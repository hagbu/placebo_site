/* מדידת האתר ב-Google Analytics. מזהה הנכס החדש של פלסיבו. */
(() => {
  // תצוגות בדיקה וכתובות Firebase אינן נכללות בנתוני האתר הרשמי.
  if (window.location.hostname !== 'placebo.co.il') return;

  const measurementId = 'G-H856D7LZY0';
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  const googleTag = document.createElement('script');
  googleTag.async = true;
  googleTag.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
  document.head.appendChild(googleTag);
  gtag('js', new Date());
  gtag('config', measurementId);

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
    } else {
      return;
    }

    // לחיצה אינה אישור לשיחה, לשליחת הודעה, להזמנה או לתשלום.
    // לא מעבירים מספרי טלפון, הודעות או פרטי לקוח בפרמטרים שלנו.
    gtag('event', eventName, { send_to: measurementId });
  });
})();
