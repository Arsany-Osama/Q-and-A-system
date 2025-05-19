import { getToken, isLoggedIn, logout, handleTokenExpiration } from './auth.js'; // Added handleTokenExpiration
import { showToast, showPopup } from './ui.js'; // Added showPopup import
import { auth } from './utils/api.js';

export async function fetchUserStats() {
  console.log('Fetching user stats');
  if (!isLoggedIn()) {
    showToast('error', 'Please log in to view profile');
    return { questionsCount: 0, answersCount: 0 };
  }

  try {
    const result = await auth.getUserStats();
    
    if (!result.success) {
      // Handle token expiration specifically
      if (result.message?.includes('jwt expired') || result.message?.includes('Invalid token')) {
        // Use the central token expiration handler
        handleTokenExpiration();
        return { questionsCount: 0, answersCount: 0 };
      }
      throw new Error(result.message || 'Failed to fetch user stats');
    }
    return result.stats;
  } catch (err) {
    console.error('Error fetching user stats:', err);
    
    // Check for token expiration in error messages
    if (err.message?.includes('jwt expired') || err.message?.includes('Invalid token')) {
      handleTokenExpiration();
    } else {
      showToast('error', 'Network error loading profile');
    }
    return { questionsCount: 0, answersCount: 0 };
  }
}

export async function renderProfile() {
  console.log('Rendering profile');
  const profileUsername = document.getElementById('profileUsername');
  const questionsAsked = document.getElementById('questionsAsked');
  const answersGiven = document.getElementById('answersGiven');

  if (!profileUsername || !questionsAsked || !answersGiven) {
    console.error('Profile elements not found');
    return;
  }

  const username = localStorage.getItem('username') || 'User';
  const stats = await fetchUserStats();

  profileUsername.textContent = username;
  questionsAsked.textContent = stats.questionsCount || 0;
  answersGiven.textContent = stats.answersCount || 0;
}
