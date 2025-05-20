import { isLoggedIn, logout, forgotPassword, getUserRole, getUserState, isAdmin, isModerator, isApproved, getToken } from './auth.js';
import { validatePassword } from './security.js';
import { fetchQuestions } from './question.js';

export function initUI() {
  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  if (themeToggle) {
    updateThemeIcon(savedTheme === 'dark');
    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      updateThemeIcon(isDark);
    });
  }

  document.getElementById('closePopupBtn')?.addEventListener('click', hidePopup);
  document.getElementById('loginTab')?.addEventListener('click', () => showPopup('login'));
  document.getElementById('registerTab')?.addEventListener('click', () => showPopup('register'));
  
  document.getElementById('closeTwoFactorPopupBtn')?.addEventListener('click', hideTwoFactorPopup);
  document.getElementById('closeSecurityQuestionsPopupBtn')?.addEventListener('click', hideSecurityQuestionsPopup);
  document.getElementById('closeForgotPasswordPopupBtn')?.addEventListener('click', hideForgotPasswordPopup);
  
  document.getElementById('forgotPasswordBtn')?.addEventListener('click', () => {
    hidePopup();
    showForgotPasswordPopup();
  });

  renderUserUI();

  setupFocusTrap('authPopup');
  setupFocusTrap('twoFactorPopup');
  setupFocusTrap('securityQuestionsPopup');
  setupFocusTrap('forgotPasswordPopup');
  setupFocusTrap('questionFormPopup');
  setupFocusTrap('answerFormPopup');
}

function updateThemeIcon(isDark) {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;
  themeToggle.innerHTML = isDark
    ? `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`
    : `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>`;
}

export function showPopup(action) {
  const popup = document.getElementById('authPopup');
  const authTitle = document.getElementById('authTitle');
  const usernameField = document.getElementById('usernameField');
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  const usernameInput = document.getElementById('username');
  const passwordRequirements = document.getElementById('passwordRequirements');
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');

  popup.classList.remove('hidden');
  authTitle.textContent = action === 'register' ? 'Register' : 'Login';
  usernameField.classList.toggle('hidden', action !== 'register');
  loginTab.classList.toggle('bg-primary', action === 'login');
  loginTab.classList.toggle('text-white', action === 'login');
  registerTab.classList.toggle('bg-primary', action === 'register');
  registerTab.classList.toggle('text-white', action === 'register');
  
  if (passwordRequirements) {
    passwordRequirements.classList.toggle('hidden', action !== 'register');
  }
  
  forgotPasswordLink.classList.toggle('hidden', action !== 'login');
  
  if (action === 'register') {
    usernameInput.setAttribute('required', 'true');
  } else {
    usernameInput.removeAttribute('required');
  }

  document.getElementById('authForm').reset();
  document.getElementById(action === 'register' ? 'username' : 'email').focus();
}

export function hidePopup() {
  const popup = document.getElementById('authPopup');
  if (popup.classList.contains('hidden')) return;
  popup.classList.add('hidden');
  document.getElementById('authMessage').textContent = '';
  document.getElementById('authForm').reset();
}

export function showSection(sectionId) {
  document.querySelectorAll('main > section').forEach(section => {
    section.classList.add('hidden');
  });
  const section = document.getElementById(sectionId);
  section.classList.remove('hidden');

  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById(`${sectionId.replace('Section', '')}Nav`)?.classList.add('active');
  
  // Track the current section in session storage for state management
  sessionStorage.setItem('currentSection', sectionId);
}

