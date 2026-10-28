// Close the mobile navigation when the page scrolls.
(() => {
  const menuBtn = document.querySelector('.menu-btn');
  const mobileMenu = document.getElementById('mobileMenu');
  if (!menuBtn || !mobileMenu) return;

  window.addEventListener('scroll', () => {
    if (!mobileMenu.classList.contains('open')) return;

    mobileMenu.classList.remove('open');
    menuBtn.textContent = '☰';
  }, { passive: true });
})();
