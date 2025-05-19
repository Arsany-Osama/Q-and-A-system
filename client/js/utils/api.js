/**
 * API Gateway - A central place to handle all API calls to the backend
 */

// Base API URL configuration
const API_BASE_URL = 'https://localhost:3000';

// Helper function to get auth token
function getToken() {
  return localStorage.getItem('token') || '';
}

/**
 * Base fetch function with error handling
 * @param {string} endpoint - The API endpoint to fetch from
 * @param {object} options - Fetch options including method, headers, body, etc.
 * @param {boolean} isBinary - Flag to indicate if the response is binary (e.g., file download)
 * @returns {Promise<object>} - The response data or error
 */
async function fetchWithAuth(endpoint, options = {}, isBinary = false) {
  // Check if body is FormData - if so, don't set Content-Type header (browser will set it with boundary)
  const isFormData = options.body instanceof FormData;

  const defaultOptions = {
    headers: {
      ...(!isFormData && { 'Content-Type': 'application/json' }),
      'Authorization': `Bearer ${getToken()}`,
    }
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(options.headers || {}),
    }
  };

  // Ensure endpoint starts with forward slash
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${normalizedEndpoint}`;

  try {
    console.log(`API Request: ${options.method || 'GET'} ${url}`);
    if (options.body && options.body !== '{}') {
      console.log('Request payload:', 
        options.body instanceof FormData 
          ? 'FormData object' 
          : JSON.parse(options.body)
      );
    }
    
    const response = await fetch(url, mergedOptions);
    console.log(`API Response status: ${response.status} ${response.statusText}`);
    
    // Handle binary response (e.g., file download)
    if (isBinary) {
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Binary response error (${response.status}): ${errorText.substring(0, 200)}...`);
        throw { status: response.status, message: errorText || 'API request failed' };
      }
      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentDisposition = response.headers.get('content-disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'downloaded_file';
      return { blob, contentType, filename };
    }

    // Handle JSON response
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const errorText = await response.text();
      console.error(`Non-JSON response from server (${response.status}): ${errorText.substring(0, 200)}...`);
      throw new Error(`Server returned non-JSON response with status ${response.status}`);
    }

    const data = await response.json();
    
    // Check for token expiration errors
    if (!response.ok && (
        data.message?.includes('jwt expired') || 
        data.message?.includes('Invalid token') ||
        response.status === 401 || 
        response.status === 403
      )) {
      console.error('Token validation error:', data.message);
      // Import handleTokenExpiration dynamically to avoid circular imports
      import('../auth.js').then(auth => {
        if (typeof auth.handleTokenExpiration === 'function') {
          auth.handleTokenExpiration();
        }
      });
    }

    if (!response.ok) {
      console.error(`API request failed:`, {
        status: response.status,
        data,
        url,
        method: mergedOptions.method,
      });
      throw { status: response.status, message: data.message || 'API request failed' };
    }

    // Before returning response data
    console.log(`API Response data for ${options.method || 'GET'} ${url}:`, data);
    return data;
  } catch (error) {
    console.error(`API Error (${url}):`, error);
    // Return a standardized error object
    return {
      success: false,
      message: error.message || 'Failed to communicate with server',
      error: error,
    };
  }
}

