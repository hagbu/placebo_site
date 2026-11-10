/*
 * טיוטת מדידה: הקובץ אינו נטען באתר ואינו שולח מידע לגוגל בעצמו.
 * לאחר בחירת חשבון המדידה ובדיקת ההגדרות אפשר לשלב אותו באתר באופן יזום.
 */
(() => {
  let started = false;

  function recordContactClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const link = target.closest('a[href]');
    const eventButton = target.closest('#whatsappSend');
    let contactType;
    let contactContext = 'general';

    if (eventButton && !eventButton.disabled) {
      // זו לחיצה לפתיחת שיחה, לא אישור שהודעה נשלחה.
      contactType = 'whatsapp';
      contactContext = 'event_calculator';
    } else if (link && link.protocol === 'tel:') {
      contactType = 'phone';
    } else if (link && link.hostname === 'wa.me' && link.protocol === 'https:') {
      contactType = 'whatsapp';
    } else {
      return;
    }

    // לא כוללים מספרי טלפון, פרטי לקוח, כתובות מלאות או תוכן הודעות.
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'placebo_contact_click',
      contact_type: contactType,
      contact_context: contactContext
    });
  }

  window.PlaceboMeasurement = {
    start() {
      if (started) return;
      started = true;
      document.addEventListener('click', recordContactClick);
    }
  };
})();
