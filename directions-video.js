// להחלפת סרטון ההגעה, משנים רק את נתיב קובץ ה־MP4 בשורה הבאה.
const DIRECTIONS_VIDEO_SRC = 'videos/how-to-arrive.mp4';

function initializeDirectionsVideo() {
  const container = document.getElementById('directions-video');
  if (!container) return;

  const playButton = container.querySelector('.directions-video-preview');
  const errorMessage = document.getElementById('directions-video-error');

  playButton.disabled = false;

  playButton.addEventListener('click', function () {
    const player = document.createElement('video');
    player.controls = true;
    player.playsInline = true;
    player.preload = 'none';
    player.poster = container.querySelector('.directions-video-thumbnail').src;
    player.setAttribute('aria-label', 'איך מגיעים אלינו? — סרטון הגעה לפלסיבו');
    player.tabIndex = 0;

    player.addEventListener('error', function () {
      errorMessage.hidden = false;
    }, { once: true });

    // מקור הסרטון מחובר רק בעקבות לחיצה, כדי למנוע הורדה בטעינת העמוד.
    player.src = DIRECTIONS_VIDEO_SRC;
    container.replaceChildren(player);
    player.focus();

    player.play().catch(function () {
      // אם הדפדפן חסם הפעלה, אפשר להשתמש בכפתור הניגון המובנה.
    });
  }, { once: true });
}

initializeDirectionsVideo();
