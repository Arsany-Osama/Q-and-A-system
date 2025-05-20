import { showToast, showSection } from './ui.js';
import { isLoggedIn } from './auth.js';
import { questions as questionsApi, documents as documentsApi } from './utils/api.js';

export async function fetchQuestions() {
  console.log('Fetching questions');
  try {
    const questions = await questionsApi.fetchAll();
    return questions.map(question => {
      let tags = [];
      if (question.tags) {
        if (typeof question.tags === 'string') {
          try {
            tags = JSON.parse(question.tags);
          } catch (e) {
            console.warn(`Invalid JSON tags format for question ${question.id}: ${question.tags}`);
            tags = question.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
          }
        } else if (Array.isArray(question.tags)) {
          tags = question.tags;
        } else {
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
        documents: Array.isArray(question.documents) ? question.documents : [],
        tags,
      };
    });
  } catch (err) {
    console.error('Error fetching questions:', err);
    showToast('Failed to fetch questions', 'error');
    return [];
  }
}

export function setupQuestionForm() {
  const form = document.getElementById('postQuestionForm');
  if (!form) {
    console.error('Post question form not found');
    return;
  }

  const step1 = document.getElementById('questionStep1');
  const step2 = document.getElementById('questionStep2');
  const step1Indicator = document.getElementById('questionStep1Indicator');
  const step2Indicator = document.getElementById('questionStep2Indicator');
  const nextBtn = document.getElementById('nextToStep2Btn');
  const backBtn = document.getElementById('backToStep1Btn');
  const submitBtn = document.getElementById('submitQuestionBtn');
  const submitSpinner = document.getElementById('submitSpinner');

  let selectedFile = null;

  document.addEventListener('documentSelected', (e) => {
    selectedFile = e.detail.file;
    console.log('Document selected for question:', selectedFile ? selectedFile.name : 'No file');
  });

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const title = document.getElementById('questionTitle').value;
      const content = document.getElementById('questionContent').value;

      if (!title.trim()) {
        showToast('Please enter a question title', 'error');
        return;
      }

      if (!content.trim()) {
        showToast('Please enter question details', 'error');
        return;
      }

      step1.classList.add('hidden');
      step2.classList.remove('hidden');
      step1Indicator.classList.remove('bg-primary');
      step1Indicator.classList.add('bg-gray-300', 'dark:bg-gray-600');
      step2Indicator.classList.remove('bg-gray-300', 'dark:bg-gray-600');
      step2Indicator.classList.add('bg-primary');
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      step2.classList.add('hidden');
      step1.classList.remove('hidden');
      step2Indicator.classList.remove('bg-primary');
      step2Indicator.classList.add('bg-gray-300', 'dark:bg-gray-600');
      step1Indicator.classList.remove('bg-gray-300', 'dark:bg-gray-600');
      step1Indicator.classList.add('bg-primary');
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Post question form submitted');
    if (!isLoggedIn()) {
      showToast('Please log in to post a question', 'error');
      showPopup('login');
      return;
    }
    if (typeof window.isApproved === 'function' && !window.isApproved()) {
      showToast('Only approved users can post questions', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitSpinner.classList.remove('hidden');

    const title = document.getElementById('questionTitle').value;
    const content = document.getElementById('questionContent').value;
    const tags = document.getElementById('questionTags').value;

    console.log('Form data:', { title, content, tags, hasFile: !!selectedFile });

    if (!title.trim()) {
      showToast('Please enter a question title', 'error');
      submitBtn.disabled = false;
      submitSpinner.classList.add('hidden');
      return;
    }

    if (!content.trim()) {
      showToast('Please enter question details', 'error');
      submitBtn.disabled = false;
      submitSpinner.classList.add('hidden');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('content', content.trim());
      formData.append('tags', tags ? tags.split(',').map(tag => tag.trim()).join(',') : '');
      if (selectedFile) {
        formData.append('document', selectedFile);
      }

      console.log('Submitting question with file:', selectedFile ? selectedFile.name : 'No file');
      const result = await questionsApi.create(formData, true);

      if (result.success) {
        showToast('Question posted successfully', 'success');
        form.reset();
        step2.classList.add('hidden');
        step1.classList.remove('hidden');
        step2Indicator.classList.remove('bg-primary');
        step2Indicator.classList.add('bg-gray-300', 'dark:bg-gray-600');
        step1Indicator.classList.remove('bg-gray-300', 'dark:bg-gray-600');
        step1Indicator.classList.add('bg-primary');

        const uploadDefaultView = document.getElementById('uploadDefaultView');
        const uploadedFileView = document.getElementById('uploadedFileView');
        if (uploadDefaultView && uploadedFileView) {
          uploadDefaultView.classList.remove('hidden');
          uploadedFileView.classList.add('hidden');
        }

        const fileUploadContainer = document.getElementById('fileUploadContainer');
        if (fileUploadContainer) {
          fileUploadContainer.classList.remove('bg-gray-50', 'dark:bg-gray-800', 'border-primary', 'drag-over');
        }        document.getElementById('questionFormPopup').classList.add('hidden');
        
        // Ensure the feed section is visible
        const feedSection = document.getElementById('feedSection');
        if (feedSection) {
          document.querySelectorAll('main > section').forEach(section => {
            if (section !== feedSection) {
              section.classList.add('hidden');
            }
          });
          feedSection.classList.remove('hidden');
        }
        
        const { renderFeed } = await import('./feed.js');
        renderFeed();
      } else {
        console.error('Question creation failed:', result.message);
        showToast(result.message || 'Failed to post question', 'error');
      }
    } catch (err) {
      console.error('Error posting question:', err);
      showToast('Network error posting question', 'error');
    } finally {
      selectedFile = null;
      submitBtn.disabled = false;
      submitSpinner.classList.add('hidden');
    }
  });
}

// Helper function to display uploaded documents
export function displayDocumentLink(document) {
  if (!document || !document.id) return '';

  const fileName = document.filename || 'document';
  const extension = fileName.split('.').pop().toLowerCase();

  let icon = '';
  switch (extension) {
    case 'pdf':
      icon = '<svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>';
      break;
    case 'docx':
      icon = '<svg class="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>';
      break;
    case 'txt':
      icon = '<svg class="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>';
      break;
    default:
      icon = '<svg class="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>';
  }

  return `
    <div class="document-attachment mt-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-md border border-gray-200 dark:border-gray-700">
      <a class="flex items-center text-sm text-primary hover:underline view-document" 
         data-document-id="${document.id}" 
         data-original-filename="${fileName}">
        ${icon}
        <span class="ml-2">View attached document (${fileName})</span>
      </a>
    </div>
  `;
}
