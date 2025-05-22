import { fetchQuestions } from './question.js';
import { isLoggedIn } from './auth.js';
import { showToast, showPopup } from './ui.js';
import { answers as answersApi } from './utils/api.js';

export function setupAnswerForm() {
  console.log('Setting up answer form');
  const form = document.getElementById('postAnswerForm');
  const questionSearch = document.getElementById('questionSearch');
  const questionList = document.getElementById('questionListToAnswer');
  const questionSelect = document.getElementById('questionSelect');
  if (!form || !questionSearch || !questionList || !questionSelect) {
    console.error('Missing DOM elements:', { form, questionSearch, questionList, questionSelect });
    return;
  }

  let questions = [];

  fetchQuestions().then(data => {
    console.log('Fetched questions:', data);
    questions = data;
  }).catch(err => {
    console.error('Failed to load questions:', err);
    showToast('error', 'Failed to load questions');
  });

  questionSearch.addEventListener('input', () => {
    console.log('Question search input');
    const query = questionSearch.value.toLowerCase();
    questionList.innerHTML = '';
    const filteredQuestions = questions.filter(q => 
      q.title.toLowerCase().includes(query) || q.content.toLowerCase().includes(query)
    );
    console.log('Filtered questions:', filteredQuestions);
    
    filteredQuestions.forEach(q => {
      const li = document.createElement('li');
      li.textContent = q.title;
      li.className = 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 p-3 sm:p-4 text-sm sm:text-base rounded';
      li.addEventListener('click', () => {
        console.log('Selected question:', q);
        questionSearch.value = q.title;
        questionSelect.value = q.id;
        questionList.innerHTML = '';
        questionSelect.setAttribute('required', 'true');
        console.log('Updated questionSelect value:', questionSelect.value);
      });
      questionList.appendChild(li);
    });

    if (filteredQuestions.length > 0) {
      questionList.classList.remove('hidden');
    } else {
      questionList.classList.add('hidden');
    }
  });

  questionSearch.addEventListener('change', () => {
    if (!questionSearch.value) {
      questionSelect.value = '';
      questionSelect.removeAttribute('required');
      console.log('Cleared questionSelect value:', questionSelect.value);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Answer form submitted');
    if (!isLoggedIn()) {
      showPopup('login');
      return;
    }
    const questionId = parseInt(questionSelect.value);
    const content = document.getElementById('answerContent').value;
    console.log('Submitting answer:', { questionId, content });

    if (!questionId || isNaN(questionId)) {
      showToast('error', 'Please select a valid question');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const spinner = document.getElementById('answerSpinner');
    
    submitBtn.disabled = true;
    spinner.classList.remove('hidden');

    try {
      const result = await answersApi.create(questionId, content);
        if (result.success) {
        showToast('success', 'Answer submitted successfully');
        form.reset();
        questionSearch.value = '';
        questionSelect.value = '';
        questionSelect.removeAttribute('required');
        
        // Hide the answer form popup
        const answerFormPopup = document.getElementById('answerFormPopup');
        if (answerFormPopup) {
          answerFormPopup.classList.add('hidden');
        }
        
        // Ensure feed is visible
        const feedSection = document.getElementById('feedSection');
        if (feedSection) {
          feedSection.classList.remove('hidden');
        }
      } else {
        showToast('error', result.message || 'Failed to submit answer');
      }
    } catch (err) {
      console.error('Error submitting answer:', err);
      showToast('error', 'Network error submitting answer');
    } finally {
      submitBtn.disabled = false;
      spinner.classList.add('hidden');
    }
  });
}

export async function updateAnswer(answerId, content) {
  if (!isLoggedIn()) {
    showPopup('login');
    return { success: false, message: 'Please log in to update your answer' };
  }

  try {
    const result = await answersApi.updateAnswer(answerId, { content });
    if (result.success) {
      showToast('success', 'Answer updated successfully');
      return { success: true, data: result.data };
    } else {
      showToast('error', result.message || 'Failed to update answer');
      return { success: false, message: result.message };
    }
  } catch (err) {
    console.error('Error updating answer:', err);
    showToast('error', 'Network error updating answer');
    return { success: false, message: 'Network error' };
  }
}

export async function deleteAnswer(answerId) {
  if (!isLoggedIn()) {
    showPopup('login');
    return { success: false, message: 'Please log in to delete your answer' };
  }

  try {
    const result = await answersApi.deleteAnswer(answerId);
    if (result.success) {
      showToast('success', 'Answer deleted successfully');
      return { success: true };
    } else {
      showToast('error', result.message || 'Failed to delete answer');
      return { success: false, message: result.message };
    }
  } catch (err) {
    console.error('Error deleting answer:', err);
    showToast('error', 'Network error deleting answer');
    return { success: false, message: 'Network error' };
  }
}
