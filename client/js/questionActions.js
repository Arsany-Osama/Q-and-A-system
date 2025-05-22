import { getToken, isLoggedIn } from './auth.js';
import { showToast } from './ui.js';

/**
 * Function to edit a question from the feed
 * @param {string} questionId - The ID of the question to edit
 */
async function editQuestionFromFeed(questionId) {  if (!isLoggedIn()) {
    Swal.fire({      title: '<span class="text-amber-600 dark:text-amber-400 font-bold">Authentication Required</span>',
      html: `
        <div class="p-3 flex items-center space-x-3 mb-2">
          <svg class="w-6 h-6 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
          <p class="text-gray-700 dark:text-gray-300">Please log in to edit your question</p>
        </div>
      `,
      showCancelButton: false,
      confirmButtonText: '<i class="fas fa-check mr-2"></i>OK',
      customClass: {
        popup: 'animated fadeInDown rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl',
        title: 'text-lg font-semibold',
        confirmButton: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-5 py-2.5 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105'
      },
      background: 'var(--swal-bg, linear-gradient(180deg, #ffffff, #f8f9fa))',
      backdrop: `rgba(0, 0, 0, 0)`,
      timerProgressBar: true,
      timer: 3000,
      buttonsStyling: false,
      ...applySwalDarkMode()
    });
    return;
  }

  // Find the question in the current feed
  const question = window.paginatedQuestions.find(q => q.id === parseInt(questionId));
  if (!question) return;  const { value: formValues } = await Swal.fire({
    title: '<span class="text-xl font-bold text-blue-600 dark:text-blue-400">Edit Your Question</span>',    html: `
        <div class="mb-4">
          <label for="swal-title" class="block text-left text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <i class="fas fa-heading text-blue-500 dark:text-blue-400 mr-2"></i>Question Title
          </label>
          <input id="swal-title" 
            class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 dark:bg-gray-700 dark:text-gray-100" 
            value="${escapeHtml(question.title)}" 
            placeholder="Enter the title of your question">
        </div>
        
        <div class="mb-4">
          <label for="swal-content" class="block text-left text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <i class="fas fa-align-left text-blue-500 dark:text-blue-400 mr-2"></i>Question Content
          </label>
          <textarea id="swal-content" 
            class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 min-h-[150px] dark:bg-gray-700 dark:text-gray-100" 
            placeholder="Describe your question in detail">${escapeHtml(question.content)}</textarea>
        </div>
        
        <div>
          <label for="swal-tags" class="block text-left text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <i class="fas fa-tags text-blue-500 dark:text-blue-400 mr-2"></i>Tags
          </label>
          <input id="swal-tags" 
            class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 dark:bg-gray-700 dark:text-gray-100" 
            value="${question.tags ? question.tags.join(', ') : ''}" 
            placeholder="javascript, react, nodejs (comma separated)">
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">Separate tags with commas. Good tags help others find your question.</p>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: '<i class="fas fa-save mr-2"></i>Save Changes',
    cancelButtonText: '<i class="fas fa-times mr-2"></i>Cancel',
    customClass: {
      popup: 'animated fadeIn rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl',
      container: ' mx-auto',
      title: 'text-center mb-4',
      confirmButton: 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium py-2.5 px-5 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105',
      cancelButton: 'bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white font-medium py-2.5 px-5 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105',
      actions: 'mt-5 space-x-3'
    },    
    buttonsStyling: false,
    background: 'var(--swal-bg, linear-gradient(180deg, #ffffff, #f8f9fa))',
    backdrop: `rgba(0, 0, 0, 0)`,
    showClass: {
      popup: 'animated fadeInDown faster'
    },
    hideClass: {
      popup: 'animated fadeOutUp faster'
    },
    ...applySwalDarkMode(),
    preConfirm: () => ({
      title: document.getElementById('swal-title').value,
      content: document.getElementById('swal-content').value,
      tags: document.getElementById('swal-tags').value.split(',').map(tag => tag.trim()).filter(Boolean)
    })
  });
  if (!formValues) return;
  try {    // Show loading state
    Swal.fire({
      title: '<span class="text-blue-600 dark:text-blue-400 font-semibold">Saving changes...</span>',
      html: `
        <div class="flex justify-center items-center">
          <div class="loader">
            <svg class="animate-spin h-10 w-10 text-blue-500 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </div>
        <p class="text-gray-600 dark:text-gray-400 mt-3">Your changes are being processed...</p>
      `,
      showConfirmButton: false,
      allowOutsideClick: false,
      backdrop: `rgba(0, 0, 0, 0)`,
      background: 'var(--swal-bg, linear-gradient(180deg, #ffffff, #f8f9fa))',
      customClass: {
        popup: 'rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700'
      },
      ...applySwalDarkMode()
    });

    const response = await fetch(`https://localhost:3000/questions/${questionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(formValues)
    });

    if (!response.ok) throw new Error('Failed to update question');    Swal.fire({
      icon: 'success',
      iconColor: '#10B981',
      title: '<span class="text-green-600 dark:text-green-400 font-bold">Success!</span>',
      html: `
        <div class="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg border border-green-100 dark:border-green-800/50 mb-3">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-green-500 dark:text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p class="text-gray-700 dark:text-gray-300">Your question has been updated successfully</p>
          </div>
        </div>
      `,
      timer: 2500,
      timerProgressBar: true,
      showConfirmButton: false,
      background: 'var(--swal-bg, linear-gradient(180deg, #ffffff, #f8f9fa))',
      backdrop: `rgba(0, 0, 0, 0)`,
      customClass: {
        popup: 'animated fadeInUp rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700',
        title: 'text-lg mb-2',
      },
      showClass: {
        popup: 'animate__animated animate__fadeInUp animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutDown animate__faster'
      },
      ...applySwalDarkMode()
    });
    
    // Refresh the feed to show updated question
    // Use the global renderFeed function from feed.js
    if (typeof window.renderFeed === 'function') {
      await window.renderFeed();
    }
  } catch (error) {
    console.error('Error updating question:', error);    Swal.fire({
      icon: 'error',
      iconColor: '#EF4444',
      title: '<span class="text-red-600 dark:text-red-400 font-bold">Error</span>',
      html: `
        <div class="bg-red-50 dark:bg-red-900/30 p-3 rounded-lg border border-red-100 dark:border-red-800/50 mb-3">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-red-500 dark:text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p class="text-gray-700 dark:text-gray-300">Failed to update your question. Please try again.</p>
          </div>
        </div>
      `,
      confirmButtonText: '<i class="fas fa-sync-alt mr-2"></i>Try Again',
      background: 'var(--swal-bg, linear-gradient(180deg, #ffffff, #f8f9fa))',
      backdrop: `rgba(0, 0, 0, 0)`,
      customClass: {
        popup: 'animated shake rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700',
        confirmButton: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium py-2.5 px-5 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105',
      },
      buttonsStyling: false,
      ...applySwalDarkMode()
    });
  }
}

