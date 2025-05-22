import { showToast, hidePopup, renderUserUI, showSection } from './ui.js';
import { validatePassword, updatePasswordRequirements } from './security.js';
import { auth as authApi, fetchWithAuth } from './utils/api.js';  
import { preloadUserStats } from './profile.js';

const pendingUsers = new Map();

export function isLoggedIn() {
  return !!localStorage.getItem('token');
}

export function getToken() {
  return localStorage.getItem('token') || '';
}

export function getUserRole() {
  const role = localStorage.getItem('role');
  return role && role !== 'undefined' && role !== 'null' ? role : 'USER';
}

export function getUserState() {
  const state = localStorage.getItem('state');
  return state && state !== 'undefined' && state !== 'null' ? state : 'APPROVED';
}

export function isAdmin() {
  return getUserRole() === 'ADMIN';
}

export function isModerator() {
  return getUserRole() === 'MODERATOR' && getUserState() === 'APPROVED';
}

export function isApproved() {
  return getUserState() === 'APPROVED';
}

/**
 * Verify if the current auth token is still valid
 * @returns {Promise<boolean>} - Promise resolving to true if token is valid
 */
export async function verifyAuthToken() {
  if (!isLoggedIn()) return false;
  
  try {
    // Call getUserStats as a lightweight way to verify token validity
    const response = await authApi.getUserStats();
    return response.success === true;
  } catch (error) {
    console.error('Token verification error:', error);
    // If we get an invalid token error, clear auth data
    if (error.message && (
      error.message.includes('Invalid token') || 
      error.message.includes('jwt expired') ||
      error.message.includes('Unauthorized')
    )) {
      // Handle expired token by logging out the user
      handleTokenExpiration();
    }
    return false;
  }
}

/**
 * Handle expired JWT token by logging out the user and redirecting
 * @export
 */
export function handleTokenExpiration() {
  console.log('Token expired, performing automatic logout');
  
  // Clear verification interval if it exists
  if (window.tokenVerificationInterval) {
    clearInterval(window.tokenVerificationInterval);
    window.tokenVerificationInterval = null;
  }
  
  // Clear all auth-related data
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('role');
  localStorage.removeItem('state');
  localStorage.removeItem('has2fa');
  localStorage.removeItem('tempToken');
  localStorage.removeItem('tempUsername');
  sessionStorage.removeItem('currentSection');
  
  // Update the UI to show login/register buttons
  renderUserUI();
  
  // Show a message to the user
  showToast('error', 'Your session has expired. Please log in again.');
  
  // Redirect to homepage only if not already there
  if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
    window.location.href = '/';
  }
}

/**
 * Set up automatic token verification to run periodically
 * This checks if the token is still valid every few minutes
 */
export function setupAutoTokenVerification() {
  // Only set up verification if user is logged in
  if (!isLoggedIn()) return;
  
  console.log('Setting up automatic token verification');
  
  // Check token validity every 5 minutes
  const intervalMinutes = 5;
  const interval = setInterval(async () => {
    console.log('Performing automatic token verification');
    const isValid = await verifyAuthToken();
    
    // If token is invalid, the verifyAuthToken function will handle the cleanup
    if (!isValid) {
      console.log('Token verification failed, clearing interval');
      clearInterval(interval);
    }
  }, intervalMinutes * 60 * 1000);
  
  // Store interval ID in case we need to clear it later
  window.tokenVerificationInterval = interval;
  
  // Also verify immediately on page load
  verifyAuthToken();
}

// Automatically check token validity on page load
document.addEventListener('DOMContentLoaded', () => {
  if (isLoggedIn()) {
    // Verify the token on page load
    verifyAuthToken();
    // Set up automatic verification for future checks
    setupAutoTokenVerification();
  }
});

export async function fetchTopContributors() {
  try {
    const data = await authApi.getTopContributors();
    return data.contributors;
  } catch (error) {
    console.error('Network error when fetching top contributors:', error);
    return [];
  }
}

/**
 * Log out the current user, reset all permissions and redirect to homepage
 * This function will:
 * 1. Clear all authentication data from localStorage
 * 2. Send a logout request to the server if a token exists
 * 3. Reset the UI to show login/register buttons
 * 4. Redirect to the homepage
 */
