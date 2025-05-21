import { getToken, isLoggedIn } from './auth.js';
import { showPopup, showToast } from './ui.js';
import { replies as repliesApi } from './utils/api.js';

// Post a reply to an answer
export async function postReply(answerId, content, mentionedUserId, mentionedUsername) {
  if (!isLoggedIn()) {
    showPopup('login');
    return false;
  }
  
  try {
    // Format content to include the @mention if not already present
    if (mentionedUsername && !content.includes(`@${mentionedUsername}`)) {
      content = `@${mentionedUsername} ${content}`;
    }
    
    const data = await repliesApi.create(answerId, content);
    
    if (data.success) {
      return {
        ...data.reply,
        mentionedUsername // Ensure this is available for UI display
      };
    } else {
      throw new Error(data.message || 'Failed to post reply');
    }
  } catch (error) {
    console.error('Error posting reply:', error);
    showToast('error', error.message || 'Error posting reply');
    return false;
  }
}

// Show reply form
export function showReplyForm(button, answerId, answerUsername, answerUserId) {
  if (!isLoggedIn()) {
    showPopup('login');
    return;
  }
  
  // Remove any existing reply forms
  document.querySelectorAll('.reply-form-container').forEach(el => el.remove());
  
  const answerCard = button.closest('.answer-card') || button.closest('.answer-container');
  if (!answerCard) return;
  
  const replyForm = document.createElement('div');
  replyForm.className = 'reply-form-container mt-3 ml-9 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700';
  replyForm.innerHTML = `
    <div class="reply-header mb-2">
      <span class="text-sm font-medium">Replying to </span>
      <span class="text-primary font-bold">@${answerUsername}</span>
    </div>
    <div class="flex items-start">
      <div class="flex-1 relative">
        <textarea class="reply-input w-full rounded-lg p-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700" 
          placeholder="Write your reply here..."
          rows="2"></textarea>
        <div class="flex justify-end items-center mt-2">
          <button class="cancel-reply-btn text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mr-2">Cancel</button>
          <button class="send-reply-btn text-sm bg-primary text-white px-3 py-1 rounded hover:bg-primary-dark">Reply</button>
        </div>
      </div>
    </div>
  `;
  
  // Insert after reply button's container
  const answerContent = answerCard.querySelector('.answer-content') || answerCard;
  const answerFooter = answerCard.querySelector('.answer-footer');
  
  if (answerFooter) {
    answerFooter.after(replyForm);
  } else {
    answerContent.appendChild(replyForm);
  }
  
  const textarea = replyForm.querySelector('.reply-input');
  textarea.focus();
  
  // Cancel button
  replyForm.querySelector('.cancel-reply-btn').addEventListener('click', () => {
    replyForm.remove();
  });
  
  // Send button
  replyForm.querySelector('.send-reply-btn').addEventListener('click', async () => {
    const content = textarea.value.trim();
    if (!content) {
      showToast('error', 'Reply cannot be empty');
      return;
    }
    
    const reply = await postReply(answerId, content, answerUserId, answerUsername);
    if (reply) {
      replyForm.remove();
      
      // Add the new reply to the UI
      const repliesContainer = answerCard.querySelector('.replies-container') || 
        createRepliesContainer(answerCard);
      
      // Format the reply data
      const replyData = {
        ...reply,
        content: content, // Original content without the @mention prefix we add on the server
        mentionedUsername: answerUsername
      };
      
      addReplyToUI(repliesContainer, replyData);
      showToast('success', 'Reply posted successfully');
    }
  });
}

