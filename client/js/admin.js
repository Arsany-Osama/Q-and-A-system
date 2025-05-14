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
    showToast('error', 'Failed to fetch users');
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
    showToast('error', 'Failed to fetch login history');
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

// Render the users table
function renderUsers(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  const filteredUsers = filterUsers(users);

  if (filteredUsers.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="8" class="text-center py-4 text-gray-500">
        No users matching the current filters
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }

  filteredUsers.forEach(user => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
    
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
        <select class="state-select select-sm" data-user-id="${user.id}">
          <option value="PENDING" ${user.state === 'PENDING' ? 'selected' : ''}>Pending</option>
          <option value="APPROVED" ${user.state === 'APPROVED' ? 'selected' : ''}>Approved</option>
          <option value="REJECTED" ${user.state === 'REJECTED' ? 'selected' : ''}>Rejected</option>
        </select>
        <button class="submit-state-btn btn btn-primary btn-sm ml-2" data-user-id="${user.id}">Submit</button>
        <button class="delete-user-btn btn btn-error btn-sm ml-2" data-user-id="${user.id}" data-username="${user.username}">
          <span class="text-red-500">Delete</span>
        </button>
      `;
    } else {
      actionCell = '<span class="text-gray-400">No action</span>';
    }
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm">${user.username}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">${user.email}</td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 py-1 text-xs rounded ${
          user.role === 'ADMIN' ? 'bg-red-100 text-red-800' :
          user.role === 'MODERATOR' ? 'bg-yellow-100 text-yellow-800' :
          'bg-green-100 text-green-800'} dark:bg-opacity-20">
          ${user.role}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 py-1 text-xs rounded ${
          user.state === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
          user.state === 'APPROVED' ? 'bg-green-100 text-green-800' :
          'bg-red-100 text-red-800'} dark:bg-opacity-20">
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
      const select = tbody.querySelector(`.state-select[data-user-id="${userId}"]`);
      if (select) {
        updateUserState(userId, select.value);
      }
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

// Render the login logs table
function renderLoginLogs(logs) {
  const tbody = document.getElementById('loginLogsTableBody');
  if (!tbody) {
    console.error('Login logs table body not found');
    return;
  }

  tbody.innerHTML = '';
  
  if (!logs || logs.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="4" class="text-center py-4 text-gray-500">
        No login history available
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }

  logs.forEach(log => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
    
    const loginTime = log.loginTime ? new Date(log.loginTime).toLocaleString() : 'Unknown';
    const ipAddress = log.ipAddress || 'Unknown';
    
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm">${log.username || 'Unknown'}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">${log.email || 'Unknown'}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">${loginTime}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">${ipAddress}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Update user state
async function updateUserState(userId, newState) {
  try {
    const data = await adminApi.updateUserState(userId, newState);
    
    if (data.success) {
      showToast('success', 'User state updated successfully');
      await refreshUsers(); // Refresh the users list
    } else {
      throw new Error(data.message || 'Failed to update user state');
    }
  } catch (error) {
    console.error('Error updating user state:', error);
    showToast('error', error.message);
  }
}

// Delete user function
async function deleteUser(userId, username) {
  console.log(`ADMIN UI: Delete function called for user ${username} (ID: ${userId})`);
  
  // Validate inputs
  if (!userId) {
    console.error("ADMIN UI: Cannot delete - missing user ID");
    showToast('error', 'Cannot delete: Missing user ID');
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
    showToast('info', `Deleting user ${username}...`);
    console.log(`ADMIN UI: Sending delete request for user ID: ${userId}`);
    
    // Import the admin API if not already imported
    const { admin: adminApi } = await import('./utils/api.js');
    
    const response = await adminApi.deleteUser(userId);
    console.log("ADMIN UI: Delete response received:", response);
    
    if (response && response.success) {
      console.log(`ADMIN UI: User ${username} deleted successfully`);
      showToast('success', `User ${username} deleted successfully`);
      
      // Refresh the users list
      console.log("ADMIN UI: Refreshing users list");
      await refreshUsers();
      console.log("ADMIN UI: Users list refreshed");
    } else {
      const errorMsg = response?.message || "Unknown error occurred";
      console.error(`ADMIN UI: Delete failed - ${errorMsg}`);
      showToast('error', `Failed to delete user: ${errorMsg}`);
    }
  } catch (error) {
    console.error("ADMIN UI: Exception during user deletion:", error);
    showToast('error', `Error: ${error.message || "Unknown error"}`);
  }
}

// Refresh users list
async function refreshUsers() {
  const users = await fetchUsers();
  renderUsers(users);
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
    renderLoginLogs(loginLogs);
  } catch (error) {
    console.error('Error loading login history:', error);
  }
}

// Initialize when document is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Only allow admin to access this page
  if (!isAdmin()) {
    window.location.href = '/';
    return;
  }
  initAdminPage();
});

async function updateUserStatus(userId, state) {
  try {
    const data = await adminApi.updateUserState(userId, state);
    
    if (data.success) {
      showToast('success', `User ${state.toLowerCase()} successfully`);
      await refreshUsers(); 
      return true;
    }
    throw new Error(data.message);
  } catch (error) {
    console.error('Error updating user status:', error);
    showToast('error', 'Failed to update user status');
    return false;
  }
}

async function updateUserRole(userId, role) {
  try {
    const data = await adminApi.updateUserRole(userId, role);
    
    if (data.success) {
      showToast('success', `User role updated to ${role.toLowerCase()}`);
      await refreshUsers();
      return true;
    }
    throw new Error(data.message);
  } catch (error) {
    console.error('Error updating user role:', error);
    showToast('error', 'Failed to update user role');
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

export function initAdminDashboard() {
  if (!isAdmin()) {
    window.location.href = '/';
    return;
  }
  initAdminPage();
}