export function logout() {
  console.log('Logging out');
  const token = getToken();
  
  // Clear verification interval if it exists
  if (window.tokenVerificationInterval) {
    clearInterval(window.tokenVerificationInterval);
    window.tokenVerificationInterval = null;
  }
    // First clear all auth data from localStorage regardless of token state
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('role');
  localStorage.removeItem('state');
  localStorage.removeItem('has2fa');
  localStorage.removeItem('tempToken');
  localStorage.removeItem('tempUsername');
  
  // Check current page to handle special redirects
  const currentPage = window.location.pathname;
  const isReportsPage = currentPage === '/reports.html';
  
  if (!token) {
    showToast('success', 'Logged out successfully');
    renderUserUI();
    // Redirect to homepage
    window.location.href = '/';
    return;
  }

  authApi.logout()
    .then(result => {
      if (result.success) {
        showToast('success', 'Logged out successfully');
      } else {
        showToast('error', result.message || 'Logout failed');
      }
    })
    .catch(() => {
      showToast('success', 'Logged out successfully');
    })
    .finally(() => {
      // Clear session data
      sessionStorage.removeItem('currentSection');
      
      // Update UI to show login/register buttons
      renderUserUI();
        // Always redirect to the homepage when logged out from a restricted page
      // This ensures users are sent back to the index page if they don't have permission
      window.location.href = '/';
    });
}

export function initAuth() {
  // Set up automatic token verification for logged-in users
  setupAutoTokenVerification();
  
  const form = document.getElementById('authForm');
  if (!form) {
    console.error('Auth form not found');
    return;
  }

  const passwordInput = document.getElementById('password');
  const passwordRequirements = document.getElementById('passwordRequirements');
  const authPasswordRequirements = document.getElementById('authPasswordRequirements');
  if (passwordRequirements) passwordRequirements.classList.add('hidden');
  if (authPasswordRequirements) authPasswordRequirements.classList.add('hidden');

  const updateFormForAction = () => {
    const action = document.getElementById('authTitle').textContent.toLowerCase();
    if (passwordRequirements) {
      if (action === 'register') {
        passwordRequirements.classList.remove('hidden');
        updatePasswordRequirements(passwordInput.value);
      } else {
        passwordRequirements.classList.add('hidden');
      }
    }
    if (authPasswordRequirements) {
      if (action === 'register') {
        authPasswordRequirements.classList.remove('hidden');
        updatePasswordRequirements(passwordInput.value);
      } else {
        authPasswordRequirements.classList.add('hidden');
      }
    }
  };

  updateFormForAction();

  const authTabs = document.querySelectorAll('#loginTab, #registerTab');
  if (authTabs) {
    authTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        setTimeout(() => {
          updateFormForAction();
          // Always hide password requirements when switching to login
          const action = document.getElementById('authTitle').textContent.toLowerCase();
          if (action === 'login') {
            if (authPasswordRequirements) authPasswordRequirements.classList.add('hidden');
            if (passwordRequirements) passwordRequirements.classList.add('hidden');
          }
        }, 50);
      });
    });
  }

  passwordInput.addEventListener('input', () => {
    const action = document.getElementById('authTitle').textContent.toLowerCase();
    if (action === 'register') {
      if (passwordRequirements) {
        passwordRequirements.classList.remove('hidden');
        updatePasswordRequirements(passwordInput.value);
      }
      if (authPasswordRequirements) {
        authPasswordRequirements.classList.remove('hidden');
        updatePasswordRequirements(passwordInput.value);
      }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Auth form submitted');
    const action = document.getElementById('authTitle').textContent.toLowerCase();
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const submitBtn = document.getElementById('authSubmitBtn');
    const spinner = document.getElementById('authSpinner');

    if (action === 'register') {
      const validation = validatePassword(password);
      if (!validation.valid) {
        showToast('error', validation.errors[0]);
        return;
      }
    }

    submitBtn.disabled = true;
    spinner.classList.remove('hidden');

    try {
      if (action === 'register') {
        const result = await handleRegister(username, email, password);
        if (result.success) {
          pendingUsers.set(email, { username, email, password });
          showOTPForm(email, 'registration');
          showToast('success', 'Please check your email for the OTP to complete registration.');
        } else {
          showToast('error', result.message || 'Registration failed');
        }
      } else {
        const result = await handleAuth(action, username, email, password);
        if (result.success) {

          if (result.requires2FA) {
            handleTwoFactorAuth(result);
          } else {
            hidePopup();
            localStorage.setItem('token', result.token);
            localStorage.setItem('username', result.username);
            localStorage.setItem('role', result.role);
            localStorage.setItem('state', result.state);
            if (result.has2fa) localStorage.setItem('has2fa', 'true');
            renderUserUI();
            
            // Preload profile data in background but don't redirect
            preloadUserStats();
          }
        } else {
          showToast('error', result.message || 'Authentication failed');
        }
      }
    } catch (err) {
      showToast('error', 'Network error');
    } finally {
      submitBtn.disabled = false;
      spinner.classList.add('hidden');
    }
  });

  // Google Login Button and Callback
  const googleLoginBtn = document.getElementById('googleLoginBtn');
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
      console.log('Google login button clicked');
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open('/auth/google', 'Google Login', `width=${width},height=${height},left=${left},top=${top}`);
    });

    window.addEventListener('message', (event) => {
      console.log('Received message event:', event.data);

      if (event.data.type === 'google-auth') {
        const requires2FA = event.data.has2fa === true || event.data.has2fa === 'true' || event.data.requires2FA;

        if (requires2FA) {
          handleTwoFactorAuth(event.data);
        } else {
          finishLogin(event.data);
        }
      }
    });
  }

  // Handle Auth0 login
  document.getElementById('auth0LoginBtn')?.addEventListener('click', () => {
    const width = 600;
    const height = 600;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;

    const authWindow = window.open(
      '/auth/auth0',
      'Auth0',
      `width=${width},height=${height},left=${left},top=${top}`
    );    window.addEventListener('message', (event) => {
      if (event.data.type === 'auth0-auth') {
        authWindow.close();
        if (event.data.success) {
          const requires2FA = event.data.has2fa === true || event.data.has2fa === 'true' || event.data.requires2FA;

          if (requires2FA) {
            handleTwoFactorAuth(event.data);
          } else {
            localStorage.setItem('token', event.data.token);
            localStorage.setItem('username', event.data.username);
            localStorage.setItem('role', event.data.role);
            localStorage.setItem('state', event.data.state);
            if (event.data.has2fa) localStorage.setItem('has2fa', 'true');
            hidePopup();
            renderUserUI();
            // Preload profile data in background
            preloadUserStats();
            showToast('success', 'Logged in successfully with Auth0');
          }
        } else {
          showToast('error', 'Auth0 login failed');
        }
      }
    });
  });

  // Password toggle
  const togglePassword = document.getElementById('togglePassword');
  if (togglePassword) {
    togglePassword.addEventListener('click', () => {
      console.log('Toggle password visibility');
      const passwordInput = document.getElementById('password');
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      togglePassword.querySelector('svg').innerHTML = isPassword
        ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.97 9.97 0 01-1.563-3.029" />`
        : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243" />`;
    });
  }

  // Initialize forgot password OTP form
  initializeForgotPasswordOTPForm();
}

