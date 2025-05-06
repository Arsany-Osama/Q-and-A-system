import { fetchQuestions } from './question.js';
import { showPopup, showToast, showSection } from './ui.js';
import { getToken, isLoggedIn, fetchTopContributors } from './auth.js';
import { getUserVotes } from './vote.js';

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
      <div class="loader-pulse"></div>
      <p class="ml-3 text-gray-600 dark:text-gray-400">Loading questions...</p>
    </div>
  `;

  renderTopContributors();

  try {
    let questions = await fetchQuestions();
    if (questions.length === 0) {
      container.innerHTML = `
        <div class="empty-state text-center py-10">
          <svg class="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="mt-4 text-gray-600 dark:text-gray-400">No questions available yet.</p>
          <button id="askFirstQuestion" class="mt-3 btn btn-primary">Ask First Question</button>
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
      wrapper.classList.add('question-card', 'animate-fade-in');
      wrapper.style.animationDelay = `${index * 0.1}s`;
      wrapper.setAttribute('data-id', q.id);
      
      const totalVotes = (q.upvotes || 0) + (q.downvotes || 0);
      const voteRatio = totalVotes > 0 ? Math.round((q.upvotes / totalVotes) * 100) : 0;
      const engagementClass = q.answers.length > 2 ? 'high-engagement' : (q.answers.length > 0 ? 'medium-engagement' : '');
      
      wrapper.innerHTML = `
        <div class="card-content ${engagementClass}">
          <div class="card-header flex items-start mb-3">
            <div class="avatar-container mr-3">
              <div class="avatar bg-gradient-to-r from-primary to-primary-light text-white flex items-center justify-center rounded-full h-10 w-10 text-sm font-medium">
                ${q.username ? q.username.charAt(0).toUpperCase() : 'A'}
              </div>
            </div>
            <div class="flex-1">
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="card-title font-semibold text-base sm:text-lg hover:text-primary transition-colors cursor-pointer">${q.title}</h3>
                  <div class="meta flex items-center text-xs text-gray-500 dark:text-gray-400">
                    <span class="author font-medium">${q.username || 'Anonymous'}</span>
                    <span class="mx-1">•</span>
                    <span class="date">${new Date(q.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                    ${q.tags && q.tags.length ? `<span class="mx-1">•</span><span class="primary-tag">${q.tags[0]}</span>` : ''}
                  </div>
                </div>
                <div class="dropdown relative">
                  <button class="dropdown-toggle p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                    <svg class="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
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
            <p class="text-gray-600 dark:text-gray-400 text-sm line-clamp-3 mb-2">${q.content}</p>
            ${q.tags && q.tags.length > 1 ? 
              `<div class="tags-container mb-3">
                <div class="tags flex flex-wrap gap-1">
                  ${q.tags.map(tag => `<span class="tag text-xs">${tag}</span>`).join('')}
                </div>
              </div>` : ''}
          </div>
          
          <div class="card-footer mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            ${voteRatio >= 75 ? 
              `<div class="trending-indicator mb-2 text-xs text-orange-500">
                <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clip-rule="evenodd"></path>
                </svg>
                <span>Trending</span>
              </div>` : ''}
            <div class="reaction-bar flex justify-between items-center">
              <div class="vote-section flex items-center">
                <button class="reaction-btn upvote-btn ${upvoteClass}" data-question-id="${q.id}" aria-label="Like question">
                  <span class="reaction-icon">👍</span>
                  <span class="vote-count">${q.upvotes || 0}</span>
                </button>
                <button class="reaction-btn downvote-btn ${downvoteClass}" data-question-id="${q.id}" aria-label="Dislike question">
                  <span class="reaction-icon">👎</span>
                  <span class="vote-count">${q.downvotes || 0}</span>
                </button>
              </div>
              
              <div class="action-buttons flex items-center">
                <button class="action-btn answers-counter flex items-center mr-2" aria-label="View answers">
                  <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <span>${q.answers.length}</span>
                </button>
                
                <button class="action-btn share-btn flex items-center mr-2" aria-label="Share question">
                  <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
                
                <button class="answer-btn btn-primary-outline text-xs px-3 py-1" data-question-id="${q.id}">Answer</button>
              </div>
            </div>
            
            <div class="answers-section mt-3">
              <div class="toggle-answers-container mb-2">
                <button class="toggle-answers flex items-center text-primary hover:text-primary-dark text-sm" aria-expanded="false" aria-controls="answers-${q.id}">
                  <svg class="w-4 h-4 mr-1 toggle-icon transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                  <span>${q.answers.length > 0 ? `Show ${q.answers.length} answers` : 'No answers yet'}</span>
                </button>
              </div>
              
              <div id="answers-${q.id}" class="answers hidden space-y-3">
                ${q.answers.length === 0 ? 
                  `<div class="no-answers flex items-center text-sm text-gray-500 dark:text-gray-500 p-2">
                    <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <span>Be the first to answer this question!</span>
                  </div>` : 
                  q.answers.map(a => {
                    const answerUpvoteClass = userVotes.answers[a.id] === 'upvote' ? 'active' : '';
                    const answerDownvoteClass = userVotes.answers[a.id] === 'downvote' ? 'active' : '';
                return `
                      <div class="answer-card">
                        <div class="answer-header flex items-start mb-1">
                          <div class="avatar-container mr-2">
                            <div class="avatar bg-gradient-to-r from-gray-400 to-gray-500 text-white flex items-center justify-center rounded-full h-7 w-7 text-xs font-medium">
                              ${a.username ? a.username.charAt(0).toUpperCase() : 'A'}
                            </div>
                          </div>
                          <div>
                            <span class="font-medium text-xs">${a.username || 'Anonymous'}</span>
                            <span class="text-xs text-gray-500 dark:text-gray-500 ml-1">${new Date(a.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                          </div>
                        </div>
                        <div class="answer-content ml-9">
                    <p class="text-sm">${a.content}</p>
                          <div class="answer-footer mt-1 flex items-center">
                            <button class="reaction-btn reaction-btn-sm upvote-answer-btn ${answerUpvoteClass}" data-answer-id="${a.id}" aria-label="Like answer">
                              <span class="reaction-icon text-xs">👍</span>
                              <span class="vote-count text-xs">${a.upvotes || 0}</span>
                      </button>
                            <button class="reaction-btn reaction-btn-sm downvote-answer-btn ${answerDownvoteClass}" data-answer-id="${a.id}" aria-label="Dislike answer">
                              <span class="reaction-icon text-xs">👎</span>
                              <span class="vote-count text-xs">${a.downvotes || 0}</span>
                      </button>
                            <button class="reply-btn text-xs text-gray-500 hover:text-primary ml-2">Reply</button>
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')
                }
                
                <div class="quick-answer flex items-start mt-2">
                  <div class="avatar-container mr-2">
                    <div class="avatar bg-gradient-to-r from-primary to-primary-light text-white flex items-center justify-center rounded-full h-7 w-7 text-xs font-medium">
                      You
                    </div>
                  </div>
                  <div class="quick-answer-input-container flex-1 relative">
                    <input type="text" class="quick-answer-input w-full rounded-full pl-4 pr-10 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 focus:ring-1 focus:ring-primary" placeholder="Write a quick answer..." data-question-id="${q.id}">
                    <button class="send-answer-btn absolute right-2 top-1/2 transform -translate-y-1/2 text-primary">
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
        
        gsap.to(icon, {
          rotation: isExpanded ? 0 : 180,
          duration: 0.3,
          ease: 'power2.out'
        });

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

        button.querySelector('span').textContent = isExpanded ? 
          `Show ${button.closest('.answers-section').querySelector('.answers').children.length - 1} answers` : 
          `Hide answers`;
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
        <svg class="mx-auto h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p class="mt-3 text-gray-600 dark:text-gray-400">Error loading questions.</p>
        <button class="retry-btn btn btn-primary mt-3">Retry</button>
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
      <div class="loader-pulse"></div>
      <span class="ml-2 text-sm text-gray-500">Loading contributors...</span>
    </div>
  `;

  try {
    const contributors = await fetchTopContributors();
    
    if (contributors.length === 0) {
      contributorsContainer.innerHTML = `
        <div class="text-center py-2">
          <p class="text-sm text-gray-500">No contributors yet</p>
        </div>
      `;
      return;
    }

    contributorsContainer.innerHTML = '';
    
    const gradients = [
      'from-blue-400 to-blue-600',
      'from-purple-400 to-purple-600',
      'from-green-400 to-green-600',
      'from-red-400 to-red-600',
      'from-yellow-400 to-yellow-600'
    ];

    contributors.forEach((contributor, index) => {
      const initials = contributor.username
        .split(' ')
        .map(name => name.charAt(0).toUpperCase())
        .join('')
        .substring(0, 2);
      
      const gradientClass = gradients[index % gradients.length];
      
      const contributorElement = document.createElement('div');
      contributorElement.className = 'contributor flex items-center';
      contributorElement.innerHTML = `
        <div class="avatar bg-gradient-to-r ${gradientClass} text-white flex items-center justify-center rounded-full h-8 w-8 text-xs font-medium mr-2">
          ${initials}
        </div>
        <div>
          <div class="font-medium text-sm">${contributor.username}</div>
          <div class="text-xs text-gray-500">${contributor.answerCount} answers</div>
        </div>
      `;
      
      contributorsContainer.appendChild(contributorElement);
    });
  } catch (error) {
    console.error('Error rendering top contributors:', error);
    contributorsContainer.innerHTML = `
      <div class="text-center py-2">
        <p class="text-sm text-gray-500">Failed to load contributors</p>
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
  questionDetailsSection.className = 'mt-8';
  const upvoteClass = userVotes.questions[question.id] === 'upvote' ? 'active' : '';
  const downvoteClass = userVotes.questions[question.id] === 'downvote' ? 'active' : '';
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
        <div class="flex items-center gap-3">
          <button class="reaction-btn btn-vote upvote-btn ${upvoteClass}" data-question-id="${question.id}" aria-label="Like question">
            <span class="text-xl">👍</span>
            <span class="vote-count transition-all duration-300 font-medium">${question.upvotes || 0}</span>
          </button>
          <button class="reaction-btn btn-vote downvote-btn ${downvoteClass}" data-question-id="${question.id}" aria-label="Dislike question">
            <span class="text-xl">👎</span>
            <span class="vote-count transition-all duration-300 font-medium">${question.downvotes || 0}</span>
          </button>
        </div>
        <button class="answer-btn btn btn-primary mt-2 text-sm" data-question-id="${question.id}">Answer</button>
      </div>
      <div class="space-y-3">
        <h3 class="text-base font-semibold">Answers (${question.answers.length})</h3>
        <div id="answersList" class="space-y-4">
          ${question.answers.length > 0 ? question.answers.map(a => {
            const answerUpvoteClass = userVotes.answers[a.id] === 'upvote' ? 'active' : '';
            const answerDownvoteClass = userVotes.answers[a.id] === 'downvote' ? 'active' : '';
            return `
              <div class="border-t border-gray-200 dark:border-gray-700 pt-3 flex flex-col space-y-2">
                <p class="text-sm">${a.content}</p>
                <p class="text-xs text-gray-500 dark:text-gray-500">Answered by ${a.username || 'Anonymous'} on ${new Date(a.createdAt).toLocaleDateString()}</p>
                <div class="flex items-center gap-2">
                  <button class="reaction-btn btn-vote upvote-answer-btn ${answerUpvoteClass}" data-answer-id="${a.id}" aria-label="Like answer">
                    <span class="text-base">👍</span>
                    <span class="vote-count transition-all duration-300">${a.upvotes || 0}</span>
                  </button>
                  <button class="reaction-btn btn-vote downvote-answer-btn ${answerDownvoteClass}" data-answer-id="${a.id}" aria-label="Dislike answer">
                    <span class="text-base">👎</span>
                    <span class="vote-count transition-all duration-300">${a.downvotes || 0}</span>
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

export function updateVoteCount(button, newCount) {
  const countElement = button.querySelector('.vote-count');
  if (countElement) {
    const oldValue = parseInt(countElement.textContent);
    const newValue = newCount || 0;
    
    countElement.textContent = newValue;
    
    if (newValue > oldValue) {
      countElement.animate([
        { transform: 'scale(1)', opacity: 0.5 },
        { transform: 'scale(1.3)', opacity: 1 },
        { transform: 'scale(1)', opacity: 1 }
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
});
