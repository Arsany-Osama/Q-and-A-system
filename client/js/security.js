import { showToast, hidePopup, showPopup } from './ui.js';
import { getToken, isLoggedIn } from './auth.js';
import { auth } from './utils/api.js';

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

// Update password requirements UI
export function updatePasswordRequirements(password) {
  // Check for normal registration form requirements
  updatePasswordRequirementElements(password, 'lengthReq', 'upperReq', 'lowerReq', 'numberReq', 'specialReq');
  
  // Check for reset password form requirements
  updatePasswordRequirementElements(password, 'resetLengthReq', 'resetUpperReq', 'resetLowerReq', 'resetNumberReq', 'resetSpecialReq');
}

// Helper function to update either set of requirement elements
function updatePasswordRequirementElements(password, lengthId, upperId, lowerId, numberId, specialId) {
  const lengthReq = document.getElementById(lengthId);
  const upperReq = document.getElementById(upperId);
  const lowerReq = document.getElementById(lowerId);
  const numberReq = document.getElementById(numberId);
  const specialReq = document.getElementById(specialId);

  // Function to update class while preserving other classes
  const updateClass = (element, isValid) => {
    if (!element) return;
    // Remove both color classes
    element.classList.remove('text-red-500', 'text-green-500');
    // Add the appropriate color class
    element.classList.add(isValid ? 'text-green-500' : 'text-red-500');
  };

  updateClass(lengthReq, password.length >= PASSWORD_POLICY.minLength);
  updateClass(upperReq, /[A-Z]/.test(password));
  updateClass(lowerReq, /[a-z]/.test(password));
  updateClass(numberReq, /[0-9]/.test(password));
  
  const specialRegex = new RegExp(`[${PASSWORD_POLICY.specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`);
  updateClass(specialReq, specialRegex.test(password));
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
    const result = await auth.setup2FA();
    
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
    const result = await auth.verify2FA(code);
    
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
    const result = await auth.disable2FA(code);
    
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
  const otpVerificationForm = document.getElementById('otpVerificationForm');
  const resetPasswordForm = document.getElementById('resetPasswordForm');
  const securityQuestionsVerifyForm = document.getElementById('securityQuestionsVerifyForm');

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('forgotEmail').value;
      
      try {
        const result = await auth.forgotPassword(email);
        
        if (result.success) {
          showToast('success', 'Recovery email sent with verification code. Please check your inbox.');
          
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
            // Show OTP verification step
            document.getElementById('forgotPasswordStep').classList.add('hidden');
            document.getElementById('otpVerificationStep').classList.remove('hidden');
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
          showToast('error', result.message || 'Failed to send recovery email');
        }
      } catch (error) {
        showToast('error', 'Network error occurred');
        console.error('Error initiating password recovery:', error);
      }
    });
  }

  if (otpVerificationForm) {
    otpVerificationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('otpEmail').value;
      const otp = document.getElementById('otpCode').value;
      
      try {
        const result = await auth.verifyOTP(email, otp, 'forgot-password');

        if (result.success) {
          showToast('success', 'Verification successful');
          
          // Show reset password step
          document.getElementById('otpVerificationStep').classList.add('hidden');
          document.getElementById('resetPasswordStep').classList.remove('hidden');
          document.getElementById('resetToken').value = result.token;
          document.getElementById('resetEmail').value = email;
          
          // Update wizard indicators
          document.getElementById('forgotStep2Indicator').classList.remove('bg-primary');
          document.getElementById('forgotStep2Indicator').classList.add('bg-gray-300', 'dark:bg-gray-600');
          document.getElementById('forgotStep3Indicator').classList.remove('bg-gray-300', 'dark:bg-gray-600');
          document.getElementById('forgotStep3Indicator').classList.add('bg-primary');
          
          // Focus on new password field
          document.getElementById('newPassword').focus();
        } else {
          showToast('error', result.message || 'Invalid verification code');
        }
      } catch (error) {
        showToast('error', 'Network error occurred');
        console.error('Error verifying OTP:', error);
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
        const result = await auth.verifySecurityQuestions(email, answers);
        
        if (result.success) {
          // Show reset password form
          document.getElementById('securityQuestionsStep').classList.add('hidden');
          document.getElementById('resetPasswordStep').classList.remove('hidden');
          document.getElementById('resetToken').value = result.token;
          showResetPasswordForm(result.token); // Pass token to reset form
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
        const result = await auth.resetPassword(token, password);
        
        if (result.success) {
          showToast('success', 'Password reset successful! Please log in with your new password.');
          // Close the forgot password popup
          const forgotPasswordPopup = document.getElementById('forgotPasswordPopup');
          if (forgotPasswordPopup) {
            forgotPasswordPopup.classList.add('hidden');
          }
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
    if (field.id === 'password' || field.id === 'newPassword' || field.id === 'confirmNewPassword') {
      field.addEventListener('input', () => {
        // Get the current password value from the field being typed in
        const currentPassword = field.value;
        const action = document.getElementById('authTitle')?.textContent.toLowerCase();
        
        // Show the appropriate password requirements div based on field id and action
        if (field.id === 'password' && action === 'register') {
          const requirementsDiv = document.getElementById('passwordRequirements');
          if (requirementsDiv) {
            requirementsDiv.classList.remove('hidden');
            updatePasswordRequirements(currentPassword);
          }
        } else if (field.id === 'newPassword' || field.id === 'confirmNewPassword') {
          const resetRequirementsDiv = document.getElementById('resetPasswordRequirements');
          if (resetRequirementsDiv) {
            resetRequirementsDiv.classList.remove('hidden');
            updatePasswordRequirements(currentPassword);
          }
        }
      });
      
      field.addEventListener('blur', () => {
        if (field.value) {
          // Only validate complexity for registration or password reset, not login
          const action = document.getElementById('authTitle')?.textContent.toLowerCase();
          const isPasswordReset = field.id === 'newPassword' || field.id === 'confirmNewPassword';
          
          if (action === 'register' || isPasswordReset) {
            const validation = validatePassword(field.value);
            if (!validation.valid) {
              const firstError = validation.errors[0];
              field.setCustomValidity(firstError);
              // Remove toast message on blur - just set the field validity
            } else {
              field.setCustomValidity('');
              
              // Only check for password match without showing toast
              if (field.id === 'confirmNewPassword') {
                const password = document.getElementById('newPassword')?.value || '';
                const confirmPassword = field.value;
                
                if (password && confirmPassword && password !== confirmPassword) {
                  field.setCustomValidity('Passwords do not match');
                }
              }
            }
          } else {
            // For login, don't validate password complexity
            field.setCustomValidity('');
          }
        }
      });
    }
  });
  
  // Add validation on form submission instead
  const authForm = document.getElementById('authForm');
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      // Only validate password complexity on registration
      const action = document.getElementById('authTitle')?.textContent.toLowerCase();
      if (action === 'register') {
        const passwordField = document.getElementById('password');
        if (passwordField && passwordField.value) {
          const validation = validatePassword(passwordField.value);
          if (!validation.valid) {
            e.preventDefault();
            showToast('error', validation.errors[0]);
          }
        }
      }
    });
  }
  
  const resetPasswordForm = document.getElementById('resetPasswordForm');
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', (e) => {
      const newPassword = document.getElementById('newPassword');
      const confirmNewPassword = document.getElementById('confirmNewPassword');
      
      if (newPassword && confirmNewPassword) {
        if (newPassword.value !== confirmNewPassword.value) {
          e.preventDefault();
          showToast('error', 'Passwords do not match');
          return;
        }
        
        const validation = validatePassword(newPassword.value);
        if (!validation.valid) {
          e.preventDefault();
          showToast('error', validation.errors[0]);
        }
      }
    });
  }
}
