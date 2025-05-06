import { isLoggedIn, logout } from './auth.js';
import { validatePassword } from './security.js';

export function initUI() {
  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  updateThemeIcon(savedTheme === 'dark');

  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
  });

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
}

function updateThemeIcon(isDark) {
  const themeToggle = document.getElementById('themeToggle');
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
  passwordRequirements.classList.toggle('hidden', action !== 'register');
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
}

export function showToast(type, message) {
  const toastContainer = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
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
    const username = localStorage.getItem('username') || 'User';
    userStatus.innerHTML = `
      <div class="flex items-center">
        <span class="text-gray-700 dark:text-gray-300 truncate max-w-[150px] sm:max-w-[200px]">${username}</span>
        <div class="relative ml-2">
          <button id="userMenuBtn" class="rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 p-1">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div id="userMenu" class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 hidden">
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
    document.getElementById('twoFactorAuthBtn').addEventListener('click', () => {
      toggleUserMenu();
      showTwoFactorPopup();
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

export function showTwoFactorPopup(hasTwoFactor = false) {
  const popup = document.getElementById('twoFactorPopup');
  popup.classList.remove('hidden');
  
  document.getElementById('twoFactorSetupStep').classList.add('hidden');
  document.getElementById('twoFactorQRStep').classList.add('hidden');
  document.getElementById('twoFactorDisableStep').classList.add('hidden');
  
  if (hasTwoFactor) {
    document.getElementById('twoFactorDisableStep').classList.remove('hidden');
  } else {
    document.getElementById('twoFactorSetupStep').classList.remove('hidden');
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
  popup.classList.remove('hidden');
  
  document.getElementById('forgotPasswordStep').classList.remove('hidden');
  document.getElementById('securityQuestionsStep').classList.add('hidden');
  document.getElementById('resetPasswordStep').classList.add('hidden');
  
  document.getElementById('forgotStep1Indicator').classList.remove('bg-gray-300', 'dark:bg-gray-600');
  document.getElementById('forgotStep1Indicator').classList.add('bg-primary');
  document.getElementById('forgotStep2Indicator').classList.remove('bg-primary');
  document.getElementById('forgotStep2Indicator').classList.add('bg-gray-300', 'dark:bg-gray-600');
  document.getElementById('forgotStep3Indicator').classList.remove('bg-primary');
  document.getElementById('forgotStep3Indicator').classList.add('bg-gray-300', 'dark:bg-gray-600');
  
  document.getElementById('forgotPasswordForm').reset();
  document.getElementById('forgotEmail').focus();
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
