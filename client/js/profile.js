import { getToken, isLoggedIn, logout, handleTokenExpiration } from './auth.js';
import { showToast, showPopup } from './ui.js';
import { auth } from './utils/api.js';

// Cache for user stats
let cachedUserStats = null;

// Store user stats in memory to avoid redundant API calls
let cachedUserQuestions = null;
let cachedUserAnswers = null;

// Content display functions
async function loadUserContent() {
  if (!isLoggedIn()) {
    return;
  }

  try {
    const [questionsResponse, answersResponse] = await Promise.all([
      fetch('https://localhost:3000/questions/user', {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      }),
      fetch('https://localhost:3000/answers/user', {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      })
    ]);

    if (!questionsResponse.ok || !answersResponse.ok) {
      throw new Error('Failed to fetch user content');
    }

    const questions = await questionsResponse.json();
    const answers = await answersResponse.json();

    cachedUserQuestions = questions.success ? questions.questions : [];
    cachedUserAnswers = answers.success ? answers.answers : [];

    displayUserQuestions(cachedUserQuestions);
    displayUserAnswers(cachedUserAnswers);
  } catch (error) {
    console.error('Error loading user content:', error);
    showToast('error', 'Failed to load your content');
  }
}

function displayUserQuestions(questions) {
  const container = document.getElementById('userQuestions');
  if (!container) return;

  if (!questions.length) {
    container.innerHTML = '<p class="text-gray-500 dark:text-gray-400">You haven\'t asked any questions yet.</p>';
    return;
  }

  container.innerHTML = questions.map(question => `
    <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg question-item">
      <h4 class="font-medium mb-2">${escapeHtml(question.title)}</h4>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">${escapeHtml(question.content.substring(0, 100))}${question.content.length > 100 ? '...' : ''}</p>      <div class="flex items-center gap-2">
        <button 
          class="btn btn-primary w-full flex items-center justify-center edit-question" 
          data-id="${question.id}">
          <span>Edit Question</span>
        </button>
        <button 
          class="btn btn-danger w-full flex items-center justify-center delete-question" 
          data-id="${question.id}">
          <span>Delete Question</span>
        </button>
      </div>
    </div>
  `).join('');

  // Add event listeners for edit and delete buttons
  container.querySelectorAll('.edit-question').forEach(btn => {
    btn.addEventListener('click', () => editQuestion(btn.dataset.id));
  });

  container.querySelectorAll('.delete-question').forEach(btn => {
    btn.addEventListener('click', () => deleteQuestion(btn.dataset.id));
  });
}

function displayUserAnswers(answers) {
  const container = document.getElementById('userAnswers');
  if (!container) return;

  if (!answers.length) {
    container.innerHTML = '<p class="text-gray-500 dark:text-gray-400">You haven\'t answered any questions yet.</p>';
    return;
  }

  container.innerHTML = answers.map(answer => `
    <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg answer-item">
      <h4 class="font-medium mb-2">${answer.question ? escapeHtml(answer.question.title) : 'Question no longer available'}</h4>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">${escapeHtml(answer.content.substring(0, 100))}${answer.content.length > 100 ? '...' : ''}</p>      <div class="flex items-center gap-2">
        <button 
          class="btn btn-primary w-full flex items-center justify-center edit-answer" 
          data-id="${answer.id}">
          <span>Edit Answer</span>
        </button>
        <button 
          class="btn btn-danger w-full flex items-center justify-center delete-answer" 
          data-id="${answer.id}">
          <span>Delete Answer</span>
        </button>
      </div>
    </div>
  `).join('');

  // Add event listeners for edit and delete buttons
  container.querySelectorAll('.edit-answer').forEach(btn => {
    btn.addEventListener('click', () => editAnswer(btn.dataset.id));
  });

  container.querySelectorAll('.delete-answer').forEach(btn => {
    btn.addEventListener('click', () => deleteAnswer(btn.dataset.id));
  });
}

async function editQuestion(questionId) {
  if (!isLoggedIn()) {
    Swal.fire({
      title: 'Authentication Required',
      text: 'Please log in to edit your question',
      icon: 'warning',
      showCancelButton: false,
      confirmButtonText: 'OK'
    });
    return;
  }

  const question = cachedUserQuestions.find(q => q.id === parseInt(questionId));
  if (!question) return;

  const { value: formValues } = await Swal.fire({
    title: 'Edit Question',
    html: `
      <input id="swal-title" class="swal2-input" value="${escapeHtml(question.title)}" placeholder="Question Title">
      <textarea id="swal-content" class="swal2-textarea" placeholder="Question Content">${escapeHtml(question.content)}</textarea>
      <input id="swal-tags" class="swal2-input" value="${question.tags ? question.tags.join(', ') : ''}" placeholder="Tags (comma separated)">
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Save Changes',
    preConfirm: () => ({
      title: document.getElementById('swal-title').value,
      content: document.getElementById('swal-content').value,
      tags: document.getElementById('swal-tags').value.split(',').map(tag => tag.trim()).filter(Boolean)
    })
  });

  if (!formValues) return;

  try {
    const response = await fetch(`https://localhost:3000/questions/${questionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(formValues)
    });

    if (!response.ok) throw new Error('Failed to update question');

    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Question updated successfully',
      timer: 1500
    });
    await loadUserContent();
  } catch (error) {
    console.error('Error updating question:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to update question'
    });
  }
}

