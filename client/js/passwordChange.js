// Updated file with both password and username change functionality
export function initProfileChanges() {
  // Initialize password change functionality
  initPasswordChange();
  
  // Initialize username change functionality
  initUsernameChange();
}

function initPasswordChange() {
  const changePasswordForm = document.getElementById('changePasswordForm');
  if (!changePasswordForm) return;

  changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    const passwordFeedback = document.getElementById('passwordFeedback');
    
    // Reset feedback
    passwordFeedback.textContent = '';
    passwordFeedback.className = 'text-sm hidden';
    
    // Validate passwords
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showPasswordFeedback('All fields are required', 'error');
      return;
    }
    
    // Validate password strength
    if (newPassword.length < 8) {
      showPasswordFeedback('Password must be at least 8 characters long', 'error');
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
        
        // Update username in localStorage if you store it there
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        if (userData) {
          userData.username = newUsername;
          localStorage.setItem('user', JSON.stringify(userData));
        }
        
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