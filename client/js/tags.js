import { questions } from './utils/api.js';
import { showToast } from './ui.js';

/**
 * Fetches popular tags from the backend and renders them in the sidebar
 */
export async function fetchAndRenderPopularTags() {
  try {
    const tagsContainer = document.querySelector('.popular-tags');
    if (!tagsContainer) return;

    // Show loading state
    tagsContainer.innerHTML = '<div class="w-full text-center py-2"><div class="loader-pulse mx-auto"></div></div>';

    // Fetch popular tags from the backend
    const popularTags = await questions.getPopularTags();
    
    if (!Array.isArray(popularTags) || popularTags.length === 0) {
      tagsContainer.innerHTML = '<p class="text-gray-500 text-sm">No tags available</p>';
      return;
    }

    // Render tags
    tagsContainer.innerHTML = popularTags
      .map(({ tag, count }) => `
        <a href="#" class="tag flex items-center" data-tag="${tag}">
          ${tag}<span class="ml-1 text-xs text-gray-500">(${count})</span>
        </a>
      `)
      .join('');

    // Add click handlers to filter by tag
    tagsContainer.querySelectorAll('.tag').forEach(tagElement => {
      tagElement.addEventListener('click', (e) => {
        e.preventDefault();
        const tag = tagElement.getAttribute('data-tag');
        filterQuestionsByTag(tag);
      });
    });
  } catch (err) {
    console.error('Error fetching popular tags:', err);
    showToast('error', 'Failed to load popular tags');
  }
}

/**
 * Filters the question feed by a specific tag
 * @param {string} tag - The tag to filter by
 */
function filterQuestionsByTag(tag) {
  // You can implement the filtering logic here or
  // dispatch a custom event that your feed.js can listen for
  
  const event = new CustomEvent('filter-by-tag', { detail: { tag } });
  document.dispatchEvent(event);
  
  showToast('info', `Filtering by tag: ${tag}`);
} 