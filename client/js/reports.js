import { reports } from './utils/api.js';
import { showToast, showPopup, renderUserUI } from './ui.js';
import { isLoggedIn, getUserRole, logout } from './auth.js';
import { enforceReportAccess } from './reportAccess.js';
import { checkPageAccess } from './routeProtection.js';

/**
 * Reports management module for handling reported content
 * This module is responsible for fetching and displaying reported content,
 * as well as providing actions for moderators and admins to handle reports
 */

// Helper functions for UI presentation
/**
 * Returns an appropriate icon for a report reason
 * @param {string} reason - The report reason
 * @returns {string} HTML string containing the SVG icon
 */
function getReasonIcon(reason) {
    switch (reason) {
        case 'SPAM':
            return '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>';
        case 'HARASSMENT':
            return '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>';
        case 'INAPPROPRIATE_CONTENT':
            return '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>';
        default:
            return '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>';
    }
}

/**
 * Returns CSS classes for a report reason badge
 * @param {string} reason - The report reason
 * @returns {string} CSS class string
 */
function getReasonBadgeClass(reason) {
    switch (reason) {
        case 'SPAM':
            return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
        case 'HARASSMENT':
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        case 'INAPPROPRIATE_CONTENT':
            return 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200';
        default:
            return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
}

/**
 * Formats report reason text for display
 * @param {string} reason - The report reason
 * @returns {string} Formatted reason text
 */
function formatReasonText(reason) {
    return reason.replace(/_/g, ' ').toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Format a Date object into a readable string, e.g., "May 20, 2025, 14:30"
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) return 'Unknown date';
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

// DOM Elements
const reportsList = document.getElementById('reportsList');
const reportsLoading = document.getElementById('reportsLoading');
const noReports = document.getElementById('noReports');
const filterReports = document.getElementById('filterReports');
const refreshReports = document.getElementById('refreshReports');
const reportDetailModal = document.getElementById('reportDetailModal');
const reportModalContent = document.getElementById('reportModalContent');
const closeReportModal = document.getElementById('closeReportModal');
const rejectReportBtn = document.getElementById('rejectReportBtn');
const deleteContentBtn = document.getElementById('deleteContentBtn');

// Current report being viewed in the modal
let currentReport = null;

/**
 * Initialize the reports page
 */
async function init() {
    console.log('Initializing reports page...');
    
    // Check if DOM elements are found
    console.log('DOM elements check:', {
        reportsList: !!reportsList,
        reportsLoading: !!reportsLoading,
        noReports: !!noReports,
        filterReports: !!filterReports,
        refreshReports: !!refreshReports
    });
    
    // Render user status first
    renderUserUI();
    
    // Check if user has access to this page (admin or moderator)
    const hasAccess = await checkPageAccess(window.location.pathname);
    console.log('Page access check:', hasAccess);
    if (!hasAccess) return;
    
    // Double-check using our specialized reportAccess module
    const accessGranted = enforceReportAccess();
    console.log('Report access check:', accessGranted);
    if (!accessGranted) return;

    // Setup event listeners
    setupEventListeners();
    
    // Setup tab event listeners
    const stateTabs = document.querySelectorAll('.state-tab');
    stateTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            stateTabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            tab.classList.add('active');
            // Apply filter based on state
            filterReportsByState(tab.dataset.state);
        });
    });

    // Initial reports load
    await fetchReports();
}

/**
 * Setup event listeners for the reports page
 */
function setupEventListeners() {
    // Refresh button
    refreshReports.addEventListener('click', fetchReports);
    
    // Empty state refresh button
    document.getElementById('refreshEmptyBtn')?.addEventListener('click', fetchReports);
    
    // Filter reports
    filterReports.addEventListener('change', applyReportsFilter);
    
    // Modal close button
    closeReportModal.addEventListener('click', closeModal);
    
    // Reject report button
    rejectReportBtn.addEventListener('click', handleRejectReport);
    
    // Delete content button
    deleteContentBtn.addEventListener('click', handleDeleteContent);

    // Handle authentication buttons and user menu
    document.getElementById('loginBtn')?.addEventListener('click', () => showPopup('login'));
    document.getElementById('userMenuBtn')?.addEventListener('click', toggleUserDropdown);
    
    // Theme toggling
    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
    
    // Initialize theme from localStorage
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
        document.documentElement.classList.add('dark');
    }

    // Check login status on page load
    if (isLoggedIn()) {
        updateUserMenu();
    } else {
        document.getElementById('loginBtn').classList.remove('hidden');
        document.getElementById('userMenuBtn').classList.add('hidden');
    }
}

