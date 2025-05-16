// Function to initialize password change functionality
export function initPasswordChange() {
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