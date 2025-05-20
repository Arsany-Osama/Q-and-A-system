export function initSidebar() {
  console.log('Initializing sidebar');
  const sidebar = document.getElementById('sidebar');
  const logoBtn = document.getElementById('sidebarLogoBtn');
  const closeBtn = document.getElementById('sidebarCloseBtn');
  const header = document.getElementById('mainHeader');
  const content = document.getElementById('mainContent');

  if (!sidebar || !logoBtn || !closeBtn || !header || !content) {
    console.error('Sidebar elements not found:', { sidebar, logoBtn, closeBtn, header, content });
    return;
  }

  let isOpen = false; // Sidebar is closed by default

  // Create overlay element for mobile
  const overlay = document.createElement('div');
  overlay.id = 'sidebarOverlay';
  document.body.appendChild(overlay);
  function toggleSidebar() {
    isOpen = !isOpen;
    logoBtn.setAttribute('aria-expanded', isOpen);

    // GSAP animations
    gsap.to(sidebar, {
      x: isOpen ? 0 : '-100%',
      duration: 0.3,
      ease: 'power2.out',
    });

    // Handle overlay for all screen sizes to create the drawer effect
    gsap.to(overlay, {
      opacity: isOpen ? 1 : 0,
      duration: 0.3,
      ease: 'power2.out',
      onComplete: () => {
        overlay.classList.toggle('open', isOpen);
      },
    });
  }

  // Event listeners
  logoBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent click from bubbling to document
    toggleSidebar();
  });

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isOpen) toggleSidebar();
  });

  overlay.addEventListener('click', () => {
    if (isOpen) toggleSidebar();
  });

  // Close sidebar when clicking outside
  document.addEventListener('click', (e) => {
    if (isOpen && !sidebar.contains(e.target) && !logoBtn.contains(e.target)) {
      toggleSidebar();
    }
  });

  // Close sidebar on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      toggleSidebar();
    }
  });

  // Keyboard accessibility
  logoBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleSidebar();
    }
  });
  // Update layout on resize - now we don't need to adjust margins
  window.addEventListener('resize', () => {
    // If sidebar is closing on resize, update the overlay
    if (isOpen && window.innerWidth < 768) {
      gsap.set(overlay, { opacity: 1 });
    }
  });

  // Initialize state
  gsap.set(sidebar, { x: '-100%' }); // Start closed
  gsap.set(overlay, { opacity: 0 }); // Overlay hidden
}
