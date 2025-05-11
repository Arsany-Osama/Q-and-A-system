import { showToast, showSection } from './ui.js';
import { isLoggedIn } from './auth.js';
import { questions as questionsApi } from './utils/api.js';

export async function fetchQuestions() {
  console.log('Fetching questions');
  try {
    const questions = await questionsApi.fetchAll();
    return questions.map(question => {
      let tags = [];
      if (question.tags) {
        if (typeof question.tags === 'string') {
          try {
            // Try parsing as JSON
            tags = JSON.parse(question.tags);
          } catch (e) {
            // If JSON.parse fails, treat as comma-separated string
            console.warn(`Invalid JSON tags format for question ${question.id}: ${question.tags}`);
            tags = question.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
          }
        } else if (Array.isArray(question.tags)) {
          // If tags is already an array, use it directly
          tags = question.tags;
        } else {
          // Log unexpected type for debugging
          console.warn(`Unexpected tags type for question ${question.id}:`, typeof question.tags, question.tags);
          tags = [];
        }
      }
      return {
        ...question,
        username: question.user?.username || 'Anonymous',
        answers: Array.isArray(question.answers) ? question.answers.map(answer => ({
          ...answer,
          username: answer.user?.username || 'Anonymous',
        })) : [],
        tags,
      };
    });
  } catch (err) {
    console.error('Error fetching questions:', err);
    showToast('error', 'Failed to fetch questions');
    return [];
  }
}

export function setupQuestionForm() {
  const form = document.getElementById('postQuestionForm');
  if (!form) {
    console.error('Post question form not found');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Post question form submitted');
    if (!isLoggedIn()) {
      showToast('error', 'Please log in to post a question');
      return;
    }

    const title = document.getElementById('questionTitle').value;
    const content = document.getElementById('questionContent').value;
    const tags = document.getElementById('questionTags').value;

    try {
      const result = await questionsApi.create({
        title,
        content,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      });
      
      if (result.success) {
        showToast('success', 'Question posted successfully');
        form.reset();
        showSection('feedSection');
        const { renderFeed } = await import('./feed.js');
        renderFeed();
      } else {
        showToast('error', result.message || 'Failed to post question');
      }
    } catch (err) {
      console.error('Error posting question:', err);
      showToast('error', 'Network error posting question');
    }
  });
}