export function handleTwoFactorAuth(result) {
  // تخزين البيانات المؤقتة في localStorage
  if (result.token) {
    localStorage.setItem('tempToken', result.token);
  }
  if (result.username) {
    localStorage.setItem('tempUsername', result.username);
  }

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full relative">
      <button type="button" id="closeModal" class="absolute top-3 right-3 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
      
      <div class="flex justify-center mb-4">
        <div class="p-3 rounded-full bg-primary bg-opacity-10 dark:bg-opacity-20">
          <svg class="w-12 h-12 text-primary dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
        </div>
      </div>
      
      <h2 class="text-xl font-bold mb-2 text-gray-800 dark:text-gray-100 text-center">Two-Factor Authentication</h2>
      <p class="mb-6 text-gray-600 dark:text-gray-300 text-center">Please enter the verification code from your authenticator app.</p>
      
      <form id="twoFactorForm" class="space-y-6">
        <div class="space-y-1">
          <input type="text" id="twoFactorCode" pattern="[0-9]{6}" maxlength="6" class="input w-full text-center text-lg font-mono tracking-widest focus:ring-2 focus:ring-primary" placeholder="000000" required>
          <p class="text-xs text-center text-gray-500 dark:text-gray-400">Enter 6-digit code from your authenticator app</p>
        </div>
        
        <button type="submit" class="btn btn-primary w-full py-3 rounded-lg transition-all group relative overflow-hidden flex items-center justify-center">
          <span class="relative z-10">Verify</span>
          <span class="absolute inset-0 bg-white bg-opacity-20 transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300"></span>
        </button>
      </form>
    </div>
  `;document.body.appendChild(modal);
  // Focus on the code input field
  setTimeout(() => document.getElementById('twoFactorCode').focus(), 100);
  
  // Add event listener to close button
  document.getElementById('closeModal').addEventListener('click', () => {
    modal.remove();
    // Clear temporary authentication data
    localStorage.removeItem('tempToken');
    localStorage.removeItem('tempUsername');
    showToast('info', 'Two-factor authentication canceled');
  });
  
  // Improve input field handling
  const twoFactorInput = document.getElementById('twoFactorCode');
  twoFactorInput.addEventListener('input', (e) => {
    // Only allow numeric input
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
    
    // Auto-submit when 6 digits are entered
    if (e.target.value.length === 6) {
      setTimeout(() => {
        document.getElementById('twoFactorForm').dispatchEvent(new Event('submit'));
      }, 500);
    }
  });
  
  // Handle Escape key to close modal
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('closeModal').click();
    }
  });

  document.getElementById('twoFactorForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('twoFactorCode').value;    try {
      const submitBtn = document.querySelector('#twoFactorForm button[type="submit"]');
      const originalBtnText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> Verifying...
      `;
    
      const token = localStorage.getItem('tempToken') || getToken();
      
      const response = await fetchWithAuth('/auth/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ token: code })
      });

      if (response.success) {
        localStorage.setItem('token', response.token || token);
        localStorage.setItem('username', response.username || localStorage.getItem('tempUsername'));
        localStorage.setItem('has2fa', 'true');
        
        localStorage.removeItem('tempToken');
        localStorage.removeItem('tempUsername');
          showToast('success', 'Two-factor authentication successful');
        modal.remove();
        hidePopup();
        renderUserUI();
        // Preload profile data in background but don't redirect or reload
        preloadUserStats();      } else {
        showToast('error', response.message || 'Invalid verification code');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    } catch (error) {
      console.error('Error verifying 2FA:', error);
      showToast('error', error.message || 'Network error occurred');
      
      const submitBtn = document.querySelector('#twoFactorForm button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText || 'Verify';
      }
    }
  });
}function finishLogin(result) {
  hidePopup();
  localStorage.setItem('token', result.token);
  localStorage.setItem('username', result.username);
  localStorage.setItem('role', result.role || 'USER');
  localStorage.setItem('state', result.state || 'APPROVED');
  if (result.has2fa) {
    localStorage.setItem('has2fa', 'true');
  }
  renderUserUI();
  
  // Preload profile data in background but don't redirect
  preloadUserStats();
  
  showToast('success', 'Logged in successfully');
}

