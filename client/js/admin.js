import { isAdmin } from './auth.js';
import { showToast } from './ui.js';
import { admin as adminApi } from './utils/api.js';

let currentFilter = {
  role: 'ALL',
  state: 'ALL'
};

async function fetchUsers() {
  try {
    const data = await adminApi.getUsers();
    return data.users || [];
  } catch (error) {
    console.error('Error fetching users:', error);
    showAdminToast('error', 'Failed to fetch users');
    return [];
  }
}

// Fetch login logs for the login history table
async function fetchLoginLogs() {
  try {
    const data = await adminApi.getLoginLogs();
    console.log('Login logs data:', data); // Debug
    return data.logs || [];
  } catch (error) {
    console.error('Error fetching login logs:', error);
    showAdminToast('error', 'Failed to fetch login history');
    return [];
  }
}

// Filter users based on current filter settings
function filterUsers(users) {
  return users.filter(user => {
    const roleMatch = currentFilter.role === 'ALL' || user.role === currentFilter.role;
    const stateMatch = currentFilter.state === 'ALL' || user.state === currentFilter.state;
    return roleMatch && stateMatch;
  });
}

// Enhanced renderUsers function with modern UI for dark mode
function renderEnhancedUsers(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  const filteredUsers = filterUsers(users);

  if (filteredUsers.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="8" class="text-center py-6 text-gray-500 dark:text-gray-400">
        <svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-3 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p>No users matching the current filters</p>
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }

  filteredUsers.forEach((user, index) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
    // Add animation index for staggered fade-in
    tr.style.setProperty('--row-index', index);
    
    // Format date if it exists, or show "Never"
    const lastLoginDate = user.lastLoginAt 
      ? new Date(user.lastLoginAt).toLocaleString() 
      : 'Never';
      
    // Format IP address or show "Unknown"
    const ipAddress = user.lastLoginIp || 'Unknown';
    
    let actionCell = '';
    // Hide action for all admins
    if (user.role !== 'ADMIN') {
      actionCell = `
        <div class="flex space-x-2">
          ${
            user.state === 'PENDING'
              ? `<button 
                  class="submit-state-btn admin-btn admin-btn-secondary text-xs py-1 px-2"
                  data-user-id="${user.id}" 
                  data-new-state="APPROVED">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Approve
                </button>
                <button 
                  class="submit-state-btn admin-btn admin-btn-secondary text-xs py-1 px-2"
                  data-user-id="${user.id}" 
                  data-new-state="REJECTED">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject
                </button>`
              : user.state === 'APPROVED'
              ? `<button 
                  class="submit-state-btn admin-btn admin-btn-secondary text-xs py-1 px-2"
                  data-user-id="${user.id}" 
                  data-new-state="REJECTED">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  Block
                </button>`
              : `<button 
                  class="submit-state-btn admin-btn admin-btn-secondary text-xs py-1 px-2"
                  data-user-id="${user.id}" 
                  data-new-state="APPROVED">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Activate
                </button>`
          }
          <button
            class="delete-user-btn admin-btn admin-btn-danger text-xs py-1 px-2"
            data-user-id="${user.id}"
            data-username="${user.username}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      `;
    } else {
      actionCell = `<span class="text-gray-400 dark:text-gray-500">Protected</span>`;
    }
    
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm">${user.username}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">${user.email}</td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="admin-badge ${
          user.role === 'ADMIN' ? 'admin-badge-danger' :
          user.role === 'MODERATOR' ? 'admin-badge-warning' :
          'admin-badge-success'} flex items-center">
          ${user.role === 'ADMIN' ? 
            '<svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>' : 
            user.role === 'MODERATOR' ?
            '<svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>' : 
            '<svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path></svg>'}
          ${user.role}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="admin-badge ${
          user.state === 'PENDING' ? 'admin-badge-warning' :
          user.state === 'APPROVED' ? 'admin-badge-success' :
          'admin-badge-danger'}">
          ${user.state}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">${lastLoginDate}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">${ipAddress}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">${actionCell}</td>
    `;
    tbody.appendChild(tr);
  });

  // Add event listeners for submit buttons
  tbody.querySelectorAll('.submit-state-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const userId = btn.getAttribute('data-user-id');
      const newState = btn.getAttribute('data-new-state');
      updateUserState(userId, newState);
    });
  });
  
  // Add event listeners for delete buttons
  tbody.querySelectorAll('.delete-user-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const userId = btn.getAttribute('data-user-id');
      const username = btn.getAttribute('data-username');
      deleteUser(userId, username);
    });
  });
}

// Enhanced render login logs function with modern UI for dark mode
function renderEnhancedLoginLogs(logs) {
  const tbody = document.getElementById('loginLogsTableBody');
  if (!tbody) {
    console.error('Login logs table body not found');
    return;
  }

  tbody.innerHTML = '';
  
  if (!logs || logs.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="4" class="text-center py-6 text-gray-500 dark:text-gray-400">
        <svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-3 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>No login history available</p>
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }

  logs.forEach((log, index) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
    tr.style.setProperty('--row-index', index);
    
    const loginTime = log.loginTime ? new Date(log.loginTime).toLocaleString() : 'Unknown';
    const ipAddress = log.ipAddress || 'Unknown';
    
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm">${log.username || 'Unknown'}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">${log.email || 'Unknown'}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">
        <div class="flex items-center">
          <svg class="h-4 w-4 mr-2 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          ${loginTime}
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">
        <div class="flex items-center">
          <svg class="h-4 w-4 mr-2 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          ${ipAddress}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Update user state
async function updateUserState(userId, newState) {
  try {
    const data = await adminApi.updateUserState(userId, newState);
    
    if (data.success) {
      showAdminToast('success', 'User state updated successfully');
      await refreshUsers(); // Refresh the users list
    } else {
      throw new Error(data.message || 'Failed to update user state');
    }
  } catch (error) {
    console.error('Error updating user state:', error);
    showAdminToast('error', error.message);
  }
}

// Delete user function
async function deleteUser(userId, username) {
  console.log(`ADMIN UI: Delete function called for user ${username} (ID: ${userId})`);
  
  // Validate inputs
  if (!userId) {
    console.error("ADMIN UI: Cannot delete - missing user ID");
    showAdminToast('error', 'Cannot delete: Missing user ID');
    return;
  }
  
  if (!username) {
    username = `ID: ${userId}`; // Fallback if username is missing
  }
  
  // Confirm deletion
  if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
    console.log("ADMIN UI: Deletion cancelled by user");
    return;
  }
  
  try {
    // Show loading state
    showAdminToast('info', `Deleting user ${username}...`);
    console.log(`ADMIN UI: Sending delete request for user ID: ${userId}`);
    
    // Import the admin API if not already imported
    const { admin: adminApi } = await import('./utils/api.js');
    
    const response = await adminApi.deleteUser(userId);
    console.log("ADMIN UI: Delete response received:", response);
    
    if (response && response.success) {
      console.log(`ADMIN UI: User ${username} deleted successfully`);
      showAdminToast('success', `User ${username} deleted successfully`);
      
      // Refresh the users list
      console.log("ADMIN UI: Refreshing users list");
      await refreshUsers();
      console.log("ADMIN UI: Users list refreshed");
    } else {
      const errorMsg = response?.message || "Unknown error occurred";
      console.error(`ADMIN UI: Delete failed - ${errorMsg}`);
      showAdminToast('error', `Failed to delete user: ${errorMsg}`);
    }
  } catch (error) {
    console.error("ADMIN UI: Exception during user deletion:", error);
    showAdminToast('error', `Error: ${error.message || "Unknown error"}`);
  }
}

// Refresh users list
async function refreshUsers() {
  const users = await fetchUsers();
  renderEnhancedUsers(users);
}

// Initialize admin page
async function initAdminPage() {
  if (!isAdmin()) {
    window.location.href = '/';
    return;
  }

  // Set up filter event listeners
  const roleFilter = document.getElementById('roleFilter');
  const stateFilter = document.getElementById('stateFilter');

  if (roleFilter) {
    roleFilter.addEventListener('change', (e) => {
      currentFilter.role = e.target.value;
      refreshUsers();
    });
  }

  if (stateFilter) {
    stateFilter.addEventListener('change', (e) => {
      currentFilter.state = e.target.value;
      refreshUsers();
    });
  }

  // Initial load of users table
  await refreshUsers();
  
  // Load and display login logs - Call this separately to ensure it works
  loadLoginHistory();
}

// Function to load login history separately
async function loadLoginHistory() {
  try {
    const loginLogs = await fetchLoginLogs();
    console.log('Fetched login logs:', loginLogs);
    renderEnhancedLoginLogs(loginLogs);
  } catch (error) {
    console.error('Error loading login history:', error);
  }
}

// Handle dark mode toggle
function setupDarkModeToggle() {
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (!darkModeToggle) return;

  // Check for saved theme preference or respect OS preference
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Set initial theme
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
  
  // Toggle theme on click
  darkModeToggle.addEventListener('click', () => {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      showAdminToast('info', 'Light mode activated');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      showAdminToast('info', 'Dark mode activated');
    }
  });
}

// Enhanced toast notifications for admin dashboard
function showAdminToast(type, message, duration = 3000) {
  // First, remove any existing toast
  const existingToast = document.querySelector('.admin-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('admin-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'admin-toast-container';
    toastContainer.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2';
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `admin-toast flex items-center p-4 min-w-[300px] rounded-lg shadow-lg transform translate-y-2 opacity-0 transition-all duration-300 ease-out ${
    type === 'success' ? 'bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500' :
    type === 'error' ? 'bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500' :
    type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500' :
    'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500'
  }`;

  // Define the icon based on the toast type
  let icon;
  switch (type) {
    case 'success':
      icon = '<svg class="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
      break;
    case 'error':
      icon = '<svg class="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
      break;
    case 'warning':
      icon = '<svg class="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
      break;
    default:
      icon = '<svg class="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
  }

  // Add content to the toast
  toast.innerHTML = `
    <div class="flex-shrink-0 mr-3">${icon}</div>
    <div class="flex-1 text-sm ${
      type === 'success' ? 'text-green-800 dark:text-green-200' :
      type === 'error' ? 'text-red-800 dark:text-red-200' :
      type === 'warning' ? 'text-yellow-800 dark:text-yellow-200' :
      'text-blue-800 dark:text-blue-200'
    }">${message}</div>
    <button class="ml-4 text-gray-400 hover:text-gray-500 focus:outline-none" onclick="this.parentElement.remove()">
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  `;

  // Add to the DOM
  toastContainer.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  // Automatically remove after duration
  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

// Initialize when document is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Only allow admin to access this page
  if (!isAdmin()) {
    window.location.href = '/';
    return;
  }
  initAdminPage();
  setupDarkModeToggle();
});

async function updateUserStatus(userId, state) {
  try {
    const data = await adminApi.updateUserState(userId, state);
    
    if (data.success) {
      showAdminToast('success', `User ${state.toLowerCase()} successfully`);
      await refreshUsers(); 
      return true;
    }
    throw new Error(data.message);
  } catch (error) {
    console.error('Error updating user status:', error);
    showAdminToast('error', 'Failed to update user status');
    return false;
  }
}

async function updateUserRole(userId, role) {
  try {
    const data = await adminApi.updateUserRole(userId, role);
    
    if (data.success) {
      showAdminToast('success', `User role updated to ${role.toLowerCase()}`);
      await refreshUsers();
      return true;
    }
    throw new Error(data.message);
  } catch (error) {
    console.error('Error updating user role:', error);
    showAdminToast('error', 'Failed to update user role');
    return false;
  }
}

function renderPendingModerators(moderators) {
  const container = document.getElementById('pendingModerators');
  if (!container) return;

  container.innerHTML = moderators.length ? moderators.map(mod => `
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-4" data-user-id="${mod.id}">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold">${mod.username}</h3>
          <p class="text-gray-600 dark:text-gray-400">${mod.email}</p>
          <p class="text-sm text-gray-500">Joined: ${new Date(mod.createdAt).toLocaleDateString()}</p>
        </div>
        <div class="space-x-2">
          <button
            class="approve-btn px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            onclick="handleApprove(${mod.id})"
          >
            Approve
          </button>
          <button
            class="reject-btn px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            onclick="handleReject(${mod.id})"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  `).join('') : '<p class="text-gray-600 dark:text-gray-400">No pending moderators</p>';
}