async function deleteQuestion(questionId) {
  if (!isLoggedIn()) {
    Swal.fire({
      title: 'Authentication Required',
      text: 'Please log in to delete your question',
      icon: 'warning',
      showCancelButton: false,
      confirmButtonText: 'OK'
    });
    return;
  }

  const result = await Swal.fire({
    title: 'Are you sure?',
    text: 'This action cannot be undone!',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete it!',
    cancelButtonText: 'No, keep it',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6'
  });

  if (!result.isConfirmed) return;

  try {
    const response = await fetch(`https://localhost:3000/questions/${questionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    if (!response.ok) throw new Error('Failed to delete question');

    Swal.fire({
      icon: 'success',
      title: 'Deleted!',
      text: 'Your question has been deleted.',
      timer: 1500
    });
    await loadUserContent();
  } catch (error) {
    console.error('Error deleting question:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to delete question'
    });
  }
}

async function editAnswer(answerId) {
  if (!isLoggedIn()) {
    Swal.fire({
      title: 'Authentication Required',
      text: 'Please log in to edit your answer',
      icon: 'warning',
      showCancelButton: false,
      confirmButtonText: 'OK'
    });
    return;
  }

  const answer = cachedUserAnswers.find(a => a.id === parseInt(answerId));
  if (!answer) return;

  const { value: content } = await Swal.fire({
    title: 'Edit Answer',
    input: 'textarea',
    inputValue: answer.content,
    inputPlaceholder: 'Your answer...',
    showCancelButton: true,
    confirmButtonText: 'Save Changes',
    inputValidator: (value) => {
      if (!value) {
        return 'Answer content cannot be empty';
      }
    }
  });

  if (!content) return;

  try {
    const response = await fetch(`https://localhost:3000/answers/${answerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ content })
    });

    if (!response.ok) throw new Error('Failed to update answer');

    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Answer updated successfully',
      timer: 1500
    });
    await loadUserContent();
  } catch (error) {
    console.error('Error updating answer:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to update answer'
    });
  }
}

async function deleteAnswer(answerId) {
  if (!isLoggedIn()) {
    Swal.fire({
      title: 'Authentication Required',
      text: 'Please log in to delete your answer',
      icon: 'warning',
      showCancelButton: false,
      confirmButtonText: 'OK'
    });
    return;
  }

  const result = await Swal.fire({
    title: 'Are you sure?',
    text: 'This action cannot be undone!',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete it!',
    cancelButtonText: 'No, keep it',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6'
  });

  if (!result.isConfirmed) return;

  try {
    const response = await fetch(`https://localhost:3000/answers/${answerId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    if (!response.ok) throw new Error('Failed to delete answer');

    Swal.fire({
      icon: 'success',
      title: 'Deleted!',
      text: 'Your answer has been deleted.',
      timer: 1500
    });
    await loadUserContent();
  } catch (error) {
    console.error('Error deleting answer:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to delete answer'
    });
  }
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Add tab switching functionality
function initializeTabs() {
  const tabButtons = document.querySelectorAll('[role="tab"]');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active state from all tabs
      tabButtons.forEach(btn => {
        btn.classList.remove('active', 'border-primary', 'text-primary');
        btn.classList.add('border-transparent', 'text-gray-500');
      });

      // Add active state to clicked tab
      button.classList.remove('border-transparent', 'text-gray-500');
      button.classList.add('active', 'border-primary', 'text-primary');

      // Show the corresponding panel
      const panels = document.querySelectorAll('[role="tabpanel"]');
      panels.forEach(panel => {
        panel.classList.add('hidden');
        if (panel.id === button.getAttribute('aria-controls')) {
          panel.classList.remove('hidden');
        }
      });
    });
  });
}

export async function renderProfile() {
  console.log('Rendering profile');
  if (!isLoggedIn()) {
    showToast('error', 'Please log in to view profile');
    return;
  }

  const profileUsername = document.getElementById('profileUsername');
  const questionsAsked = document.getElementById('questionsAsked');
  const answersGiven = document.getElementById('answersGiven');

  if (!profileUsername || !questionsAsked || !answersGiven) {
    console.error('Profile elements not found');
    return;
  }

  const username = decodeURIComponent(localStorage.getItem('username') || 'User');
  const stats = await fetchUserStats(false);

  profileUsername.textContent = username;
  questionsAsked.textContent = stats.questionsCount || 0;
  answersGiven.textContent = stats.answersCount || 0;

  // Initialize tab functionality
  initializeTabs();
  
  // Load user's questions and answers
  await loadUserContent();
}

async function fetchUserStats(forceRefresh = false) {
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

async function preloadUserStats() {
  if (isLoggedIn()) {
    return fetchUserStats();
  }
  return null;
}

// Export other functions for use in main.js
export { fetchUserStats, preloadUserStats };
