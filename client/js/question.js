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

  // Get wizard elements
  const step1 = document.getElementById('questionStep1');
  const step2 = document.getElementById('questionStep2');
  const step1Indicator = document.getElementById('questionStep1Indicator');
  const step2Indicator = document.getElementById('questionStep2Indicator');
  const nextBtn = document.getElementById('nextToStep2Btn');
  const backBtn = document.getElementById('backToStep1Btn');

  // Setup step navigation
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      // Validate step 1 fields
      const title = document.getElementById('questionTitle').value;
      const content = document.getElementById('questionContent').value;
      
      if (!title.trim()) {
        showToast('error', 'Please enter a question title');
        return;
      }
      
      if (!content.trim()) {
        showToast('error', 'Please enter question details');
        return;
      }
      
      // Move to step 2
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
      // Move back to step 1
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
      showToast('error', 'Please log in to post a question');
      return;
    }

    const title = document.getElementById('questionTitle').value;
    const content = document.getElementById('questionContent').value;
    const tags = document.getElementById('questionTags').value;
    const documentFile = document.getElementById('questionDocument').files[0];

    // Validate required fields
    if (!title.trim()) {
      showToast('error', 'Please enter a question title');
      return;
    }
    
    if (!content.trim()) {
      showToast('error', 'Please enter question details');
      return;
    }

    // Validate file if present
    if (documentFile) {
      // Check file extension
      const fileExtension = documentFile.name.split('.').pop().toLowerCase();
      const allowedExtensions = ['pdf', 'doc', 'docx', 'txt'];
      if (!allowedExtensions.includes(fileExtension)) {
        showToast('error', 'Please upload only PDF, DOC, DOCX, or TXT files');
        return;
      }
      
      // Check file size (5MB max)
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      if (documentFile.size > MAX_FILE_SIZE) {
        showToast('error', 'File size exceeds 5MB limit');
        return;
      }
    }

    try {
      // Always use FormData if there's a file upload, otherwise use JSON
      let result;
      
      if (documentFile) {
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('title', title.trim());
        formData.append('content', content.trim());
        formData.append('tags', tags ? JSON.stringify(tags.split(',').map(tag => tag.trim())) : JSON.stringify([]));
        formData.append('document', documentFile);
        
        console.log('Submitting with FormData (file upload)');
        result = await questionsApi.create(formData, true);
      } else {
        // Standard JSON submission for no file uploads
        console.log('Submitting with JSON (no file)');
        result = await questionsApi.create({
          title: title.trim(),
          content: content.trim(),
          tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
        }, false);
      }
      
      if (result.success) {
        showToast('success', 'Question posted successfully');
        form.reset();
        // Reset form wizard to step 1
        step2.classList.add('hidden');
        step1.classList.remove('hidden');
        step2Indicator.classList.remove('bg-primary');
        step2Indicator.classList.add('bg-gray-300', 'dark:bg-gray-600');
        step1Indicator.classList.remove('bg-gray-300', 'dark:bg-gray-600');
        step1Indicator.classList.add('bg-primary');
        
        // Reset file upload UI if needed
        const uploadDefaultView = document.getElementById('uploadDefaultView');
        const uploadedFileView = document.getElementById('uploadedFileView');
        if (uploadDefaultView && uploadedFileView) {
          uploadDefaultView.classList.remove('hidden');
          uploadedFileView.classList.add('hidden');
        }
        
        // Reset file upload container styling
        const fileUploadContainer = document.getElementById('fileUploadContainer');
        if (fileUploadContainer) {
          fileUploadContainer.classList.remove('bg-gray-50', 'dark:bg-gray-800', 'border-primary', 'drag-over');
        }
        
        showSection('feedSection');
        const { renderFeed } = await import('./feed.js');
        renderFeed();
      } else {
        showToast('error', result.message || 'Failed to post question');
        // Log detailed error if available
        if (result.details) {
          console.error('Error details:', result.details);
        }
      }
    } catch (err) {
      console.error('Error posting question:', err);
      showToast('error', 'Network error posting question');
    }
  });
}

// Helper function to extract the original filename from the Cloudinary URL
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

// Helper function to display uploaded documents - add this function
function displayDocumentLink(documentPath, originalFilename) {
  if (!documentPath) return '';
  
  const fileName = getOriginalFilename(documentPath, originalFilename);
  const extension = fileName.split('.').pop().toLowerCase();
  
  let icon = '';
  switch(extension) {
    case 'pdf':
      icon = '<svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>';
      break;
    case 'doc':
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
      <a href="${documentPath}" download="${fileName}" target="_blank" class="flex items-center text-sm text-primary hover:underline view-document" data-document-path="${documentPath}" data-original-filename="${originalFilename || ''}">
        ${icon}
        <span class="ml-2">View attached document</span>
      </a>
    </div>
  `;
}