// Auth API
export const auth = {
  login: async (email, password) => {
    return fetchWithAuth('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  register: async (username, email, password) => {
    return fetchWithAuth('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });
  },

  logout: async () => {
    return fetchWithAuth('/auth/logout', { method: 'POST' });
  },

  verifyOTP: async (email, otp, type) => {
    if (!email || !otp || !type) {
      return {
        success: false,
        message: 'Email, OTP, and type are required'
      };
    }
    if (!/^\d{6}$/.test(otp)) {
      return {
        success: false,
        message: 'OTP must be exactly 6 digits'
      };
    }
    return fetchWithAuth('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), otp: otp.trim(), type: type.trim() })
    });
  },

  forgotPassword: async (email) => {
    return fetchWithAuth('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  resetPassword: async (token, password) => {
    return fetchWithAuth('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password })
    });
  },

  getUserStats: async () => {
    return fetchWithAuth('/auth/stats');
  },

  getTopContributors: async () => {
    return fetchWithAuth('/auth/top-contributors');
  },

  // 2FA methods
  setup2FA: async () => {
    return fetchWithAuth('/auth/2fa/setup', { method: 'POST' });
  },

  verify2FA: async (token) => {
    return fetchWithAuth('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  },

  disable2FA: async (code) => {
    return fetchWithAuth('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  },

  // Security questions methods
  verifySecurityQuestions: async (email, answers) => {
    return fetchWithAuth('/auth/verify-security-questions', {
      method: 'POST',
      body: JSON.stringify({ email, answers })
    });
  }
};

// Questions API
export const questions = {
  fetchAll: async () => {
    return fetchWithAuth('/questions');
  },

  create: async (questionData, isFormData = false) => {
    return fetchWithAuth(isFormData ? '/questions/with-document' : '/questions', {
      method: 'POST',
      body: isFormData ? questionData : JSON.stringify(questionData)
    });
  },

  getPopularTags: async () => {
    return fetchWithAuth('/questions/popular-tags');
  }
};

// Answers API
export const answers = {
  create: async (questionId, content) => {
    return fetchWithAuth('/answers', {
      method: 'POST',
      body: JSON.stringify({ questionId, content })
    });
  }
};

// Votes API
export const votes = {
  upvoteQuestion: async (questionId) => {
    return fetchWithAuth(`/vote/question`, {
      method: 'POST',
      body: JSON.stringify({ questionId: parseInt(questionId), voteType: 'upvote' })
    });
  },

  downvoteQuestion: async (questionId) => {
    return fetchWithAuth(`/vote/question`, {
      method: 'POST',
      body: JSON.stringify({ questionId: parseInt(questionId), voteType: 'downvote' })
    });
  },

  upvoteAnswer: async (answerId) => {
    return fetchWithAuth(`/vote/answer`, {
      method: 'POST',
      body: JSON.stringify({ answerId: parseInt(answerId), voteType: 'upvote' })
    });
  },

  downvoteAnswer: async (answerId) => {
    return fetchWithAuth(`/vote/answer`, {
      method: 'POST',
      body: JSON.stringify({ answerId: parseInt(answerId), voteType: 'downvote' })
    });
  }
};

// Replies API
export const replies = {
  create: async (answerId, content) => {
    return fetchWithAuth('/replies', {
      method: 'POST',
      body: JSON.stringify({ answerId, content })
    });
  }
};

// Documents API
export const documents = {
  upload: async (file, questionId = null) => {
    if (!file) {
      console.error('Document upload failed: No file provided');
      return { success: false, message: 'No file provided' };
    }
    if (!(file instanceof File)) {
      console.error('Document upload failed: Invalid file object', file);
      return { success: false, message: 'Invalid file object' };
    }
    if (!window.isApproved()) {
      console.error('Document upload failed: User not approved');
      return { success: false, message: 'Only approved users can upload documents' };
    }

    const formData = new FormData();
    formData.append('document', file);
    if (questionId) {
      formData.append('questionId', questionId.toString());
    }

    console.log('Uploading document:', {
      fileName: file.name,
      fileSize: file.size,
      questionId: questionId
    });

    const response = await fetchWithAuth('/documents/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.success) {
      console.error('Document upload failed:', response.message, response.error);
    }
    return response;
  },

  download: async (documentId) => {
    if (!documentId) {
      console.error('Document download failed: Document ID is required');
      return { success: false, message: 'Document ID is required' };
    }
    if (!window.isApproved()) {
      console.error('Document download failed: User not approved');
      return { success: false, message: 'Only approved users can download documents' };
    }

    console.log('Initiating download for document ID:', documentId);
    try {
      const response = await fetchWithAuth(`/documents/download/${documentId}`, {}, true);
      if (!response.blob) {
        console.error('Download failed: No blob in response', response);
        return { success: false, message: response.message || 'Invalid download response' };
      }
      return { success: true, blob: response.blob, filename: response.filename };
    } catch (error) {
      console.error('Document download error:', error);
      // Handle JSON error response
      let message = 'Failed to download document';
      if (error.status && error.message) {
        try {
          const errorData = JSON.parse(error.message);
          message = errorData.message || message;
        } catch (parseError) {
          message = error.message;
        }
      }
      return { success: false, message };
    }
  }
};

// Admin API
export const admin = {
  getUsers: async () => {
    return fetchWithAuth('/admin/users');
  },
  
  updateUserState: async (userId, state) => {
    return fetchWithAuth(`/admin/users/${userId}/state`, {
      method: 'PUT',
      body: JSON.stringify({ state })
    });
  },
  
  updateUserRole: async (userId, role) => {
    return fetchWithAuth('/admin/users/role', {
      method: 'POST',
      body: JSON.stringify({ userId, role })
    });
  },
  
  // Make sure this function is defined properly
  getLoginLogs: async () => {
    return fetchWithAuth('/admin/login-logs');
  },
  
  deleteUser: async (userId) => {
    console.log(`API: Preparing to delete user with ID: ${userId}`);
    
    try {
      // Make API request
      const response = await fetchWithAuth(`/admin/users/${userId}`, {
        method: 'DELETE'
      });
      
      console.log(`API: Delete user response:`, response);
      
      // Return standardized response
      return {
        success: !!response.success,
        message: response.message || 'User deleted successfully',
        ...response
      };
    } catch (error) {
      console.error('Error in deleteUser API call:', error);
      return {
        success: false,
        message: error.message || 'Failed to delete user'
      };
    }
  },
  
  createUser: async (userData) => {
    console.log('API: Creating user:', userData);
    return fetchWithAuth('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },
};

// Default export of all API modules
export default {
  auth,
  questions,
  answers,
  votes,
  replies,
  documents,
  admin
};

// Expose isApproved globally for use in other scripts
import { isApproved } from '../auth.js';
window.isApproved = isApproved;

export { fetchWithAuth };
