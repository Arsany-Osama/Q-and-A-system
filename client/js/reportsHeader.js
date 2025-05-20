/**
 * Reports header module for handling the header UI in reports page
 * This ensures consistent header behavior with other pages
 */

import { isLoggedIn, logout } from './auth.js';
import { renderUserUI } from './ui.js';
import { enforceReportAccess } from './reportAccess.js';

/**
 * Initialize the reports header
 */
function initReportsHeader() {
    // Setup dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
        
        darkModeToggle.addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeIcon(isDark);
        });
        
        // Initial icon update
        updateThemeIcon(savedTheme === 'dark');
    }
    
    // Render user status
    renderUserUI();
    
    // Enforce access control
    enforceReportAccess();
}

/**
 * Update the theme toggle icon based on current theme
 * @param {boolean} isDark - Whether dark mode is active
 */
function updateThemeIcon(isDark) {
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (!darkModeToggle) return;
    
    // Update SVG icons for the dark mode toggle
    const moonIcon = darkModeToggle.querySelector('.dark\\:hidden');
    const sunIcon = darkModeToggle.querySelector('.hidden.dark\\:block');
    
    if (moonIcon && sunIcon) {
        moonIcon.classList.toggle('dark:hidden', isDark);
        moonIcon.classList.toggle('hidden', !isDark);
        sunIcon.classList.toggle('hidden', isDark);
        sunIcon.classList.toggle('dark:block', !isDark);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initReportsHeader);

export { initReportsHeader };
