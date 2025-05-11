import { fetchQuestions } from './question.js';
import { showPopup, showToast, showSection, showAnswerFormPopup } from './ui.js';
import { getToken, isLoggedIn, fetchTopContributors } from './auth.js';
import { getUserVotes } from './vote.js';
import { setupReplyUI } from './reply.js';  // Add this import

let currentPage = 1;
const questionsPerPage = 10;
let currentFilter = 'trending'; // Default filter

// Filter functions
function applyFilter(questions, filter) {
  if (!questions || !questions.length) return [];
  
  const filtered = [...questions]; // Clone the array to avoid modifying original
  
  switch(filter) {
    case 'trending':
      return filtered.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
    
    case 'newest':
      return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
    case 'unanswered':
      return filtered
        .filter(q => !q.answers || q.answers.length === 0)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
    default:
      return filtered;
  }
}

// Initialize event listeners for filters
export function setupFilterButtons() {
  console.log('Setting up filter buttons');
  
  const activeFilterBtn = document.querySelector(`.filter-btn[data-filter="${currentFilter}"]`);
  if (activeFilterBtn) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    activeFilterBtn.classList.add('active');
  }
  
  document.querySelectorAll('.filter-btn').forEach(button => {
    button.addEventListener('click', () => {
      const filter = button.getAttribute('data-filter');
      if (filter === currentFilter) return;
      
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      button.classList.add('active');
      
      currentFilter = filter;
      currentPage = 1;
      
      const feed = document.getElementById('questionFeed');
      if (feed) {
        gsap.to(feed, {
          opacity: 0,
          y: 10,
          duration: 0.2,
          onComplete: () => {
            renderFeed();
            gsap.to(feed, {
              opacity: 1,
              y: 0,
              duration: 0.3,
              delay: 0.1
            });
          }
        });
      } else {
        renderFeed();
      }
    });
  });
  
  document.getElementById('sidebarAskQuestion')?.addEventListener('click', () => {
    showSection('questionForm');
  });
}