/**
 * Function to delete a question from the feed
 * @param {string} questionId - The ID of the question to delete
 */
async function deleteQuestionFromFeed(questionId) {  if (!isLoggedIn()) {
    Swal.fire({      title: '<span class="text-amber-600 dark:text-amber-400 font-bold">Authentication Required</span>',
      html: `
        <div class="p-3 flex items-center space-x-3 mb-2">
          <svg class="w-6 h-6 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
          <p class="text-gray-700 dark:text-gray-300">Please log in to delete your question</p>
        </div>
      `,
      showCancelButton: false,
      confirmButtonText: '<i class="fas fa-check mr-2"></i>OK',
      customClass: {
        popup: 'animated fadeInDown rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl',
        title: 'text-lg font-semibold',
        confirmButton: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-5 py-2.5 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105'
      },
      background: 'var(--swal-bg, linear-gradient(180deg, #ffffff, #f8f9fa))',
      backdrop: `rgba(0, 0, 0, 0)`,
      timerProgressBar: true,
      timer: 3000,
      buttonsStyling: false,
      ...applySwalDarkMode()
    });
    return;
  }  const result = await Swal.fire({
    title: '<span class="text-xl font-bold text-red-600 dark:text-red-400">Delete Question</span>',
    html: `
      <div class="p-5 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border border-red-200 dark:border-red-800/50 rounded-lg mb-4 shadow-inner">
        <div class="flex items-center mb-4">
          <div class="flex-shrink-0 bg-red-100 dark:bg-red-900/30 rounded-full p-2">
            <svg class="w-8 h-8 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
          <div class="ml-3">
            <span class="text-red-700 dark:text-red-300 font-semibold text-lg">Warning</span>
            <p class="text-gray-700 dark:text-gray-300 text-left mt-1">Are you sure you want to delete this question? <br>This action <span class="font-bold">cannot</span> be undone!</p>
          </div>
        </div>
        <div class="mt-2 rounded-lg bg-white dark:bg-gray-800 p-3 border border-red-200 dark:border-red-700/50">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            <i class="fas fa-info-circle text-blue-500 dark:text-blue-400 mr-2"></i>
            All associated answers and comments will also be deleted.
          </p>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '<i class="fas fa-trash-alt mr-2"></i>Yes, delete it!',
    cancelButtonText: '<i class="fas fa-times mr-2"></i>No, keep it',
    customClass: {
      popup: 'animated fadeIn rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700',
      container: ' mx-auto',
      title: 'text-center mb-4',
      confirmButton: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium py-2.5 px-5 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105',
      cancelButton: 'bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white font-medium py-2.5 px-5 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105',
      actions: 'mt-5 space-x-3'
    },    
    buttonsStyling: false,
    background: 'var(--swal-bg, linear-gradient(180deg, #ffffff, #f8f9fa))',
    backdrop: `rgba(0, 0, 0, 0)`,
    showClass: {
      popup: 'animated fadeInDown faster'
    },
    hideClass: {
      popup: 'animated fadeOutUp faster'
    },
    reverseButtons: true,
    ...applySwalDarkMode()
  });

  if (!result.isConfirmed) return;  try {    // Show loading state
    Swal.fire({
      title: '<span class="text-red-600 dark:text-red-400 font-semibold">Deleting...</span>',
      html: `
        <div class="flex justify-center items-center">
          <div class="loader">
            <svg class="animate-spin h-10 w-10 text-red-500 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </div>
        <p class="text-gray-600 dark:text-gray-400 mt-3">Removing your question...</p>
      `,
      showConfirmButton: false,
      allowOutsideClick: false,
      backdrop: `rgba(0, 0, 0, 0)`,
      background: 'var(--swal-bg, linear-gradient(180deg, #ffffff, #f8f9fa))',
      customClass: {
        popup: 'rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700'
      },
      ...applySwalDarkMode()
    });

    const response = await fetch(`https://localhost:3000/questions/${questionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    if (!response.ok) throw new Error('Failed to delete question');    Swal.fire({
      icon: 'success',
      iconColor: '#10B981',
      title: '<span class="text-green-600 dark:text-green-400 font-bold">Deleted!</span>',
      html: `
        <div class="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg border border-green-100 dark:border-green-800/50 mb-3">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-green-500 dark:text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p class="text-gray-700 dark:text-gray-300">Your question has been successfully removed.</p>
          </div>
        </div>
      `,
      timer: 2500,
      timerProgressBar: true,
      showConfirmButton: false,
      background: 'var(--swal-bg, linear-gradient(180deg, #ffffff, #f8f9fa))',
      backdrop: `rgba(0, 0, 0, 0)`,
      customClass: {
        popup: 'animated fadeInUp rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700',
        title: 'text-lg mb-2',
      },
      showClass: {
        popup: 'animate__animated animate__fadeInUp animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutDown animate__faster'
      },
      ...applySwalDarkMode()
    });
    
    // Refresh the feed to remove deleted question
    // Use the global renderFeed function from feed.js
    if (typeof window.renderFeed === 'function') {
      await window.renderFeed();
    }
  } catch (error) {
    console.error('Error deleting question:', error);    Swal.fire({
      icon: 'error',
      iconColor: '#EF4444',
      title: '<span class="text-red-600 dark:text-red-400 font-bold">Error</span>',
      html: `
        <div class="bg-red-50 dark:bg-red-900/30 p-3 rounded-lg border border-red-100 dark:border-red-800/50 mb-3">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-red-500 dark:text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p class="text-gray-700 dark:text-gray-300">Failed to delete your question. Please try again.</p>
          </div>
        </div>
      `,
      confirmButtonText: '<i class="fas fa-sync-alt mr-2"></i>Try Again',
      background: 'var(--swal-bg, linear-gradient(180deg, #ffffff, #f8f9fa))',
      backdrop: `rgba(0, 0, 0, 0)`,
      customClass: {
        popup: 'animated shake rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700',
        confirmButton: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium py-2.5 px-5 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105',
      },
      buttonsStyling: false,
      ...applySwalDarkMode()
    });
  }
}

/**
 * Helper function to escape HTML special characters
 * @param {string} unsafe - The string to escape
 * @returns {string} - The escaped string
 */
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Helper function to apply dark mode styling to SweetAlert popups
 */
function applySwalDarkMode() {
  return {
    didOpen: () => {
      // Set dynamic background based on theme
      if (document.documentElement.classList.contains('dark')) {
        document.querySelector('.swal2-popup').style.setProperty('--swal-bg', 'linear-gradient(180deg, #1e293b, #0f172a)');
        document.querySelector('.swal2-popup').classList.add('dark-mode-popup');
      } else {
        // Ensure light mode has proper styling
        document.querySelector('.swal2-popup').style.setProperty('--swal-bg', 'linear-gradient(180deg, #ffffff, #f1f5f9)');
        document.querySelector('.swal2-popup').classList.add('light-mode-popup');
      }
    }
  };
}

export { editQuestionFromFeed, deleteQuestionFromFeed };
