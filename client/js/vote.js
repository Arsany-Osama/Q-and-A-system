import { isLoggedIn } from './auth.js';
import { showToast } from './ui.js';
import { renderFeed, showQuestionDetails, updateVoteCount } from './feed.js';
import { votes as votesApi } from './utils/api.js';

const userVotes = {
  questions: {},
  answers: {},
};

export function getUserVotes() {
  return userVotes;
}

export function setupVoting() {
  console.log('Setting up voting');
  
  // Use event delegation with a flag to prevent multiple triggers
  let isHandlingVote = false;
  document.addEventListener('click', event => {
    const target = event.target.closest('.reaction-btn');
    if (!target) return;

    // Check if this click has already been processed
    if (target.dataset.voteProcessed === 'true') {
      console.log('Vote already processed for this click');
      return;
    }

    event.stopPropagation(); // Prevent bubbling to other handlers
    event.preventDefault(); // Prevent default action (e.g., form submission)
    isHandlingVote = true;
    target.dataset.voteProcessed = 'true'; // Mark as processed

    try {
      if (target.classList.contains('upvote-btn')) {
        handleVote(target, 'question', 'upvote');
      } else if (target.classList.contains('downvote-btn')) {
        handleVote(target, 'question', 'downvote');
      } else if (target.classList.contains('upvote-answer-btn')) {
        handleVote(target, 'answer', 'upvote');
      } else if (target.classList.contains('downvote-answer-btn')) {
        handleVote(target, 'answer', 'downvote');
      }
    } finally {
      isHandlingVote = false;
      // Reset the processed flag after a short delay to allow for new clicks
      setTimeout(() => {
        target.dataset.voteProcessed = 'false';
      }, 100);
    }
  }, { capture: false }); // Use bubbling phase to ensure proper event delegation
}

async function handleVote(button, type, voteType) {
  console.log(`Voting ${voteType} on ${type}`);
  if (!isLoggedIn()) {
    showToast('error', 'Please log in to vote');
    return;
  }

  const id = parseInt(type === 'question' ? button.getAttribute('data-question-id') : button.getAttribute('data-answer-id'));
  if (isNaN(id)) {
    console.error('Invalid ID for vote:', id);
    showToast('error', 'Invalid vote target');
    return;
  }

  const voteStore = type === 'question' ? userVotes.questions : userVotes.answers;
  const oppositeVoteType = voteType === 'upvote' ? 'downvote' : 'upvote';

  // Find opposite button more robustly
  let oppositeButton = null;
  const parentCard = button.closest(type === 'question' ? '.question-card' : '.answer-card');
  if (parentCard) {
    oppositeButton = parentCard.querySelector(
      type === 'question'
        ? `.${oppositeVoteType === 'upvote' ? 'upvote-btn' : 'downvote-btn'}[data-question-id="${id}"]`
        : `.${oppositeVoteType === 'upvote' ? 'upvote-answer-btn' : 'downvote-answer-btn'}[data-answer-id="${id}"]`
    );
  }

  if (voteStore[id] === voteType) {
    showToast('info', 'You have already voted this way');
    return;
  }

  const previousVote = voteStore[id];
  voteStore[id] = voteType;

  try {
    let result;
    if (type === 'question') {
      result = voteType === 'upvote' 
        ? await votesApi.upvoteQuestion(id) 
        : await votesApi.downvoteQuestion(id);
    } else { // answer
      result = voteType === 'upvote' 
        ? await votesApi.upvoteAnswer(id) 
        : await votesApi.downvoteAnswer(id);
    }

    if (!result.success) {
      throw new Error(result.message || `Failed to vote on ${type}`);
    }

    const voteCountElement = button.querySelector('.vote-count');
    const oppositeVoteCountElement = oppositeButton?.querySelector('.vote-count');
    if (!voteCountElement) {
      console.warn('Vote count element not found');
      return;
    }

    let currentVotes = parseInt(voteCountElement.textContent) || 0;
    let oppositeVotes = oppositeVoteCountElement ? parseInt(oppositeVoteCountElement.textContent) || 0 : 0;

    if (previousVote === oppositeVoteType) {
      currentVotes += 1;
      oppositeVotes -= 1;
    } else {
      currentVotes += 1;
    }

    updateVoteCount(button, currentVotes);
    if (oppositeButton && oppositeVoteCountElement) {
      updateVoteCount(oppositeButton, Math.max(0, oppositeVotes));
    }

    // Update CSS classes for the active state
    button.classList.add('active');
    if (oppositeButton) {
      oppositeButton.classList.remove('active');
    }

    showToast('success', `Successfully ${voteType}d the ${type}`);

    // Update UI if in details view
    const questionDetailsSection = document.getElementById('questionDetailsSection');
    if (questionDetailsSection && !questionDetailsSection.classList.contains('hidden')) {
      const questionId = document.querySelector(`.upvote-btn[data-question-id]`)?.getAttribute('data-question-id');
      if (questionId) {
        showQuestionDetails(questionId);
      }
    }
  } catch (err) {
    voteStore[id] = previousVote;
    console.error('Vote error:', err);
    showToast('error', err.message || `Failed to vote on ${type}`);
  }
}