export function showToast(type, message) {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      ${type === 'success' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />' : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />'}
    </svg>
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export function renderUserUI() {
  const userStatus = document.getElementById('userStatus');
  if (isLoggedIn()) {
    console.log('Rendering user UI - localStorage state:', {
      username: localStorage.getItem('username'),
      role: localStorage.getItem('role'),
      state: localStorage.getItem('state')
    });
    const username = decodeURIComponent(localStorage.getItem('username') || 'User');
    const role = decodeURIComponent(localStorage.getItem('role') || 'unauthorized');
    const state = decodeURIComponent(localStorage.getItem('state') || 'unauthenticated');
    console.log('Final values:', { username, role, state });

    userStatus.innerHTML = `
      <div class="flex items-center">
        <span class="text-gray-700 dark:text-gray-300 truncate max-w-[150px] sm:max-w-[200px]">${username}</span>
        <span class="ml-2 px-2 py-1 text-xs rounded ${role === 'ADMIN' ? 'bg-red-100 text-red-800' : role === 'MODERATOR' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-800 text-white-800 fw-bolder'} ">
          ${role}
        </span>
        ${state !== 'APPROVED' ? `<span class="ml-2 px-2 py-1 text-xs rounded bg-gray-100 text-gray-800 dark:bg-opacity-20">${state}</span>` : ''}
        <div class="relative ml-2">
          <button id="userMenuBtn" class="rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 p-1">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div id="userMenu" class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 hidden">
            ${isAdmin() ? `
              <a href="/admin.html" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                Admin Dashboard
              </a>
            ` : ''}
            <button id="securitySettingsBtn" class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
              Security Settings
            </button>
            <button id="twoFactorAuthBtn" class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
              Two-Factor Auth
            </button>
            <button id="logoutBtn" class="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700">
              Logout
            </button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('userMenuBtn').addEventListener('click', toggleUserMenu);
    document.getElementById('twoFactorAuthBtn').addEventListener('click', async () => {
      toggleUserMenu();
      await showTwoFactorPopup();
    });

    document.addEventListener('click', (e) => {
      const userMenu = document.getElementById('userMenu');
      const userMenuBtn = document.getElementById('userMenuBtn');
      if (userMenu && !userMenu.classList.contains('hidden') && !userMenuBtn.contains(e.target) && !userMenu.contains(e.target)) {
        userMenu.classList.add('hidden');
      }
    });
  } else {
    userStatus.innerHTML = `
      <button id="loginBtn" class="btn btn-primary">Login</button>
      <button id="registerBtn" class="btn btn-secondary">Register</button>
    `;
    document.getElementById('loginBtn').addEventListener('click', () => showPopup('login'));
    document.getElementById('registerBtn').addEventListener('click', () => showPopup('register'));
  }
}

function toggleUserMenu() {
  const userMenu = document.getElementById('userMenu');
  userMenu.classList.toggle('hidden');
}

export async function showTwoFactorPopup() {
  const popup = document.getElementById('twoFactorPopup');
  popup.classList.remove('hidden');
  
  // Hide all steps first
  document.getElementById('twoFactorSetupStep').classList.add('hidden');
  document.getElementById('twoFactorQRStep').classList.add('hidden');
  document.getElementById('twoFactorDisableStep').classList.add('hidden');
  
  try {
    // Check 2FA status
    const response = await fetch('/auth/2fa/status', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    const result = await response.json();

    if (result.success) {
      if (result.isEnabled) {
        // Show disable step if 2FA is enabled
        document.getElementById('twoFactorDisableStep').classList.remove('hidden');
      } else {
        // Show setup step if 2FA is disabled
        document.getElementById('twoFactorSetupStep').classList.remove('hidden');
      }
    } else {
      showToast('error', 'Failed to check 2FA status');
    }
  } catch (error) {
    showToast('error', 'Network error occurred');
    console.error('Error checking 2FA status:', error);
  }
}

export function hideTwoFactorPopup() {
  const popup = document.getElementById('twoFactorPopup');
  if (popup.classList.contains('hidden')) return;
  popup.classList.add('hidden');
}

export function hideSecurityQuestionsPopup() {
  const popup = document.getElementById('securityQuestionsPopup');
  if (popup.classList.contains('hidden')) return;
  popup.classList.add('hidden');
}

export function showForgotPasswordPopup() {
  const popup = document.getElementById('forgotPasswordPopup');
  const forgotPasswordStep = document.getElementById('forgotPasswordStep');
  const otpVerificationStep = document.getElementById('otpVerificationStep');
  const securityQuestionsStep = document.getElementById('securityQuestionsStep');
  const resetPasswordStep = document.getElementById('resetPasswordStep');
  const forgotStep1Indicator = document.getElementById('forgotStep1Indicator');
  const forgotStep2Indicator = document.getElementById('forgotStep2Indicator');
  const forgotStep3Indicator = document.getElementById('forgotStep3Indicator');
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');

  if (popup) popup.classList.remove('hidden');

  if (forgotPasswordStep) forgotPasswordStep.classList.remove('hidden');
  if (otpVerificationStep) otpVerificationStep.classList.add('hidden');
  if (securityQuestionsStep) securityQuestionsStep.classList.add('hidden');
  if (resetPasswordStep) resetPasswordStep.classList.add('hidden');

  if (forgotStep1Indicator) {
    forgotStep1Indicator.classList.remove('bg-gray-300', 'dark:bg-gray-600');
    forgotStep1Indicator.classList.add('bg-primary');
  }
  if (forgotStep2Indicator) {
    forgotStep2Indicator.classList.remove('bg-primary');
    forgotStep2Indicator.classList.add('bg-gray-300', 'dark:bg-gray-600');
  }
  if (forgotStep3Indicator) {
    forgotStep3Indicator.classList.remove('bg-primary');
    forgotStep3Indicator.classList.add('bg-gray-300', 'dark:bg-gray-600');
  }

  if (forgotPasswordForm) {
    forgotPasswordForm.reset();
    document.getElementById('forgotEmail')?.focus();
  }
}

export function hideForgotPasswordPopup() {
  const popup = document.getElementById('forgotPasswordPopup');
  if (popup.classList.contains('hidden')) return;
  popup.classList.add('hidden');
}

function setupFocusTrap(popupId) {
  const popup = document.getElementById(popupId);
  if (!popup) return;
  
  const focusableElements = popup.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  popup.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  });
}

export function showQuestionFormPopup() {
  const popup = document.getElementById('questionFormPopup');
  popup.classList.remove('hidden');
  
  // Do not call showSection here as it hides all other sections
  // Just ensure the form is ready for input
  
  document.getElementById('questionTitle').focus();
  document.getElementById('postQuestionForm').reset();
}

export function hideQuestionFormPopup() {
  const popup = document.getElementById('questionFormPopup');
  if (popup.classList.contains('hidden')) return;
  popup.classList.add('hidden');
  document.getElementById('postQuestionForm').reset();
  
  // Ensure the feed section stays visible
  const feedSection = document.getElementById('feedSection');
  if (feedSection) {
    feedSection.classList.remove('hidden');
  }
}

export function showAnswerFormPopup(questionId = null) {
  const popup = document.getElementById('answerFormPopup');
  popup.classList.remove('hidden');
  
  // Do not call showSection here as it hides all other sections
  // Just handle the popup independently
  
  if (questionId) {
    fetchQuestions().then(questions => {
      const question = questions.find(q => q.id == questionId);
      if (question) {
        document.getElementById('questionSearch').value = question.title;
        document.getElementById('questionSelect').value = questionId;
        document.getElementById('questionSelect').setAttribute('required', 'true');
      }
    });
  }
  
  document.getElementById('questionSearch').focus();
  document.getElementById('postAnswerForm').reset();
}

export function hideAnswerFormPopup() {
  const popup = document.getElementById('answerFormPopup');
  if (popup.classList.contains('hidden')) return;
  popup.classList.add('hidden');
  document.getElementById('postAnswerForm').reset();
  
  // Ensure the feed section stays visible
  const feedSection = document.getElementById('feedSection');
  if (feedSection) {
    feedSection.classList.remove('hidden');
  }
}
