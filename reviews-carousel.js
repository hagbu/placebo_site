(function(){
  // Add the Player 12 podcast to the homepage main navigation.
  const desktopNav=document.querySelector('header .links');
  if(desktopNav && !desktopNav.querySelector('a[href="player-12.html"]')){
    const link=document.createElement('a');
    link.href='player-12.html';
    link.textContent='השחקן ה־12';
    desktopNav.appendChild(link);
  }
  const mobileNav=document.getElementById('mobileMenu');
  if(mobileNav && !mobileNav.querySelector('a[href="player-12.html"]')){
    const link=document.createElement('a');
    link.href='player-12.html';
    link.textContent='השחקן ה־12';
    mobileNav.appendChild(link);
  }

  const target=document.querySelector('.proofs');
  if(!target) return;
  const reviews=[
    {name:'ביקורת לדוגמה',text:'כאן תופיע ביקורת אמיתית מ-Google ברגע שה-API יאושר.'},
    {name:'ביקורת לדוגמה',text:'הקרוסלה כבר מוכנה. בהמשך הנתונים יתחלפו אוטומטית לביקורות Google אמיתיות.'},
    {name:'ביקורת לדוגמה',text:'עיצוב זמני לבדיקה בלבד — ללא המצאת שמות או תוכן של לקוחות.'},
    {name:'ביקורת לדוגמה',text:'לאחר חיבור Google Business Profile נציג כאן ביקורות אמיתיות עם ייחוס ל-Google.'},
    {name:'ביקורת לדוגמה',text:'המבנה מותאם לדסקטופ ולמובייל וכולל גלילה אוטומטית וחצים.'}
  ];
  const section=document.createElement('section');
  section.className='google-reviews-section';
  section.innerHTML=`<div class="wrap"><div class="reviews-heading"><div><span class="reviews-kicker">מה אומרים עלינו</span><h2>הלקוחות שלנו <span>ממליצים</span></h2><p>בקרוב: ביקורות Google אמיתיות שמתעדכנות אוטומטית</p></div><div class="google-rating"><b>Google</b><span class="review-stars">★★★★★</span><small>חיבור ל-Google בתהליך</small></div></div><div class="reviews-shell"><button class="reviews-arrow reviews-prev" type="button" aria-label="ביקורת קודמת">‹</button><div class="reviews-track">${reviews.map(r=>`<article class="review-card"><div class="review-top"><div class="review-avatar">G</div><div><strong>${r.name}</strong><div class="review-stars">★★★★★</div></div><span class="google-mark">G</span></div><p>${r.text}</p><div class="review-source">Google · תצוגה מקדימה</div></article>`).join('')}</div><button class="reviews-arrow reviews-next" type="button" aria-label="ביקורת הבאה">›</button></div><div class="reviews-note">תצוגה מקדימה בלבד — לא מוצגות כאן ביקורות מומצאות בשם לקוחות אמיתיים.</div></div>`;
  target.parentNode.insertBefore(section,target);
  const track=section.querySelector('.reviews-track');
  const cards=[...section.querySelectorAll('.review-card')];
  let timer;
  function step(){return cards[0]?cards[0].getBoundingClientRect().width+18:320}
  function go(dir){track.scrollBy({left:dir<0?step():-step(),behavior:'smooth'});}
  section.querySelector('.reviews-next').addEventListener('click',()=>go(1));
  section.querySelector('.reviews-prev').addEventListener('click',()=>go(-1));
  function start(){clearInterval(timer);timer=setInterval(()=>go(1),4200)}
  track.addEventListener('mouseenter',()=>clearInterval(timer));
  track.addEventListener('mouseleave',start);
  track.addEventListener('touchstart',()=>clearInterval(timer),{passive:true});
  track.addEventListener('touchend',start,{passive:true});
  start();
})();