async function handleAuth(action, username, email, password) {
  try {
    if (action === 'login') {
      return await authApi.login(email, password);
    }
    return { success: false, message: 'Invalid action' };
  } catch (error) {
    console.error('Auth error:', error);
    return { success: false, message: error.message || 'Authentication failed' };
  }
}

async function handleRegister(username, email, password) {
  try {
    return await authApi.register(username, email, password);
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, message: error.message || 'Registration failed' };
  }
}

// Updated showOTPForm to reuse initializeOTPInput
function showOTPForm(email, type) {  const popup = document.createElement('div');
  popup.id = `${type}-otp-popup`;
  popup.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  popup.innerHTML = `
    <div class="popup-content bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-md animate-scale-in relative transform transition-all">
      <div class="text-center mb-6">
        <h2 class="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">${type === 'registration' ? 'Verify Your Email' : 'Verify OTP'}</h2>
        <p class="text-gray-600 dark:text-gray-300">We've sent a verification code to <span class="font-semibold">${email}</span></p>
      </div>
      
      <div class="flex justify-center mb-6">
        <div class="p-3 rounded-full bg-primary bg-opacity-10 dark:bg-opacity-20">
          <svg class="w-16 h-16 text-primary dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
          </svg>
        </div>
      </div>
        <form id="otpForm" class="space-y-6">
        <div class="space-y-2">
          <label for="otpCode1" class="label">Verification Code</label>
          <input
            type="text"
            id="otpCode1"
            name="otpCode1"
            pattern="[0-9]{6}"
            maxlength="6"
            class="input w-full text-center text-lg font-mono tracking-widest py-3 focus:ring-2 focus:ring-primary"
            placeholder="000000"
            autocomplete="one-time-code"
            inputmode="numeric"
            required
          >
        </div>
        
        <div id="otpTimer" class="text-center text-sm text-gray-600 dark:text-gray-300">
          Code expires in <span id="otpCountdown" class="font-semibold">5:00</span>
        </div>
        
        <button type="submit" class="btn btn-primary w-full py-3 rounded-lg transition-all group relative overflow-hidden flex items-center justify-center">
          <span class="relative z-10">Verify Code</span>
          <svg class="ml-2 w-5 h-5 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
          <span class="absolute inset-0 bg-white bg-opacity-20 transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300"></span>
        </button>
      </form>
        <div class="mt-5 text-center">
        <button id="resendOtpBtn" class="text-primary hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors duration-200">
          Didn't receive the code? <span class="underline">Resend</span>
        </button>
      </div>
      
      <button id="cancelOtpBtn" class="mt-4 btn btn-secondary w-full group relative overflow-hidden flex items-center justify-center">
        <svg class="mr-2 w-5 h-5 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
        <span class="relative z-10">Cancel</span>
        <span class="absolute inset-0 bg-white bg-opacity-20 transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300"></span>
      </button>
    </div>
  `;
  document.body.appendChild(popup);

  // Focus on OTP input field
  const otpInput = document.getElementById('otpCode1');
  if (!otpInput) {
    console.error('OTP input not found');
    return;
  }
  setTimeout(() => otpInput.focus(), 100);

  // Initialize OTP input handling
  function initializeOTPInput(input) {
    if (!input) {
      console.error('Input element is null');
      return;
    }

    // Log initial input value
    console.log('Initial OTP input value:', input.value);

    // Handle input event
    input.addEventListener('input', (e) => {
      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
      e.target.value = value;
      console.log('Input event - cleaned value:', value);

      if (value.length === 6 && /^[0-9]{6}$/.test(value)) {
        e.target.classList.add('bg-green-50', 'dark:bg-green-900', 'border-green-500');
      } else {
        e.target.classList.remove('bg-green-50', 'dark:bg-green-900', 'border-green-500');
      }
    });

    // Handle paste event
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedData = (e.clipboardData || window.clipboardData).getData('text');
      const cleanedValue = pastedData.replace(/\D/g, '').slice(0, 6);
      input.value = cleanedValue;
      console.log('Paste event - cleaned value:', cleanedValue);

      if (cleanedValue.length === 6 && /^[0-9]{6}$/.test(cleanedValue)) {
        input.classList.add('bg-green-50', 'dark:bg-green-900', 'border-green-500');
      } else {
        input.classList.remove('bg-green-50', 'dark:bg-green-900', 'border-green-500');
      }
    });
  }

  initializeOTPInput(otpInput);

  // Initialize countdown timer
  let timeLeft = 300; // 5 minutes in seconds
  const countdownEl = document.getElementById('otpCountdown');
  const timerInterval = setInterval(() => {
    timeLeft--;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      countdownEl.textContent = 'Expired';
      document.getElementById('resendOtpBtn').classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }, 1000);

  // Handle OTP form submission
  const otpForm = document.getElementById('otpForm');
  if (!otpForm) {
    console.error('OTP form not found');
    return;
  }
  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = otpInput.value.trim();
    console.log('Form submission - OTP value:', otp);    // Strict validation for OTP
    if (!otp || !/^[0-9]{6}$/.test(otp)) {
      console.log('Validation failed - OTP:', otp);
      showToast('error', 'Please enter a valid 6-digit OTP');
      otpInput.value = ''; // Clear invalid input
      otpInput.classList.remove('bg-green-50', 'dark:bg-green-900', 'border-green-500', 'dark:border-green-400');
      otpInput.focus();
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg> Verifying...`;

    try {
      console.log('Submitting OTP:', { email, otp, type });
      const result = await authApi.verifyOTP(email, otp, type);
      console.log('OTP verification result:', result);

      if (result.success) {
        clearInterval(timerInterval);
        popup.remove();
        showToast('success', 'Verification successful!');
        if (type === 'registration') {
          localStorage.setItem('token', result.token);
          localStorage.setItem('username', result.username);
          localStorage.setItem('role', result.role);
          localStorage.setItem('state', result.state);
          hidePopup();
          renderUserUI();
          showSection('profileSection');
          setTimeout(() => window.location.reload(), 100);
        }
      } else {
        showToast('error', result.message || 'Invalid or expired OTP');
        otpInput.value = ''; // Clear input on error
        otpInput.classList.remove('bg-green-50', 'dark:bg-green-900', 'border-green-500');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        otpInput.focus();
      }
    } catch (err) {
      console.error('OTP verification error:', err.message, err);
      showToast('error', err.message || 'Failed to verify OTP. Please try again.');
      otpInput.value = ''; // Clear input on error
      otpInput.classList.remove('bg-green-50', 'dark:bg-green-900', 'border-green-500');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
      otpInput.focus();
    }
  });

  // Handle resend OTP
  document.getElementById('resendOtpBtn').addEventListener('click', async () => {
    const resendBtn = document.getElementById('resendOtpBtn');
    if (resendBtn.classList.contains('opacity-50')) return;

    resendBtn.classList.add('opacity-50', 'cursor-not-allowed');
    resendBtn.innerHTML = 'Sending...';

    try {
      const userData = pendingUsers.get(email);
      if (type === 'registration' && userData) {
        await authApi.register(userData.username, userData.email, userData.password);
      } else {
        await authApi.resendOTP(email, type);
      }
      showToast('success', 'A new code has been sent to your email');

      // Reset timer
      timeLeft = 300;
      countdownEl.textContent = '5:00';

      setTimeout(() => {
        resendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        resendBtn.innerHTML = `Didn't receive the code? <span class="underline">Resend</span>`;
      }, 30000);
    } catch (error) {
      console.error('Resend OTP error:', error);
      showToast('error', 'Failed to resend code. Please try again.');
      resendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      resendBtn.innerHTML = `Didn't receive the code? <span class="underline">Resend</span>`;
    }
  });

  // Handle cancel
  document.getElementById('cancelOtpBtn').addEventListener('click', () => {
    clearInterval(timerInterval);
    popup.remove();
    if (type === 'registration') {
      pendingUsers.delete(email);
    }
  });
}

