import { showToast, hidePopup, renderUserUI } from './ui.js';
import { validatePassword } from './security.js';

export function isLoggedIn() {
  return !!localStorage.getItem('token');
}

export function getToken() {
  return localStorage.getItem('token') || '';
}

export async function fetchTopContributors() {
  try {
    const response = await fetch('/auth/top-contributors');
    const data = await response.json();
    
    if (data.success) {
      return data.contributors;
    } else {
      console.error('Error fetching top contributors:', data.message);
      return [];
    }
  } catch (error) {
    console.error('Network error when fetching top contributors:', error);
    return [];
  }
}

export function logout() {
  console.log('Logging out');
  const token = getToken();
  if (!token) {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('has2fa');
    showToast('success', 'Logged out successfully');
    renderUserUI();
    return;
  }

  fetch('/auth/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        showToast('success', 'Logged out successfully');
      } else {
        showToast('error', result.message || 'Logout failed');
      }
    })
    .catch(() => {
      showToast('success', 'Logged out successfully'); // Fallback for expired token
    })
    .finally(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('has2fa');
      renderUserUI();
    });
}

export function initAuth() {
  const form = document.getElementById('authForm');
  if (!form) {
    console.error('Auth form not found');
    return;
  }

  // Real-time password validation for register
  const passwordInput = document.getElementById('password');
  passwordInput.addEventListener('input', () => {
    if (document.getElementById('authTitle').textContent.toLowerCase() === 'register') {
      updatePasswordRequirements(passwordInput.value);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Auth form submitted');
    const action = document.getElementById('authTitle').textContent.toLowerCase();
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const submitBtn = document.getElementById('authSubmitBtn');
    const spinner = document.getElementById('authSpinner');
    
    // Validate password for register
    if (action === 'register') {
      const validation = validatePassword(password);
      if (!validation.valid) {
        showToast('error', validation.errors[0]);
        return;
      }
    }

    submitBtn.disabled = true;
    spinner.classList.remove('hidden');

    try {
      const result = await handleAuth(action, username, email, password);
      if (result.success) {
        showToast('success', `${action === 'login' ? 'Logged in' : 'Registered'} successfully`);
        
        // Handle 2FA if required
        if (result.requires2FA) {
          // Show 2FA verification form
          handleTwoFactorAuth(result);
        } else {
          hidePopup();
          renderUserUI();
          if (action === 'login') {
            window.location.reload(); // Refresh to update UI
          }
        }
      } else {
        showToast('error', result.message || 'Authentication failed');
      }
    } catch (err) {
      showToast('error', 'Network error');
    } finally {
      submitBtn.disabled = false;
      spinner.classList.add('hidden');
    }
  });

  // Password toggle
  const togglePassword = document.getElementById('togglePassword');
  if (togglePassword) {
    togglePassword.addEventListener('click', () => {
      console.log('Toggle password visibility');
      const passwordInput = document.getElementById('password');
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      togglePassword.querySelector('svg').innerHTML = isPassword
        ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />`
        : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />`;
    });
  }
}

// Update password requirements in real-time
function updatePasswordRequirements(password) {
  const requirements = document.getElementById('passwordRequirements');
  if (!requirements) return;
  
  requirements.classList.remove('hidden');
  
  // Check each requirement
  document.getElementById('lengthReq').className = password.length >= 8 ? 'text-green-500' : 'text-red-500';
  document.getElementById('upperReq').className = /[A-Z]/.test(password) ? 'text-green-500' : 'text-red-500';
  document.getElementById('lowerReq').className = /[a-z]/.test(password) ? 'text-green-500' : 'text-red-500';
  document.getElementById('numberReq').className = /[0-9]/.test(password) ? 'text-green-500' : 'text-red-500';
  document.getElementById('specialReq').className = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? 'text-green-500' : 'text-red-500';
}

// Handle 2FA verification if required during login
function handleTwoFactorAuth(result) {
  // Create a modal for 2FA verification
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
      <h2 class="text-xl font-bold mb-4">Two-Factor Authentication</h2>
      <p class="mb-4">Please enter the verification code from your authenticator app.</p>
      <form id="twoFactorForm" class="space-y-4">
        <input type="text" id="twoFactorCode" pattern="[0-9]{6}" maxlength="6" class="input w-full" placeholder="000000" required>
        <button type="submit" class="btn btn-primary w-full">Verify</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Focus on input
  setTimeout(() => document.getElementById('twoFactorCode').focus(), 100);
  
  // Handle 2FA verification
  document.getElementById('twoFactorForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('twoFactorCode').value;
    
    try {
      const response = await fetch('/auth/2fa/verify-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: result.email,
          twoFactorToken: result.twoFactorToken,
          code
        })
      });
      
      const verifyResult = await response.json();
      
      if (verifyResult.success) {
        localStorage.setItem('token', verifyResult.token);
        localStorage.setItem('username', verifyResult.username);
        localStorage.setItem('has2fa', 'true');
        showToast('success', 'Two-factor authentication successful');
        modal.remove();
        hidePopup();
        renderUserUI();
        window.location.reload();
      } else {
        showToast('error', verifyResult.message || 'Invalid verification code');
      }
    } catch (error) {
      showToast('error', 'Network error occurred');
    }
  });
}

async function handleAuth(action, username, email, password) {
  const url = `/auth/${action}`;
  const body = action === 'login' ? { email, password } : { username, email, password };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (result.success && !result.requires2FA) {
      localStorage.setItem('token', result.token);
      localStorage.setItem('username', action === 'register' ? username : result.username);
      if (result.has2fa) {
        localStorage.setItem('has2fa', 'true');
      }
    }
    return result;
  } catch (err) {
    throw new Error('Network error');
  }
}