/**
 * Toggle user dropdown menu visibility
 */
function toggleUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('hidden');
}

/**
 * Update user menu with login information
 */
function updateUserMenu() {
    const username = localStorage.getItem('username') || 'User';
    const role = getUserRole();
    
    // Get UI elements
    const usernameDisplay = document.getElementById('usernameDisplay');
    const userMenuBtn = document.getElementById('userMenuBtn');
    const loginBtn = document.getElementById('loginBtn');
    const dropdown = document.getElementById('userDropdown');
    
    // Update username display if element exists
    if (usernameDisplay) {
        usernameDisplay.textContent = username;
    }
    
    // Show user menu, hide login button if elements exist
    if (userMenuBtn) {
        userMenuBtn.classList.remove('hidden');
    }
    if (loginBtn) {
        loginBtn.classList.add('hidden');
    }
    
    // Update dropdown menu if it exists
    if (dropdown) {
        dropdown.innerHTML = `
            <div class="py-1">
                <div class="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                    <div class="font-medium">${username}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">${role}</div>
                </div>
                <a href="index.html" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Home</a>
                <button id="logoutBtn" class="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                    Sign out
                </button>
            </div>
        `;
        
        // Add logout handler
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                logout();
                window.location.href = 'index.html';
            });
        }
    }
}

/**
 * Toggle between light and dark theme
 */
function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark);
}

/**
 * Fetch all reports from the API
 */
async function fetchReports() {
    try {
        // Show loading indicator
        reportsLoading.classList.remove('hidden');
        noReports.classList.add('hidden');
        reportsList.innerHTML = '';
        
        // Clear statistics
        updateReportStats(null);
        
        console.log('Fetching reports from backend...');
        
        // Get auth token to verify we're authenticated
        const token = localStorage.getItem('token');
        console.log('Auth token present:', !!token);
        
        // Fetch reports from API
        console.log('Making getAllReports API call...');
        const response = await reports.getAllReports();
        
        console.log('Reports API response:', response);
        console.log('Raw response:', JSON.stringify(response, null, 2));
        
        // Hide loading indicator
        reportsLoading.classList.add('hidden');
        
        if (!response?.success || !response?.reports) {
            console.log('No reports found or API error:', response);
            noReports.classList.remove('hidden');
            return;
        }
        
        // Get all reports from all states
        const allReports = Object.values(response.reports).flat();
        console.log(`Successfully fetched ${allReports.length} total reports`);
        
        // Update statistics with all reports
        updateReportStats(allReports);
        
        // Reports are already grouped by state in the response
        renderReports(response.reports);
        
        // Apply any existing filter
        applyReportsFilter();
        
    } catch (error) {
        console.error('Error fetching reports:', error);
        reportsLoading.classList.add('hidden');
        
        // Check if it's an auth error
        if (error.message && (error.message.includes('unauthorized') || error.message.includes('forbidden'))) {
            showToast('error', 'You do not have permission to access this page.');
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 2000);
        } else {
            showToast('error', 'Failed to fetch reports. Please try again.');
        }
    }
}

/**
 * Update report statistics in the UI
 * @param {Array|null} reports - List of reports or null to clear stats
 */
