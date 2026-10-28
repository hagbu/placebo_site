export const ADMIN_HTML = `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ניהול ביקורות | Placebo</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f1f6fa;color:#153345;font-family:Arial,sans-serif;line-height:1.6}main{max-width:1080px;margin:auto;padding:32px 20px}header{display:flex;align-items:center;justify-content:space-between;gap:20px}h1{font-size:32px;line-height:1.2;margin:10px 0}.brand{font-size:15px;letter-spacing:3px;color:#16778c}button,.button{border:1px solid #b4ccd8;border-radius:10px;background:white;padding:10px 16px;font:inherit;color:#153345;cursor:pointer;text-decoration:none;display:inline-block}button:disabled{opacity:.55;cursor:wait}button.primary{background:#125e72;color:white;border-color:#125e72}button.danger{color:#9e293c}button:focus-visible,a:focus-visible{outline:3px solid #247ea2;outline-offset:3px}.panel{background:white;border:1px solid #d0dfe7;border-radius:18px;padding:22px;margin:20px 0}.toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center}form{margin:0}.muted{color:#526c7b}.notice{padding:14px 18px;border-radius:12px;background:#e5f1f5;white-space:pre-wrap}#message:empty{display:none}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.card{padding:22px;border:1px solid #ccdae2;border-radius:16px;background:#fff;overflow-wrap:anywhere}.card header{align-items:flex-start}.reviewer{display:flex;gap:10px;align-items:center}.avatar{width:42px;height:42px;object-fit:cover;border-radius:50%;background:#e4edf3}.stars{color:#926700;direction:ltr;display:inline-block}.text{white-space:pre-wrap;max-height:340px;overflow:auto}.badge{font-size:13px;border-radius:20px;padding:3px 10px;background:#edf0f4}.approved{background:#d9f4e7;color:#145237}.hidden{background:#f9e2e6;color:#812a39}.pending{background:#fff0cc;color:#74530b}.actions{display:flex;gap:8px;flex-wrap:wrap}.small{font-size:13px}#pager{margin:22px auto;display:block}#empty{text-align:center;padding:40px}a{color:#12687f}@media(max-width:650px){.grid{grid-template-columns:1fr}header{align-items:flex-start}h1{font-size:27px}.panel{padding:16px}.toolbar{align-items:stretch}}
#pager[hidden]{display:none}
</style><script src="/admin.js" defer></script></head><body><main>
<header><div><div class="brand">PLACEBO</div><h1>הביקורות שבאתר שלך</h1><p class="muted">קוראים, בוחרים ומאשרים לפני פרסום.</p></div><a class="button" href="https://hagbu.github.io/placebo_site/" target="_blank" rel="noopener noreferrer">צפייה באתר ↗</a></header>
<div id="message" role="status" class="notice" aria-live="polite"></div>
<section class="panel" aria-label="חיבור ועדכון"><p id="connection">בודק את החיבור לגוגל…</p><p class="muted small" id="summary"></p><div class="toolbar">
<button id="connect" type="button" class="primary">חיבור / חיבור מחדש לגוגל</button>
<button id="sync">רענון הביקורות המאושרות</button><button id="disconnect" class="danger">ניתוק מגוגל</button>
</div></section>
<section class="panel"><div class="toolbar"><button id="latest" class="primary" aria-pressed="true">כל הביקורות מגוגל</button><button id="selected" aria-pressed="false">הביקורות המאושרות באתר</button><label>סינון תצוגה <select id="filter"><option value="all">הכול</option><option value="pending">ממתינות לאישור</option><option value="approved">מאושרות</option><option value="hidden">מוסתרות</option></select></label></div>
<p class="muted small">באתר מוצגות עד 12 ביקורות נבחרות. אישור מתייחס לתוכן שקראת: שינוי בגוגל מחזיר את הביקורת לבדיקה בעדכון הבא. הסתרה משפיעה על האתר בלבד.</p>
<p class="muted small">הביקורות המאושרות מתרעננות אוטומטית כשמוגדר עדכון מתוזמן בשירות. ביקורות חדשות ממתינות כאן לבחירתך. הדירוג ומספר הביקורות הם הנתונים הכוללים של העסק בגוגל.</p></section>
<div id="reviews" class="grid"></div><p id="empty" hidden></p><button id="pager" hidden>טעינת ביקורות נוספות</button>
</main></body></html>`;

