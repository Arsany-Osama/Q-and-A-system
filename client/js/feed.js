import { fetchQuestions } from './question.js';
import { showPopup, showToast, showSection } from './ui.js';
import { getToken, isLoggedIn } from './auth.js';
import { setupVoting, getUserVotes } from './vote.js';

let currentPage = 1;
const questionsPerPage = 10;

export async function renderFeed() {
  console.log('Rendering feed');
  const container = document.getElementById('questionFeed');
  const pagination = document.getElementById('pagination');
  if (!container || !pagination) {
    console.error('Feed container or pagination not found');
    return;
  }

  container.innerHTML = '<p>Loading questions...</p>';

  try {
    const questions = await fetchQuestions();
    if (questions.length === 0) {
      container.innerHTML = '<p>No questions available.</p>';
      pagination.innerHTML = '';
      return;
    }

    questions.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
    const start = (currentPage - 1) * questionsPerPage;
    const end = start + questionsPerPage;
    const paginatedQuestions = questions.slice(start, end);
    const userVotes = getUserVotes();

    container.innerHTML = '';
    paginatedQuestions.forEach((q, index) => {
      const upvoteClass = userVotes.questions[q.id] === 'upvote' ? 'text-blue-500 font-bold' : '';
      const downvoteClass = userVotes.questions[q.id] === 'downvote' ? 'text-blue-500 font-bold' : '';
      const wrapper = document.createElement('div');
      wrapper.classList.add('question-thread', 'animate-fade-in');
      wrapper.style.animationDelay = `${index * 0.1}s`;
      wrapper.setAttribute('data-id', q.id);
      wrapper.innerHTML = `
        <div class="question">
          <h3 class="text-base sm:text-lg font-semibold">${q.title}</h3>
          <p class="text-gray-600 dark:text-gray-400 text-sm">${q.content}</p>
          <small class="text-xs text-gray-500 dark:text-gray-500">Posted by ${q.username || 'Anonymous'} — ${new Date(q.createdAt).toLocaleString()}</small>
          <div class="tags mt-2">${q.tags ? q.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : ''}</div>
          <div class="vote-section mt-2">
            <button class="btn-vote upvote-btn ${upvoteClass}" data-question-id="${q.id}" aria-label="Upvote question">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
              </svg>
              <span>${q.upvotes || 0}</span>
            </button>
            <button class="btn-vote downvote-btn ${downvoteClass}" data-question-id="${q.id}" aria-label="Downvote question">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
              <span>${q.downvotes || 0}</span>
            </button>
          </div>
          <button class="answer-btn btn btn-primary mt-2 text-sm" data-question-id="${q.id}">Answer</button>
          <div class="answers-section mt-2">
            <button class="toggle-answers flex items-center text-primary hover:text-primary-dark text-sm" aria-expanded="false" aria-controls="answers-${q.id}">
              <svg class="w-4 h-4 mr-1 toggle-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
              <span>Show Answers (${q.answers.length})</span>
            </button>
            <div id="answers-${q.id}" class="answers hidden">
              ${q.answers.length === 0 ? '<p class="text-sm text-gray-500 dark:text-gray-500">No answers yet.</p>' : q.answers.map(a => {
                const answerUpvoteClass = userVotes.answers[a.id] === 'upvote' ? 'text-blue-500 font-bold' : '';
                const answerDownvoteClass = userVotes.answers[a.id] === 'downvote' ? 'text-blue-500 font-bold' : '';
                return `
                  <div class="answer p-2 bg-gray-100 dark:bg-gray-700 rounded-md mt-2">
                    <p class="text-sm">${a.content}</p>
                    <small class="block mt-1 text-xs text-gray-500 dark:text-gray-500">By ${a.username || 'Anonymous'} — ${new Date(a.createdAt).toLocaleString()}</small>
                    <div class="vote-section mt-1">
                      <button class="btn-vote upvote-answer-btn ${answerUpvoteClass}" data-answer-id="${a.id}" aria-label="Upvote answer">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        </svg>
                        <span>${a.upvotes || 0}</span>
                      </button>
                      <button class="btn-vote downvote-answer-btn ${answerDownvoteClass}" data-answer-id="${a.id}" aria-label="Downvote answer">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                        <span>${a.downvotes || 0}</span>
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
      container.appendChild(wrapper);
    });

    // Setup answers toggle
    document.querySelectorAll('.toggle-answers').forEach(button => {
      button.addEventListener('click', () => {
        const answersDiv = button.nextElementSibling;
        const isExpanded = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', !isExpanded);
        const icon = button.querySelector('.toggle-icon');
        icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';

        gsap.to(answersDiv, {
          height: isExpanded ? 0 : 'auto',
          opacity: isExpanded ? 0 : 1,
          duration: 0.3,
          ease: 'power2.out',
          onStart: () => {
            if (!isExpanded) {
              answersDiv.classList.remove('hidden');
            }
          },
          onComplete: () => {
            if (isExpanded) {
              answersDiv.classList.add('hidden');
            }
          },
        });

        button.querySelector('span').textContent = isExpanded ? `Show Answers (${button.parentElement.querySelector('.answers').children.length})` : `Hide Answers`;
      });
    });

    // Setup answer button
    document.querySelectorAll('.answer-btn').forEach(button => {
      button.addEventListener('click', () => {
        if (!isLoggedIn()) {
          showPopup('login');
          return;
        }
        const questionId = button.getAttribute('data-question-id');
        showSection('answerForm');
        fetchQuestions().then(questions => {
          const question = questions.find(q => q.id == questionId);
          if (question) {
            document.getElementById('questionSearch').value = question.title;
            document.getElementById('questionSelect').value = questionId;
            document.getElementById('questionSelect').setAttribute('required', 'true');
          }
        });
      });
    });

    setupVoting();
    renderPagination(questions.length, pagination);

  } catch (err) {
    console.error('Error rendering feed:', err);
    container.innerHTML = '<p>Error loading questions.</p>';
    showToast('error', 'Failed to load questions');
  }
}

