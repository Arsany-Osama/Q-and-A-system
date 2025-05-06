import { initAuth, isLoggedIn } from './auth.js';
import { initUI, showSection, showPopup, showToast } from './ui.js';
import { setupQuestionForm } from './question.js';
import { setupAnswerForm } from './answer.js';
import { renderProfile } from './profile.js';
import { initAnimations } from './animations.js';
import { initSearch } from './search.js';
import { setupVoting } from './vote.js';
import { initSidebar } from './sidebar.js';
import { renderFeed, setupFilterButtons } from './feed.js';
import { initSecurity } from './security.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing main.js');
  initAuth();
  initUI();
  initSidebar();
  setupQuestionForm();
  setupAnswerForm();
  initSearch();
  setupVoting();
  initAnimations();
  setupFilterButtons();
  renderFeed();
  initSecurity();
  initFacebookLikeFeedUI();

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
    // We'll use event delegation for dynamically added elements
    document.addEventListener('click', (e) => {
      // Handle share button clicks
      if (e.target.closest('.share-btn')) {
        const btn = e.target.closest('.share-btn');
        const card = btn.closest('.question-card');
        if (!card) return;

        const questionId = card.getAttribute('data-id');
        const title = card.querySelector('.card-title')?.textContent || 'Question';
        
        // Create a share URL
        const shareUrl = `${window.location.origin}${window.location.pathname}?q=${questionId}`;
        
        // If Web Share API is available
        if (navigator.share) {
          navigator.share({
            title: title,
            text: `Check out this question: ${title}`,
            url: shareUrl
          }).catch(console.error);
        } else {
          // Fallback: copy to clipboard
          navigator.clipboard.writeText(shareUrl).then(() => {
            showToast('success', 'Link copied to clipboard');
          }).catch(() => {
            prompt('Copy this link:', shareUrl);
          });
        }
      }
      
      // Handle answer counter button clicks to toggle answers visibility
      if (e.target.closest('.answers-counter')) {
        const btn = e.target.closest('.answers-counter');
        const card = btn.closest('.question-card');
        if (!card) return;
        
        const toggleBtn = card.querySelector('.toggle-answers');
        if (toggleBtn) {
          toggleBtn.click(); // Trigger the toggle answers button
        }
      }
      
      // Handle dropdown toggles
      if (e.target.closest('.dropdown-toggle')) {
        e.stopPropagation();
        const button = e.target.closest('.dropdown-toggle');
        const menu = button.nextElementSibling;
        
        // Close all other dropdowns first
        document.querySelectorAll('.dropdown-menu').forEach(m => {
          if (m !== menu) m.classList.add('hidden');
        });
        
        // Toggle current dropdown
        menu.classList.toggle('hidden');
      }
      
      // Handle reply button clicks
      if (e.target.closest('.reply-btn')) {
        const button = e.target.closest('.reply-btn');
        const questionId = button.closest('.question-card')?.getAttribute('data-id');
        const answerCard = button.closest('.answer-card');
        
        if (!isLoggedIn()) {
          showPopup('login');
          return;
        }
        
        if (questionId && answerCard) {
          // Focus on the quick reply input for this answer
          const quickInput = answerCard.closest('.answers-section').querySelector('.quick-answer-input');
          if (quickInput) {
            quickInput.focus();
            quickInput.setAttribute('placeholder', 'Write a reply...');
          }
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
    
    // Monitor for new question cards and apply observer
    const questionFeed = document.getElementById('questionFeed');
    if (questionFeed) {
      // Create a MutationObserver to watch for new cards
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
      
      // Start observing the feed for new cards
      observer.observe(questionFeed, { childList: true, subtree: false });
      
      // Also setup lazy loading for existing cards
      questionFeed.querySelectorAll('.question-card').forEach(card => {
        setupLazyLoadingForCard(card);
      });
    }
  }
  
  // Setup lazy loading effect for a single card
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

  // Navigation Event Listeners
  document.getElementById('postQuestionBtn')?.addEventListener('click', () => {
    console.log('Post Question button clicked');
    if (!isLoggedIn()) {
      showPopup('login');
    } else {
      showSection('questionForm');
      closeSidebar();
    }
  });

  document.getElementById('answerQuestionBtn')?.addEventListener('click', () => {
    console.log('Answer Question button clicked');
    if (!isLoggedIn()) {
      showPopup('login');
    } else {
      showSection('answerForm');
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
      showSection('questionForm');
      closeSidebar();
    }
  });

  document.getElementById('answerQuestionNav')?.addEventListener('click', () => {
    console.log('Answer Question nav clicked');
    if (!isLoggedIn()) {
      showPopup('login');
    } else {
      showSection('answerForm');
      closeSidebar();
    }
  });
});
