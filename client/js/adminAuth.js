import { isAdmin, verifyAuthToken } from './auth.js';
import { showToast } from './ui.js';

/**
 * Check if user has admin access, redirect if not
 * @returns {Promise<boolean>} - Promise resolving to access status
 */
export async function checkAdminAccess() {
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
  
  // Then check if user is an admin
  if (!isAdmin()) {
    showToast('error', 'Access denied. Only administrators can view this page.');
    
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
  await checkAdminAccess();
});
