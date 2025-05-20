import { isLoggedIn, getUserRole, isAdmin, isModerator } from './auth.js';

/**
 * Check if the current user has access to the reports page
 * @returns {boolean} - True if user has access, false otherwise
 */
export function hasReportAccess() {
  if (!isLoggedIn()) {
    return false;
  }
  
  return isAdmin() || isModerator();
}

/**
 * Redirects user to index page if they don't have access to reports
 * @returns {boolean} - True if user has access and remains on page, false if redirected
 */
export function enforceReportAccess() {
  if (!hasReportAccess()) {
    console.log('Unauthorized access attempt to reports page');
    window.location.href = '/index.html';
    return false;
  }
  return true;
}
