import { fetchQuestions } from './question.js';
import { getToken, isLoggedIn } from './auth.js';
import { showToast, showPopup } from './ui.js';

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
      const response = await fetch('/answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          questionId,
          content,
        }),
      });
      const result = await response.json();
      if (result.success) {
        showToast('success', 'Answer submitted successfully');
        form.reset();
        questionSearch.value = '';
        questionSelect.value = '';
        questionSelect.removeAttribute('required');
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
