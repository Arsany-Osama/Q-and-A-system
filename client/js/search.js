import { fetchQuestions } from './question.js';
import { showSection, showToast } from './ui.js';
import { showQuestionDetails } from './feed.js';

export function initSearch() {
  console.log('Initializing search');
  const searchInput = document.getElementById('globalSearch');
  const suggestions = document.getElementById('searchSuggestions');

  if (!searchInput || !suggestions) {
    console.error('Search input or suggestions element not found');
    return;
  }

  let filteredQuestions = [];
  let selectedIndex = -1;

  const renderSuggestions = async (filter = '') => {
    suggestions.innerHTML = '';
    suggestions.classList.add('hidden');
    selectedIndex = -1;

    if (!filter.trim()) return;

    try {
      const questions = await fetchQuestions();
      filteredQuestions = questions.filter(q =>
        q.title.toLowerCase().includes(filter.toLowerCase()) ||
        q.content.toLowerCase().includes(filter.toLowerCase()) ||
        q.username?.toLowerCase().includes(filter.toLowerCase()) ||
        q.tags?.some(tag => tag.toLowerCase().includes(filter.toLowerCase()))
      );

      if (filteredQuestions.length) {
        suggestions.classList.remove('hidden');
        filteredQuestions.forEach((q, index) => {
          const li = document.createElement('li');
          li.textContent = `${q.title} by ${q.username || 'Anonymous'} — ${q.content.slice(0, 50)}...`;
          li.className = 'p-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700';
          li.setAttribute('data-index', index);
          li.addEventListener('click', () => selectQuestion(q));
          suggestions.appendChild(li);
        });
      }
    } catch (err) {
      showToast('error', 'Failed to load search suggestions');
      console.error('Search error:', err);
    }
  };

  const selectQuestion = (q) => {
    console.log('Selected question from search:', q);
    showSection('feedSection');
    suggestions.classList.add('hidden');
    searchInput.value = '';
    showQuestionDetails(q.id);
  };

  searchInput.addEventListener('input', () => renderSuggestions(searchInput.value));
  searchInput.addEventListener('focus', () => renderSuggestions(searchInput.value));

  searchInput.addEventListener('keydown', (e) => {
    if (!filteredQuestions.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      updateSelected(selectedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateSelected(selectedIndex - 1);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      selectQuestion(filteredQuestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      suggestions.classList.add('hidden');
      searchInput.blur();
    }
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestions.contains(e.target)) {
      suggestions.classList.add('hidden');
    }
  });

  function updateSelected(newIndex) {
    const items = suggestions.querySelectorAll('li');
    if (items.length === 0) return;

    if (selectedIndex >= 0) {
      items[selectedIndex].classList.remove('bg-gray-200', 'dark:bg-gray-700');
    }

    selectedIndex = newIndex;
    if (selectedIndex < 0) selectedIndex = 0;
    if (selectedIndex >= items.length) selectedIndex = items.length - 1;

    items[selectedIndex].classList.add('bg-gray-200', 'dark:bg-gray-700');
    items[selectedIndex].scrollIntoView({ block: 'nearest' });
  }
}