// Create a new user
async function createUser(userData) {
  console.log('Creating user:', userData);
  
  try {
    const data = await adminApi.createUser(userData);
    
    if (data.success) {
      showAdminToast('success', `User ${userData.username} created successfully`);
      
      // Close the modal
      const modal = document.getElementById('addUserModal');
      if (modal) modal.classList.remove('modal-open');
      
      // Reset the form
      document.getElementById('addUserForm').reset();
      
      // Refresh the users list
      await refreshUsers();
      return true;
    } else {
      showAdminToast('error', data.message || 'Failed to create user');
      return false;
    }
  } catch (error) {
    console.error('Error creating user:', error);
    showAdminToast('error', error.message || 'An error occurred');
    return false;
  }
}

// Set up the add user modal and form
function setupAddUserModal() {
  // Get elements
  const showModalBtn = document.getElementById('showAddUserModal');
  const cancelBtn = document.getElementById('cancelAddUser');
  const modal = document.getElementById('addUserModal');
  const form = document.getElementById('addUserForm');
  
  // Show modal
  if (showModalBtn && modal) {
    showModalBtn.addEventListener('click', () => {
      modal.classList.add('modal-open');
    });
  }
  
  // Hide modal
  if (cancelBtn && modal) {
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.remove('modal-open');
      form.reset();
    });
  }
  
  // Handle form submission
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Get form data
      const userData = {
        username: document.getElementById('newUsername').value.trim(),
        email: document.getElementById('newEmail').value.trim(),
        password: document.getElementById('newPassword').value,
        role: document.getElementById('newRole').value,
        state: document.getElementById('newState').value
      };
      
      // Validate
      if (!userData.username || !userData.email || !userData.password) {
        showAdminToast('error', 'All fields are required');
        return;
      }
      
      // Create user
      await createUser(userData);
    });
  }
}

// Update your initAdminDashboard function to include all setup functions
export function initAdminDashboard() {
  if (!isAdmin()) {
    window.location.href = '/';
    return;
  }
  
  // Set up dark mode toggle before other UI elements
  setupDarkModeToggle();
  
  // Initialize the admin page and components
  initAdminPage();
  setupAddUserModal();
}
