/**
 * File Upload Component
 * Handles the custom file upload component functionality
 */
document.addEventListener('DOMContentLoaded', () => {
  const fileUploadContainer = document.getElementById('fileUploadContainer');
  const fileInput = document.getElementById('questionDocument');
  const uploadDefaultView = document.getElementById('uploadDefaultView');
  const uploadedFileView = document.getElementById('uploadedFileView');
  const selectedFileName = document.getElementById('selectedFileName');
  const removeFileBtn = document.getElementById('removeFileBtn');
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  if (!fileUploadContainer) return;

  // Click on container to trigger file input
  fileUploadContainer.addEventListener('click', () => {
    fileInput.click();
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
  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent container click
    resetFileUpload();
  });

  function handleFileSelection() {
    const file = fileInput.files[0];
    
    if (!file) return;

    // Validate file type
    const acceptedTypes = ['.doc', '.docx', '.pdf', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!acceptedTypes.includes(fileExtension)) {
      showToast('Please upload a DOC, DOCX, PDF, or TXT file', 'error');
      resetFileUpload();
      return;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
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
  }
  
  function addFileTypeIcon(extension) {
    // Remove any existing file type classes
    selectedFileName.classList.remove('docx', 'pdf', 'txt');
    
    // Add the appropriate file type class
    switch(extension) {
      case '.doc':
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
  }

  function showToast(message, type = 'info') {
    // Use existing toast functionality if available
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      alert(message);
    }
  }
}); 