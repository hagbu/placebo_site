/* בחירת המבקר לגבי מדידת השימוש באתר. */
(() => {
  const storageKey = 'placebo_analytics_consent';
  let choice = null;
  try { choice = localStorage.getItem(storageKey); } catch (_) { /* בחירה זמנית */ }
  if (choice !== 'accepted' && choice !== 'rejected') choice = null;

  window.PlaceboConsent = { allowsAnalytics: () => choice === 'accepted' };

  function removeAnalyticsCookies() {
    document.cookie.split(';').forEach(part => {
      const name = part.trim().split('=')[0];
      if (name !== '_ga' && !name.startsWith('_ga_')) return;
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=placebo.co.il; SameSite=Lax`;
    });
  }

  function showBanner() {
    let banner = document.getElementById('cookie-consent');
    if (!banner) {
      banner = document.createElement('section');
      banner.id = 'cookie-consent';
      banner.className = 'cookie-consent';
      banner.setAttribute('aria-labelledby', 'cookie-consent-title');
      banner.innerHTML = `
        <div class="cookie-consent-copy">
          <h2 id="cookie-consent-title">העדפות מדידה באתר</h2>
          <p>אנחנו משתמשים בעוגיות כדי לשפר את חוויית הגלישה ולמדוד את השימוש באתר.</p>
        </div>
        <div class="cookie-consent-actions">
          <button type="button" data-consent="accepted">אישור מדידה</button>
          <button type="button" data-consent="rejected">ללא מדידה</button>
          <button type="button" class="cookie-info-toggle" aria-expanded="false" aria-controls="cookie-info">מידע נוסף</button>
        </div>
        <div id="cookie-info" class="cookie-info" hidden>
          <p>באישור מדידה, Google Analytics עוזר לנו להבין איך משתמשים באתר, למשל באילו עמודים מבקרים ועל אילו כפתורים לוחצים. ניתן לשנות את הבחירה בכל עת דרך „העדפות מדידה” בתחתית האתר.</p>
          <p>חלון ההזמנות של vcita והמפות של Google הם שירותים חיצוניים שעשויים להשתמש בעוגיות משלהם. הבחירה כאן מתייחסת למדידת האתר בלבד.</p>
        </div>`;
      banner.addEventListener('click', event => {
        const infoButton = event.target.closest('.cookie-info-toggle');
        if (infoButton) {
          const info = banner.querySelector('#cookie-info');
          info.hidden = !info.hidden;
          infoButton.setAttribute('aria-expanded', String(!info.hidden));
          return;
        }
        const button = event.target.closest('button[data-consent]');
        if (!button) return;
        const previousChoice = choice;
        choice = button.dataset.consent;
        try { localStorage.setItem(storageKey, choice); } catch (_) { /* בחירה זמנית */ }
        banner.hidden = true;
        if (choice === 'rejected') removeAnalyticsCookies();
        // רענון מפסיק גם תג שכבר נטען לפני שההסכמה בוטלה.
        if (previousChoice === 'accepted' && choice === 'rejected') {
          location.reload();
        } else {
          window.dispatchEvent(new Event('placebo-consent-changed'));
        }
      });
      document.body.appendChild(banner);
    }
    banner.hidden = false;
  }

  function initialize() {
    const footer = document.querySelector('footer');
    if (footer) {
      const settings = document.createElement('button');
      settings.type = 'button';
      settings.className = 'cookie-settings-link';
      settings.textContent = 'העדפות מדידה';
      settings.addEventListener('click', showBanner);
      footer.appendChild(settings);
    }
    if (!choice) showBanner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