// New function to initialize forgot password OTP form
function initializeForgotPasswordOTPForm() {
  const otpForm = document.getElementById('otpVerificationForm');
  const otpInput = document.getElementById('otpCode1');
  const resendBtn = document.getElementById('resendOtpBtn');

  if (!otpForm || !otpInput || !resendBtn) return;

  // Initialize OTP input handling
  initializeOTPInput(otpInput);

  // Handle form submission
  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('otpEmail').value;
    const otp = otpInput.value.trim();
    const submitBtn = otpForm.querySelector('button[type="submit"]');
    const spinner = document.getElementById('otpSpinner');
    const originalBtnText = submitBtn.innerHTML;

    // Strict validation for OTP
    if (!otp || !/^[0-9]{6}$/.test(otp)) {
      showToast('error', 'Please enter a valid 6-digit OTP');
      otpInput.value = ''; // Clear invalid input
      otpInput.classList.remove('bg-green-50', 'dark:bg-green-900', 'border-green-500');
      otpInput.focus();
      return;
    }

    submitBtn.disabled = true;
    spinner.classList.remove('hidden');

    try {
      console.log('Submitting OTP for forgot password:', { email, otp, type: 'forgot-password' });
      const result = await authApi.verifyOTP(email, otp, 'forgot-password');
      console.log('OTP verification result:', result);

      if (result.success) {
        showToast('success', 'OTP verified. Please set a new password.');
        const otpVerificationStep = document.getElementById('otpVerificationStep');
        const resetPasswordStep = document.getElementById('resetPasswordStep');
        if (otpVerificationStep && resetPasswordStep) {
          otpVerificationStep.classList.add('hidden');
          resetPasswordStep.classList.remove('hidden');
          document.getElementById('resetToken').value = result.token;
          document.getElementById('resetEmail').value = email;

          // Update wizard indicators
          document.getElementById('forgotStep2Indicator').classList.remove('bg-primary');
          document.getElementById('forgotStep2Indicator').classList.add('bg-gray-300', 'dark:bg-gray-600');
          document.getElementById('forgotStep3Indicator').classList.remove('bg-gray-300', 'dark:bg-gray-600');
          document.getElementById('forgotStep3Indicator').classList.add('bg-primary');

          // Focus on new password field
          setTimeout(() => document.getElementById('newPassword').focus(), 100);
        }
      } else {
        showToast('error', result.message || 'Invalid or expired OTP');
        otpInput.value = ''; // Clear input on error
        otpInput.classList.remove('bg-green-50', 'dark:bg-green-900', 'border-green-500');
        otpInput.focus();
      }
    } catch (err) {
      console.error('OTP verification error:', err.message, err);
      showToast('error', err.message || 'Failed to verify OTP. Please try again.');
      otpInput.value = ''; // Clear input on error
      otpInput.classList.remove('bg-green-50', 'dark:bg-green-900', 'border-green-500');
      otpInput.focus();
    } finally {
      submitBtn.disabled = false;
      spinner.classList.add('hidden');
      submitBtn.innerHTML = originalBtnText;
    }
  });

  // Handle resend OTP
  resendBtn.addEventListener('click', async () => {
    if (resendBtn.classList.contains('opacity-50')) return;

    const email = document.getElementById('otpEmail').value;
    resendBtn.classList.add('opacity-50', 'cursor-not-allowed');
    resendBtn.innerHTML = 'Sending...';

    try {
      await authApi.resendOTP(email, 'forgot-password');
      showToast('success', 'A new code has been sent to your email');
      setTimeout(() => {
        resendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        resendBtn.innerHTML = `Didn't receive the code? <span class="underline">Resend</span>`;
      }, 30000);
    } catch (error) {
      console.error('Resend OTP error:', error);
      showToast('error', 'Failed to resend code. Please try again.');
      resendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      resendBtn.innerHTML = `Didn't receive the code? <span class="underline">Resend</span>`;
    }
  });
}

