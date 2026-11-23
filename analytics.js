/* מדידת האתר מופעלת רק לאחר הסכמה למדידה. */
(() => {
  if (window.location.hostname !== 'placebo.co.il') return;

  const measurementId = 'G-H856D7LZY0';
  let started = false;
  let bookingInteractionSent = false;
  const pageNames = {
    '': 'home', 'index.html': 'home', 'throne.html': 'throne',
    'monastery.html': 'monastery', 'super-clasico.html': 'super_clasico',
    'social-media.html': 'social_media', 'protectors.html': 'protectors',
    'events.html': 'events', 'prices.html': 'prices', 'faq.html': 'faq',
    'accessibility.html': 'accessibility', 'guides.html': 'guides',
    'birthday-guide.html': 'birthday_guide', 'first-escape-room.html': 'first_room',
    'team-building-guide.html': 'team_guide', 'player-12.html': 'player_12',
    'reviews-privacy.html': 'privacy', 'reviews-service.html': 'reviews',
    'takanon.html': 'terms', 'thank-you.html': 'thank_you'
  };
  const pageName = pageNames[window.location.pathname.split('/').pop()] || 'other';

  function sendEvent(name) {
    if (!started || !window.PlaceboConsent?.allowsAnalytics()) return false;
    window.gtag('event', name, { send_to: measurementId, transport_type: 'beacon' });
    return true;
  }

  function startAnalytics() {
    if (started || !window.PlaceboConsent?.allowsAnalytics()) return;
    started = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };

    const googleTag = document.createElement('script');
    googleTag.async = true;
    googleTag.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.appendChild(googleTag);
    window.gtag('js', new Date());
    window.gtag('config', measurementId);
  }

  startAnalytics();
  window.addEventListener('placebo-consent-changed', startAnalytics);

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const eventButton = event.target.closest('#whatsappSend');
    const link = event.target.closest('a[href]');
    let eventName;

    // מודדים את כפתורי ההזמנה המהירה ואת קישורי ההזמנה לכרטיסי החדרים.
    if (link && (link.classList.contains('mobile-action-book') ||
      link.textContent.trim() === 'להזמנה מהירה' ||
      (link.hash === '#booking-calendar' && link.classList.contains('room-btn')))) {
      sendEvent(`quick_booking_click_${pageName}`);
    }

    if (eventButton && !eventButton.disabled) {
      eventName = 'event_whatsapp_click';
    } else if (link && link.protocol === 'tel:') {
      eventName = 'phone_click';
    } else if (link && link.protocol === 'https:' && link.hostname === 'wa.me') {
      eventName = 'whatsapp_click';
      // האתר נשאר פתוח כדי לאפשר למדידה להשלים את השליחה.
      if (!link.target) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    } else {
      return;
    }

    sendEvent(eventName);
  });

  // חלון חיצוני אינו חושף לחיצות: מעבר הפוקוס אליו הוא אומדן לאינטראקציה.
  window.addEventListener('blur', () => {
    window.setTimeout(() => {
      if (!bookingInteractionSent && document.activeElement?.matches('iframe.vcita-frame')) {
        bookingInteractionSent = sendEvent(`booking_widget_interaction_${pageName}`);
      }
    }, 0);
  });
})();
