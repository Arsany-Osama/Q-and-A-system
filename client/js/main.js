import { initAuth, isLoggedIn } from './auth.js';
import { initUI, showSection, showPopup } from './ui.js';
import { setupQuestionForm } from './question.js';
import { setupAnswerForm } from './answer.js';
import { renderProfile } from './profile.js';
import { initAnimations } from './animations.js';
import { initSearch } from './search.js';
import { setupVoting } from './vote.js';
import { initSidebar } from './sidebar.js';
import { renderFeed } from './feed.js';
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
  renderFeed();
  initSecurity();

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
