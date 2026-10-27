// להחלפת סרטון ההגעה, משנים רק את המזהה בשורה הבאה.
const DIRECTIONS_VIDEO_ID = 'C8BP8K-ZuL0';

function initializeDirectionsVideo() {
  const container = document.getElementById('directions-video');
  if (!container) return;

  const playButton = container.querySelector('.directions-video-preview');
  const thumbnail = container.querySelector('.directions-video-thumbnail');

  thumbnail.src = `https://i.ytimg.com/vi/${DIRECTIONS_VIDEO_ID}/hqdefault.jpg`;
  playButton.disabled = false;

  playButton.addEventListener('click', function () {
    const player = document.createElement('iframe');
    player.src = `https://www.youtube.com/embed/${DIRECTIONS_VIDEO_ID}?autoplay=1&playsinline=1`;
    player.title = 'איך מגיעים אלינו? — סרטון הגעה לפלסיבו';
    player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    player.allowFullscreen = true;

    // YouTube requires a Referer; override the page's no-referrer policy here.
    player.referrerPolicy = 'strict-origin-when-cross-origin';

    container.replaceChildren(player);
    player.focus();
  }, { once: true });
}

initializeDirectionsVideo();
