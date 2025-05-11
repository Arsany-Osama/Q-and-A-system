import { showToast, hidePopup, renderUserUI, showSection } from './ui.js';
import { validatePassword, updatePasswordRequirements } from './security.js';
import { auth as authApi } from './utils/api.js';

const pendingUsers = new Map();

export function isLoggedIn() {
  return !!localStorage.getItem('token');
}

export function getToken() {
  return localStorage.getItem('token') || '';
}

export function getUserRole() {
  return localStorage.getItem('role') || 'USER';
}

export function getUserState() {
  return localStorage.getItem('state') || 'APPROVED';
}

export function isAdmin() {
  return getUserRole() === 'ADMIN';
}

export function isModerator() {
  return getUserRole() === 'MODERATOR';
}

export function isApproved() {
  return getUserState() === 'APPROVED';
}

export async function fetchTopContributors() {
  try {
    const data = await authApi.getTopContributors();
    return data.contributors;
  } catch (error) {
    console.error('Network error when fetching top contributors:', error);
    return [];
  }
}

export function logout() {
  console.log('Logging out');
  const token = getToken();
  if (!token) {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('has2fa');
    showToast('success', 'Logged out successfully');
    renderUserUI();
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
      showToast('success', 'Logged out successfully'); // Fallback for expired token
    })
    .finally(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('has2fa');
      renderUserUI();
    });
}