export async function showQuestionDetails(questionId) {
  console.log('Showing question details for ID:', questionId);
  const questions = await fetchQuestions();
  const question = questions.find(q => q.id === parseInt(questionId));
  if (!question) {
    showToast('error', 'Question not found');
    return;
  }

  question.answers.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
  const userVotes = getUserVotes();

  const questionDetailsSection = document.createElement('section');
  questionDetailsSection.id = 'questionDetailsSection';
  questionDetailsSection.className = 'mt-8';
  const upvoteClass = userVotes.questions[question.id] === 'upvote' ? 'text-blue-500 font-bold' : '';
  const downvoteClass = userVotes.questions[question.id] === 'downvote' ? 'text-blue-500 font-bold' : '';
  questionDetailsSection.innerHTML = `
    <div class="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg flex flex-col space-y-4">
      <button id="backToFeedBtn" class="btn btn-secondary text-xs sm:text-sm px-3 py-1 w-fit">Back to Feed</button>
      <div class="space-y-3">
        <h2 class="text-lg sm:text-xl font-semibold">${question.title}</h2>
        <p class="text-sm sm:text-base text-gray-600 dark:text-gray-400">${question.content}</p>
        <p class="text-xs text-gray-500 dark:text-gray-500">Asked by ${question.username || 'Anonymous'} on ${new Date(question.createdAt).toLocaleDateString()}</p>
        <div class="flex flex-wrap gap-2">
          ${question.tags ? question.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : ''}
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-vote upvote-btn ${upvoteClass}" data-question-id="${question.id}" aria-label="Upvote question">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
            </svg>
            <span>${question.upvotes || 0}</span>
          </button>
          <button class="btn-vote downvote-btn ${downvoteClass}" data-question-id="${question.id}" aria-label="Downvote question">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
            <span>${question.downvotes || 0}</span>
          </button>
        </div>
        <button class="answer-btn btn btn-primary mt-2 text-sm" data-question-id="${question.id}">Answer</button>
      </div>
      <div class="space-y-3">
        <h3 class="text-base font-semibold">Answers (${question.answers.length})</h3>
        <div id="answersList" class="space-y-4">
          ${question.answers.length > 0 ? question.answers.map(a => {
            const answerUpvoteClass = userVotes.answers[a.id] === 'upvote' ? 'text-blue-500 font-bold' : '';
            const answerDownvoteClass = userVotes.answers[a.id] === 'downvote' ? 'text-blue-500 font-bold' : '';
            return `
              <div class="border-t border-gray-200 dark:border-gray-700 pt-3 flex flex-col space-y-2">
                <p class="text-sm">${a.content}</p>
                <p class="text-xs text-gray-500 dark:text-gray-500">Answered by ${a.username || 'Anonymous'} on ${new Date(a.createdAt).toLocaleDateString()}</p>
                <div class="flex items-center gap-2">
                  <button class="btn-vote upvote-answer-btn ${answerUpvoteClass}" data-answer-id="${a.id}" aria-label="Upvote answer">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                    </svg>
                    <span>${a.upvotes || 0}</span>
                  </button>
                  <button class="btn-vote downvote-answer-btn ${answerDownvoteClass}" data-answer-id="${a.id}" aria-label="Downvote answer">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                    <span>${a.downvotes || 0}</span>
                  </button>
                </div>
              </div>
            `;
          }).join('') : '<p class="text-sm text-gray-500 dark:text-gray-500">No answers yet.</p>'}
        </div>
      </div>
    </div>
  `;

  document.getElementById('feedSection').classList.add('hidden');
  const mainContent = document.getElementById('mainContent');
  const existingDetailsSection = document.getElementById('questionDetailsSection');
  if (existingDetailsSection) {
    existingDetailsSection.remove();
  }
  mainContent.appendChild(questionDetailsSection);

  document.getElementById('backToFeedBtn').addEventListener('click', () => {
    console.log('Back to feed clicked');
    questionDetailsSection.remove();
    showSection('feedSection');
    renderFeed();
  });

  document.querySelectorAll('.answer-btn').forEach(button => {
    button.addEventListener('click', () => {
      if (!isLoggedIn()) {
        showPopup('login');
        return;
      }
      const questionId = button.getAttribute('data-question-id');
      showSection('answerForm');
      fetchQuestions().then(questions => {
        const question = questions.find(q => q.id == questionId);
        if (question) {
          document.getElementById('questionSearch').value = question.title;
          document.getElementById('questionSelect').value = questionId;
          document.getElementById('questionSelect').setAttribute('required', 'true');
        }
      });
    });
  });

  setupVoting();
}

function renderPagination(totalQuestions, pagination) {
  console.log('Rendering pagination');
  const totalPages = Math.ceil(totalQuestions / questionsPerPage);
  pagination.innerHTML = '';

  for (let i = 1; i <= totalPages; i++) {
    const button = document.createElement('button');
    button.textContent = i;
    button.className = `px-3 py-1 rounded ${i === currentPage ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`;
    button.addEventListener('click', () => {
      console.log(`Pagination page ${i} clicked`);
      currentPage = i;
      renderFeed();
    });
    pagination.appendChild(button);
  }
}