export async function renderFeed() {
  console.log('Rendering feed with filter:', currentFilter);
  const container = document.getElementById('questionFeed');
  const pagination = document.getElementById('pagination');
  if (!container || !pagination) {
    console.error('Feed container or pagination not found');
    return;
  }

  container.innerHTML = `
    <div class="loading-container flex justify-center items-center py-8">
      <div class="loader-pulse bg-blue-500"></div>
      <p class="ml-3 text-gray-600 dark:text-gray-400">Loading questions...</p>
    </div>
  `;

  renderTopContributors();

  try {
    let questions = await fetchQuestions();
    if (questions.length === 0) {
      container.innerHTML = `
        <div class="empty-state text-center py-10">
          <svg class="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="mt-4 text-gray-600 dark:text-gray-400">No questions available yet.</p>
          <button id="askFirstQuestion" class="mt-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors">Ask First Question</button>
        </div>
      `;
      pagination.innerHTML = '';
      
      document.getElementById('askFirstQuestion')?.addEventListener('click', () => {
        showSection('askQuestion');
      });
      return;
    }

    questions = applyFilter(questions, currentFilter);
    
    const start = (currentPage - 1) * questionsPerPage;
    const end = start + questionsPerPage;
    const paginatedQuestions = questions.slice(start, end);
    const userVotes = getUserVotes();

    container.innerHTML = '';
    paginatedQuestions.forEach((q, index) => {
      const upvoteClass = userVotes.questions[q.id] === 'upvote' ? 'active' : '';
      const downvoteClass = userVotes.questions[q.id] === 'downvote' ? 'active' : '';
      const wrapper = document.createElement('div');
      wrapper.classList.add('question-card', 'animate-fade-in', 'hover:shadow-lg', 'transition-all', 'duration-300');
      wrapper.style.animationDelay = `${index * 0.1}s`;
      wrapper.setAttribute('data-id', q.id);
      
      const totalVotes = (q.upvotes || 0) + (q.downvotes || 0);
      const voteRatio = totalVotes > 0 ? Math.round((q.upvotes / totalVotes) * 100) : 0;
      const engagementClass = q.answers.length > 2 ? 'high-engagement' : (q.answers.length > 0 ? 'medium-engagement' : '');
      
      wrapper.innerHTML = `
        <div class="card-content ${engagementClass}">
          <div class="card-header flex items-start mb-3">
            <div class="avatar-container mr-3">
              <div class="avatar bg-gradient-to-r from-indigo-500 to-blue-600 text-white flex items-center justify-center rounded-full h-10 w-10 text-sm font-medium">
                ${q.username ? q.username.charAt(0).toUpperCase() : 'A'}
              </div>
            </div>
            <div class="flex-1">
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="card-title font-semibold text-base sm:text-lg hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">${q.title}</h3>
                  <div class="meta flex items-center text-xs text-gray-600 dark:text-gray-400">
                    <span class="author font-medium">${q.username || 'Anonymous'}</span>
                    <span class="mx-1">•</span>
                    <span class="date">${new Date(q.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                    ${q.tags && q.tags.length ? `<span class="mx-1">•</span><span class="primary-tag text-blue-600 dark:text-blue-400">${q.tags[0]}</span>` : ''}
                  </div>
                </div>
                <div class="dropdown relative">
                  <button class="dropdown-toggle p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
                    </svg>
                  </button>
                  <div class="dropdown-menu hidden absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10">
                    <a href="#" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Save question</a>
                    <a href="#" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Report</a>
                    <a href="#" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Not interested</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="card-body">
            <p class="text-gray-700 dark:text-gray-300 text-sm line-clamp-3 mb-2">${q.content}</p>
            ${q.tags && q.tags.length > 1 ? 
              `<div class="tags-container mb-3">
                <div class="tags flex flex-wrap gap-1">
                  ${q.tags.map(tag => `<span class="tag text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">${tag}</span>`).join('')}
                </div>
              </div>` : ''}
          </div>
          
          <div class="card-footer mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            ${voteRatio >= 75 ? 
              `<div class="trending-indicator mb-2 text-xs text-orange-500 dark:text-orange-400 flex items-center">
                <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clip-rule="evenodd"></path>
                </svg>
                <span>Trending</span>
              </div>` : ''}
            <div class="reaction-bar flex justify-between items-center">
              <div class="vote-section flex items-center space-x-2">
                <button class="reaction-btn upvote-btn ${upvoteClass} hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded-md transition-colors" data-question-id="${q.id}" aria-label="Like question">
                  <svg class="w-5 h-5 mr-1 text-blue-600 dark:text-blue-400" fill="${upvoteClass ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                  <span class="vote-count text-gray-700 dark:text-gray-300">${q.upvotes || 0}</span>
                </button>
                <button class="reaction-btn downvote-btn ${downvoteClass} hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded-md transition-colors" data-question-id="${q.id}" aria-label="Dislike question">
                  <svg class="w-5 h-5 mr-1 text-red-500 dark:text-red-400" fill="${downvoteClass ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                  </svg>
                  <span class="vote-count text-gray-700 dark:text-gray-300">${q.downvotes || 0}</span>
                </button>
              </div>
              
              <div class="action-buttons flex items-center">
                <button class="action-btn answers-counter flex items-center mr-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" aria-label="View answers">
                  <svg class="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <span>${q.answers.length}</span>
                </button>
                
                <button class="action-btn share-btn flex items-center mr-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" aria-label="Share question">
                  <svg class="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
                
                <button class="answer-btn bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-xs px-3 py-1.5 flex items-center rounded-md transition-colors" data-question-id="${q.id}">
                  <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  Answer
                </button>
              </div>
            </div>
            
            <div class="answers-section mt-3">
              <div class="toggle-answers-container mb-2">
                <button class="toggle-answers flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm" aria-expanded="false" aria-controls="answers-${q.id}">
                  <svg class="w-4 h-4 mr-1 toggle-icon transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                  <span>${q.answers.length > 0 ? `Show ${q.answers.length} answers` : 'No answers yet'}</span>
                </button>
              </div>
              
              <div id="answers-${q.id}" class="answers hidden space-y-3">
                ${q.answers.length === 0 ? 
                  `<div class="no-answers flex items-center text-sm text-gray-500 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <span>Be the first to answer this question!</span>
                  </div>` : 
                  q.answers.map(a => {
                    const answerUpvoteClass = userVotes.answers[a.id] === 'upvote' ? 'active' : '';
                    const answerDownvoteClass = userVotes.answers[a.id] === 'downvote' ? 'active' : '';
                return `
                      <div class="answer-card p-2 bg-gray-50 dark:bg-gray-800 rounded-md" data-username="${a.username}" data-user-id="${a.userId}">
                        <div class="answer-header flex items-start mb-1">
                          <div class="avatar-container mr-2">
                            <div class="avatar bg-gradient-to-r from-gray-500 to-gray-600 text-white flex items-center justify-center rounded-full h-7 w-7 text-xs font-medium">
                              ${a.username ? a.username.charAt(0).toUpperCase() : 'A'}
                            </div>
                          </div>
                          <div>
                            <span class="font-medium text-xs">${a.username || 'Anonymous'}</span>
                            <span class="text-xs text-gray-500 dark:text-gray-400 ml-1">${new Date(a.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                          </div>
                        </div>
                        <div class="answer-content ml-9">
                          <p class="text-sm text-gray-700 dark:text-gray-300">${a.content}</p>
                          <div class="answer-footer mt-1 flex items-center">
                            <button class="reaction-btn reaction-btn-sm upvote-answer-btn ${answerUpvoteClass} text-blue-600 dark:text-blue-400" data-answer-id="${a.id}" aria-label="Like answer">
                              <svg class="w-4 h-4 mr-1" fill="${answerUpvoteClass ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                              </svg>
                              <span class="vote-count text-xs">${a.upvotes || 0}</span>
                            </button>
                            <button class="reaction-btn reaction-btn-sm downvote-answer-btn ${answerDownvoteClass} text-red-500 dark:text-red-400" data-answer-id="${a.id}" aria-label="Dislike answer">
                              <svg class="w-4 h-4 mr-1" fill="${answerDownvoteClass ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                              </svg>
                              <span class="vote-count text-xs">${a.downvotes || 0}</span>
                            </button>
                            <button class="reply-btn text-xs text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 ml-2 flex items-center transition-colors">
                              <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')
                }
                
                <div class="quick-answer flex items-start mt-2">
                  <div class="avatar-container mr-2">
                    <div class="avatar bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center justify-center rounded-full h-7 w-7 text-xs font-medium">
                      You
                    </div>
                  </div>
                  <div class="quick-answer-input-container flex-1 relative">
                    <input type="text" class="quick-answer-input w-full rounded-full pl-4 pr-10 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 text-gray-700 dark:text-gray-200" placeholder="Write a quick answer..." data-question-id="${q.id}">
                    <button class="send-answer-btn absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11h2v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      container.appendChild(wrapper);
    });

    document.querySelectorAll('.answer-card').forEach(answerCard => {
      const answerId = answerCard.querySelector('.reaction-btn-sm')?.dataset.answerId;
      const username = answerCard.getAttribute('data-username');
      const userId = answerCard.getAttribute('data-user-id');
      
      if (answerId) {
        setupReplyUI(answerCard, parseInt(answerId), username, userId);
      }
    });

    document.querySelectorAll('.quick-answer-input').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleQuickAnswer(input);
        }
      });
      
      input.addEventListener('focus', () => {
        if (!isLoggedIn()) {
          showPopup('login');
          return;
        }
      });
    });
    
    document.querySelectorAll('.send-answer-btn').forEach(button => {
      button.addEventListener('click', () => {
        const input = button.previousElementSibling;
        handleQuickAnswer(input);
      });
    });

    document.querySelectorAll('.answer-btn').forEach(button => {
      button.addEventListener('click', () => {
        if (!isLoggedIn()) {
          showPopup('login');
          return;
        }
        const questionId = button.getAttribute('data-question-id');
        showAnswerFormPopup(questionId);
      });
    });

    document.querySelectorAll('.card-title').forEach(title => {
      title.addEventListener('click', () => {
        const questionId = parseInt(title.closest('.question-card').getAttribute('data-id'));
        showQuestionDetails(questionId);
      });
    });

    renderPagination(questions.length, pagination);

  } catch (err) {
    console.error('Error rendering feed:', err);
    container.innerHTML = `
      <div class="error-state text-center py-8">
        <svg class="mx-auto h-12 w-12 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p class="mt-3 text-gray-600 dark:text-gray-400">Error loading questions.</p>
        <button class="retry-btn bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors mt-3">Retry</button>
      </div>
    `;
    showToast('error', 'Failed to load questions');
    
    document.querySelector('.retry-btn')?.addEventListener('click', () => {
      renderFeed();
    });
  }
}

