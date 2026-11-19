// Close the mobile navigation when the page scrolls.
(() => {
  const menuBtn = document.querySelector('.menu-btn');
  const mobileMenu = document.getElementById('mobileMenu');
  if (!menuBtn || !mobileMenu) return;

  // הסקריפטים בעמודים פותחים וסוגרים את התפריט; נשקף את מצבם לקוראי מסך.
  function updateExpandedState() {
    menuBtn.setAttribute('aria-expanded', String(mobileMenu.classList.contains('open')));
    mobileMenu.querySelectorAll('.mobile-submenu').forEach(submenu => {
      const button = submenu.querySelector('.mobile-submenu-toggle');
      if (button) button.setAttribute('aria-expanded', String(submenu.classList.contains('open')));
    });
  }
  const observer = new MutationObserver(updateExpandedState);
  observer.observe(mobileMenu, { attributes: true, attributeFilter: ['class'], subtree: true });
  updateExpandedState();

  window.addEventListener('scroll', () => {
    if (!mobileMenu.classList.contains('open')) return;

    mobileMenu.classList.remove('open');
    menuBtn.textContent = '☰';
  }, { passive: true });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !mobileMenu.classList.contains('open')) return;
    mobileMenu.classList.remove('open');
    menuBtn.textContent = '☰';
    menuBtn.focus();
  });
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
