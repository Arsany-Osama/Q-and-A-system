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

  filteredUsers.forEach(user => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
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

  roleFilter.addEventListener('change', (e) => {
    currentFilter.role = e.target.value;
    refreshUsers();
  });

  stateFilter.addEventListener('change', (e) => {
    currentFilter.state = e.target.value;
    refreshUsers();
  });

  // Initial load
  await refreshUsers();
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
      await refreshUsersList();
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
      await refreshUsersList();
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

function renderUserRow(user) {
  const tr = document.createElement('tr');
  tr.className = 'border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750';
  
  return tr;
}

export function initAdminDashboard() {
  if (!isAdmin()) {
    window.location.href = '/';
    return;
  }
  initAdminPage();
}