async function renderTopContributors() {
  const contributorsContainer = document.querySelector('.contributors');
  if (!contributorsContainer) return;

  contributorsContainer.innerHTML = `
    <div class="loading-indicator flex items-center justify-center py-2">
      <div class="loader-pulse bg-blue-500"></div>
      <span class="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading contributors...</span>
    </div>
  `;

  try {
    const contributors = await fetchTopContributors();
    
    if (contributors.length === 0) {
      contributorsContainer.innerHTML = `
        <div class="text-center py-2">
          <p class="text-sm text-gray-500 dark:text-gray-400">No contributors yet</p>
        </div>
      `;
      return;
    }

    contributorsContainer.innerHTML = '';
    
    const gradients = [
      'from-blue-500 to-indigo-600',
      'from-indigo-500 to-purple-600',
      'from-purple-500 to-pink-600',
      'from-teal-500 to-emerald-600',
      'from-orange-500 to-amber-600'
    ];

    contributors.forEach((contributor, index) => {
      const initials = contributor.username
        .split(' ')
        .map(name => name.charAt(0).toUpperCase())
        .join('')
        .substring(0, 2);
      
      const gradientClass = gradients[index % gradients.length];
      
      const contributorElement = document.createElement('div');
      contributorElement.className = 'contributor flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors';
      contributorElement.innerHTML = `
        <div class="avatar bg-gradient-to-r ${gradientClass} text-white flex items-center justify-center rounded-full h-8 w-8 text-xs font-medium mr-2 shadow-sm">
          ${initials}
        </div>
        <div>
          <div class="font-medium text-sm text-gray-800 dark:text-gray-200">${contributor.username}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">${contributor.answerCount} answers</div>
        </div>
      `;
      
      contributorsContainer.appendChild(contributorElement);
    });
  } catch (error) {
    console.error('Error rendering top contributors:', error);
    contributorsContainer.innerHTML = `
      <div class="text-center py-2">
        <p class="text-sm text-gray-500 dark:text-gray-400">Failed to load contributors</p>
      </div>
    `;
  }
}

