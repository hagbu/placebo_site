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

// When moving between desktop dropdowns, close a menu left open by a click.
(() => {
  const dropdowns = document.querySelectorAll('header .links > .nav-dropdown');
  dropdowns.forEach(dropdown => {
    dropdown.addEventListener('mouseenter', () => {
      const focused = document.activeElement;
      const otherDropdown = focused?.closest('.nav-dropdown');
      if (otherDropdown && otherDropdown !== dropdown && focused.blur) focused.blur();
    });
  });
})();