export const ADMIN_JS = `
'use strict';
const $ = id => document.getElementById(id);
let items = [], nextPage = '', selectedView = false, busy = false;
const statusNames = {pending:'ממתינה לאישור',approved:'מופיעה באתר',hidden:'מוסתרת מהאתר'};
function message(text) { $('message').textContent = text; }
async function api(path, options = {}) {
  const response = await fetch(path, {credentials:'same-origin', ...options,
    headers:{'Content-Type':'application/json', ...options.headers}});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'הבקשה נכשלה. נסה שוב.');
  return data;
}
async function action(work) {
  if(busy) return;
  busy = true; document.querySelectorAll('button').forEach(b => b.disabled = true);
  try { await work(); } catch(error) { message(error.message); }
  finally { busy = false; document.querySelectorAll('button').forEach(b => b.disabled = false); }
}
function text(tag, value, className) {
  const node = document.createElement(tag); node.textContent = value;
  if(className) node.className = className; return node;
}
function render() {
  $('reviews').replaceChildren();
  const visible = items.filter(r => $('filter').value === 'all' || r.status === $('filter').value);
  $('empty').hidden = visible.length > 0;
  $('empty').textContent = items.length ? 'אין ביקורות שמתאימות לסינון בעמודים שנטענו.' : 'אין ביקורות להצגה. התחבר לגוגל או בחר ביקורות לאישור.';
  visible.forEach(review => {
    const card = document.createElement('article'); card.className = 'card';
    const header = document.createElement('header');
    const reviewer = document.createElement('div'); reviewer.className = 'reviewer';
    if(review.photoUrl && review.photoUrl.startsWith('https://')) {
      const img = document.createElement('img'); img.src = review.photoUrl; img.alt = ''; img.className = 'avatar'; img.referrerPolicy = 'no-referrer'; reviewer.append(img);
    }
    const author = document.createElement('div'); author.append(text('strong',review.name), document.createElement('br'), text('span','★'.repeat(review.rating)+'☆'.repeat(5-review.rating),'stars'));
    reviewer.append(author); header.append(reviewer,text('span',statusNames[review.status], 'badge '+review.status));
    const date = new Date(review.updateTime || review.createTime);
    card.append(header,text('p',review.text || 'ביקורת ללא תוכן כתוב','text'));
    if(!Number.isNaN(date.valueOf())) card.append(text('p',date.toLocaleDateString('he-IL'),'muted small'));
    const actions = document.createElement('div'); actions.className = 'actions';
    [['approved','אישור לפרסום'],['hidden','הסתרה מהאתר'],['pending','החזרה להמתנה']].forEach(([status,label]) => {
      if(status === review.status) return;
      const button = text('button', label, status === 'approved' ? 'primary' : '');
      button.addEventListener('click',() => action(async() => {
        await api('/api/admin/reviews/'+encodeURIComponent(review.id),{method:'PUT',body:JSON.stringify({status,digest:review.digest})});
        review.status = status; message('הבחירה נשמרה.');
        if(selectedView) items = items.filter(r => r.status === 'approved');
        render();
      })); actions.append(button);
    });
    card.append(actions); $('reviews').append(card);
  });
  $('pager').hidden = selectedView || !nextPage;
}
async function status() {
  const data = await api('/api/admin/status');
  $('connection').textContent = data.connected ? '✓ חשבון העסק מחובר לגוגל' : 'חשבון העסק עדיין אינו מחובר לגוגל';
  $('summary').textContent = data.summary ? 'דירוג '+Number(data.summary.rating).toFixed(1)+' מתוך 5 · '+Number(data.summary.total).toLocaleString('he-IL')+' ביקורות בגוגל' : '';
  if(data.lastSync) $('summary').textContent += ' · עדכון אוטומטי אחרון: '+new Date(Number(data.lastSync)).toLocaleString('he-IL');
  if(data.syncError) message(data.syncError);
  return data;
}
async function load(append = false) {
  const path = selectedView ? '/api/admin/selected' : '/api/admin/reviews'+(append && nextPage ? '?pageToken='+encodeURIComponent(nextPage) : '');
  const data = await api(path);
  items = append ? items.concat(data.reviews) : data.reviews; nextPage = data.nextPageToken || ''; render();
}
function view(selected) {
  return action(async() => {
    selectedView = selected;
    $('latest').classList.toggle('primary',!selected); $('selected').classList.toggle('primary',selected);
    $('latest').setAttribute('aria-pressed',String(!selected)); $('selected').setAttribute('aria-pressed',String(selected));
    message('טוען ביקורות…'); await load(); message('');
  });
}
$('latest').onclick = () => view(false); $('selected').onclick = () => view(true);
$('filter').onchange = render; $('pager').onclick = () => action(() => load(true));
$('connect').onclick = () => action(async() => {
  message('מעביר להתחברות בגוגל…');
  const data = await api('/oauth/start',{method:'POST',body:'{}'});
  const destination = new URL(data.authorizationUrl);
  if(destination.origin !== 'https://accounts.google.com') throw new Error('כתובת התחברות לא תקינה.');
  window.location.assign(destination.href);
});
$('sync').onclick = () => action(async() => {message('מרענן מגוגל…'); await api('/api/admin/sync',{method:'POST',body:'{}'}); await status(); await load(); message('העדכון הסתיים.');});
$('disconnect').onclick = () => {
  if(!confirm('לנתק את גוגל? הביקורות יוסתרו מהאתר עד לחיבור מחדש.')) return;
  action(async() => {await api('/api/admin/disconnect',{method:'POST',body:'{}'}); items=[]; render(); await status(); message('החשבון נותק.');});
};
action(async() => {const data = await status(); if(data.connected) await load(); else render();});
`;