function updateReportStats(reports) {
    const statsContainer = document.getElementById('reportStats');
    const statsElements = statsContainer.querySelectorAll('.stats-value');
    
    if (!reports) {
        // Clear stats if no reports
        statsElements.forEach(elem => {
            elem.textContent = '--';
        });
        return;
    }
    
    // Optimized statistics calculation - single pass through reports
    const reportCounts = {
        total: 0,
        questions: 0,
        answers: 0,
        inappropriate: 0
    };
    
    // Single loop to count everything
    reports.forEach(report => {
        reportCounts.total++;
        if (report.question) reportCounts.questions++;
        if (report.answer) reportCounts.answers++;
        if (report.reason === 'INAPPROPRIATE_CONTENT') reportCounts.inappropriate++;
    });
    
    // Use our counted values
    const totalReports = reportCounts.total;
    const questionReports = reportCounts.questions;
    const answerReports = reportCounts.answers;
    const inappropriateReports = reportCounts.inappropriate;
    
    console.log('Report statistics:', {
        total: totalReports,
        questions: questionReports,
        answers: answerReports,
        inappropriate: inappropriateReports
    });
    
    // Update the stats UI with a counting animation
    const stats = [totalReports, questionReports, answerReports, inappropriateReports];
    
    statsElements.forEach((elem, index) => {
        const targetValue = stats[index];
        animateCounter(elem, 0, targetValue, 1000);
    });
}

/**
 * Animate a counter from start to end value
 * @param {HTMLElement} element - The element to update
 * @param {number} start - Starting value
 * @param {number} end - Ending value
 * @param {number} duration - Animation duration in ms
 */
function animateCounter(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        element.textContent = value;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.textContent = end;
        }
    };
    window.requestAnimationFrame(step);
}

/**
 * Render reports in the reports list
 * @param {Object} reportsByState - Object containing reports grouped by state
 */
