/* מדידת האתר מופעלת רק לאחר הסכמה למדידה. */
(() => {
  if (window.location.hostname !== 'placebo.co.il') return;

  const measurementId = 'G-H856D7LZY0';
  let started = false;

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

    if (started && window.PlaceboConsent?.allowsAnalytics()) {
      window.gtag('event', eventName, { send_to: measurementId });
    }
  });
})();
