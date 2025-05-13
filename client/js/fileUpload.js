/**
 * File Upload Component
 * Handles the custom file upload component functionality
 */
import { documents } from './utils/api.js';

document.addEventListener('DOMContentLoaded', () => {
  const fileUploadContainer = document.getElementById('fileUploadContainer');
  const fileInput = document.getElementById('questionDocument');
  const uploadDefaultView = document.getElementById('uploadDefaultView');
  const uploadedFileView = document.getElementById('uploadedFileView');
  const selectedFileName = document.getElementById('selectedFileName');
  const removeFileBtn = document.getElementById('removeFileBtn');
  const uploadFileBtn = document.getElementById('uploadFileBtn');
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  // Hide upload UI if user is not approved
  if (fileUploadContainer && typeof window.isApproved === 'function' && !window.isApproved()) {
    fileUploadContainer.classList.add('hidden');
    return;
  }

  if (!fileUploadContainer || !fileInput) {
    console.error('File upload container or input not found');
    return;
  }

  // Click on container to trigger file input
  fileUploadContainer.addEventListener('click', (e) => {
    if (e.target !== uploadFileBtn && e.target !== removeFileBtn) {
      fileInput.click();
    }
  });

  // Handle file selection
  fileInput.addEventListener('change', handleFileSelection);

  // Handle drag and drop
  fileUploadContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUploadContainer.classList.add('border-primary', 'drag-over');
  });

  fileUploadContainer.addEventListener('dragleave', (e) => {
    e.preventDefault();
    fileUploadContainer.classList.remove('border-primary', 'drag-over');
  });

  fileUploadContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUploadContainer.classList.remove('border-primary', 'drag-over');

    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelection();
    }
  });

  // Remove file button
  if (removeFileBtn) {
    removeFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetFileUpload();
    });
  }

  // Remove upload button functionality (handled by form submission)
  if (uploadFileBtn) {
    uploadFileBtn.classList.add('hidden'); // Hide manual upload button
  }

  function handleFileSelection() {
    const file = fileInput.files[0];
    if (!file) return;

    console.log('File selected:', file.name, file.type, file.size);

    // Validate file type
    const acceptedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    const acceptedExtensions = ['.pdf', '.docx', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

    if (!acceptedMimeTypes.includes(file.type) || !acceptedExtensions.includes(fileExtension)) {
      console.error('Invalid file type:', file.type, fileExtension);
      showToast('Please upload a PDF, DOCX, or TXT file', 'error');
      resetFileUpload();
      return;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      console.error('File size exceeds limit:', file.size);
      showToast('File size exceeds 5MB limit', 'error');
      resetFileUpload();
      return;
    }

    // Display file name
    selectedFileName.textContent = file.name;
    uploadDefaultView.classList.add('hidden');
    uploadedFileView.classList.remove('hidden');

    // Add selected class to container
    fileUploadContainer.classList.add('bg-gray-50', 'dark:bg-gray-800');
    fileUploadContainer.classList.add('border-primary');

    // Add file type class for icon
    addFileTypeIcon(fileExtension);

    // Dispatch event to notify question form
    const selectEvent = new CustomEvent('documentSelected', {
      detail: { file },
    });
    document.dispatchEvent(selectEvent);
    console.log('Dispatched documentSelected event for:', file.name);
  }

  function addFileTypeIcon(extension) {
    selectedFileName.classList.remove('docx', 'pdf', 'txt');
    switch (extension) {
      case '.docx':
        selectedFileName.classList.add('docx');
        break;
      case '.pdf':
        selectedFileName.classList.add('pdf');
        break;
      case '.txt':
        selectedFileName.classList.add('txt');
        break;
    }
  }

  function resetFileUpload() {
    fileInput.value = '';
    uploadDefaultView.classList.remove('hidden');
    uploadedFileView.classList.add('hidden');
    fileUploadContainer.classList.remove('bg-gray-50', 'dark:bg-gray-800', 'border-primary', 'drag-over');
    selectedFileName.classList.remove('docx', 'pdf', 'txt');
    // Notify question form of file removal
    document.dispatchEvent(new CustomEvent('documentSelected', { detail: { file: null } }));
  }

  function showToast(message, type = 'info') {
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      alert(message);
    }
  }
});
