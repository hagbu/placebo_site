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
  const endpoint=document.currentScript?.dataset.endpoint;
  if(!endpoint) return;

  const text=(tag,value,className)=>{
    const node=document.createElement(tag);
    node.textContent=value;
    if(className) node.className=className;
    return node;
  };
  const safeUrl=(value)=>{
    try { const url=new URL(value); return url.protocol==='https:'?url.href:null; }
    catch { return null; }
  };
  async function load(){
    try {
      const response=await fetch(endpoint,{credentials:'omit',signal:AbortSignal.timeout(8000)});
      if(!response.ok) return;
      const data=await response.json();
      if(!data.available || !Array.isArray(data.reviews) || !data.reviews.length) return;
      if(!Number.isFinite(data.rating) || data.rating<1 || data.rating>5 || !Number.isInteger(data.total)) return;
      const reviews=data.reviews.filter(r=>typeof r.name==='string' && typeof r.text==='string' && Number.isInteger(r.rating) && r.rating>=1 && r.rating<=5).slice(0,12);
      if(!reviews.length) return;
      const section=document.createElement('section');
      section.className='google-reviews-section';
      section.setAttribute('aria-label','ביקורות נבחרות מגוגל');
      section.innerHTML='<div class="wrap"><div class="reviews-heading"><div><span class="reviews-kicker">מה אומרים עלינו</span><h2>הלקוחות שלנו <span>ממליצים</span></h2><p>ביקורות נבחרות מגוגל, באישור צוות פלסיבו</p></div><div class="google-rating"><b>Google Maps</b></div></div><div class="reviews-shell"><button class="reviews-arrow reviews-prev" type="button" aria-label="ביקורת קודמת">‹</button><div class="reviews-track" tabindex="0" aria-label="גלריית ביקורות"></div><button class="reviews-arrow reviews-next" type="button" aria-label="ביקורת הבאה">›</button></div><div class="reviews-note"></div></div>';
      const rating=section.querySelector('.google-rating');
      rating.append(text('strong',data.rating.toFixed(1)+' מתוך 5'),text('small',data.total.toLocaleString('he-IL')+' ביקורות בגוגל'));
      const track=section.querySelector('.reviews-track');
      reviews.forEach(review=>{
        const card=document.createElement('article'); card.className='review-card';
        const top=document.createElement('div'); top.className='review-top';
        const avatar=text('div',review.name.charAt(0),'review-avatar');
        const photo=safeUrl(review.photoUrl);
        if(photo){
          const img=document.createElement('img'); img.src=photo; img.alt=''; img.loading='lazy'; img.referrerPolicy='no-referrer';
          img.addEventListener('error',()=>img.remove(),{once:true}); avatar.append(img);
        }
        const author=document.createElement('div');
        const stars=text('div','★'.repeat(review.rating)+'☆'.repeat(5-review.rating),'review-stars');
        stars.setAttribute('aria-label',review.rating+' מתוך 5 כוכבים'); stars.dir='ltr';
        author.append(text('strong',review.name),stars); top.append(avatar,author);
        const source=text('div','Google Maps','review-source');
        const date=new Date(review.createTime);
        if(!Number.isNaN(date.valueOf())) source.append(text('time',' · '+date.toLocaleDateString('he-IL')));
        card.append(top,text('p',review.text||'ביקורת ללא תוכן כתוב'),source);
        track.append(card);
      });
      const note=section.querySelector('.reviews-note');
      note.append(text('span','מוצג מבחר ביקורות שאושר לפרסום. הדירוג וכמות הביקורות מתייחסים לכל הביקורות בגוגל. '));
      const mapsUrl=safeUrl(data.mapsUrl);
      if(mapsUrl){
        const link=text('a','לכל הביקורות בגוגל ↗'); link.href=mapsUrl; link.target='_blank'; link.rel='noopener noreferrer'; note.append(link);
      }
      target.parentNode.insertBefore(section,target);
      const cards=[...track.children];
      let active=0;
      const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
      function go(delta){
        active=(active+delta+cards.length)%cards.length;
        const offset=cards[active].getBoundingClientRect().right-track.getBoundingClientRect().right;
        track.scrollBy({left:offset,behavior:reducedMotion.matches?'instant':'smooth'});
      }
      // Keep arrow navigation aligned with touch, keyboard and trackpad scrolling.
      track.addEventListener('scroll',()=>{
        const edge=track.getBoundingClientRect().right;
        active=cards.reduce((best,card,i)=>Math.abs(card.getBoundingClientRect().right-edge)<Math.abs(cards[best].getBoundingClientRect().right-edge)?i:best,0);
      },{passive:true});
      section.querySelector('.reviews-next').addEventListener('click',()=>go(1));
      section.querySelector('.reviews-prev').addEventListener('click',()=>go(-1));
      if(cards.length===1) section.querySelectorAll('.reviews-arrow').forEach(button=>button.hidden=true);
    } catch { /* Keep the homepage usable while the reviews service is unavailable. */ }
  }
  load();
})();