function handleQuickAnswer(input) {
  if (!isLoggedIn()) {
    showPopup('login');
    return;
  }
  
  const questionId = input.getAttribute('data-question-id');
  const answer = input.value.trim();
  
  if (!answer) return;
  
  fetch('/answers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({
      questionId: questionId,
      content: answer
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      input.value = '';
      showToast('success', 'Your answer has been posted!');
      setTimeout(() => renderFeed(), 1000);
    } else {
      throw new Error(data.message || 'Failed to post answer');
    }
  })
  .catch(error => {
    console.error('Error posting answer:', error);
    showToast('error', error.message || 'Failed to post your answer');
  });
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
  questionDetailsSection.className = 'mt-8 max-w-4xl mx-auto';
  const upvoteClass = userVotes.questions[question.id] === 'upvote' ? 'active' : '';
  const downvoteClass = userVotes.questions[question.id] === 'downvote' ? 'active' : '';
  
  questionDetailsSection.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <!-- Navigation bar -->
      <div class="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <button id="backToFeedBtn" class="flex items-center text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors text-sm font-medium">
          <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Feed
        </button>
        <div class="flex items-center space-x-2">
          <button class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-full transition-colors">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          </button>
          <button class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-full transition-colors">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Question content -->
      <div class="px-6 py-5">
        <div class="flex items-start space-x-3 mb-4">
          <div class="avatar-container flex-shrink-0">
            <div class="avatar bg-gradient-to-r from-indigo-500 to-blue-600 text-white flex items-center justify-center rounded-full h-10 w-10 text-sm font-medium shadow-sm">
              ${question.username ? question.username.charAt(0).toUpperCase() : 'A'}
            </div>
          </div>
          <div>
            <div class="flex items-center">
              <span class="font-medium text-gray-900 dark:text-gray-100">${question.username || 'Anonymous'}</span>
              <span class="mx-2 text-gray-400 dark:text-gray-500">•</span>
              <span class="text-sm text-gray-500 dark:text-gray-400">${new Date(question.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</span>
            </div>
            <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              ${new Date(question.createdAt).toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'})}
            </div>
          </div>
        </div>
        
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3">${question.title}</h2>
        
        <div class="prose dark:prose-invert prose-sm sm:prose-base max-w-none mb-4 text-gray-700 dark:text-gray-200">
          <p>${question.content}</p>
        </div>
        
        <div class="flex flex-wrap gap-2 mb-6">
          ${question.tags ? question.tags.map(tag => `<span class="tag bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-full text-xs font-medium">${tag}</span>`).join('') : ''}
        </div>
        
        <!-- Question stats and actions -->
        <div class="flex items-center justify-between py-3 border-t border-b border-gray-100 dark:border-gray-700 mb-6">
          <div class="flex items-center space-x-6">
            <div class="flex items-center space-x-2">
              <button class="reaction-btn btn-vote upvote-btn ${upvoteClass} hover:bg-gray-100 dark:hover:bg-gray-700 p-1.5 rounded-md transition-colors flex items-center" data-question-id="${question.id}" aria-label="Like question">
                <svg class="w-5 h-5 mr-1 text-blue-600 dark:text-blue-400" fill="${upvoteClass ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
                <span class="vote-count transition-all duration-300 font-medium text-gray-700 dark:text-gray-300">${question.upvotes || 0}</span>
              </button>
              <button class="reaction-btn btn-vote downvote-btn ${downvoteClass} hover:bg-gray-100 dark:hover:bg-gray-700 p-1.5 rounded-md transition-colors flex items-center" data-question-id="${question.id}" aria-label="Dislike question">
                <svg class="w-5 h-5 mr-1 text-red-500 dark:text-red-400" fill="${downvoteClass ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                </svg>
                <span class="vote-count transition-all duration-300 font-medium text-gray-700 dark:text-gray-300">${question.downvotes || 0}</span>
              </button>
            </div>
            
            <div class="flex items-center text-gray-500 dark:text-gray-400">
              <svg class="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span>${question.answers.length} ${question.answers.length === 1 ? 'answer' : 'answers'}</span>
            </div>
          </div>
          
          <button class="answer-btn bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-md transition-colors flex items-center shadow-sm" data-question-id="${question.id}">
            <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Answer
          </button>
        </div>
        
        <!-- Answers section -->
        <div class="space-y-1">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Answers (${question.answers.length})</h3>
            <div class="flex items-center rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
              <button class="py-1 px-3 text-xs font-medium rounded-md bg-white dark:bg-gray-600 shadow-sm text-gray-800 dark:text-gray-200">
                Most Relevant
              </button>
              <button class="py-1 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                Newest
              </button>
            </div>
          </div>
          
          <div id="answersList" class="space-y-6">
            ${question.answers.length > 0 ? question.answers.map(a => {
              const answerUpvoteClass = userVotes.answers[a.id] === 'upvote' ? 'active' : '';
              const answerDownvoteClass = userVotes.answers[a.id] === 'downvote' ? 'active' : '';
              return `
                <div class="answer-item bg-gray-50 dark:bg-gray-800/70 rounded-lg p-4">
                  <div class="flex items-start space-x-3 mb-2">
                    <div class="avatar-container flex-shrink-0">
                      <div class="avatar bg-gradient-to-r from-gray-500 to-gray-600 text-white flex items-center justify-center rounded-full h-8 w-8 text-xs font-medium shadow-sm">
                        ${a.username ? a.username.charAt(0).toUpperCase() : 'A'}
                      </div>
                    </div>
                    <div class="flex-1">
                      <div class="flex items-center">
                        <span class="font-medium text-sm text-gray-900 dark:text-gray-100">${a.username || 'Anonymous'}</span>
                        <span class="mx-2 text-xs text-gray-400 dark:text-gray-500">•</span>
                        <span class="text-xs text-gray-500 dark:text-gray-400">${new Date(a.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                      </div>
                      
                      <div class="mt-2 text-sm text-gray-700 dark:text-gray-300">${a.content}</div>
                      
                      <div class="mt-3 flex items-center space-x-3">
                        <button class="reaction-btn btn-vote upvote-answer-btn ${answerUpvoteClass} hover:bg-gray-200/70 dark:hover:bg-gray-700 p-1 rounded-md transition-colors flex items-center" data-answer-id="${a.id}" aria-label="Like answer">
                          <svg class="w-4 h-4 mr-1 text-blue-600 dark:text-blue-400" fill="${answerUpvoteClass ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                          </svg>
                          <span class="vote-count transition-all duration-300 text-sm text-gray-700 dark:text-gray-300">${a.upvotes || 0}</span>
                        </button>
                        <button class="reaction-btn btn-vote downvote-answer-btn ${answerDownvoteClass} hover:bg-gray-200/70 dark:hover:bg-gray-700 p-1 rounded-md transition-colors flex items-center" data-answer-id="${a.id}" aria-label="Dislike answer">
                          <svg class="w-4 h-4 mr-1 text-red-500 dark:text-red-400" fill="${answerDownvoteClass ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                          </svg>
                          <span class="vote-count transition-all duration-300 text-sm text-gray-700 dark:text-gray-300">${a.downvotes || 0}</span>
                        </button>
                        <button class="reply-btn text-xs text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center transition-colors">
                          <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join('') : '<div class="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/70 p-4 rounded-lg text-center">No answers yet. Be the first to contribute!</div>'}
          </div>
        </div>
        
        <!-- Answer input -->
        <div class="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div class="flex items-start space-x-3">
            <div class="avatar-container flex-shrink-0">
              <div class="avatar bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center justify-center rounded-full h-9 w-9 text-sm font-medium">
                You
              </div>
            </div>
            <div class="flex-1">
              <div class="bg-gray-100 dark:bg-gray-700 rounded-2xl p-3 relative">
                <textarea class="bg-transparent w-full outline-none resize-none text-gray-700 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 text-sm min-h-[80px]" placeholder="Write your answer here..."></textarea>
                <div class="flex justify-end mt-2">
                  <button class="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm px-4 py-1.5 rounded-md transition-colors flex items-center shadow-sm">
                    Submit Answer
                  </button>
                </div>
              </div>
            </div>
          </div>
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
      showAnswerFormPopup(questionId);
    });
  });
}

function renderPagination(totalQuestions, pagination) {
  console.log('Rendering pagination');
  const totalPages = Math.ceil(totalQuestions / questionsPerPage);
  pagination.innerHTML = '';

  // Add prev button
  const prevButton = document.createElement('button');
  prevButton.className = `pagination-btn prev-btn ${currentPage === 1 ? 'disabled' : ''} flex items-center justify-center px-3 py-1 rounded-l-lg border border-gray-300 dark:border-gray-600 ${currentPage === 1 ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed text-gray-400 dark:text-gray-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`;
  prevButton.innerHTML = `
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
    </svg>
  `;
  prevButton.disabled = currentPage === 1;
  prevButton.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderFeed();
    }
  });
  pagination.appendChild(prevButton);

  // Calculate visible page range
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  
  if (endPage - startPage < 4 && startPage > 1) {
    startPage = Math.max(1, endPage - 4);
  }

  // Add first page button if needed
  if (startPage > 1) {
    const firstPageBtn = document.createElement('button');
    firstPageBtn.textContent = '1';
    firstPageBtn.className = `pagination-btn flex items-center justify-center px-3 py-1 border border-gray-300 dark:border-gray-600 ${1 === currentPage ? 'bg-blue-600 text-white font-medium dark:bg-blue-500' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors'}`;
    firstPageBtn.addEventListener('click', () => {
      currentPage = 1;
      renderFeed();
    });
    pagination.appendChild(firstPageBtn);
    
    // Add ellipsis if there's a gap
    if (startPage > 2) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'pagination-ellipsis flex items-center justify-center px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300';
      ellipsis.textContent = '...';
      pagination.appendChild(ellipsis);
    }
  }

  // Add page buttons
  for (let i = startPage; i <= endPage; i++) {
    if (i === 1 || i === totalPages) continue; // Skip first and last pages as they're handled separately
    
    const button = document.createElement('button');
    button.textContent = i;
    button.className = `pagination-btn flex items-center justify-center px-3 py-1 border border-gray-300 dark:border-gray-600 ${i === currentPage ? 'bg-blue-600 text-white font-medium dark:bg-blue-500' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors'}`;
    button.addEventListener('click', () => {
      console.log(`Pagination page ${i} clicked`);
      currentPage = i;
      renderFeed();
    });
    pagination.appendChild(button);
  }

  // Add last page button if needed
  if (endPage < totalPages) {
    // Add ellipsis if there's a gap
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'pagination-ellipsis flex items-center justify-center px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300';
      ellipsis.textContent = '...';
      pagination.appendChild(ellipsis);
    }
    
    const lastPageBtn = document.createElement('button');
    lastPageBtn.textContent = totalPages;
    lastPageBtn.className = `pagination-btn flex items-center justify-center px-3 py-1 border border-gray-300 dark:border-gray-600 ${totalPages === currentPage ? 'bg-blue-600 text-white font-medium dark:bg-blue-500' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors'}`;
    lastPageBtn.addEventListener('click', () => {
      currentPage = totalPages;
      renderFeed();
    });
    pagination.appendChild(lastPageBtn);
  }

  // Add next button
  const nextButton = document.createElement('button');
  nextButton.className = `pagination-btn next-btn ${currentPage === totalPages ? 'disabled' : ''} flex items-center justify-center px-3 py-1 rounded-r-lg border border-gray-300 dark:border-gray-600 ${currentPage === totalPages ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed text-gray-400 dark:text-gray-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors'}`;
  nextButton.innerHTML = `
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
    </svg>
  `;
  nextButton.disabled = currentPage === totalPages;
  nextButton.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderFeed();
    }
  });
  pagination.appendChild(nextButton);
  
  // Add pagination styles
  pagination.classList.add('flex', 'justify-center', 'space-x-1', 'mt-8');
}

export function updateVoteCount(button, newCount) {
  const countElement = button.querySelector('.vote-count');
  const iconElement = button.querySelector('svg');
  
  if (countElement) {
    const oldValue = parseInt(countElement.textContent);
    const newValue = newCount || 0;
    
    countElement.textContent = newValue;
    
    // Update the SVG fill if the button is now active
    if (button.classList.contains('active')) {
      iconElement.setAttribute('fill', 'currentColor');
    } else {
      iconElement.setAttribute('fill', 'none');
    }
    
    if (newValue > oldValue) {
      countElement.animate([
        { transform: 'scale(1)', opacity: 0.5 },
        { transform: 'scale(1.3)', opacity: 1 },
        { transform: 'scale(1)', opacity: 1 }
      ], {
        duration: 300,
        easing: 'ease-out'
      });
      
      // Also animate the icon
      iconElement.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(1.2)' },
        { transform: 'scale(1)' }
      ], {
        duration: 300,
        easing: 'ease-out'
      });
      
    } else if (newValue < oldValue) {
      countElement.animate([
        { transform: 'scale(1)', opacity: 0.5 },
        { transform: 'scale(0.8)', opacity: 1 },
        { transform: 'scale(1)', opacity: 1 }
      ], {
        duration: 300,
        easing: 'ease-out'
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupFilterButtons();

  // Setup the delegated event listener for toggle-answers
  document.addEventListener('click', (e) => {
    // Handle dropdown toggles with delegation
    if (e.target.closest('.dropdown-toggle')) {
      e.stopPropagation();
      const button = e.target.closest('.dropdown-toggle');
      const menu = button.nextElementSibling;
      
      document.querySelectorAll('.dropdown-menu').forEach(m => {
        if (m !== menu) m.classList.add('hidden');
      });
      
      menu.classList.toggle('hidden');
    }

    // Handle answers toggle with delegation
    if (e.target.closest('.toggle-answers')) {
      const button = e.target.closest('.toggle-answers');
      const answersDiv = button.closest('.toggle-answers-container').nextElementSibling;
      const isExpanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', !isExpanded);
      const icon = button.querySelector('.toggle-icon');
      
      // Ensure answersDiv exists before proceeding
      if (!answersDiv) {
        console.error('Could not find answers div element');
        return;
      }

      // First make sure the element is visible before animating
      if (!isExpanded) {
        answersDiv.classList.remove('hidden');
        // Set initial height to 0 for proper animation
        answersDiv.style.height = '0px';
        answersDiv.style.overflow = 'hidden';
        answersDiv.style.display = 'block';
      }
      
      // Animate the icon rotation
      gsap.to(icon, {
        rotation: isExpanded ? 0 : 180,
        duration: 0.3,
        ease: 'power2.out'
      });

      // Use a more reliable animation approach
      if (!isExpanded) {
        // Get the natural height of the element to animate to
        const height = answersDiv.scrollHeight;
        
        gsap.fromTo(answersDiv, 
          { height: 0, opacity: 0 },
          { 
            height: height, 
            opacity: 1, 
            duration: 0.3, 
            ease: 'power2.out',
            onComplete: () => {
              // Remove inline styles to allow natural resizing
              answersDiv.style.height = 'auto';
              answersDiv.style.overflow = 'visible';
            }
          }
        );
      } else {
        // Closing animation
        const height = answersDiv.offsetHeight;
        
        // First set fixed height for smooth animation
        answersDiv.style.height = `${height}px`;
        answersDiv.style.overflow = 'hidden';
        
        gsap.to(answersDiv, {
          height: 0,
          opacity: 0,
          duration: 0.3,
          ease: 'power2.out',
          onComplete: () => {
            answersDiv.classList.add('hidden');
            // Reset styles
            answersDiv.style.height = '';
            answersDiv.style.overflow = '';
            answersDiv.style.display = '';
          }
        });
      }

      // Update the button text
      const answerCount = button.closest('.answers-section').querySelector('.answers').children.length - 1;
      button.querySelector('span').textContent = isExpanded ? 
        `Show ${answerCount > 0 ? answerCount : 0} answers` : 
        `Hide answers`;
    }
  });
});