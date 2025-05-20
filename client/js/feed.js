import { fetchQuestions, displayDocumentLink } from './question.js';
import { showPopup, showToast, showSection, showAnswerFormPopup } from './ui.js';
import { getToken, isLoggedIn, fetchTopContributors, isApproved } from './auth.js';
import { getUserVotes } from './vote.js';
import { setupReplyUI, getReplies, postReply } from './reply.js';  // Import getReplies and postReply
import { auth, answers, replies, documents, reports } from './utils/api.js';

let currentPage = 1;
const questionsPerPage = 10;
let currentFilter = 'trending'; // Default filter
let currentTag = null; // Add new variable for tag filtering

// Filter functions
function applyFilter(questions, filter) {
  if (currentTag) {
    questions = questions.filter(q =>
      q.tags && Array.isArray(q.tags) &&
      q.tags.some(tag => tag.toLowerCase() === currentTag.toLowerCase())
    );
  }

  if (!questions || !questions.length) return [];

  const filtered = [...questions]; // Clone the array to avoid modifying original

  switch (filter) {
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
      currentTag = null; // Reset tag when applying a different filter
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

  // Add event listener for filtering by tag
  document.addEventListener('filter-by-tag', (event) => {
    const { tag } = event.detail;
    currentTag = tag;
    // Update filter button UI - deactivate all filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    currentPage = 1;
    renderFeed();
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
      const engagementClass = q.answers.length > 2 ? 'high-engagement' : q.answers.length > 0 ? 'medium-engagement' : '';

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
                  <h3 class="card-title font-semibold text-base sm:text-lg hover:text-blue-600 hover:underline dark:hover:text-blue-400 transition-colors cursor-pointer">${q.title}</h3>
                  <div class="meta flex items-center text-xs text-gray-600 dark:text-gray-400">
                    <span class="author font-medium">${q.username || 'Anonymous'}</span>
                    <span class="mx-1">•</span>
                    <span class="date">${new Date(q.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    ${q.tags && q.tags.length ? `<span class="mx-1">•</span><span class="primary-tag text-blue-600 dark:text-blue-400">${q.tags[0]}</span>` : ''}
                  </div>
                </div>                <div class="flex items-center gap-2">
                  <!-- Three-dot menu for actions -->
                  ${(isLoggedIn()) ? `
                    <div class="relative inline-block">
                      <button class="action-menu-btn ml-2 p-1 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700" title="More actions" aria-label="More actions" data-id="${q.id}">
                        <svg class="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                        </svg>
                      </button>
                      <div class="action-menu hidden absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-50 border border-gray-200 dark:border-gray-700">
                        ${getCurrentUsername() === q.username ? `
                          <button class="edit-question-btn w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center">
                            <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                            Edit
                          </button>
                          <button class="delete-question-btn w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center border-t border-gray-200 dark:border-gray-700">
                            <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                            Delete
                          </button>
                        ` : ''}
                        ${getCurrentUsername() !== q.username ? `
                          <button class="report-btn w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center" data-id="${q.id}" data-type="question">
                            <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                            </svg>
                            Report
                          </button>
                        ` : ''}
                      </div>
                    </div>
                  ` : ''}
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
            ${q.documents && q.documents.length > 0 ? q.documents.map(doc => displayDocumentLink(doc)).join('') : ''}
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
              <div class="vote-section flex items-center space-x-2">                <button class="reaction-btn upvote-btn ${upvoteClass} hover:bg-blue-50 hover:shadow-sm dark:hover:bg-gray-700 p-1 rounded-md transition-colors" data-question-id="${q.id}" aria-label="Like question">
                  <svg class="w-5 h-5 mr-1 text-blue-600 dark:text-blue-400" fill="${upvoteClass ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                  <span class="vote-count text-gray-700 dark:text-gray-300">${q.upvotes || 0}</span>
                </button>
                <button class="reaction-btn downvote-btn ${downvoteClass} hover:bg-red-50 hover:shadow-sm dark:hover:bg-gray-700 p-1 rounded-md transition-colors" data-question-id="${q.id}" aria-label="Dislike question">
                  <svg class="w-5 h-5 mr-1 text-red-500 dark:text-red-400" fill="${downvoteClass ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                  </svg>
                  <span class="vote-count text-gray-700 dark:text-gray-300">${q.downvotes || 0}</span>
                </button>
              </div>              <div class="action-buttons flex items-center">
                <button class="action-btn answers-counter flex items-center mr-2 text-gray-600 dark:text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-gray-700 dark:hover:text-blue-400 p-1 rounded-md transition-colors" aria-label="View answers">
                  <svg class="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <span>${q.answers.length}</span>
                </button>

                <button class="action-btn share-btn flex items-center mr-2 text-gray-600 dark:text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-gray-700 dark:hover:text-blue-400 p-1 rounded-md transition-colors" aria-label="Share question">
                  <svg class="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>

                <button class="answer-btn bg-blue-600 hover:bg-blue-700 hover:shadow dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-xs px-3 py-1.5 flex items-center rounded-md transition-colors" data-question-id="${q.id}">
                  <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  Answer
                </button>
              </div>
            </div>

            <div class="answers-section mt-3">                <div class="toggle-answers-container mb-2">
                <button class="toggle-answers flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 hover:bg-blue-50 hover:shadow-sm hover:rounded-md dark:hover:text-blue-300 text-sm p-1" aria-expanded="false" aria-controls="answers-${q.id}">
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
                            <span class="text-xs text-gray-500 dark:text-gray-400 ml-1">${new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                          </div>
                          <!-- Report icon for non-owners -->
                          ${(isLoggedIn() && getCurrentUsername() !== a.username) ? `<button class=\"report-btn ml-2 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900\" title=\"Report answer\" aria-label=\"Report answer\" data-id=\"${a.id}\" data-type=\"answer\"><svg class=\"w-4 h-4 text-red-500\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M4 4v16h16V4H4zm2 2h12v12H6V6zm3 3v6m6-6v6\" /></svg></button>` : ''}
                        </div>
                        <div class="answer-content ml-9">
                          <p class="text-sm text-gray-700 dark:text-gray-300">${a.content}</p>
                          <div class="answer-footer mt-1 flex items-center">                            <button class="reaction-btn reaction-btn-sm upvote-answer-btn ${answerUpvoteClass} text-blue-600 hover:bg-blue-50 hover:shadow-sm rounded-md dark:text-blue-400 dark:hover:bg-gray-700" data-answer-id="${a.id}" aria-label="Like answer">
                            <svg class="w-4 h-4 mr-1" fill="${answerUpvoteClass ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                            </svg>
                            <span class="vote-count text-xs">${a.upvotes || 0}</span>
                          </button>
                          <button class="reaction-btn reaction-btn-sm downvote-answer-btn ${answerDownvoteClass} text-red-500 hover:bg-red-50 hover:shadow-sm rounded-md dark:text-red-400 dark:hover:bg-gray-700" data-answer-id="${a.id}" aria-label="Dislike answer">
                            <svg class="w-4 h-4 mr-1" fill="${answerDownvoteClass ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 14H5.236a2 2 0 01-1.789-2.894l-3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                            </svg>
                            <span class="vote-count text-xs">${a.downvotes || 0}</span>
                          </button>
                          <button class="reply-btn text-xs text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:shadow-sm hover:rounded-md dark:hover:bg-gray-700 dark:hover:text-blue-400 flex items-center transition-colors p-1">
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
                  <div class="quick-answer-input-container flex-1 relative">                    <input type="text" class="quick-answer-input w-full rounded-full pl-4 pr-10 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-300 focus:border-blue-500 dark:focus:border-blue-400 text-gray-700 dark:text-gray-200 hover:border-blue-300 transition-colors" placeholder="Write a quick answer..." data-question-id="${q.id}">
                    <button class="send-answer-btn absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:scale-110 dark:hover:text-blue-300 transition-all">
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

    renderPagination(questions.length, pagination);    // Add delegated event listeners for action menu and buttons
    setTimeout(() => {
      // Action menu toggle handlers
      document.querySelectorAll('.action-menu-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          // Close all other menus first
          document.querySelectorAll('.action-menu').forEach(menu => {
            if (menu !== btn.nextElementSibling) {
              menu.classList.add('hidden');
            }
          });
          // Toggle current menu
          const menu = btn.nextElementSibling;
          menu.classList.toggle('hidden');
        };
      });

      // Close menus when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-menu') && !e.target.closest('.action-menu-btn')) {
          document.querySelectorAll('.action-menu').forEach(menu => {
            menu.classList.add('hidden');
          });
        }
      });

      // Handle edit button clicks
      document.querySelectorAll('.edit-question-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          const questionId = btn.closest('.action-menu').previousElementSibling.getAttribute('data-id');
          // TODO: Implement edit question functionality
          console.log('Edit question:', questionId);
        };
      });

      // Handle delete button clicks
      document.querySelectorAll('.delete-question-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          const questionId = btn.closest('.action-menu').previousElementSibling.getAttribute('data-id');
          // TODO: Implement delete question functionality
          if (confirm('Are you sure you want to delete this question?')) {
            console.log('Delete question:', questionId);
          }
        };
      });

      // Handle report button clicks
      document.querySelectorAll('.report-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          
          if (!isLoggedIn()) {
            showToast('warning', 'Please log in to report content');
            showPopup('login');
            return;
          }
          
          const contentId = btn.getAttribute('data-id');
          const type = btn.getAttribute('data-type');
          
          if (!contentId || !type) {
            console.error('Missing data attributes for report button:', { contentId, type, button: btn });
            showToast('error', 'Could not report content. Missing information.');
            return;
          }
          
          showReportModal({ contentId, type });
        };
      });
    }, 0);

  } catch (err) {
    console.error('Error rendering feed:', err);
    container.innerHTML = `
      <div class="error-state text-center py-8">
        <svg class="mx-auto h-12 w-12 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p class="mt-3 text-gray-600 dark:text-gray-400">Error loading questions.</p>
        <button class="retry-btn bg-blue-600 hover:bg-blue-700 hover:shadow dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-all mt-3">Retry</button>
      </div>
    `;
    showToast('Failed to load questions', 'error');

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
    const result = await auth.getTopContributors();
    const contributors = result.contributors || [];

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
  const content = input.value.trim();

  if (!content) return;

  answers.create(questionId, content)
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

// Helper function to extract the original filename from the Cloudinary URL and ensure proper extension
function getOriginalFilename(cloudinaryUrl, originalFilename) {
  // If originalFilename is provided, use it directly
  if (originalFilename) return originalFilename;

  if (!cloudinaryUrl) return '';

  // Extract the filename from the path
  const parts = cloudinaryUrl.split('/');
  let filename = parts[parts.length - 1];

  // If there are URL parameters, remove them
  if (filename.includes('?')) {
    filename = filename.split('?')[0];
  }

  // Decode URL-encoded characters
  try {
    return decodeURIComponent(filename);
  } catch (e) {
    return filename;
  }
}

export async function showQuestionDetails(questionId) {
  console.log('Showing question details for ID:', questionId);
  // Ensure animation styles are added
  ensureAnimationStyles();

  const questions = await fetchQuestions();
  const question = questions.find(q => q.id === parseInt(questionId));
  if (!question) {
    showToast('error', 'Question not found');
    return;
  }

  question.answers.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
  const userVotes = getUserVotes();

  // Create popup container
  const popup = document.createElement('div');
  popup.id = 'questionDetailsPopup';
  popup.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto';

  const upvoteClass = userVotes.questions[question.id] === 'upvote' ? 'active' : '';
  const downvoteClass = userVotes.questions[question.id] === 'downvote' ? 'active' : '';

  popup.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden w-full max-w-4xl max-h-[90vh] flex flex-col animate-scale-in">
      <!-- Navigation bar -->
      <div class="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <button id="closeQuestionPopup" class="flex items-center text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors text-sm font-medium">
          <svg class="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>
        <div class="flex items-center space-x-2">
          <button class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-full transition-colors">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Question content -->
      <div class="px-6 py-5 overflow-y-auto flex-1">
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
              <span class="text-sm text-gray-500 dark:text-gray-400">${new Date(question.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              ${new Date(question.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
        
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3">${question.title}</h2>
        
        <div class="prose dark:prose-invert prose-sm sm:prose-base max-w-none mb-4 text-gray-700 dark:text-gray-200">
          <p>${question.content}</p>
        </div>
        
        ${question.documentPath ? `
        <div class="document-attachment mb-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <div class="flex items-center">
            <div class="document-icon mr-3">
              ${question.documentPath.endsWith('.pdf') ? `
                <svg class="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.819 14.427c.064.267.077.679-.021.948-.128.351-.381.528-.754.528h-.637v-2.12h.496c.474 0 .803.173.916.644zm3.091-8.65c2.047.479 4.805.907 4.805 3.469 0 1.044-.479 1.952-1.326 2.771-.979.932-2.127 1.578-3.383 1.98v.121c1.159.459 2.403 1.352 2.403 3.049 0 1.338-.561 2.555-1.588 3.4-1.194.989-2.736 1.534-4.383 1.534h-7.745v-16.324h6.553c1.564 0 3.123.277 4.664 1zm-9.829 1.211v5.34h1.632c.433 0 .854-.059 1.275-.18.433-.111.823-.321 1.151-.596.328-.273.593-.601.784-.97.191-.37.3-.825.3-1.359 0-.468-.083-.896-.234-1.254-.15-.358-.365-.654-.63-.88-.268-.222-.599-.399-.993-.528-.395-.13-.846-.195-1.376-.195h-1.909zm0 6.553v5.34h1.907c.468 0 .914-.068 1.306-.203.394-.135.74-.327 1.04-.574.299-.249.536-.548.712-.911.176-.36.262-.784.262-1.262 0-.965-.346-1.768-1.04-2.411-.692-.642-1.593-.979-2.692-.979h-1.495z"/>
                </svg>
              ` : question.documentPath.endsWith('.docx') ? `
                <svg class="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.186 14.552c-.199 0-.359-.077-.48-.231-.121-.154-.182-.357-.182-.609v-.574h1.324v.574c0 .252-.06.455-.182.609-.12.154-.281.231-.48.231zm0-2.737c-.157 0-.284-.032-.38-.098-.096-.066-.168-.156-.217-.267-.048-.112-.072-.24-.072-.386 0-.227.047-.405.14-.535.095-.13.271-.194.529-.194.078 0 .16.008.245.025l.149.041-.047.393c-.085-.035-.159-.052-.224-.052-.103 0-.176.035-.219.105-.043.07-.064.177-.064.322 0 .141.024.246.073.313.048.067.116.101.202.101.029 0 .069-.009.12-.027.05-.018.098-.043.144-.074v.411c-.095.015-.172.022-.231.022zm3.174-.399c-.108 0-.19-.033-.246-.101-.056-.067-.084-.17-.084-.308v-.729h-.409v-.326h.409v-.324l.518-.156v.48h.503v.326h-.503v.689c0 .066.009.116.026.147.018.031.048.047.091.047.024 0 .046-.002.068-.007s.055-.012.099-.024v.33c-.085.022-.156.037-.214.045-.057.008-.133.011-.231.011h-.027zm-1.242-.866c.055.052.082.145.082.28v.986h-.516v-.874c0-.165-.057-.247-.172-.247-.076 0-.17.041-.283.124v.997h-.516v-1.724h.516v.14c.122-.12.271-.18.446-.18.189 0 .334.083.436.248l.007.016zm-1.932.846c0 .13-.046.233-.139.308-.093.075-.218.113-.373.113-.067 0-.133-.007-.198-.02-.064-.013-.13-.033-.199-.059v-.385c.067.033.134.059.202.079.068.019.128.029.18.029.041 0 .072-.008.093-.025.021-.016.031-.037.031-.064 0-.021-.007-.039-.021-.053-.014-.014-.038-.027-.072-.038-.034-.011-.075-.024-.123-.038-.104-.031-.179-.074-.225-.129-.046-.055-.069-.131-.069-.227 0-.121.046-.215.138-.283.092-.068.212-.102.36-.102.119 0 .244.024.375.073v.374c-.051-.031-.106-.055-.165-.073-.059-.017-.108-.026-.148-.026-.044 0-.077.007-.1.021-.022.014-.034.033-.034.057 0 .031.016.054.047.069.031.015.094.037.19.067.095.03.166.071.211.124zm5.714-.594c0 .078-.022.147-.065.208-.044.061-.104.108-.182.141s-.165.05-.263.05c-.083 0-.158-.009-.223-.027-.065-.018-.136-.047-.211-.088v-.417c.081.043.161.077.239.101.078.024.145.036.201.036.041 0 .073-.008.095-.023.022-.016.034-.038.034-.066 0-.024-.012-.045-.036-.063-.023-.018-.075-.043-.156-.076-.11-.043-.19-.099-.239-.168-.049-.069-.074-.156-.074-.262 0-.165.051-.291.152-.379.102-.088.246-.132.434-.132.1 0 .194.012.282.036.088.024.164.053.229.088v.407c-.136-.076-.253-.114-.35-.114-.039 0-.07.008-.092.024-.023.016-.034.035-.034.059 0 .029.015.052.044.07.029.018.091.045.186.082.106.039.184.092.234.159.05.067.075.153.075.257zm-10.1-1.018c.094 0 .171.035.229.104.057.069.086.159.086.269 0 .109-.029.2-.086.269-.059.069-.135.104-.229.104-.095 0-.172-.035-.231-.104-.059-.069-.088-.159-.088-.269 0-.11.029-.199.088-.269.059-.069.136-.104.231-.104zm.257.799v1.724h-.516v-1.724h.516zm7.043-.799c.095 0 .171.035.229.104.057.069.086.159.086.269 0 .109-.029.2-.086.269-.059.069-.135.104-.229.104-.095 0-.172-.035-.231-.104-.059-.069-.088-.159-.088-.269 0-.11.029-.199.088-.269.059-.069.136-.104.231-.104zm.257.799v1.724h-.516v-1.724h.516zm-.854 1.724h-.516v-1.724h.516v1.724zm-1.242-1.407c-.139 0-.209.11-.209.331 0 .109.019.194.057.254.038.06.087.09.146.09.136 0 .204-.111.204-.331 0-.22-.066-.331-.199-.331h.001zm0-.317c.199 0 .357.063.473.189.116.126.174.301.174.527 0 .234-.057.413-.171.539-.114.126-.272.189-.476.189-.203 0-.362-.064-.476-.191-.114-.127-.171-.307-.171-.538 0-.225.058-.4.174-.525.118-.126.275-.19.473-.19zm-9.095 0c.142 0 .25.05.323.15.073.1.11.242.11.425v1.149h-.516v-1.037c0-.231-.065-.346-.195-.346-.081 0-.177.043-.288.129v1.254h-.516v-1.037c0-.232-.066-.347-.198-.347-.08 0-.175.043-.286.129v1.254h-.516v-1.724h.516v.144c.127-.13.27-.194.428-.194.19 0 .325.083.406.251.139-.167.29-.251.453-.251h.279z" transform="translate(0 -1)"/>
                </svg>
              ` : `
                <svg class="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM9 18h6v-1H9v1zm7-3H8v1h8v-1zm0-2H8v1h8v-1zM9 9h1V4H9v5zM6 4v16h12V9h-5V4H6z"/>
                </svg>
              `}
            </div>
            <div class="flex-1">
              <div class="font-medium text-sm text-gray-800 dark:text-gray-200">Attached Document</div>
              <div class="text-xs text-gray-600 dark:text-gray-400">
                ${getOriginalFilename(question.documentPath, question.originalFilename)}
              </div>
            </div>
            <div class="flex space-x-2">
              <button class="view-document-btn bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center" data-document-path="${question.documentPath}" data-original-filename="${question.originalFilename || ''}">
                <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View
              </button>
              <button class="view-document bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center" data-document-id="${question.documentId || ''}" data-original-filename="${question.originalFilename || getOriginalFilename(question.documentPath, question.originalFilename)}">
              <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
            </div>
          </div>
        </div>
        ` : ''}
        
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
                <div class="answer-item bg-gray-50 dark:bg-gray-800/70 rounded-lg p-4" data-answer-id="${a.id}" data-username="${a.username}" data-user-id="${a.userId}">
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
                        <span class="text-xs text-gray-500 dark:text-gray-400">${new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
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
                      
                      <!-- Reply container and replies list -->
                      <div class="reply-container mt-3 hidden">
                        <div class="flex items-start space-x-2">
                          <div class="avatar-container flex-shrink-0">
                            <div class="avatar bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center justify-center rounded-full h-6 w-6 text-xs font-medium">
                              You
                            </div>
                          </div>
                          <div class="flex-1">
                            <div class="relative">
                              <input type="text" class="reply-input w-full rounded-full pl-3 pr-10 py-1 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 text-gray-700 dark:text-gray-200" placeholder="Write a reply...">
                              <button class="send-reply-btn absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11h2v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <!-- Replies list container -->
                      <div class="replies-list-container mt-3 ml-6 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                        <div class="replies-list" data-answer-id="${a.id}">
                          <div class="loading-replies text-xs text-gray-500 dark:text-gray-400">
                            <div class="animate-pulse flex items-center">
                              <div class="h-2 w-2 bg-blue-400 rounded-full mr-1"></div>
                              <div class="h-2 w-2 bg-blue-400 rounded-full mr-1 animation-delay-200"></div>
                              <div class="h-2 w-2 bg-blue-400 rounded-full animation-delay-400"></div>
                              <span class="ml-2">Loading replies...</span>
                            </div>
                          </div>
                        </div>
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
                <textarea id="questionDetailAnswer" class="bg-transparent w-full outline-none resize-none text-gray-700 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 text-sm min-h-[80px]" placeholder="Write your answer here..."></textarea>
                <div class="flex justify-end mt-2">
                  <button id="submitDetailAnswer" class="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm px-4 py-1.5 rounded-md transition-colors flex items-center shadow-sm" data-question-id="${question.id}">
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

  // Add popup to the DOM
  document.body.appendChild(popup);

  // Add CSS for animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes scale-in {
      0% { opacity: 0; transform: scale(0.95); }
      100% { opacity: 1; transform: scale(1); }
    }
    .animate-scale-in {
      animation: scale-in 0.2s ease-out forwards;
    }
    .animation-delay-200 {
      animation-delay: 0.2s;
    }
    .animation-delay-400 {
      animation-delay: 0.4s;
    }
    @keyframes fade-in {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    .animate-fade-in {
      animation: fade-in 0.3s ease-out forwards;
    }
    @keyframes fade-out {
      0% { opacity: 1; }
      100% { opacity: 0; }
    }
    .animate-fade-out {
      animation: fade-out 0.2s ease-out forwards;
    }
  `;
  document.head.appendChild(style);

  // Setup event listeners
  document.getElementById('closeQuestionPopup').addEventListener('click', () => {
    popup.classList.add('animate-fade-out');
    setTimeout(() => {
      popup.remove();
    }, 200);
  });

  // Fetch and display replies for each answer
  question.answers.forEach(async (answer) => {
    const answerId = answer.id;
    const repliesListContainer = document.querySelector(`.replies-list[data-answer-id="${answerId}"]`);

    if (repliesListContainer) {
      try {
        const replies = await getReplies(answerId);

        // Clear loading indicator
        repliesListContainer.innerHTML = '';

        if (replies.length === 0) {
          // Hide the empty container if there are no replies
          const parentContainer = repliesListContainer.closest('.replies-list-container');
          if (parentContainer) {
            parentContainer.style.display = 'none';
          }
        } else {
          // Display each reply
          replies.forEach(reply => {
            // Format content with mention highlight
            let displayContent = reply.content;

            if (reply.mentionedUsername && !displayContent.startsWith(`@${reply.mentionedUsername}`)) {
              displayContent = `<span class="text-blue-600 dark:text-blue-400 font-medium">@${reply.mentionedUsername}</span> ${displayContent}`;
            } else if (reply.mentionedUsername) {
              // Replace the @username with a highlighted version
              displayContent = displayContent.replace(
                new RegExp(`@${reply.mentionedUsername}\\b`, 'g'),
                `<span class="text-blue-600 dark:text-blue-400 font-medium">@${reply.mentionedUsername}</span>`
              );
            }

            const replyElement = document.createElement('div');
            replyElement.className = 'reply mb-2 last:mb-0 text-sm';
            replyElement.innerHTML = `
              <div class="flex items-start">
                <div class="flex-shrink-0 mr-2">
                  <div class="avatar bg-gradient-to-r from-gray-400 to-gray-500 text-white flex items-center justify-center rounded-full h-5 w-5 text-xs font-medium shadow-sm">
                    ${reply.username ? reply.username.charAt(0).toUpperCase() : 'A'}
                  </div>
                </div>
                <div>
                  <div class="flex items-center">
                    <span class="font-medium text-xs text-gray-900 dark:text-gray-100">${reply.username || 'Anonymous'}</span>
                    <span class="mx-1 text-xs text-gray-400 dark:text-gray-500">•</span>
                    <span class="text-xs text-gray-400 dark:text-gray-500">${new Date(reply.createdAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</span>
                  </div>
                  <div class="reply-content text-xs text-gray-700 dark:text-gray-300">${displayContent}</div>
                </div>
              </div>
            `;

            repliesListContainer.appendChild(replyElement);
          });
        }
      } catch (error) {
        console.error(`Error loading replies for answer ${answerId}:`, error);
        repliesListContainer.innerHTML = `
          <div class="text-xs text-red-500 dark:text-red-400">
            Failed to load replies. Please try again later.
          </div>
        `;
      }
    }
  });

  // Setup reply functionality for each answer
  document.querySelectorAll('.reply-btn').forEach(button => {
    button.addEventListener('click', () => {
      if (!isLoggedIn()) {
        showPopup('login');
        return;
      }

      const answerItem = button.closest('.answer-item');
      const replyContainer = answerItem.querySelector('.reply-container');
      replyContainer.classList.toggle('hidden');

      if (!replyContainer.classList.contains('hidden')) {
        replyContainer.querySelector('.reply-input').focus();
      }
    });
  });

  // Setup send reply functionality
  document.querySelectorAll('.send-reply-btn').forEach(button => {
    button.addEventListener('click', async () => {
      const answerItem = button.closest('.answer-item');
      const input = button.closest('.relative').querySelector('.reply-input');
      const content = input.value.trim();

      if (!content) return;

      const answerId = parseInt(answerItem.getAttribute('data-answer-id'));
      const username = answerItem.getAttribute('data-username');
      const userId = answerItem.getAttribute('data-user-id');

      try {
        // Post the reply using the imported postReply function
        const reply = await postReply(answerId, content, userId, username);

        if (reply) {
          // Clear input and hide reply container
          input.value = '';
          answerItem.querySelector('.reply-container').classList.add('hidden');

          // Make sure replies container is visible
          const repliesListContainer = answerItem.querySelector('.replies-list-container');
          repliesListContainer.style.display = 'block';

          // Add the new reply to the UI
          const repliesList = answerItem.querySelector('.replies-list');

          // Format content with mention highlight
          let displayContent = reply.content;

          if (username && !displayContent.startsWith(`@${username}`)) {
            displayContent = `<span class="text-blue-600 dark:text-blue-400 font-medium">@${username}</span> ${displayContent}`;
          } else if (username) {
            // Replace the @username with a highlighted version
            displayContent = displayContent.replace(
              new RegExp(`@${username}\\b`, 'g'),
              `<span class="text-blue-600 dark:text-blue-400 font-medium">@${username}</span>`
            );
          }

          const replyElement = document.createElement('div');
          replyElement.className = 'reply mb-2 last:mb-0 text-sm animate-fade-in';
          replyElement.innerHTML = `
            <div class="flex items-start">
              <div class="flex-shrink-0 mr-2">
                <div class="avatar bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center justify-center rounded-full h-5 w-5 text-xs font-medium shadow-sm">
                  You
                </div>
              </div>
              <div>
                <div class="flex items-center">
                  <span class="font-medium text-xs text-gray-900 dark:text-gray-100">You</span>
                  <span class="mx-1 text-xs text-gray-400 dark:text-gray-500">•</span>
                  <span class="text-xs text-gray-400 dark:text-gray-500">Just now</span>
                </div>
                <div class="reply-content text-xs text-gray-700 dark:text-gray-300">${displayContent}</div>
              </div>
            </div>
          `;

          repliesList.appendChild(replyElement);

          // Add a subtle background highlight animation
          replyElement.animate([
            { backgroundColor: 'rgba(59, 130, 246, 0.1)' }, // Light blue highlight
            { backgroundColor: 'transparent' }
          ], {
            duration: 2000,
            easing: 'ease-out'
          });

          showToast('success', 'Reply posted successfully');
        }
      } catch (error) {
        console.error('Error posting reply:', error);
        showToast('error', error.message || 'Failed to post reply');
      }
    });
  });

  // Setup reply input keypress event
  document.querySelectorAll('.reply-input').forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const button = input.nextElementSibling;
        button.click();
      }
    });
  });

  // Setup answer submission in the popup
  document.getElementById('submitDetailAnswer').addEventListener('click', () => {
    if (!isLoggedIn()) {
      showPopup('login');
      return;
    }

    const textarea = document.getElementById('questionDetailAnswer');
    const content = textarea.value.trim();
    const questionId = document.getElementById('submitDetailAnswer').getAttribute('data-question-id');

    if (!content) return;

    answers.create(questionId, content)
      .then(data => {
        if (data.success) {
          textarea.value = '';
          showToast('success', 'Your answer has been posted!');

          // Close the popup and refresh the feed
          document.getElementById('closeQuestionPopup').click();
          setTimeout(() => renderFeed(), 300);
        } else {
          throw new Error(data.message || 'Failed to post answer');
        }
      })
      .catch(error => {
        console.error('Error posting answer:', error);
        showToast('error', error.message || 'Failed to post your answer');
      });
  });

  // Handle clicking outside to close
  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      document.getElementById('closeQuestionPopup').click();
    }
  });

  // After popup is added to DOM
  setTimeout(() => {
    document.querySelectorAll('.report-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const contentId = btn.getAttribute('data-id');
        const type = btn.getAttribute('data-type');
        showReportModal({ contentId, type });
      };
    });
  }, 0);
}

// Update the handleReply function to use our imported postReply function
function handleReply(answerId, content, username, userId) {
  if (!isLoggedIn()) {
    showPopup('login');
    return;
  }

  return postReply(answerId, content, userId, username)
    .then(reply => {
      if (reply) {
        showToast('success', 'Your reply has been posted!');
        return reply;
      }
      return false;
    })
    .catch(error => {
      console.error('Error posting reply:', error);
      showToast('error', error.message || 'Failed to post reply');
      return false;
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

// Document download handler for APPROVED users only
export function setupDocumentDownloadHandlers() {
  document.addEventListener('click', async (e) => {
    const target = e.target.closest('.view-document');
    if (!target) return;
    e.preventDefault();

    if (!isApproved()) {
      showToast('Only approved users can download documents', 'error');
      return;
    }

    const documentId = target.getAttribute('data-document-id');
    const documentPath = target.getAttribute('data-document-path');
    const originalFilename = target.getAttribute('data-original-filename') || 'document';

    if (!documentId && !documentPath) {
      showToast('Invalid document identifier', 'error');
      return;
    }

    try {
      let response;
      if (documentId) {
        response = await documents.download(documentId);
      } else {
        // Fallback to downloading via documentPath
        // Assuming the documents.download API can handle a path or you need to fetch the documentId
        // This is a placeholder; adjust based on your API capabilities
        response = await documents.downloadByPath(documentPath); // Hypothetical API call
      }

      if (response.success === false) {
        showToast(response.message || 'Download failed', 'error');
        return;
      }

      const { blob, filename } = response;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || originalFilename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        a.remove();
      }, 100);
    } catch (err) {
      showToast(err.message || 'Download error', 'error');
      console.error('Download error:', err);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupFilterButtons();
  setupDocumentDownloadHandlers();

  // Setup the delegated event listener for toggle-answers
  document.addEventListener('click', (e) => {
    // Handle document viewer clicks
    if (e.target.closest('.view-document-btn')) {
      e.preventDefault();
      const element = e.target.closest('.view-document-btn');
      const documentPath = element.getAttribute('data-document-path');
      const originalFilename = element.getAttribute('data-original-filename');
      if (documentPath) {
        showDocumentViewer(documentPath, originalFilename);
      }
    }

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

// Add document viewer function
export function showDocumentViewer(documentPath, originalFilename) {
  // Ensure animation styles are added
  ensureAnimationStyles();

  // Create the document viewer popup
  const viewerPopup = document.createElement('div');
  viewerPopup.id = 'documentViewerPopup';
  viewerPopup.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4 overflow-y-auto animate-fade-in';

  const fileName = getOriginalFilename(documentPath, originalFilename);
  const fileExtension = fileName.split('.').pop().toLowerCase();

  let viewerContent = '';

  // Different viewer based on file type
  if (fileExtension === 'pdf') {
    viewerContent = `
      <iframe src="${documentPath}" class="w-full h-full-screen border-0 rounded-b-lg" allowfullscreen></iframe>
    `;
  } else if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension)) {
    viewerContent = `
      <div class="w-full h-full-screen flex items-center justify-center overflow-auto">
        <img src="${documentPath}" class="max-w-full max-h-full-screen object-contain" alt="${fileName}">
      </div>
    `;
  } else {
    // For all other file types, show a friendly download option
    viewerContent = `
      <div class="w-full h-full-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-b-lg">
        <div class="text-center max-w-md px-4 py-6">
          <div class="mb-6">
            ${fileExtension === 'docx' || fileExtension === 'doc' ? `
              <svg class="w-20 h-20 mx-auto text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21.986 12c0 5.387-4.579 9.769-10.286 9.997h-.014v-3.823c0-.282-.143-.509-.428-.641a.669.669 0 00-.614.031l-8.071 4.173c-.235.12-.359.371-.359.643s.128.523.357.643l8.073 4.176c.19.097.404.105.614.029.285-.133.428-.359.428-.643v-3.823c6.75-.171 12.214-5.265 12.214-11.763C23.9 5.34 18.59 0 12 0S.1 5.34.1 11.998c0 1.96.48 3.815 1.318 5.461.146.288.233.521.594.205.362-.317.152-.479.054-.671A10.72 10.72 0 01.975 11.998C.975 5.824 5.949.85 12 .85s11.025 4.973 11.025 11.147c0 5.809-4.426 10.557-10.082 11.094v-2.803l7.069-3.641-7.068-3.644v-2.801c5.656.54 10.082 5.286 10.082 11.096 0 .261-.105.514-.298.699s-.456.281-.727.25c-5.417-.612-9.575-4.906-9.575-9.854 0-5.51 4.489-9.988 10.025-9.988 5.537 0 10.026 4.478 10.026 9.988 0 .254-.128.486-.327.634-.2.148-.452.185-.677.104a8.153 8.153 0 00-3.188-.642c-4.507 0-8.175 3.659-8.175 8.153 0 .295-.226.535-.519.567-.293.033-.558-.164-.6-.445a9.278 9.278 0 01-.15-1.656c0-2.851 1.289-5.403 3.31-7.118.204-.173.234-.464.097-.693-.139-.229-.408-.313-.659-.213-3.19 1.27-5.45 4.339-5.45 7.926 0 .348.022.69.062 1.027.042.347.354.6.729.6h.016c.36 0 .667-.231.776-.551.077-.222.158-.438.248-.648.156-.366-.036-.786-.399-.873a.678.678 0 00-.196-.008c.166-.518.377-1.016.631-1.488.136-.251.072-.558-.141-.753-.213-.195-.526-.217-.764-.056-1.168.798-2.165 1.971-2.821 3.372-.136.292-.077.635.164.865.241.229.583.257.85.08a9.147 9.147 0 01.986-.542c.294-.141.432-.471.338-.778-.094-.307-.387-.486-.713-.455-.119.011-.238.026-.356.046a9.216 9.216 0 014.755-5.422c.249-.113.396-.361.387-.631-.009-.27-.176-.504-.442-.618-2.555-1.045-4.954-.736-7.3.776-.255.165-.353.483-.241.775.111.29.41.46.732.425a8.99 8.99 0 011.202-.081c2.059 0 3.972.714 5.474 1.9.249.195.592.202.848.023s.383-.5.297-.787a9.221 9.221 0 00-.35-1.048c-.116-.284-.412-.463-.723-.442-.311.022-.564.231-.626.52l-.005.022a8.175 8.175 0 00-4.949-1.647c-1.1 0-2.156.217-3.12.602-.293.118-.455.418-.407.751.048.333.305.584.65.634 2.616.376 4.812 1.961 5.92 4.199.123.248.382.401.672.401a.746.746 0 00.174-.021c.316-.075.53-.351.53-.681 0-4.236 3.458-7.681 7.712-7.681 1.057 0 2.061.22 2.979.602a.668.668 0 00.833-.421.658.658 0 00-.364-.821 9.072 9.072 0 00-3.448-.708c-5.026 0-9.112 4.075-9.112 9.089 0 .22.009.435.024.65.016.219.144.412.354.532.21.12.466.127.686.021 2.713-1.32 4.344-4.038 4.344-7.204a8.513 8.513 0 00-1.16-4.318c-.154-.257-.468-.392-.762-.322-.295.07-.505.328-.505.622 0 4.774-3.886 8.65-8.669 8.65a8.67 8.67 0 01-2.287-.305c-.286-.078-.593.063-.724.322a.684.684 0 00.145.796c2.463 2.281 5.812 3.737 9.522 3.737 7.66 0 13.9-6.223 13.9-13.861 0-7.64-6.24-13.863-13.9-13.863s-13.9 6.223-13.9 13.862c0 2.808.841 5.424 2.282 7.616.169.255.477.387.762.322.285-.064.492-.298.516-.579.024-.283-.131-.559-.402-.695a12.95 12.95 0 01-2.282-5.032 13.005 13.005 0 01-.276-2.671c0-7.205 5.872-13.064 13.1-13.064 7.227 0 13.1 5.86 13.1 13.064 0 7.203-5.873 13.064-13.1 13.064-3.238 0-6.202-1.169-8.48-3.101a13.23 13.23 0 01-.527-.488.664.664 0 00-.875-.028c-.262.212-.334.576-.193.876a13.106 13.106 0 0010.075 4.689c7.227 0 13.1-5.86 13.1-13.064 0-7.205-5.873-13.064-13.1-13.064z" />
              </svg>
            ` : fileExtension === 'txt' ? `
              <svg class="w-20 h-20 mx-auto text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM9 18h6v-1H9v1zm7-3H8v1h8v-1zm0-2H8v1h8v-1zM9 9h1V4H9v5zM6 4v16h12V9h-5V4H6z"/>
              </svg>
            ` : `
              <svg class="w-20 h-20 mx-auto text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
              </svg>
            `}
          </div>
          <h3 class="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">This file cannot be previewed</h3>
          <p class="text-gray-600 dark:text-gray-300 mb-6">${fileName} needs to be downloaded to view its contents.</p>
          <button class="view-document bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6 py-3 rounded-md transition-colors inline-flex items-center shadow-sm font-medium" data-document-id="${documentId || ''}" data-original-filename="${fileName}">
            <svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download File
          </button>
          <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">
            ${fileExtension === 'docx' || fileExtension === 'doc' ? 'This is a Microsoft Word document that requires an appropriate application to open.' :
        fileExtension === 'txt' ? 'This is a plain text file that can be opened with any text editor.' :
          `This is a ${fileExtension.toUpperCase()} file that requires an appropriate application to open.`}
          </p>
        </div>
      </div>
    `;
  }

  viewerPopup.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden w-full max-w-5xl max-h-[90vh] flex flex-col animate-scale-in">
      <!-- Viewer header -->
      <div class="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between bg-white dark:bg-gray-800">
        <div class="flex items-center">
          <div class="document-icon mr-3">
            ${fileExtension === 'pdf' ? `
              <svg class="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.819 14.427c.064.267.077.679-.021.948-.128.351-.381.528-.754.528h-.637v-2.12h.496c.474 0 .803.173.916.644zm3.091-8.65c2.047.479 4.805.907 4.805 3.469 0 1.044-.479 1.952-1.326 2.771-.979.932-2.127 1.578-3.383 1.98v.121c1.159.459 2.403 1.352 2.403 3.049 0 1.338-.561 2.555-1.588 3.4-1.194.989-2.736 1.534-4.383 1.534h-7.745v-16.324h6.553c1.564 0 3.123.277 4.664 1zm-9.829 1.211v5.34h1.632c.433 0 .854-.059 1.275-.18.433-.111.823-.321 1.151-.596.328-.273.593-.601.784-.97.191-.37.3-.825.3-1.359 0-.468-.083-.896-.234-1.254-.15-.358-.365-.654-.63-.88-.268-.222-.599-.399-.993-.528-.395-.13-.846-.195-1.376-.195h-1.909zm0 6.553v5.34h1.907c.468 0 .914-.068 1.306-.203.394-.135.74-.327 1.04-.574.299-.249.536-.548.712-.911.176-.36.262-.784.262-1.262 0-.965-.346-1.768-1.04-2.411-.692-.642-1.593-.979-2.692-.979h-1.495z"/>
              </svg>
            ` : ['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension) ? `
              <svg class="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ` : ['doc', 'docx'].includes(fileExtension) ? `
              <svg class="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.186 14.552c-.199 0-.359-.077-.48-.231-.121-.154-.182-.357-.182-.609v-.574h1.324v.574c0 .252-.06.455-.182.609-.12.154-.281.231-.48.231zm0-2.737c-.157 0-.284-.032-.38-.098-.096-.066-.168-.156-.217-.267-.048-.112-.072-.24-.072-.386 0-.227.047-.405.14-.535.095-.13.271-.194.529-.194.078 0 .16.008.245.025l.149.041-.047.393c-.085-.035-.159-.052-.224-.052-.103 0-.176.035-.219.105-.043.07-.064.177-.064.322 0 .141.024.246.073.313.048.067.116.101.202.101.029 0 .069-.009.12-.027.05-.018.098-.043.144-.074v.411c-.095.015-.172.022-.231.022zm3.174-.399c-.108 0-.19-.033-.246-.101-.056-.067-.084-.17-.084-.308v-.729h-.409v-.326h.409v-.324l.518-.156v.48h.503v.326h-.503v.689c0 .066.009.116.026.147.018.031.048.047.091.047.024 0 .046-.002.068-.007s.055-.012.099-.024v.33c-.085.022-.156.037-.214.045-.057.008-.133.011-.231.011h-.027zm-1.242-.866c.055.052.082.145.082.28v.986h-.516v-.874c0-.165-.057-.247-.172-.247-.076 0-.17.041-.283.124v.997h-.516v-1.724h.516v.14c.122-.12.271-.18.446-.18.189 0 .334.083.436.248l.007.016zm-1.932.846c0 .13-.046.233-.139.308-.093.075-.218.113-.373.113-.067 0-.133-.007-.198-.02-.064-.013-.13-.033-.199-.059v-.385c.067.033.134.059.202.079.068.019.128.029.18.029.041 0 .072-.008.093-.025.021-.016.031-.037.031-.064 0-.021-.007-.039-.021-.053-.014-.014-.038-.027-.072-.038-.034-.011-.075-.024-.123-.038-.104-.031-.179-.074-.225-.129-.046-.055-.069-.131-.069-.227 0-.121.046-.215.138-.283.092-.068.212-.102.36-.102.119 0 .244.024.375.073v.374c-.051-.031-.106-.055-.165-.073-.059-.017-.108-.026-.148-.026-.044 0-.077.007-.1.021-.022.014-.034.033-.034.057 0 .031.016.054.047.069.031.015.094.037.19.067.095.03.166.071.211.124zm5.714-.594c0 .078-.022.147-.065.208-.044.061-.104.108-.182.141s-.165.05-.263.05c-.083 0-.158-.009-.223-.027-.065-.018-.136-.047-.211-.088v-.417c.081.043.161.077.239.101.078.024.145.036.201.036.041 0 .073-.008.095-.023.022-.016.034-.038.034-.066 0-.024-.012-.045-.036-.063-.023-.018-.075-.043-.156-.076-.11-.043-.19-.099-.239-.168-.049-.069-.074-.156-.074-.262 0-.165.051-.291.152-.379.102-.088.246-.132.434-.132.1 0 .194.012.282.036.088.024.164.053.229.088v.407c-.136-.076-.253-.114-.35-.114-.039 0-.07.008-.092.024-.023.016-.034.035-.034.059 0 .029.015.052.044.07.029.018.091.045.186.082.106.039.184.092.234.159.05.067.075.153.075.257zm-10.1-1.018c.094 0 .171.035.229.104.057.069.086.159.086.269 0 .109-.029.2-.086.269-.059.069-.135.104-.229.104-.095 0-.172-.035-.231-.104-.059-.069-.088-.159-.088-.269 0-.11.029-.199.088-.269.059-.069.136-.104.231-.104zm.257.799v1.724h-.516v-1.724h.516zm7.043-.799c.095 0 .171.035.229.104.057.069.086.159.086.269 0 .109-.029.2-.086.269-.059.069-.135.104-.229.104-.095 0-.172-.035-.231-.104-.059-.069-.088-.159-.088-.269 0-.11.029-.199.088-.269.059-.069.136-.104.231-.104zm.257.799v1.724h-.516v-1.724h.516zm-.854 1.724h-.516v-1.724h.516v1.724zm-1.242-1.407c-.139 0-.209.11-.209.331 0 .109.019.194.057.254.038.06.087.09.146.09.136 0 .204-.111.204-.331 0-.22-.066-.331-.199-.331h.001zm0-.317c.199 0 .357.063.473.189.116.126.174.301.174.527 0 .234-.057.413-.171.539-.114.126-.272.189-.476.189-.203 0-.362-.064-.476-.191-.114-.127-.171-.307-.171-.538 0-.225.058-.4.174-.525.118-.126.275-.19.473-.19zm-9.095 0c.142 0 .25.05.323.15.073.1.11.242.11.425v1.149h-.516v-1.037c0-.231-.065-.346-.195-.346-.081 0-.177.043-.288.129v1.254h-.516v-1.037c0-.232-.066-.347-.198-.347-.08 0-.175.043-.286.129v1.254h-.516v-1.724h.516v.144c.127-.13.27-.194.428-.194.19 0 .325.083.406.251.139-.167.29-.251.453-.251h.279z" transform="translate(0 -1)"/>
              </svg>
            ` : `
              <svg class="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
              </svg>
            `}
          </div>
          <div>
            <div class="font-medium text-gray-800 dark:text-gray-200">${fileName}</div>
            <div class="text-xs text-gray-600 dark:text-gray-400">
              ${fileExtension.toUpperCase()} Document
            </div>
          </div>
        </div>
        <div class="flex items-center">
          <a href="${documentPath}" download="${fileName}" class="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 text-xs font-medium rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors flex items-center mr-3">
            <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Download
          </a>
          <button id="closeDocumentViewer" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded-full transition-colors">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Document content -->
      <div class="flex-1 bg-gray-50 dark:bg-gray-900 h-[70vh]">
        ${viewerContent}
      </div>
    </div>
  `;

  // Add to DOM
  document.body.appendChild(viewerPopup);

  // Add event listeners
  document.getElementById('closeDocumentViewer').addEventListener('click', () => {
    viewerPopup.classList.add('animate-fade-out');
    setTimeout(() => {
      viewerPopup.remove();
    }, 200);
  });

  // Close when clicking outside of the content
  viewerPopup.addEventListener('click', (e) => {
    if (e.target === viewerPopup) {
      document.getElementById('closeDocumentViewer').click();
    }
  });
}

// Add animation styles function
function ensureAnimationStyles() {
  // Check if styles are already added
  if (!document.getElementById('q-and-a-animation-styles')) {
    const style = document.createElement('style');
    style.id = 'q-and-a-animation-styles';
    style.textContent = `
      @keyframes scale-in {
        0% { opacity: 0; transform: scale(0.95); }
        100% { opacity: 1; transform: scale(1); }
      }
      .animate-scale-in {
        animation: scale-in 0.2s ease-out forwards;
      }
      @keyframes fade-in {
        0% { opacity: 0; }
        100% { opacity: 1; }
      }
      .animate-fade-in {
        animation: fade-in 0.3s ease-out forwards;
      }
      @keyframes fade-out {
        0% { opacity: 1; }
        100% { opacity: 0; }
      }
      .animate-fade-out {
        animation: fade-out 0.2s ease-out forwards;
      }
      .animation-delay-200 {
        animation-delay: 0.2s;
      }
      .animation-delay-400 {
        animation-delay: 0.4s;
      }
    `;
    document.head.appendChild(style);
  }
}

function renderQuestionCard(question) {
  const tagsArray = JSON.parse(question.tags || '[]');
  const tagElements = tagsArray.map(tag =>
    `<span class="tag text-xs mr-1">${tag}</span>`
  ).join('');

  // Format date
  const formattedDate = new Date(question.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Document attachment element
  const documentAttachment = question.documentPath ?
    `<div class="document-attachment mt-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-md border border-gray-200 dark:border-gray-700">
    <button class="view-document flex items-center text-sm text-primary hover:underline" data-document-id="${question.documentId || ''}" data-document-path="${question.documentPath}" data-original-filename="${question.originalFilename || ''}">
      <svg class="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span class="ml-2">View attached document</span>
    </button>
  </div>` : '';

  return `
    <div class="question-card bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
      <div class="p-4">
        <h3 class="text-lg font-semibold mb-2">
          <a href="#" class="question-link text-primary hover:text-primary-dark" data-id="${question.id}">
            ${question.title}
          </a>
        </h3>
        <p class="text-gray-600 dark:text-gray-300 text-sm mb-3 max-h-20 overflow-hidden">
          ${question.content.substring(0, 140)}${question.content.length > 140 ? '...' : ''}
        </p>
        ${documentAttachment}
        <div class="flex flex-wrap items-center text-xs text-gray-500 dark:text-gray-400">
          <span class="mr-3">${formattedDate}</span>
          <span class="mr-3">${question.answers.length} answers</span>
          <span>${question.upvotes} upvotes</span>
        </div>
      </div>
      <div class="px-4 py-3 bg-gray-50 dark:bg-gray-700 flex justify-between items-center">
        <div class="tags">
          ${tagElements.length > 0 ? tagElements : '<span class="text-xs text-gray-400">No tags</span>'}
        </div>
        <div class="question-actions flex items-center">
          <button class="upvote-btn flex items-center text-xs text-gray-600 dark:text-gray-300 hover:text-primary" data-id="${question.id}">
            <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
            </svg>
            Upvote
          </button>
        </div>
      </div>
    </div>
  `;
}

// Helper to get current username
function getCurrentUsername() {
  return localStorage.getItem('username');
}

// Report modal HTML generator
function createReportModal({ contentId, type, onSubmit, onCancel }) {
  // Remove any existing modal
  document.getElementById('reportModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'reportModal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 backdrop-blur-sm p-4 transition-all duration-300';
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg dark:shadow-blue-900/10 w-full max-w-md p-6 animate-scale-in relative border border-gray-200 dark:border-gray-700 dark:border-opacity-50 transition-colors duration-200">
      <div class="absolute -inset-0.5 bg-gradient-to-r dark:from-blue-500/20 dark:to-purple-600/20 rounded-xl blur opacity-0 dark:opacity-70 -z-10"></div>
      <button class="absolute top-3 right-3 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-200" id="closeReportModal" aria-label="Close report modal">
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Report Content</h2>
      <p class="mb-4 text-gray-700 dark:text-gray-300">Please select the reason why you are reporting this content. Your feedback helps us maintain a safe and respectful community.</p>
      <form id="reportForm">
        <label for="reportReason" class="block text-sm font-medium mb-2 text-gray-800 dark:text-gray-200">Reason</label>
        <select id="reportReason" name="reason" class="input w-full mb-4 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 rounded-md transition-colors shadow-sm dark:shadow-inner" required>
          <option value="">Select a reason...</option>
          <option value="SPAM" class="dark:bg-gray-700 dark:text-gray-100">SPAM — Unwanted or repetitive content.</option>
          <option value="HARASSMENT" class="dark:bg-gray-700 dark:text-gray-100">HARASSMENT — Offensive, abusive, or threatening behavior.</option>
          <option value="INAPPROPRIATE_CONTENT" class="dark:bg-gray-700 dark:text-gray-100">INAPPROPRIATE CONTENT — Content that violates guidelines or is inappropriate.</option>
        </select>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" id="cancelReportBtn" class="btn py-2 px-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-md transition-all duration-200 font-medium">Cancel</button>
          <button type="submit" id="submitReportBtn" class="btn btn-primary py-2 px-4 bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 border border-blue-600 dark:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed rounded-md transition-all duration-200 shadow-sm hover:shadow font-medium" disabled>Submit Report</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  // Focus trap
  setTimeout(() => modal.querySelector('select')?.focus(), 100);

  // Event listeners
  modal.querySelector('#closeReportModal').onclick = onCancel;
  modal.querySelector('#cancelReportBtn').onclick = onCancel;
  modal.addEventListener('click', e => { if (e.target === modal) onCancel(); });

  // Form validation
  const reasonSelect = modal.querySelector('#reportReason');
  const submitBtn = modal.querySelector('#submitReportBtn');
  reasonSelect.addEventListener('change', () => {
    submitBtn.disabled = !reasonSelect.value;
  });

  modal.querySelector('#reportForm').onsubmit = async e => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    await onSubmit(reasonSelect.value);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Report';
  };
}

// Show report modal
function showReportModal({ contentId, type }) {
  // Ensure animation styles are added
  ensureAnimationStyles();
    // Log what we're trying to report
  console.log(`Opening report modal for ${type} with ID: ${contentId}`);
  
  createReportModal({
    contentId,
    type,onSubmit: async (reason) => {
      try {
        // Show processing state in modal
        const submitBtn = document.querySelector('#submitReportBtn');
        if (submitBtn) {
          submitBtn.textContent = 'Submitting...';
          submitBtn.disabled = true;
        }

        const res = await reports.reportContent(contentId, type, reason);
        
        // Handle response
        if (res && res.success) {
          // Success - close modal with animation
          const modal = document.getElementById('reportModal');
          if (modal) {
            modal.classList.add('animate-fade-out');
            setTimeout(() => modal.remove(), 200);
          }
          showToast('success', 'Report submitted. Thank you for your feedback!');
        } else {
          // Error but API responded
          const errorMsg = res?.message || 'Failed to submit report.';
          console.error('Report submission error:', errorMsg);
          
          // Reset button state but keep modal open
          if (submitBtn) {
            submitBtn.textContent = 'Submit Report';
            submitBtn.disabled = false;
          }
          
          showToast('error', errorMsg);
        }
      } catch (err) {
        // Complete failure (exception thrown)
        console.error('Report submission exception:', err);
        
        // Reset button state
        const submitBtn = document.querySelector('#submitReportBtn');
        if (submitBtn) {
          submitBtn.textContent = 'Submit Report';
          submitBtn.disabled = false;
        }
        
        showToast('error', 'Failed to submit report. Please try again later.');
      }
    },
    onCancel: () => {
      const modal = document.getElementById('reportModal');
      if (modal) {
        modal.classList.add('animate-fade-out');
        setTimeout(() => modal.remove(), 200);
      }
    }
  });
}
