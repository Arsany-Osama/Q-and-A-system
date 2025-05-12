/**
 * API Gateway - A central place to handle all API calls to the backend
 */

// Base API URL configuration
const API_BASE_URL = 'http://localhost:3000';

// Helper function to get auth token
function getToken() {
  return localStorage.getItem('token') || '';
}

/**
 * Base fetch function with error handling
 * @param {string} endpoint - The API endpoint to fetch from
 * @param {object} options - Fetch options including method, headers, body, etc.
 * @returns {Promise<object>} - The response data or error
 */
async function fetchWithAuth(endpoint, options = {}) {
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
    // Log the request details for debugging
    if (isFormData) {
      console.log(`Making request to: ${url}`, { 
        method: mergedOptions.method, 
        isFormData: 'Yes (FormData)',
        formDataContents: Array.from(options.body.entries()).reduce((acc, [key, val]) => {
          acc[key] = key === 'document' ? '[FILE]' : val;
          return acc;
        }, {}),
      });
    } else {
      console.log(`Making request to: ${url}`, { 
        method: mergedOptions.method, 
        isFormData: 'No',
        body: options.body,
      });
    }

    const response = await fetch(url, mergedOptions);

    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const errorText = await response.text();
      console.error(`Non-JSON response from server (${response.status}): ${errorText.substring(0, 200)}...`);
      throw new Error(`Server returned non-JSON response with status ${response.status}`);
    }

    const data = await response.json();

    if (!response.ok) {
      console.error(`API request failed:`, { 
        status: response.status, 
        data,
        url,
        method: mergedOptions.method,
      });
      throw { status: response.status, message: data.message || 'API request failed' };
    }

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
    return fetchWithAuth('/questions', {
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

// Admin API
export const admin = {
  getUsers: async () => {
    return fetchWithAuth('/admin/users');
  },

  updateUserRole: async (userId, role) => {
    return fetchWithAuth('/admin/users/role', {
      method: 'PATCH',
      body: JSON.stringify({ userId, role })
    });
  },

  updateUserState: async (userId, state) => {
    return fetchWithAuth('/admin/users/state', {
      method: 'PATCH',
      body: JSON.stringify({ userId, state })
    });
  },

  deleteUser: async (userId) => {
    return fetchWithAuth(`/admin/users/${userId}`, { method: 'DELETE' });
  }
};

// Default export of all API modules
export default {
  auth,
  questions,
  answers,
  votes,
  replies,
  admin
};
export { fetchWithAuth };