export async function verifyOTP(email, otp, type) {
  try {
    const response = await authApi.verifyOTP(email, otp, type);    if (response.success) {      if (type === 'registration') {
        showToast('success', 'Registration completed successfully!');
        localStorage.setItem('token', response.token);
        localStorage.setItem('username', response.username);
        localStorage.setItem('role', response.role || 'USER');
        localStorage.setItem('state', response.state || 'APPROVED');
        hidePopup();
        renderUserUI();
        // Preload profile data in background but don't redirect
        preloadUserStats();      } else if (type === '2fa') {
        showToast('success', '2FA verification successful');
        localStorage.setItem('token', response.token);
        localStorage.setItem('username', response.username);
        localStorage.setItem('role', response.role);
        localStorage.setItem('state', response.state);
        if (response.has2fa) localStorage.setItem('has2fa', 'true');
        hidePopup();
        renderUserUI();
        // Preload profile data in background but don't redirect
        preloadUserStats();
      }
    } else {
      showToast('error', response.message || 'OTP verification failed');
    }
    return response;
  } catch (error) {
    console.error('OTP verification error:', error);
    showToast('error', 'Network error during OTP verification');
    return { success: false, message: 'Network error' };
  }
}

export async function forgotPassword(email) {
  try {
    const response = await authApi.forgotPassword(email);

    if (response.success) {
      showToast('success', 'Password reset email sent. Please check your inbox for the verification code.');

      // Show OTP verification step
      const forgotPasswordStep = document.getElementById('forgotPasswordStep');
      const otpVerificationStep = document.getElementById('otpVerificationStep');

      if (forgotPasswordStep && otpVerificationStep) {
        forgotPasswordStep.classList.add('hidden');
        otpVerificationStep.classList.remove('hidden');
        document.getElementById('otpEmail').value = email;

        // Update wizard indicators
        document.getElementById('forgotStep1Indicator').classList.remove('bg-primary');
        document.getElementById('forgotStep1Indicator').classList.add('bg-gray-300', 'dark:bg-gray-600');
        document.getElementById('forgotStep2Indicator').classList.remove('bg-gray-300', 'dark:bg-gray-600');
        document.getElementById('forgotStep2Indicator').classList.add('bg-primary');

        // Focus on OTP input field
        const otpInput = document.getElementById('otpCode');
        if (otpInput) {
          setTimeout(() => otpInput.focus(), 100);
        }

        // Initialize OTP input handling
        initializeOTPInput(otpInput);
      }
    } else {
      showToast('error', response.message || 'Failed to process password reset');
    }
    return response;
  } catch (error) {
    console.error('Forgot password error:', error);
    showToast('error', 'Network error during password reset request');
    return { success: false, message: 'Network error' };
  }
}

