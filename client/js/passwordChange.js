// Updated file with both password and username change functionality
import { validatePassword, updatePasswordRequirements } from './security.js';

export function initProfileChanges() {
  // Initialize password change functionality
  initPasswordChange();

  // Initialize username change functionality
  initUsernameChange();

  // Initialize password toggle buttons
  initPasswordToggles();
}

function initPasswordChange() {
  const changePasswordForm = document.getElementById('changePasswordForm');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
  const passwordRequirements = document.getElementById('passwordRequirements');

  if (!changePasswordForm) return;

  // Add event listener for real-time password validation
  if (newPasswordInput) {
    newPasswordInput.addEventListener('input', () => {
      if (passwordRequirements) {
        passwordRequirements.classList.remove('hidden');
        updatePasswordRequirements(newPasswordInput.value);
      }
    });
  }

  changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = newPasswordInput.value;
    const confirmNewPassword = confirmNewPasswordInput.value;
    const passwordFeedback = document.getElementById('passwordFeedback');

    // Reset feedback
    passwordFeedback.textContent = '';
    passwordFeedback.className = 'text-sm hidden';

    // Validate passwords
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showPasswordFeedback('All fields are required', 'error');
      return;
    }

    // Validate password strength using the common validator
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      showPasswordFeedback(validation.errors[0], 'error');
      return;
    }

    // Check if passwords match
    if (newPassword !== confirmNewPassword) {
      showPasswordFeedback('New passwords do not match', 'error');
      return;
    }

    // Submit password change request
    try {
      const response = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showPasswordFeedback('Password changed successfully!', 'success');
        changePasswordForm.reset();
        // Hide password requirements after successful change
        passwordRequirements.classList.add('hidden');
      } else {
        showPasswordFeedback(data.message || 'Failed to change password', 'error');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      showPasswordFeedback('An error occurred. Please try again.', 'error');
    }
  });

  // Helper function to show password feedback
  function showPasswordFeedback(message, type) {
    const passwordFeedback = document.getElementById('passwordFeedback');
    passwordFeedback.textContent = message;
    passwordFeedback.classList.remove('hidden', 'text-red-500', 'text-green-500');

    if (type === 'error') {
      passwordFeedback.classList.add('text-red-500');
    } else {
      passwordFeedback.classList.add('text-green-500');
    }
  }
}

// Add event listeners for password toggle buttons in the password change section
function initPasswordToggles() {
  // Define pairs of password fields and their respective toggle buttons using IDs
  const passwordTogglePairs = [
    { field: 'currentPassword', button: document.getElementById('toggleCurrentPassword') },
    { field: 'newPassword', button: document.getElementById('toggleNewPassword') },
    { field: 'confirmNewPassword', button: document.getElementById('toggleConfirmNewPassword') },
    { field: 'usernamePasswordConfirm', button: document.getElementById('toggleUsernamePassword') }
  ];

  // Add event listeners for each toggle button
  passwordTogglePairs.forEach(pair => {
    const field = document.getElementById(pair.field);
    const button = pair.button;

    if (field && button) {
      button.addEventListener('click', () => {
        // Toggle between password and text
        const type = field.type === 'password' ? 'text' : 'password';
        field.type = type;

        // Update the icon based on visibility
        if (type === 'text') {
          // Eye-off icon (password is visible)
          button.innerHTML = `
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          `;
        } else {
          // Eye icon (password is hidden)
          button.innerHTML = `
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          `;
        }
      });
    }
  });
}

function initUsernameChange() {
  const changeUsernameForm = document.getElementById('changeUsernameForm');
  if (!changeUsernameForm) return;

  changeUsernameForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newUsername = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('usernamePasswordConfirm').value;
    const usernameFeedback = document.getElementById('usernameFeedback');

    // Reset feedback
    usernameFeedback.textContent = '';
    usernameFeedback.className = 'text-sm hidden';

    // Validate inputs
    if (!newUsername || !password) {
      showUsernameFeedback('Both username and password are required', 'error');
      return;
    }

    // Username validation
    if (newUsername.length < 3 || newUsername.length > 30) {
      showUsernameFeedback('Username must be between 3 and 30 characters', 'error');
      return;
    }

    // Check for valid characters (alphanumeric and underscores)
    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      showUsernameFeedback('Username can only contain letters, numbers, and underscores', 'error');
      return;
    }

    // Submit username change request
    try {
      const response = await fetch('/api/users/update-username', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          newUsername,
          password
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showUsernameFeedback('Username updated successfully!', 'success');

        // Update the displayed username in the profile
        const profileUsername = document.getElementById('profileUsername');
        if (profileUsername) {
          profileUsername.textContent = newUsername;
        }

        // Update username in navbar if it exists
        const navUsername = document.getElementById('navUsername');
        if (navUsername) {
          navUsername.textContent = newUsername;
        }

        // Update username in localStorage
        localStorage.setItem('username', newUsername);

        // Optionally update the user object if app still uses it
        // let userData;
        // try {
        //   userData = JSON.parse(localStorage.getItem('user') || '{}');
        // } catch (e) {
        //   console.error('Error parsing user data from localStorage:', e);
        //   userData = {};
        // }
        // userData.username = newUsername;
        // localStorage.setItem('user', JSON.stringify(userData));

        // Reset the form
        changeUsernameForm.reset();
      } else {
        showUsernameFeedback(data.message || 'Failed to update username', 'error');
      }
    } catch (error) {
      console.error('Error updating username:', error);
      showUsernameFeedback('An error occurred. Please try again.', 'error');
    }
  });

  // Helper function to show username feedback
  function showUsernameFeedback(message, type) {
    const usernameFeedback = document.getElementById('usernameFeedback');
    usernameFeedback.textContent = message;
    usernameFeedback.classList.remove('hidden', 'text-red-500', 'text-green-500');

    if (type === 'error') {
      usernameFeedback.classList.add('text-red-500');
    } else {
      usernameFeedback.classList.add('text-green-500');
    }
  }
}