// Add a reply to the UI
function addReplyToUI(container, reply) {
  const replyEl = document.createElement('div');
  replyEl.className = 'reply border-l-2 border-gray-200 dark:border-gray-700 pl-3 py-2 ml-2 mt-1 animate-fade-in';
  
  // Format content with mention highlight
  let displayContent = reply.content;
  
  // If the content doesn't start with @username, add the mention at the beginning
  if (reply.mentionedUsername && !displayContent.startsWith(`@${reply.mentionedUsername}`)) {
    displayContent = `<span class="text-primary font-bold">@${reply.mentionedUsername}</span> ${displayContent}`;
  } else if (reply.mentionedUsername) {
    // Replace the @username with a highlighted version
    displayContent = displayContent.replace(
      new RegExp(`@${reply.mentionedUsername}\\b`, 'g'), 
      `<span class="text-primary font-bold">@${reply.mentionedUsername}</span>`
    );
  }
    replyEl.innerHTML = `
    <div class="reply-content text-sm">
      <span class="font-medium">${reply.username || 'Anonymous'}</span>
      ${displayContent}
    </div>
    <div class="reply-footer flex items-center text-xs text-gray-500 mt-1">
      <span>${reply.createdAt ? 
        new Date(reply.createdAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'Just now'
      }</span>
      <button class="reply-to-reply-btn ml-4 text-primary hover:text-primary-dark" 
        data-username="${reply.username}"
        data-user-id="${reply.userId}"
        data-answer-id="${reply.answerId}">
        Reply
      </button>
    </div>
  `;
  
  // Add reply button event handler
  const replyBtn = replyEl.querySelector('.reply-to-reply-btn');
  if (replyBtn) {
    replyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const username = replyBtn.dataset.username;
      const userId = replyBtn.dataset.userId;
      const answerId = replyBtn.dataset.answerId;
      
      // Open reply form
      showReplyForm(replyBtn, answerId, username, userId);
    });
  }
  
  container.appendChild(replyEl);
  
  // Add a subtle animation to highlight the new reply
  replyEl.animate([
    { backgroundColor: 'rgba(var(--color-primary-rgb), 0.1)' },
    { backgroundColor: 'transparent' }
  ], {
    duration: 2000,
    easing: 'ease-out'
  });
}

// Add other functions from your original reply.js
export function setupReplyUI(answerElement, answerId, answerUsername, answerUserId) {
  // Find the existing reply button
  const existingReplyBtn = answerElement.querySelector('.reply-btn');
  
  if (existingReplyBtn) {
    // Make sure it has the correct data attributes
    existingReplyBtn.dataset.answerId = answerId;
    existingReplyBtn.dataset.username = answerUsername;
    existingReplyBtn.dataset.userId = answerUserId;
    
    // Remove existing event listeners and add a new one
    existingReplyBtn.replaceWith(existingReplyBtn.cloneNode(true));
    
    // Get the fresh button reference
    const replyBtn = answerElement.querySelector('.reply-btn');
    
    // Add click event listener
    replyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      showReplyForm(replyBtn, answerId, answerUsername, answerUserId);
    });
  }
  
  // Create replies container if it doesn't exist
  if (!answerElement.querySelector('.replies-container')) {
    const answerContent = answerElement.querySelector('.answer-content') || answerElement;
    const container = document.createElement('div');
    container.className = 'replies-container mt-2';
    answerContent.appendChild(container);
    
    // Load existing replies
    loadReplies(container, answerId);
  }
}

// Helper function to create replies container if it doesn't exist
function createRepliesContainer(answerCard) {
  const container = document.createElement('div');
  container.className = 'replies-container mt-2 ml-9';
  answerCard.appendChild(container);
  return container;
}

// Load replies for an answer
async function loadReplies(container, answerId) {
  container.innerHTML = '<div class="text-center py-2"><div class="spinner"></div></div>';
  
  const replies = await getReplies(answerId);
  
  if (replies.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = '';
  replies.forEach(reply => addReplyToUI(container, reply));
}

// Get replies for an answer
export async function getReplies(answerId) {
  try {
    const response = await fetch(`/replies/${answerId}`);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    return data.replies || [];
  } catch (error) {
    console.error('Error fetching replies:', error);
    return [];
  }
}
