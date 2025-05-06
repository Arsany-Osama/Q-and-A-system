import { showToast, hidePopup, showPopup } from './ui.js';
import { getToken, isLoggedIn } from './auth.js';

// Password policy configuration
const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecial: true,
  specialChars: '!@#$%^&*()_+{}[]|:;<>,.?/~`-='
};

// Validate password against policy
export function validatePassword(password) {
  const validationResults = {
    valid: true,
    errors: []
  };

  if (password.length < PASSWORD_POLICY.minLength) {
    validationResults.valid = false;
    validationResults.errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters long`);
  }

  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    validationResults.valid = false;
    validationResults.errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    validationResults.valid = false;
    validationResults.errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_POLICY.requireNumbers && !/[0-9]/.test(password)) {
    validationResults.valid = false;
    validationResults.errors.push('Password must contain at least one number');
  }

  if (PASSWORD_POLICY.requireSpecial && !new RegExp(`[${PASSWORD_POLICY.specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`).test(password)) {
    validationResults.valid = false;
    validationResults.errors.push('Password must contain at least one special character');
  }

  return validationResults;
}

// Initialize 2FA setup
export function initTwoFactorAuth() {
  const twoFactorSetupBtn = document.getElementById('twoFactorSetupBtn');
  const twoFactorVerifyBtn = document.getElementById('twoFactorVerifyBtn');
  const twoFactorDisableBtn = document.getElementById('twoFactorDisableBtn');

  if (twoFactorSetupBtn) {
    twoFactorSetupBtn.addEventListener('click', setup2FA);
  }

  if (twoFactorVerifyBtn) {
    twoFactorVerifyBtn.addEventListener('click', verify2FA);
  }

  if (twoFactorDisableBtn) {
    twoFactorDisableBtn.addEventListener('click', disable2FA);
  }
}

// Function to setup 2FA
async function setup2FA() {
  if (!isLoggedIn()) {
    showToast('error', 'You must be logged in to setup 2FA');
    return;
  }

  try {
    const response = await fetch('/auth/2fa/setup', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (result.success) {
      document.getElementById('qrCodeImage').src = result.qrCodeUrl;
      document.getElementById('secretKey').textContent = result.secretKey;
      document.getElementById('twoFactorSetupStep').classList.add('hidden');
      document.getElementById('twoFactorQRStep').classList.remove('hidden');
    } else {
      showToast('error', result.message || 'Failed to setup 2FA');
    }
  } catch (error) {
    showToast('error', 'Network error occurred');
    console.error('Error setting up 2FA:', error);
  }
}

// Function to verify 2FA
async function verify2FA() {
  const code = document.getElementById('verificationCode').value.trim();
  
  if (!code) {
    showToast('error', 'Please enter the verification code');
    return;
  }

  try {
    const response = await fetch('/auth/2fa/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    });

    const result = await response.json();
    
    if (result.success) {
      showToast('success', '2FA enabled successfully');
      hidePopup();
    } else {
      showToast('error', result.message || 'Invalid verification code');
    }
  } catch (error) {
    showToast('error', 'Network error occurred');
    console.error('Error verifying 2FA:', error);
  }
}

// Function to disable 2FA
async function disable2FA() {
  const code = document.getElementById('disableCode').value.trim();
  
  if (!code) {
    showToast('error', 'Please enter your verification code');
    return;
  }

  try {
    const response = await fetch('/auth/2fa/disable', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    });

    const result = await response.json();
    
    if (result.success) {
      showToast('success', '2FA disabled successfully');
      hidePopup();
    } else {
      showToast('error', result.message || 'Failed to disable 2FA');
    }
  } catch (error) {
    showToast('error', 'Network error occurred');
    console.error('Error disabling 2FA:', error);
  }
}

// Initialize forgot password functionality
export function initForgotPassword() {
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  const resetPasswordForm = document.getElementById('resetPasswordForm');
  const securityQuestionsVerifyForm = document.getElementById('securityQuestionsVerifyForm');

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('forgotEmail').value;
      
      try {
        const response = await fetch('/auth/forgot-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email })
        });

        const result = await response.json();
        
        if (result.success) {
          showToast('success', 'Recovery email sent. Please check your inbox.');
          // Show security questions if they exist for this account
          if (result.hasSecurityQuestions) {
            document.getElementById('forgotPasswordStep').classList.add('hidden');
            document.getElementById('securityQuestionsStep').classList.remove('hidden');
            
            // Populate security questions
            const questionElements = document.querySelectorAll('.security-question-text');
            result.questions.forEach((question, index) => {
              if (questionElements[index]) {
                questionElements[index].textContent = question;
              }
            });
          } else {
            hidePopup();
          }
        } else {
          showToast('error', result.message || 'Failed to send recovery email');
        }
      } catch (error) {
        showToast('error', 'Network error occurred');
        console.error('Error initiating password recovery:', error);
      }
    });
  }

  if (securityQuestionsVerifyForm) {
    securityQuestionsVerifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('forgotEmail').value;
      const answers = [
        document.getElementById('securityAnswer1Verify').value,
        document.getElementById('securityAnswer2Verify').value,
        document.getElementById('securityAnswer3Verify').value
      ];
      
      try {
        const response = await fetch('/auth/verify-security-questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, answers })
        });

        const result = await response.json();
        
        if (result.success) {
          // Show reset password form
          document.getElementById('securityQuestionsStep').classList.add('hidden');
          document.getElementById('resetPasswordStep').classList.remove('hidden');
          document.getElementById('resetToken').value = result.token;
        } else {
          showToast('error', result.message || 'Failed to verify security questions');
        }
      } catch (error) {
        showToast('error', 'Network error occurred');
        console.error('Error verifying security questions:', error);
      }
    });
  }

  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const password = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmNewPassword').value;
      const token = document.getElementById('resetToken').value;
      
      if (password !== confirmPassword) {
        showToast('error', 'Passwords do not match');
        return;
      }
      
      // Validate password against policy
      const validation = validatePassword(password);
      if (!validation.valid) {
        showToast('error', validation.errors[0]);
        return;
      }
      
      try {
        const response = await fetch('/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token, password })
        });

        const result = await response.json();
        
        if (result.success) {
          showToast('success', 'Password reset successfully');
          hidePopup();
          // Redirect to login
          showPopup('login');
        } else {
          showToast('error', result.message || 'Failed to reset password');
        }
      } catch (error) {
        showToast('error', 'Network error occurred');
        console.error('Error resetting password:', error);
      }
    });
  }
}

// Initialize all security features
export function initSecurity() {
  initTwoFactorAuth();
  initForgotPassword();
  
  // Attach password validation to password fields
  const passwordFields = document.querySelectorAll('input[type="password"]');
  passwordFields.forEach(field => {
    if (field.id === 'password' || field.id === 'newPassword') {
      field.addEventListener('blur', () => {
        if (field.value) {
          const validation = validatePassword(field.value);
          if (!validation.valid) {
            const firstError = validation.errors[0];
            field.setCustomValidity(firstError);
            showToast('error', firstError);
          } else {
            field.setCustomValidity('');
          }
        }
      });
    }
  });
}
