import { getToken, isLoggedIn, logout } from './auth.js'; // Added logout import
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
      if (result.message === 'Invalid token: jwt expired') {
        showToast('error', 'Session expired, please log in again');
        logout(); // Clear token and update UI
        showPopup('login'); // Prompt user to log in
        return { questionsCount: 0, answersCount: 0 };
      }
      throw new Error(result.message || 'Failed to fetch user stats');
    }
    return result.stats;
  } catch (err) {
    console.error('Error fetching user stats:', err);
    showToast('error', err.message === 'Invalid token: jwt expired' ? 'Session expired, please log in again' : 'Network error loading profile');
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
