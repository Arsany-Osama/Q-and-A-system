import { getToken, isLoggedIn } from './auth.js';
import { showToast } from './ui.js';
import { renderFeed, showQuestionDetails, updateVoteCount } from './feed.js';

const userVotes = {
  questions: {},
  answers: {},
};

export function getUserVotes() {
  return userVotes;
}

export function setupVoting() {
  console.log('Setting up voting');
  
  // Use event delegation instead of individual event listeners
  document.addEventListener('click', event => {
    const target = event.target.closest('.reaction-btn');
    if (!target) return;
    
    if (target.classList.contains('upvote-btn')) {
      handleVote(target, 'question', 'upvote');
    } else if (target.classList.contains('downvote-btn')) {
      handleVote(target, 'question', 'downvote');
    } else if (target.classList.contains('upvote-answer-btn')) {
      handleVote(target, 'answer', 'upvote');
    } else if (target.classList.contains('downvote-answer-btn')) {
      handleVote(target, 'answer', 'downvote');
    }
  });
}

async function handleVote(button, type, voteType) {
  console.log(`Voting ${voteType} on ${type}`);
  if (!isLoggedIn()) {
    showToast('error', 'Please log in to vote');
    return;
  }

  const id = parseInt(type === 'question' ? button.getAttribute('data-question-id') : button.getAttribute('data-answer-id'));
  const voteStore = type === 'question' ? userVotes.questions : userVotes.answers;
  const oppositeVoteType = voteType === 'upvote' ? 'downvote' : 'upvote';
  
  // Updated selectors to match Facebook-like UI
  const oppositeSelector = type === 'question'
    ? `.downvote-btn[data-question-id="${id}"]`
    : `.downvote-answer-btn[data-answer-id="${id}"]`;
  
  const oppositeButton = type === 'question'
    ? button.parentElement.querySelector(`.downvote-btn`)
    : button.parentElement.querySelector(`.downvote-answer-btn`);

  if (voteStore[id] === voteType) {
    showToast('info', 'You have already voted this way');
    return;
  }

  const previousVote = voteStore[id];
  voteStore[id] = voteType;

  try {
    const endpoint = `/vote/${type}`;
    const body = type === 'question' ? { questionId: id, voteType } : { answerId: id, voteType };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || `Failed to vote on ${type}`);
    }

    const voteCountElement = button.querySelector('.vote-count');
    const oppositeVoteCountElement = oppositeButton?.querySelector('.vote-count');
    let currentVotes = parseInt(voteCountElement.textContent);
    let oppositeVotes = oppositeVoteCountElement ? parseInt(oppositeVoteCountElement.textContent) : 0;

    if (previousVote === oppositeVoteType) {
      currentVotes += 1;
      oppositeVotes -= 1;
    } else {
      currentVotes += 1;
    }

    updateVoteCount(button, currentVotes);
    if (oppositeButton) {
      updateVoteCount(oppositeButton, Math.max(0, oppositeVotes));
    }

    // Update CSS classes for the active state
    button.classList.add('active');
    if (oppositeButton) {
      oppositeButton.classList.remove('active');
    }

    showToast('success', `Successfully ${voteType}d the ${type}`);

    const questionFeedSection = document.getElementById('feedSection');
    const questionDetailsSection = document.getElementById('questionDetailsSection');
    if (questionFeedSection && !questionFeedSection.classList.contains('hidden')) {
      // Don't need to re-render the entire feed - just update the UI we've already changed
    } else if (questionDetailsSection) {
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
