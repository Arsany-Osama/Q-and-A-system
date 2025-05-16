import { initAuth, isLoggedIn, isAdmin } from './auth.js';
import { initUI, showSection, showPopup, showToast, hidePopup, showQuestionFormPopup, showAnswerFormPopup, hideQuestionFormPopup, hideAnswerFormPopup } from './ui.js';
import { setupQuestionForm } from './question.js';
import { setupAnswerForm } from './answer.js';
import { renderProfile } from './profile.js';
import { initAnimations } from './animations.js';
import { initSearch } from './search.js';
import { setupVoting } from './vote.js';
import { initSidebar } from './sidebar.js';
import { renderFeed, setupFilterButtons } from './feed.js';
import { initSecurity } from './security.js';
import { fetchAndRenderPopularTags } from './tags.js';
import './fileUpload.js'; // Import file upload module
import { initProfileChanges } from './passwordChange.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing main.js');
  initAuth();
  initUI();
  initSidebar();
  setupQuestionForm();
  setupAnswerForm();
  initSearch();
  setupVoting(); // Call once here
  initAnimations();
  setupFilterButtons();
  renderFeed();
  fetchAndRenderPopularTags(); // Fetch and render popular tags
  initSecurity();
  initFacebookLikeFeedUI();
  setupAdminNav();

  // Function to close the sidebar
  const sidebar = document.getElementById('sidebar');
  const toggleIcon = document.getElementById('sidebarToggleIcon');
  function closeSidebar() {
    if (sidebar && toggleIcon) {
      gsap.to(sidebar, {
        x: '-100%',
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => {
          sidebar.classList.add('-translate-x-full');
        },
      });
      toggleIcon.innerHTML = `
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      `;
      document.getElementById('sidebarToggle').setAttribute('aria-expanded', 'false');
    }
  }

  // Initialize Facebook-like UI enhancements
  function initFacebookLikeFeedUI() {
    // Apply transition effects
    const feedContainer = document.getElementById('questionFeed');
    if (feedContainer) {
      feedContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    }

    // Add scroll-to-top button
    const scrollToTop = document.createElement('button');
    scrollToTop.className = 'scroll-to-top fixed bottom-6 right-6 z-10 p-3 rounded-full bg-primary text-white shadow-lg transform transition-transform hover:scale-110 opacity-0 pointer-events-none';
    scrollToTop.setAttribute('aria-label', 'Scroll to top');
    scrollToTop.innerHTML = `
      <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    `;
    document.body.appendChild(scrollToTop);

    // Show/hide scroll-to-top button based on scroll position
    window.addEventListener('scroll', () => {
      if (window.pageYOffset > 300) {
        scrollToTop.classList.add('opacity-100');
        scrollToTop.classList.remove('opacity-0', 'pointer-events-none');
      } else {
        scrollToTop.classList.remove('opacity-100');
        scrollToTop.classList.add('opacity-0', 'pointer-events-none');
      }
    });

    // Scroll to top when button is clicked
    scrollToTop.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });

    // Setup dynamic event listeners for elements that may be added after initial load
    setupDynamicEventListeners();
  }

  // Setup event listeners for dynamically added elements
  function setupDynamicEventListeners() {
    // Use event delegation, excluding .reaction-btn
    document.addEventListener('click', (e) => {
      // Handle share button clicks
      if (e.target.closest('.share-btn') && !e.target.closest('.reaction-btn')) {
        const btn = e.target.closest('.share-btn');
        const card = btn.closest('.question-card');
        if (!card) return;

        const questionId = card.getAttribute('data-id');
        const title = card.querySelector('.card-title')?.textContent || 'Question';
        
        const shareUrl = `${window.location.origin}${window.location.pathname}?q=${questionId}`;
        
        if (navigator.share) {
          navigator.share({
            title: title,
            text: `Check out this question: ${title}`,
            url: shareUrl
          }).catch(console.error);
        } else {
          navigator.clipboard.writeText(shareUrl).then(() => {
            showToast('success', 'Link copied to clipboard');
          }).catch(() => {
            prompt('Copy this link:', shareUrl);
          });
        }
      }
      
      // Handle answer counter button clicks to toggle answers visibility
      if (e.target.closest('.answers-counter') && !e.target.closest('.reaction-btn')) {
        const btn = e.target.closest('.answers-counter');
        const card = btn.closest('.question-card');
        if (!card) return;
        
        const toggleBtn = card.querySelector('.toggle-answers');
        if (toggleBtn) {
          toggleBtn.click();
        }
      }
      
      // Handle dropdown toggles
      if (e.target.closest('.dropdown-toggle') && !e.target.closest('.reaction-btn')) {
        e.stopPropagation();
        const button = e.target.closest('.dropdown-toggle');
        const menu = button.nextElementSibling;
        
        document.querySelectorAll('.dropdown-menu').forEach(m => {
          if (m !== menu) m.classList.add('hidden');
        });
        
        menu.classList.toggle('hidden');
      }
      
      // Handle reply button clicks
      if (e.target.closest('.reply-btn') && !e.target.closest('.reaction-btn')) {
        const button = e.target.closest('.reply-btn');
        const answerId = button.getAttribute('data-answer-id');
        const answerCard = button.closest('.answer-card');
        
        if (!isLoggedIn()) {
          showPopup('login');
          return;
        }
        
        if (answerCard) {
          const answerUsername = answerCard.getAttribute('data-username');
          const answerUserId = answerCard.getAttribute('data-user-id');
          showReplyForm(button, answerId, answerUsername, answerUserId);
        }
      }
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.add('hidden');
      });
    });
    
    // Setup sidebar ask question button
    document.getElementById('sidebarAskQuestion')?.addEventListener('click', () => {
      if (!isLoggedIn()) {
        showPopup('login');
        return;
      }
      showSection('questionForm');
    });
    
    const questionFeed = document.getElementById('questionFeed');
    if (questionFeed) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === 1 && node.classList?.contains('question-card')) {
                setupLazyLoadingForCard(node);
              }
            });
          }
        });
      });
      
      observer.observe(questionFeed, { childList: true, subtree: false });
      
      questionFeed.querySelectorAll('.question-card').forEach(card => {
        setupLazyLoadingForCard(card);
      });
    }
  }
  
  function setupLazyLoadingForCard(card) {
    const intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in');
          intersectionObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    
    intersectionObserver.observe(card);
  }

  // Function to setup admin navigation
  function setupAdminNav() {
    const adminDashboardNav = document.getElementById('adminDashboardNav');
    if (adminDashboardNav) {
      // Show admin nav only for admin users
      if (isAdmin()) {
        adminDashboardNav.classList.remove('hidden');
      } else {
        adminDashboardNav.classList.add('hidden');
      }

      // Add click handler for admin dashboard
      adminDashboardNav.addEventListener('click', () => {
        if (!isAdmin()) {
          showToast('error', 'Access denied: Admin privileges required');
          return;
        }
        window.location.href = '/admin.html';
        closeSidebar();
      });
    }
  }

  document.getElementById('postQuestionBtn')?.addEventListener('click', () => {
    console.log('Post Question button clicked');
    if (!isLoggedIn()) {
      showPopup('login');
    } else {
      showQuestionFormPopup();
      closeSidebar();
    }
  });

  document.getElementById('answerQuestionBtn')?.addEventListener('click', () => {
    console.log('Answer Question button clicked');
    if (!isLoggedIn()) {
      showPopup('login');
    } else {
      showAnswerFormPopup();
      closeSidebar();
    }
  });

  document.getElementById('feedNav')?.addEventListener('click', () => {
    console.log('Feed nav clicked');
    showSection('feedSection');
    renderFeed();
    closeSidebar();
  });

  document.getElementById('profileNav')?.addEventListener('click', async () => {
    console.log('Profile nav clicked');
    showSection('profileSection');
    await renderProfile();
    closeSidebar();
  });

  document.getElementById('postQuestionNav')?.addEventListener('click', () => {
    console.log('Post Question nav clicked');
    if (!isLoggedIn()) {
      showPopup('login');
    } else {
      showQuestionFormPopup();
      closeSidebar();
    }
  });

  document.getElementById('answerQuestionNav')?.addEventListener('click', () => {
    console.log('Answer Question nav clicked');
    if (!isLoggedIn()) {
      showPopup('login');
    } else {
      showAnswerFormPopup();
      closeSidebar();
    }
  });

  // Setup popup close buttons
  document.getElementById('closeQuestionFormBtn')?.addEventListener('click', hideQuestionFormPopup);
  document.getElementById('closeAnswerFormBtn')?.addEventListener('click', hideAnswerFormPopup);

  // This function gets called when profile section is loaded
  function loadProfileSection() {
    // Your existing profile section initialization code
    
    // Initialize both password and username change functionality
    initProfileChanges();
  }

  // Find where you show the profile section and call loadProfileSection
  const profileNav = document.getElementById('profileNav');
  if (profileNav) {
    const originalClickHandler = profileNav.onclick;
    
    profileNav.onclick = function(e) {
      // Call the original handler if it exists
      if (originalClickHandler) {
        originalClickHandler.call(this, e);
      }
      
      // Then initialize our password change functionality
      setTimeout(loadProfileSection, 100); // Small delay to ensure DOM is updated
    };
  }
});
