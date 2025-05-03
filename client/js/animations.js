export function initAnimations() {
  // Register ScrollTrigger (already loaded via CDN)
  gsap.registerPlugin(ScrollTrigger);

  // Hero Section Animation
  gsap.from('.hero', {
    opacity: 0,
    y: 50,
    duration: 1,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top 80%',
      toggleActions: 'play none none none',
    },
  });

  // Button Hover Animation
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach((btn) => {
    const glow = document.createElement('div');
    glow.className = 'btn-glow';
    btn.appendChild(glow);

    btn.addEventListener('mouseenter', () => {
      gsap.to(btn, {
        y: -3,
        scale: 1.05,
        duration: 0.3,
        ease: 'power2.out',
      });
      gsap.to(glow, {
        opacity: 0.7,
        scale: 1.2,
        duration: 0.5,
        ease: 'power1.inOut',
        repeat: -1,
        yoyo: true,
      });
    });

    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, {
        y: 0,
        scale: 1,
        duration: 0.3,
        ease: 'power2.out',
      });
      gsap.to(glow, {
        opacity: 0,
        scale: 1,
        duration: 0.3,
        ease: 'power1.inOut',
        repeat: 0,
      });
    });
  });
}