function renderReports(reportsByState) {
    reportsList.innerHTML = '';
    
    if (!reportsByState || Object.keys(reportsByState).length === 0) {
        console.log('No reports to render:', reportsByState);
        return;
    }
    
    // Flatten reports from all states into a single array
    const allReports = Object.values(reportsByState).flat();
    
    if (allReports.length === 0) {
        console.log('No reports to render after flattening');
        noReports.classList.remove('hidden');
        noReports.querySelector('p').textContent = 'No reports found.';
        return;
    }
    
    console.log(`Rendering ${allReports.length} reports`);
    console.log('First report details:', JSON.stringify(allReports[0], null, 2));
    
    allReports.forEach(report => {
        try {
            const card = document.createElement('div');
            card.className = 'report-card group bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4 transition-all duration-200 hover:shadow-md';
            card.dataset.reportId = report.id;
            card.dataset.type = report.question ? 'question' : 'answer';
            card.dataset.reason = report.reason;
            card.dataset.state = report.state;
            card.dataset.reportData = JSON.stringify(report);
            
            const isQuestion = !!report.question;
            const reportedItem = isQuestion ? report.question : report.answer;
            
            // Get appropriate icon for report reason
            const reasonIcon = getReasonIcon(report.reason);
            
            // Format dates
            let formattedDate = 'Unknown date';
            try {
                const reportDate = new Date(report.createdAt);
                formattedDate = formatDate(reportDate);
            } catch (e) {
                console.warn('Error formatting date:', e);
            }
            
            // Get the question title for answers by looking up the question in the reports list
            let questionTitle = 'Unknown Question';
            if (!isQuestion && reportedItem?.questionId) {
                // Try to find this question in other reports
                const questionReport = allReports.find(r => r.question?.id === reportedItem.questionId);
                if (questionReport) {
                    questionTitle = questionReport.question.title || 'Untitled Question';
                }
            }

            // Safely get usernames
            const reporterUsername = report.user?.username || 'Unknown User';
            const contentUsername = reportedItem?.user?.email?.split('@')[0] || 'Unknown User';
            
            // Get title and content
            const title = isQuestion ? 
                (reportedItem?.title || 'Untitled Question') : 
                `Response to: "${questionTitle}"`;
            const content = reportedItem?.content || 'No content available';
            
            // Build card content
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex-1 mr-4">
                        <div class="flex items-center flex-wrap gap-2 mb-3">
                            <span class="report-badge badge-with-icon px-2.5 py-1.5 rounded-md font-medium shadow-sm ${
                                isQuestion ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700' : 
                                'bg-emerald-100 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-700'
                            }">
                                <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    ${isQuestion ? 
                                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />' : 
                                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 01-2 2h-3l-4 4z" />'}
                                </svg>
                                ${isQuestion ? 'Question' : 'Answer'}
                            </span>
                            <span class="report-badge badge-with-icon ${getReasonBadgeClass(report.reason)}">
                                ${reasonIcon}
                                ${formatReasonText(report.reason)}
                            </span>
                            <span class="state-badge ${report.state?.toLowerCase() || 'pending'}">
                                ${report.state || 'PENDING'}
                            </span>
                        </div>
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                            ${title}
                        </h3>
                        <p class="text-gray-800 dark:text-gray-200 text-sm mt-2 line-clamp-2 report-content">
                            ${content}
                        </p>
                    </div>
                    <button class="view-report-btn action-btn bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-300 flex items-center px-3 py-2 rounded-md border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200">
                        <span class="hidden md:inline mr-1 font-medium">View</span>
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>
                </div>
                <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-4 text-xs text-gray-700 dark:text-gray-300 gap-1 border-t border-gray-100 dark:border-gray-800 pt-3">
                    <div class="flex items-center">
                        <svg class="w-3.5 h-3.5 mr-1 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span class="font-semibold text-gray-800 dark:text-gray-200">Reported by:</span>
                        <span class="ml-1">${reporterUsername}</span>
                        <span class="mx-2 text-gray-400 dark:text-gray-600">•</span>
                        <span class="text-gray-600 dark:text-gray-400">${formattedDate}</span>
                    </div>
                    <div class="flex items-center">
                        <svg class="w-3.5 h-3.5 mr-1 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span class="font-medium text-gray-700 dark:text-gray-300">Content by:</span>
                        <span class="ml-1">${contentUsername}</span>
                    </div>
                </div>
            `;
            
            // Add click event for viewing report details
            const viewBtn = card.querySelector('.view-report-btn');
            viewBtn.addEventListener('click', () => showReportDetails(report));
            
            reportsList.appendChild(card);
        } catch (err) {
            console.error('Error rendering report card:', err, report);
        }
    });
    
    // Update state counts after rendering
    updateStateCounts();
}

/**
 * Apply filter to the reports list
 */
function applyReportsFilter() {
    const filter = filterReports.value;
    const reportCards = reportsList.querySelectorAll('[data-report-id]');
    
    reportCards.forEach(card => {
        if (filter === 'all') {
            card.classList.remove('hidden');
            return;
        }
        
        const cardType = card.dataset.type;
        const cardReason = card.dataset.reason;
        
        if (filter === 'question' && cardType === 'question') {
            card.classList.remove('hidden');
        } else if (filter === 'answer' && cardType === 'answer') {
            card.classList.remove('hidden');
        } else if (filter === cardReason) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
    
    // Check if all reports are now hidden
    const visibleReports = reportsList.querySelectorAll('[data-report-id]:not(.hidden)');
    if (visibleReports.length === 0 && reportCards.length > 0) {
        noReports.classList.remove('hidden');
        noReports.querySelector('p').textContent = 'No reports match the selected filter.';
    } else {
        noReports.classList.add('hidden');
    }
}

/**
 * Filter reports by state
 * @param {string} state - The state to filter by (PENDING, ACCEPTED, REJECTED)
 */
function filterReportsByState(state) {
    const reportCards = reportsList.querySelectorAll('[data-report-id]');
    
    reportCards.forEach(card => {
        if (state === 'all') {
            card.classList.remove('hidden');
            return;
        }
        
        const cardState = card.dataset.state;
        if (cardState === state) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
    
    // Show/hide empty state message
    const visibleReports = reportsList.querySelectorAll('[data-report-id]:not(.hidden)');
    if (visibleReports.length === 0 && reportCards.length > 0) {
        noReports.classList.remove('hidden');
        noReports.querySelector('p').textContent = `No reports with state ${state.toLowerCase()}.`;
    } else {
        noReports.classList.add('hidden');
    }
}

/**
 * Update tab counts based on current reports
 */
function updateStateCounts() {
    const reports = document.querySelectorAll('[data-report-id]');
    const counts = {
        PENDING: 0,
        ACCEPTED: 0,
        REJECTED: 0
    };
    
    reports.forEach(report => {
        const state = report.dataset.state || 'PENDING';
        if (state in counts) {
            counts[state]++;
        }
    });
    
    console.log('State counts:', counts);
    
    // Update count badges in tabs
    Object.entries(counts).forEach(([state, count]) => {
        const countElem = document.getElementById(`${state.toLowerCase()}Count`);
        if (countElem) {
            countElem.textContent = count;
            
            // Update badge visibility
            const badge = countElem.closest('.badge');
            if (badge) {
                if (count > 0) {
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }
        }
    });
}

/**
 * Show report details in a modal
 * @param {Object} report - The report to show details for
 */
function showReportDetails(report) {
    try {
        currentReport = report;
        
        console.log('Showing report details:', report);
        
        const isQuestion = !!report.question;
        const reportedItem = isQuestion ? report.question : report.answer;
        
        if (!reportedItem) {
            console.error('Cannot show details - report item is missing:', report);
            showToast('error', 'Cannot display report details - content is missing');
            return;
        }
        
        // Safely format dates
        let formattedReportDate = 'Unknown date';
        let formattedContentDate = 'Unknown date';
        
        try {
            const reportDate = new Date(report.createdAt);
            formattedReportDate = formatDate(reportDate);
        } catch (e) {
            console.warn('Error formatting report date:', e);
        }
        
        try {
            const contentDate = new Date(reportedItem.createdAt);
            formattedContentDate = formatDate(contentDate);
        } catch (e) {
            console.warn('Error formatting content date:', e);
        }
        
        // Get appropriate styling for reason
        const reasonClass = getReasonBadgeClass(report.reason);
        const reasonIconSvg = getReasonIcon(report.reason);
        const formattedReasonText = formatReasonText(report.reason);
        
        // Get the question title for answers by looking up the question in all reports
        let questionTitle = 'Unknown Question';
        if (!isQuestion && reportedItem.questionId) {
            // First try to find this question in the reports list
            const allReports = document.querySelectorAll('[data-report-id]');
            for (const reportCard of allReports) {
                const reportData = JSON.parse(reportCard.dataset.reportData || '{}');
                if (reportData.question?.id === reportedItem.questionId) {
                    questionTitle = reportData.question.title || 'Untitled Question';
                    break;
                }
            }
        }

        // Safe data values
        const reporterUsername = report.user?.username|| report.user?.username || 'Unknown User';
        const contentUsername = reportedItem.user?.email?.split('@')[0] || reportedItem.user?.username || 'Unknown User';
        
        const title = isQuestion ? 
            (reportedItem.title || 'Untitled Question') : 
            `Response to: "${questionTitle}"`;
        const content = reportedItem.content || 'No content available';
        
        // Add state to modal content
        const stateClass = {
            'PENDING': 'pending',
            'ACCEPTED': 'accepted',
            'REJECTED': 'rejected'
        }[report.state || 'PENDING'];

        // Build modal content
        reportModalContent.innerHTML = `
            <div class="${reasonClass.replace('bg-', 'bg-opacity-20 bg-').replace('text-', 'border-')} rounded-lg p-4 mb-4 border">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center">
                            <div class="${reasonClass} p-2 rounded-full mr-3">
                                ${reasonIconSvg.replace('w-3.5 h-3.5', 'w-5 h-5')}
                            </div>
                            <div>
                                <h3 class="text-md font-medium ${reasonClass.replace('bg-', 'text-').split(' ')[1]} mb-2 flex items-center">
                                    Report Information
                                    <span class="ml-2 text-xs font-normal px-2 py-0.5 rounded-full ${reasonClass}">
                                        ${formattedReasonText}
                                    </span>
                                </h3>
                                <div class="mt-2">
                                    <span class="state-badge ${stateClass}">
                                        ${report.state || 'PENDING'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                            <div class="flex items-center text-sm text-gray-700 dark:text-gray-300">
                                <svg class="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span><strong>Reported by:</strong> ${reporterUsername}</span>
                            </div>
                            <div class="flex items-center text-sm text-gray-700 dark:text-gray-300">
                                <svg class="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span><strong>Date Reported:</strong> ${formattedReportDate}</span>
                            </div>
                            <div class="flex items-center text-sm text-gray-700 dark:text-gray-300">
                                <svg class="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    ${isQuestion ? 
                                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />' : 
                                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 01-2 2h-3l-4 4z" />'}
                                </svg>
                                <span><strong>Content Type:</strong> ${isQuestion ? 'Question' : 'Answer'}</span>
                            </div>
                            <div class="flex items-center text-sm text-gray-700 dark:text-gray-300">
                                <svg class="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                                </svg>
                                <span><strong>Report ID:</strong> ${report.id}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="mb-4 bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <div class="px-4 py-3 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            ${isQuestion ? 'Reported Question' : 'Reported Answer'}
                        </h3>
                        <div class="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <svg class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            ${formattedContentDate}
                        </div>
                    </div>
                </div>
                
                <div class="p-4 space-y-4">
                    ${isQuestion ? 
                    `<h4 class="text-xl font-medium text-gray-900 dark:text-gray-100 mb-3">${reportedItem.title || 'Untitled Question'}</h4>` : 
                    `<div class="mb-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800/50 shadow-sm">
                        <p class="text-sm text-gray-700 dark:text-gray-300">
                            <strong class="text-gray-900 dark:text-gray-100">In response to:</strong> 
                            <span class="text-blue-700 dark:text-blue-400 font-medium">${title}</span>
                        </p>
                    </div>`
                    }
                    <div class="text-gray-800 dark:text-gray-200 report-content bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div class="prose dark:prose-invert max-w-none">
                            ${content}
                        </div>
                    </div>
                </div>
                
                <div class="px-4 py-3 bg-gray-50 dark:bg-gray-750 border-t border-gray-200 dark:border-gray-700 flex items-center">
                    <div class="flex items-center">
                        <svg class="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span class="text-sm text-gray-500 dark:text-gray-400">Posted by: <span class="font-medium">${contentUsername}</span></span>
                    </div>
                </div>
            </div>
        `;
        
        // Show the modal
        reportDetailModal.classList.remove('hidden');
        reportDetailModal.classList.add('modal-backdrop');
        
        // Add animation class for modal content
        const modalContent = reportDetailModal.querySelector('div:first-child');
        modalContent.classList.add('animate-fade-in-up', 'modal-content');
        
        // Add animation to modal content sections
        const sections = reportModalContent.querySelectorAll('div > div');
        sections.forEach((section, index) => {
            section.style.opacity = '0';
            section.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                section.style.transition = 'all 0.3s ease';
                section.style.opacity = '1';
                section.style.transform = 'translateY(0)';
            }, 200 + (index * 100));
        });
        
        // Update button visibility and styling based on user role
        const userRole = getUserRole();
        
        if (userRole === 'ADMIN') {
            // Admins can reject reports and delete content
            rejectReportBtn.classList.remove('hidden');
            deleteContentBtn.classList.remove('hidden');
            
            // Enhanced button styling
            rejectReportBtn.className = 'action-btn btn-outline-primary flex items-center justify-center';
            rejectReportBtn.innerHTML = `
                <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                Dismiss Report
            `;
            
            deleteContentBtn.className = 'action-btn btn-danger flex items-center justify-center';
            deleteContentBtn.innerHTML = `
                <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                Remove Content
            `;
        } else if (userRole === 'MODERATOR') {
            // Moderators can only reject reports, not delete content
            rejectReportBtn.classList.remove('hidden');
            deleteContentBtn.classList.add('hidden');
            
            // Enhanced button styling
            rejectReportBtn.className = 'action-btn btn-outline-primary flex items-center justify-center';
            rejectReportBtn.innerHTML = `
                <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                Dismiss Report
            `;
        } else {
            // This shouldn't happen due to page access control, but just in case
            rejectReportBtn.classList.add('hidden');
            deleteContentBtn.classList.add('hidden');
        }
    } catch (err) {
        console.error('Error showing report details:', err);
        showToast('error', 'Failed to display report details');
    }
}

/**
 * Close the report detail modal
 */
function closeModal() {
    const modalContent = reportDetailModal.querySelector('div:first-child');
    modalContent.classList.remove('animate-fade-in-up');
    modalContent.classList.add('animate-fade-out-down');
    
    // Fade out content sections
    const sections = reportModalContent.querySelectorAll('div > div');
    sections.forEach((section, index) => {
        section.style.transition = 'all 0.2s ease';
        section.style.opacity = '0';
        section.style.transform = 'translateY(10px)';
    });
    
    setTimeout(() => {
        reportDetailModal.classList.add('hidden');
        reportDetailModal.classList.remove('modal-backdrop');
        modalContent.classList.remove('animate-fade-out-down', 'modal-content');
        currentReport = null;
    }, 300);
}

/**
 * Handle rejecting a report
 */
async function handleRejectReport() {
    if (!currentReport) {
        console.error('No current report selected');
        showToast('error', 'No report selected');
        return;
    }
    
    // Store the ID we need before any async operations
    const reportId = currentReport.id;
    
    try {
        // Disable buttons while processing
        rejectReportBtn.disabled = true;
        deleteContentBtn.disabled = true;
        
        // Update button UI to show loading state
        rejectReportBtn.innerHTML = `
            <svg class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
        `;
        
        console.log(`Rejecting report ID: ${reportId}`);
        const response = await reports.rejectReport(reportId);
        console.log('Reject report response:', response);
        
        if (response && response.success) {
            const reportCard = document.querySelector(`[data-report-id="${reportId}"]`);
            if (reportCard) {
                reportCard.dataset.state = 'REJECTED';
                const stateBadge = reportCard.querySelector('.state-badge');
                if (stateBadge) {
                    stateBadge.className = 'state-badge rejected';
                    stateBadge.textContent = 'REJECTED';
                }
            }
            
            showToast('success', 'Report dismissed successfully');
            closeModal();
            
            // Refresh the list
            await fetchReports();
            
            // Update state counts
            updateStateCounts();
        } else {
            const errorMsg = response?.message || 'Failed to dismiss report';
            console.error('Error rejecting report:', errorMsg);
            showToast('error', errorMsg);
        }
    } catch (error) {
        console.error('Error rejecting report:', error);
        showToast('error', 'An error occurred while dismissing the report');
    } finally {
        // Re-enable buttons
        rejectReportBtn.disabled = false;
        deleteContentBtn.disabled = false;
        
        // Restore button text
        rejectReportBtn.innerHTML = `
            <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
            Dismiss Report
        `;
    }
}

/**
 * Handle deleting reported content
 */
async function handleDeleteContent() {
    if (!currentReport) {
        console.error('No current report selected');
        showToast('error', 'No report selected');
        return;
    }
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this content? This action cannot be undone.')) {
        return;
    }
    
    try {
        // Disable buttons while processing
        rejectReportBtn.disabled = true;
        deleteContentBtn.disabled = true;
        
        // Update button UI to show loading state
        const originalBtnText = deleteContentBtn.innerHTML;
        deleteContentBtn.innerHTML = `
            <svg class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
        `;
        
        console.log(`Deleting content for report ID: ${currentReport.id}`);
        const response = await reports.deleteReportedContent(currentReport.id);
        console.log('Delete content response:', response);
        
        if (response && response.success) {
            showToast('success', 'Content removed successfully');
            closeModal();
            await fetchReports(); // Refresh the reports list
            
            // Update UI state after delete
            const reportCard = document.querySelector(`[data-report-id="${currentReport.id}"]`);
            if (reportCard) {
                reportCard.dataset.state = 'ACCEPTED';
                const stateBadge = reportCard.querySelector('.state-badge');
                if (stateBadge) {
                    stateBadge.className = 'state-badge accepted';
                    stateBadge.textContent = 'ACCEPTED';
                }
            }
            
            // Update state counts
            updateStateCounts();
        } else {
            const errorMsg = response?.message || 'Failed to remove content';
            console.error('Error deleting content:', errorMsg);
            showToast('error', errorMsg);
        }
    } catch (error) {
        console.error('Error deleting content:', error);
        showToast('error', 'An error occurred while removing the content');
    } finally {
        // Re-enable buttons
        rejectReportBtn.disabled = false;
        deleteContentBtn.disabled = false;
        
        // Restore button text
        deleteContentBtn.innerHTML = `
            <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            Remove Content
        `;
    }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Export functions for potential use in other modules
export {
    fetchReports,
    renderReports,
    applyReportsFilter
};
