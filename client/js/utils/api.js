/**
 * API Gateway - A central place to handle all API calls to the backend
 */

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
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    }
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };

  try {
    const response = await fetch(endpoint, mergedOptions);
    const data = await response.json();
    
    if (!response.ok) {
      throw { status: response.status, message: data.message || 'API request failed' };
    }
    
    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

// Auth API
export const auth = {
  login: async (username, password) => {
    return fetchWithAuth('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
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
    return fetchWithAuth('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp, type })
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
  }
};

// Questions API
export const questions = {
  fetchAll: async () => {
    return fetchWithAuth('/questions');
  },
  
  create: async (questionData) => {
    return fetchWithAuth('/questions', {
      method: 'POST',
      body: JSON.stringify(questionData)
    });
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
    return fetchWithAuth(`/vote/upvote/question/${questionId}`, { method: 'POST' });
  },
  
  downvoteQuestion: async (questionId) => {
    return fetchWithAuth(`/vote/downvote/question/${questionId}`, { method: 'POST' });
  },
  
  upvoteAnswer: async (answerId) => {
    return fetchWithAuth(`/vote/upvote/answer/${answerId}`, { method: 'POST' });
  },
  
  downvoteAnswer: async (answerId) => {
    return fetchWithAuth(`/vote/downvote/answer/${answerId}`, { method: 'POST' });
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