// New helper function to initialize OTP input handling
function initializeOTPInput(otpInput) {
  if (!otpInput) return;

  // Handle input event
  otpInput.addEventListener('input', (e) => {
    const cleanedValue = e.target.value.replace(/\D/g, '').slice(0, 6);
    e.target.value = cleanedValue;    if (cleanedValue.length === 6 && /^[0-9]{6}$/.test(cleanedValue)) {
      e.target.classList.add('bg-green-50', 'dark:bg-green-900', 'border-green-500', 'dark:border-green-400');
    } else {
      e.target.classList.remove('bg-green-50', 'dark:bg-green-900', 'border-green-500', 'dark:border-green-400');
    }
  });

  // Handle paste event
  otpInput.addEventListener('paste', (e) => {
    e.preventDefault();
    const pastedData = (e.clipboardData || window.clipboardData).getData('text');
    const cleanedValue = pastedData.replace(/\D/g, '').slice(0, 6);
    otpInput.value = cleanedValue;    if (cleanedValue.length === 6 && /^[0-9]{6}$/.test(cleanedValue)) {
      otpInput.classList.add('bg-green-50', 'dark:bg-green-900', 'border-green-500', 'dark:border-green-400');
    } else {
      otpInput.classList.remove('bg-green-50', 'dark:bg-green-900', 'border-green-500', 'dark:border-green-400');
    }
  });
}

