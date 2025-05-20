import { getToken, isLoggedIn, logout, handleTokenExpiration } from './auth.js'; // Added handleTokenExpiration
import { showToast, showPopup } from './ui.js'; // Added showPopup import
import { auth } from './utils/api.js';

// Store user stats in memory to avoid redundant API calls
let cachedUserStats = null;

export async function fetchUserStats(forceRefresh = false) {
  console.log('Fetching user stats');
  
  // If we have cached stats and don't need to refresh, return them immediately
  if (cachedUserStats && !forceRefresh) {
    console.log('Using cached user stats');
    return cachedUserStats;
  }
  
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
    
    // Cache the stats
    cachedUserStats = result.stats;
    return cachedUserStats;
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

// Add a function to preload user stats in the background without showing any UI
export async function preloadUserStats() {
  if (isLoggedIn()) {
    console.log('Preloading user stats');
    try {
      await fetchUserStats(true); // Force refresh
      console.log('User stats preloaded successfully');
    } catch (err) {
      console.error('Failed to preload user stats:', err);
    }
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
  // First check if we have cached stats (should be there from preloading)
  // If not, fetch them
  const stats = await fetchUserStats(false); // false = use cache if available

  profileUsername.textContent = username;
  questionsAsked.textContent = stats.questionsCount || 0;
  answersGiven.textContent = stats.answersCount || 0;
}
