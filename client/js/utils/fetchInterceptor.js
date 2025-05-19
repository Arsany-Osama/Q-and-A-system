/**
 * Fetch Interceptor - Interceptor for handling expired JWT tokens globally
 */
import { handleTokenExpiration } from '../auth.js';

// Store the original fetch function
const originalFetch = window.fetch;

/**
 * Override the global fetch function with our intercepting version
 * This will detect expired tokens in any fetch response, not just our API calls
 */
window.fetch = async function(url, options) {
  try {
    // Call the original fetch function
    const response = await originalFetch(url, options);
    
    // Clone the response to avoid consuming it
    const clonedResponse = response.clone();
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        // Try to parse the response as JSON to check for token errors
        const data = await clonedResponse.json();
        
        // If we get auth errors, handle token expiration
        if (!response.ok && (
          data.message?.includes('jwt expired') || 
          data.message?.includes('Invalid token') ||
          response.status === 401 || 
          response.status === 403
        )) {
          console.error('Token validation error in global interceptor:', data.message);
          handleTokenExpiration();
        }
      } catch (error) {
        // Ignore JSON parsing errors, as the response might not be valid JSON
        console.warn('Error parsing response as JSON in fetch interceptor:', error);
      }
    }
    
    // Return the original response regardless
    return response;
  } catch (error) {
    // Re-throw any fetch errors
    throw error;
  }
};

/**
 * Initialize the fetch interceptor
 */
export function initFetchInterceptor() {
  console.log('Fetch interceptor initialized');
  // The interceptor is already set up just by importing this file
}
