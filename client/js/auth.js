import { showToast, hidePopup, renderUserUI, showSection } from './ui.js';
import { validatePassword } from './security.js';

const pendingUsers = new Map();

export function isLoggedIn() {
  return !!localStorage.getItem('token');
}

export function getToken() {
  return localStorage.getItem('token') || '';
}

export async function fetchTopContributors() {
  try {
    const response = await fetch('/auth/top-contributors');
    const data = await response.json();

    if (data.success) {
      return data.contributors;
    } else {
      console.error('Error fetching top contributors:', data.message);
      return [];
    }
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

  fetch('/auth/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
    .then(response => response.json())
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
  passwordInput.addEventListener('input', () => {
    if (document.getElementById('authTitle').textContent.toLowerCase() === 'register') {
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
      console.log('Received message event:', event.data);
      if (event.data.type === 'google-auth') {
        if (event.data.success) {
          console.log('Google login successful, setting localStorage:', {
            token: event.data.token,
            username: event.data.username,
          });
          localStorage.setItem('token', event.data.token);
          localStorage.setItem('username', event.data.username);
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
      const response = await fetch('/auth/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: result.email, twoFactorToken: result.twoFactorToken, code }),
      });

      const verifyResult = await response.json();

      if (verifyResult.success) {
        localStorage.setItem('token', verifyResult.token);
        localStorage.setItem('username', verifyResult.username);
        localStorage.setItem('has2fa', 'true');
        showToast('success', 'Two-factor authentication successful');
        modal.remove();
        hidePopup();
        renderUserUI();
        showSection('profileSection');
        setTimeout(() => window.location.reload(), 100);
      } else {
        showToast('error', verifyResult.message || 'Invalid verification code');
      }
    } catch (error) {
      showToast('error', 'Network error occurred');
    }
  });
}

async function handleAuth(action, username, email, password) {
  const url = `/auth/${action}`;
  const body = action === 'login' ? { email, password } : { username, email, password };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (result.success && !result.requires2FA) {
      localStorage.setItem('token', result.token);
      localStorage.setItem('username', result.username);
      if (result.has2fa) localStorage.setItem('has2fa', 'true');
    }
    return result;
  } catch (err) {
    throw new Error('Network error');
  }
}

async function handleRegister(username, email, password) {
  try {
    const response = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    return await response.json();
  } catch (err) {
    throw new Error('Network error');
  }
}

function showOTPForm(email, type) {
  const popup = document.createElement('div');
  popup.id = `${type}-otp-popup`;
  popup.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  popup.innerHTML = `
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
      <h2 class="text-xl font-bold mb-4">${type === 'registration' ? 'Verify Your Email' : 'Verify OTP'}</h2>
      <p class="mb-4">Enter the OTP sent to ${email}</p>
      <form id="otpForm" class="space-y-4">
        <input type="text" id="otpCode" pattern="[0-9]{6}" maxlength="6" class="input w-full" placeholder="000000" required>
        <button type="submit" class="btn btn-primary w-full">Verify</button>
      </form>
      <button id="cancelOtpBtn" class="btn btn-secondary w-full mt-2">Cancel</button>
    </div>
  `;
  document.body.appendChild(popup);

  document.getElementById('otpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = document.getElementById('otpCode').value;
    await verifyOTP(email, otp, type);
    popup.remove();
  });

  document.getElementById('cancelOtpBtn').addEventListener('click', () => {
    popup.remove();
    if (type === 'registration') {
      pendingUsers.delete(email);
    }
  });
}

export async function verifyOTP(email, otp, type) {
  try {
    const response = await fetch('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, type }),
    });
    const result = await response.json();
    if (result.success) {
      if (type === 'registration') {
        const userData = pendingUsers.get(email);
        if (!userData) throw new Error('User data not found');
        localStorage.setItem('token', result.token);
        localStorage.setItem('username', userData.username);
        pendingUsers.delete(email);
        showToast('success', 'Registration successful');
        hidePopup();
        renderUserUI();
        showSection('profileSection');
        setTimeout(() => window.location.reload(), 100);
      } else if (type === 'forgot-password') {
        // Hide the OTP popup
        const otpPopup = document.getElementById(`${type}-otp-popup`);
        if (otpPopup) otpPopup.remove();

        // Show the reset password step in the existing forgotPasswordPopup
        const forgotPasswordPopup = document.getElementById('forgotPasswordPopup');
        const forgotPasswordStep = document.getElementById('forgotPasswordStep');
        const securityQuestionsStep = document.getElementById('securityQuestionsStep');
        const resetPasswordStep = document.getElementById('resetPasswordStep');
        const forgotStep1Indicator = document.getElementById('forgotStep1Indicator');
        const forgotStep2Indicator = document.getElementById('forgotStep2Indicator');
        const forgotStep3Indicator = document.getElementById('forgotStep3Indicator');
        const resetTokenField = document.getElementById('resetToken');
        const resetEmailField = document.getElementById('resetEmail'); // Add this field in the form

        if (forgotPasswordPopup && resetPasswordStep) {
          // Hide other steps
          if (forgotPasswordStep) forgotPasswordStep.classList.add('hidden');
          if (securityQuestionsStep) securityQuestionsStep.classList.add('hidden');
          resetPasswordStep.classList.remove('hidden');

          // Update wizard indicators
          if (forgotStep1Indicator) {
            forgotStep1Indicator.classList.remove('bg-primary');
            forgotStep1Indicator.classList.add('bg-gray-300', 'dark:bg-gray-600');
          }
          if (forgotStep2Indicator) {
            forgotStep2Indicator.classList.remove('bg-primary');
            forgotStep2Indicator.classList.add('bg-gray-300', 'dark:bg-gray-600');
          }
          if (forgotStep3Indicator) {
            forgotStep3Indicator.classList.remove('bg-gray-300', 'dark:bg-gray-600');
            forgotStep3Indicator.classList.add('bg-primary');
          }

          // Set the reset token and email
          if (resetTokenField) resetTokenField.value = result.token || '';
          if (resetEmailField) resetEmailField.value = email; // Store the email

          // Focus on the new password field
          document.getElementById('newPassword')?.focus();
        } else {
          showToast('error', 'Failed to load reset password form');
        }
      }
    } else {
      showToast('error', result.message || 'Invalid OTP');
    }
  } catch (error) {
    showToast('error', 'Network error');
  }
}

export async function forgotPassword(email) {
  try {
    const response = await fetch('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const result = await response.json();
    if (result.success) {
      showOTPForm(email, 'forgot-password');
      showToast('success', 'Please check your email (including spam/junk folder) for the OTP to reset your password.');
    } else {
      showToast('error', result.message || 'Failed to initiate password reset');
    }
  } catch (error) {
    showToast('error', 'Network error');
  }
}

function showResetPasswordForm(token) {
  const popup = document.createElement('div');
  popup.id = 'reset-password-popup';
  popup.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  popup.innerHTML = `
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
      <h2 class="text-xl font-bold mb-4">Reset Your Password</h2>
      <div id="passwordRequirements" class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        <p>Password must contain:</p>
        <ul class="list-disc pl-5">
          <li id="lengthReq" class="text-red-500">At least 8 characters</li>
          <li id="upperReq" class="text-red-500">At least one uppercase letter</li>
          <li id="lowerReq" class="text-red-500">At least one lowercase letter</li>
          <li id="numberReq" class="text-red-500">At least one number</li>
          <li id="specialReq" class="text-red-500">At least one special character</li>
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
