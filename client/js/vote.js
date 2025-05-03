import { getToken, isLoggedIn } from './auth.js';
import { showToast } from './ui.js';
import { renderFeed, showQuestionDetails } from './feed.js';

const userVotes = {
  questions: {},
  answers: {},
};

export function getUserVotes() {
  return userVotes;
}

export function setupVoting() {
  console.log('Setting up voting');
  document.querySelectorAll('.upvote-btn').forEach(button => {
    button.addEventListener('click', () => handleVote(button, 'question', 'upvote'));
  });
  document.querySelectorAll('.downvote-btn').forEach(button => {
    button.addEventListener('click', () => handleVote(button, 'question', 'downvote'));
  });

  document.querySelectorAll('.upvote-answer-btn').forEach(button => {
    button.addEventListener('click', () => handleVote(button, 'answer', 'upvote'));
  });
  document.querySelectorAll('.downvote-answer-btn').forEach(button => {
    button.addEventListener('click', () => handleVote(button, 'answer', 'downvote'));
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
  const oppositeButton = type === 'question'
    ? document.querySelector(`.downvote-btn[data-question-id="${id}"]`)
    : document.querySelector(`.downvote-answer-btn[data-answer-id="${id}"]`);

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

    const voteCountElement = button.querySelector('span');
    const oppositeVoteCountElement = oppositeButton?.querySelector('span');
    let currentVotes = parseInt(voteCountElement.textContent);
    let oppositeVotes = oppositeVoteCountElement ? parseInt(oppositeVoteCountElement.textContent) : 0;

    if (previousVote === oppositeVoteType) {
      currentVotes += 1;
      oppositeVotes -= 1;
    } else {
      currentVotes += 1;
    }

    voteCountElement.textContent = currentVotes;
    if (oppositeVoteCountElement) {
      oppositeVoteCountElement.textContent = Math.max(0, oppositeVotes);
    }

    button.classList.add('text-blue-500', 'font-bold');
    if (oppositeButton) {
      oppositeButton.classList.remove('text-blue-500', 'font-bold');
    }

    showToast('success', `Successfully ${voteType}d the ${type}`);

    const questionFeedSection = document.getElementById('feedSection');
    const questionDetailsSection = document.getElementById('questionDetailsSection');
    if (questionFeedSection && !questionFeedSection.classList.contains('hidden')) {
      renderFeed();
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
