import { getUserRole, verifyAuthToken } from './auth.js';
import { showToast } from './ui.js';

/**
 * Check if user has moderator or admin access, redirect if not
 * @returns {Promise<boolean>} - Promise resolving to access status
 */
export async function checkSecurityAccess() {
  // First verify if the token is valid
  try {
    const isValid = await verifyAuthToken();
    if (!isValid) {
      showToast('error', 'Your session has expired. Please log in again.');
      // Redirect to homepage after a brief delay
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
      return false;
    }
  } catch (error) {
    console.error('Error verifying auth token:', error);
    showToast('error', 'Authentication error. Please log in again.');
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
    return false;
  }
  
  // Then check if user has appropriate role
  const role = getUserRole();
  
  if (role !== 'MODERATOR' && role !== 'ADMIN') {
    showToast('error', 'Access denied. Only moderators and administrators can view this page.');
    
    // Redirect to homepage after a brief delay
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
    
    return false;
  }
  return true;
}

// Run the access check immediately when this script is loaded
document.addEventListener('DOMContentLoaded', async () => {
  await checkSecurityAccess();
});