export function initAuth() {
  const form = document.getElementById('authForm');
  if (!form) {
    console.error('Auth form not found');
    return;
  }

  // Real-time password validation for register
  const passwordInput = document.getElementById('password');
  const passwordRequirements = document.getElementById('passwordRequirements');
  
  // Hide password requirements by default and only show when needed
  if (passwordRequirements) {
    passwordRequirements.classList.add('hidden');
  }
  
  // Update auth form based on action
  const updateFormForAction = () => {
    const action = document.getElementById('authTitle').textContent.toLowerCase();
    // Only show password requirements for registration, hide for login
    if (passwordRequirements) {
      if (action === 'register') {
        passwordRequirements.classList.remove('hidden');
        // Update requirements based on current password
        updatePasswordRequirements(passwordInput.value);
      } else {
        passwordRequirements.classList.add('hidden');
      }
    }
  };
  
  // Call this when the auth popup is shown to set correct initial state
  updateFormForAction();
  
  // Handle tab switching (login/register) to show/hide requirements
  const authTabs = document.querySelectorAll('.auth-tab');
  if (authTabs) {
    authTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Small delay to allow the title to update
        setTimeout(updateFormForAction, 50);
      });
    });
  }
  
  passwordInput.addEventListener('input', () => {
    if (document.getElementById('authTitle').textContent.toLowerCase() === 'register') {
      // Show the requirements div for registration only
      if (passwordRequirements) {
        passwordRequirements.classList.remove('hidden');
      }
      // Update the requirements indicators
      updatePasswordRequirements(passwordInput.value);
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

    // Validate password for register
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
          showToast('success', 'Logged in successfully');

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
            showSection('profileSection');
            setTimeout(() => window.location.reload(), 100);
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
      console.log('Received message event:', event.data);      if (event.data.type === 'google-auth') {
        if (event.data.success) {
          console.log('Google login successful, setting localStorage:', {
            token: event.data.token,
            username: event.data.username,
            role: event.data.role,
            state: event.data.state
          });
          localStorage.setItem('token', event.data.token);
          localStorage.setItem('username', event.data.username);
          localStorage.setItem('role', event.data.role);
          localStorage.setItem('state', event.data.state);
          console.log('LocalStorage after setting:', {
            token: localStorage.getItem('token'),
            username: localStorage.getItem('username'),
          });

          showToast('success', 'Logged in with Google successfully');
          hidePopup();
          renderUserUI();
          showSection('profileSection');
          setTimeout(() => window.location.reload(), 100);
        } else {
          console.error('Google login failed:', event.data.message);
          showToast('error', event.data.message || 'Google login failed');
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
    );

    window.addEventListener('message', (event) => {      if (event.data.type === 'auth0-auth') {
        authWindow.close();
        if (event.data.success) {
          localStorage.setItem('token', event.data.token);
          localStorage.setItem('username', event.data.username);
          localStorage.setItem('role', event.data.role);
          localStorage.setItem('state', event.data.state);
          localStorage.setItem('state', event.data.state);
          hidePopup();
          renderUserUI();
          showToast('success', 'Logged in successfully with Auth0');
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
        ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />`
        : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />`;
    });
  }
}

function handleTwoFactorAuth(result) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
      <h2 class="text-xl font-bold mb-4">Two-Factor Authentication</h2>
      <p class="mb-4">Please enter the verification code from your authenticator app.</p>
      <form id="twoFactorForm" class="space-y-4">
        <input type="text" id="twoFactorCode" pattern="[0-9]{6}" maxlength="6" class="input w-full" placeholder="000000" required>
        <button type="submit" class="btn btn-primary w-full">Verify</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  setTimeout(() => document.getElementById('twoFactorCode').focus(), 100);

  document.getElementById('twoFactorForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('twoFactorCode').value;

    try {
      const response = await authApi.verifyTwoFactor(code);

      if (response.success) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('username', response.username);
        localStorage.setItem('has2fa', 'true');
        showToast('success', 'Two-factor authentication successful');
        modal.remove();
        hidePopup();
        renderUserUI();
        showSection('profileSection');
        setTimeout(() => window.location.reload(), 100);
      } else {
        showToast('error', response.message || 'Invalid verification code');
      }
    } catch (error) {
      showToast('error', 'Network error occurred');
    }
  });
}

async function handleAuth(action, username, email, password) {
  try {
    if (action === 'login') {
      return await authApi.login(username, password);
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

function showOTPForm(email, type) {
  const popup = document.createElement('div');
  popup.id = `${type}-otp-popup`;
  popup.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  popup.innerHTML = `
    <div class="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all">
      <div class="text-center mb-6">
        <h2 class="text-2xl font-bold mb-2">${type === 'registration' ? 'Verify Your Email' : 'Verify OTP'}</h2>
        <p class="text-gray-600 dark:text-gray-400">We've sent a verification code to <span class="font-semibold">${email}</span></p>
      </div>
      
      <div class="flex justify-center mb-6">
        <svg class="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
        </svg>
      </div>
      
      <form id="otpForm" class="space-y-6">
        <div class="space-y-2">
          <label for="otpCode" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Enter 6-digit code</label>
          <input 
            type="text" 
            id="otpCode" 
            pattern="[0-9]{6}" 
            maxlength="6" 
            class="input w-full text-center text-lg font-mono tracking-widest py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
            placeholder="000000" 
            autocomplete="one-time-code"
            inputmode="numeric"
            required
          >
        </div>
        
        <div id="otpTimer" class="text-center text-sm text-gray-600 dark:text-gray-400">
          Code expires in <span id="otpCountdown">5:00</span>
        </div>
        
        <button type="submit" class="btn btn-primary w-full py-3 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center">
          <span>Verify Code</span>
          <svg class="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </button>
      </form>
      
      <div class="mt-5 text-center">
        <button id="resendOtpBtn" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
          Didn't receive the code? <span class="underline">Resend</span>
        </button>
      </div>
      
      <button id="cancelOtpBtn" class="mt-4 btn btn-secondary w-full flex items-center justify-center">
        <svg class="mr-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
        Cancel
      </button>
    </div>
  `;
  document.body.appendChild(popup);

  // Focus on OTP input field
  setTimeout(() => document.getElementById('otpCode').focus(), 100);

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

  // Add formatting to the OTP input to improve user experience
  const otpInput = document.getElementById('otpCode');
  otpInput.addEventListener('input', (e) => {
    // Remove any non-digit characters
    e.target.value = e.target.value.replace(/\D/g, '');
    
    // Add visual feedback as user types
    if (e.target.value.length === 6) {
      e.target.classList.add('bg-green-50', 'dark:bg-green-900', 'border-green-500');
    } else {
      e.target.classList.remove('bg-green-50', 'dark:bg-green-900', 'border-green-500');
    }
  });

  document.getElementById('otpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = document.getElementById('otpCode').value;
    
    // Disable submit button and show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg> Verifying...`;
    
    try {
      await verifyOTP(email, otp, type);
      clearInterval(timerInterval);
      popup.remove();
    } catch (err) {
      // Restore button state on error
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });

  document.getElementById('resendOtpBtn').addEventListener('click', async () => {
    // Simple debounce and visual feedback for resend
    const resendBtn = document.getElementById('resendOtpBtn');
    if (resendBtn.classList.contains('opacity-50')) return;
    
    resendBtn.classList.add('opacity-50', 'cursor-not-allowed');
    resendBtn.innerHTML = 'Sending...';
    
    try {
      // Implementation would depend on your API
      if (type === 'registration') {
        const userData = pendingUsers.get(email);
        if (userData) {
          await authApi.register(userData.username, userData.email, userData.password);
          showToast('success', 'A new code has been sent to your email');
        }
      } else {
        await authApi.resendOTP(email, type);
        showToast('success', 'A new code has been sent to your email');
      }
      
      // Reset timer
      timeLeft = 300;
      countdownEl.textContent = '5:00';
      
      // Reset the resend button after 30 seconds
      setTimeout(() => {
        resendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        resendBtn.innerHTML = 'Didn\'t receive the code? <span class="underline">Resend</span>';
      }, 30000);
      
    } catch (error) {
      showToast('error', 'Failed to resend code. Please try again.');
      resendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      resendBtn.innerHTML = 'Didn\'t receive the code? <span class="underline">Resend</span>';
    }
  });

  document.getElementById('cancelOtpBtn').addEventListener('click', () => {
    clearInterval(timerInterval);
    popup.remove();
    if (type === 'registration') {
      pendingUsers.delete(email);
    }
  });
}

export async function verifyOTP(email, otp, type) {
  try {
    const response = await authApi.verifyOTP(email, otp, type);
    
    if (response.success) {
      if (type === 'registration') {
        showToast('success', 'Registration completed successfully! You can now log in.');
        hidePopup();
      } else if (type === '2fa') {
        showToast('success', '2FA verification successful');
        localStorage.setItem('token', response.token);
        localStorage.setItem('username', response.username);
        localStorage.setItem('role', response.role);
        localStorage.setItem('state', response.state);
        if (response.has2fa) localStorage.setItem('has2fa', 'true');
        hidePopup();
        renderUserUI();
        showSection('profileSection');
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
        document.getElementById('otpCode').focus();
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
        ? `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>`
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
        ? `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>`
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