function showResetPasswordForm(token) {
  const popup = document.createElement('div');
  popup.id = 'reset-password-popup';
  popup.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  popup.innerHTML = `
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
      <h2 class="text-xl font-bold mb-4">Reset Your Password</h2>
      <div id="resetPasswordRequirements" class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        <p>Password must contain:</p>
        <ul class="list-disc pl-5">
          <li id="resetLengthReq" class="text-red-500">At least 8 characters</li>
          <li id="resetUpperReq" class="text-red-500">At least one uppercase letter</li>
          <li id="resetLowerReq" class="text-red-500">At least one lowercase letter</li>
          <li id="resetNumberReq" class="text-red-500">At least one number</li>
          <li id="resetSpecialReq" class="text-red-500">At least one special character</li>
        </ul>
      </div>
      <form id="resetPasswordForm" class="space-y-4">
        <input type="hidden" id="resetToken" value="${token}">
        <div class="form-group">
          <label for="newPassword" class="label">New Password</label>
          <div class="relative">
            <input type="password" id="newPassword" class="input w-full" placeholder="Enter new password" required>
            <button type="button" id="toggleNewPassword" class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
        </div>
        <div class="form-group">
          <label for="confirmNewPassword" class="label">Confirm New Password</label>
          <div class="relative">
            <input type="password" id="confirmNewPassword" class="input w-full" placeholder="Confirm new password" required>
            <button type="button" id="toggleConfirmPassword" class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
        </div>
        <button type="submit" class="btn btn-primary w-full">Reset Password</button>
      </form>
      <button id="cancelResetBtn" class="btn btn-secondary w-full mt-2">Cancel</button>
    </div>
  `;
  document.body.appendChild(popup);

  // Password toggle for new password
  const toggleNewPassword = document.getElementById('toggleNewPassword');
  const newPasswordField = document.getElementById('newPassword');
  
  if (newPasswordField) {
    // Add input event for real-time password validation
    newPasswordField.addEventListener('input', () => {
      updatePasswordRequirements(newPasswordField.value);
    });
  }
  
  if (toggleNewPassword && newPasswordField) {
    toggleNewPassword.addEventListener('click', () => {
      const isPassword = newPasswordField.type === 'password';
      newPasswordField.type = isPassword ? 'text' : 'password';
      toggleNewPassword.innerHTML = isPassword
        ? `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.542-7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>`
        : `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>`;
    });
  }

  // Password toggle for confirm password
  const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
  const confirmPasswordField = document.getElementById('confirmNewPassword');
  if (toggleConfirmPassword && confirmPasswordField) {
    toggleConfirmPassword.addEventListener('click', () => {
      const isPassword = confirmPasswordField.type === 'password';
      confirmPasswordField.type = isPassword ? 'text' : 'password';
      toggleConfirmPassword.innerHTML = isPassword
        ? `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943-9.542-7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>`
        : `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>`;
    });
  }

  // Form submission
  const resetPasswordForm = document.getElementById('resetPasswordForm');
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('Reset form submitted');
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmNewPassword').value;
      const token = document.getElementById('resetToken').value;

      // Check if passwords match
      if (newPassword !== confirmPassword) {
        showToast('error', 'Passwords do not match');
        return;
      }

      // Validate password against policy
      const validation = validatePassword(newPassword);
      updatePasswordRequirements(newPassword); // Update UI indicators
      if (!validation.valid) {
        showToast('error', validation.errors[0]);
        return;
      }

      // Show success message for password match and policy compliance
      showToast('success', 'Passwords match and meet policy requirements');

      // Proceed with reset password request
      try {
        console.log('Attempting to reset password with token:', token);
        const response = await fetch('/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password: newPassword }),
        });
        const result = await response.json();
        console.log('Reset password response:', result);

        if (result.success) {
          showToast('success', 'Password reset successful! Please log in with your new password.');
          popup.remove();
          hidePopup();
        } else {
          showToast('error', result.message || 'Failed to reset password');
        }
      } catch (error) {
        console.error('Reset password error:', error);
        showToast('error', 'Network error or server issue occurred');
      }
    });
  }

  // Cancel button
  const cancelResetBtn = document.getElementById('cancelResetBtn');
  if (cancelResetBtn) {
    cancelResetBtn.addEventListener('click', () => {
      popup.remove();
      hidePopup();
    });
  }
}
