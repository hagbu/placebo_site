import { ADMIN_HTML, ADMIN_JS } from './admin.mjs';

const DEFAULT_ORIGIN = 'https://placebo-reviews.hagbior.workers.dev';
const DEFAULT_ACCOUNT = '108142947186819830415';
const DEFAULT_LOCATION = '265165118537175429';
const MAPS = 'https://maps.app.goo.gl/xHy1HUsoMLEGq3bR9';
const DAY = 86400000;
const MAX_SELECTED = 12;
const encoder = new TextEncoder();
const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY, status TEXT NOT NULL, digest TEXT,
  payload TEXT, checked_at INTEGER, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL
);`;

class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
});
const origin = env => env.SERVICE_ORIGIN || DEFAULT_ORIGIN;
const locationPath = env => `accounts/${env.GOOGLE_ACCOUNT_ID || DEFAULT_ACCOUNT}/locations/${env.GOOGLE_LOCATION_ID || DEFAULT_LOCATION}`;
const reviewsUrl = env => `https://mybusiness.googleapis.com/v4/${locationPath(env)}/reviews`;
const random = () => base64(crypto.getRandomValues(new Uint8Array(32)));
function base64(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unbase64(value) { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); }
async function hash(value) { return base64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
async function key(env) {
  return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', encoder.encode(env.ADMIN_PASSWORD)), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encrypt(value, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(env), encoder.encode(value));
  return `${base64(iv)}.${base64(new Uint8Array(ciphertext))}`;
}
async function decrypt(value, env) {
  const [iv, ciphertext] = value.split('.');
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(iv) }, await key(env), unbase64(ciphertext)));
}
async function getSetting(env, name) {
  return (await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(name).first())?.value;
}
async function setSetting(env, name, value) {
  await env.DB.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(name, value).run();
}
async function cleanup(env) {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('UPDATE decisions SET payload=NULL WHERE checked_at<?').bind(now - 29 * DAY),
    env.DB.prepare('DELETE FROM oauth_states WHERE expires_at<?').bind(now),
    env.DB.prepare('DELETE FROM login_attempts WHERE expires_at<?').bind(now)
  ]);
  const summary = await getSetting(env, 'summary');
  if (summary && JSON.parse(summary).checkedAt < now - 29 * DAY) {
    await env.DB.prepare("DELETE FROM settings WHERE key='summary'").run();
  }
}
async function authenticate(request, env) {
  let username = '', password = '';
  try {
    const header = request.headers.get('Authorization') || '';
    if (header.startsWith('Basic ')) {
      const credentials = atob(header.slice(6));
      const colon = credentials.indexOf(':');
      username = credentials.slice(0, colon);
      password = credentials.slice(colon + 1);
    }
  } catch { /* invalid Basic header */ }
  const ip = await hash(request.headers.get('CF-Connecting-IP') || 'local');
  const bucket = await env.DB.prepare('SELECT * FROM login_attempts WHERE key=?').bind(ip).first();
  if (bucket?.expires_at > Date.now() && bucket.attempts >= 15) throw new AppError(429, 'יותר מדי ניסיונות כניסה. נסה שוב בעוד 15 דקות.');
  if (username === 'placebo' && await hash(password) === await hash(env.ADMIN_PASSWORD)) return true;
  // Opening the browser login dialog with no credentials is not a failed password attempt.
  if (request.headers.has('Authorization')) {
    await env.DB.prepare(`INSERT INTO login_attempts (key,attempts,expires_at) VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<? THEN 1 ELSE attempts+1 END,
      expires_at=CASE WHEN expires_at<? THEN excluded.expires_at ELSE expires_at END`)
      .bind(ip, Date.now() + 900000, Date.now(), Date.now()).run();
  }
  return false;
}
async function tokenRequest(env, parameters) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...parameters }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new AppError(502, 'ההרשאה לגוגל אינה זמינה. נסה להתחבר מחדש דרך מסך הניהול.');
  return response.json();
}
async function accessToken(env) {
  const stored = await getSetting(env, 'refresh_token');
  if (!stored) throw new AppError(409, 'צריך לחבר את חשבון העסק לגוגל תחילה.');
  let refresh;
  try { refresh = await decrypt(stored, env); }
  catch { throw new AppError(409, 'יש להתחבר מחדש לגוגל לאחר שינוי סיסמת הניהול.'); }
  return (await tokenRequest(env, { grant_type: 'refresh_token', refresh_token: refresh })).access_token;
}
async function google(url, token) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
  if (response.status === 404) throw new AppError(404, 'הביקורת אינה קיימת בגוגל.');
  if (!response.ok) throw new AppError(502, 'לא ניתן לקרוא את הביקורות מגוגל כרגע. בדוק את החיבור ונסה שוב.');
  return response.json();
}
function reviewId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,300}$/.test(value)) throw new AppError(400, 'מזהה ביקורת לא תקין.');
  return value;
}
export function normalizeReview(review) {
  return {
    id: reviewId(review.reviewId), name: review.reviewer?.displayName || 'משתמש Google',
    photoUrl: /^https:\/\//.test(review.reviewer?.profilePhotoUrl || '') ? review.reviewer.profilePhotoUrl : '',
    rating: { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[review.starRating] || 0,
    text: review.comment || '', createTime: review.createTime || '', updateTime: review.updateTime || ''
  };
}
export const reviewDigest = review => hash(JSON.stringify(normalizeReview(review)));
async function saveSummary(env, data) {
  if (!Number.isFinite(data.averageRating) || !Number.isInteger(data.totalReviewCount)) throw new AppError(502, 'הדירוג שהתקבל מגוגל אינו תקין.');
  await setSetting(env, 'summary', JSON.stringify({ rating: data.averageRating, total: data.totalReviewCount, checkedAt: Date.now() }));
}
async function reconcile(env, review, known) {
  const id = reviewId(review.reviewId);
  const saved = known === undefined ? await env.DB.prepare('SELECT * FROM decisions WHERE id=?').bind(id).first() : known;
  if (!saved || saved.status === 'hidden') return saved?.status || 'pending';
  const digest = await reviewDigest(review);
  const status = saved.status === 'approved' && saved.digest === digest ? 'approved' : 'pending';
  await env.DB.prepare('UPDATE decisions SET status=?,payload=?,checked_at=? WHERE id=?')
    .bind(status, JSON.stringify(review), Date.now(), id).run();
  return status;
}
async function removeMissing(env, id) {
  await env.DB.prepare("UPDATE decisions SET status='pending',payload=NULL,checked_at=? WHERE id=?").bind(Date.now(), id).run();
}
export async function synchronize(env) {
  await cleanup(env);
  const token = await accessToken(env);
  await saveSummary(env, await google(`${reviewsUrl(env)}?pageSize=1`, token));
  const { results } = await env.DB.prepare("SELECT id FROM decisions WHERE status='approved'").all();
  for (const { id } of results) {
    try { await reconcile(env, await google(`${reviewsUrl(env)}/${encodeURIComponent(id)}`, token)); }
    catch (error) { if (error.status === 404) await removeMissing(env, id); else throw error; }
  }
  await setSetting(env, 'last_sync', String(Date.now()));
  await env.DB.prepare("DELETE FROM settings WHERE key='sync_error'").run();
}
async function beginOAuth(env) {
  const state = random(), verifier = random();
  await env.DB.prepare('INSERT INTO oauth_states (state,verifier,expires_at) VALUES (?,?,?)').bind(state, verifier, Date.now() + 600000).run();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID, redirect_uri: `${origin(env)}/oauth/callback`,
    response_type: 'code', scope: 'https://www.googleapis.com/auth/business.manage',
    access_type: 'offline', prompt: 'consent', state, code_challenge: await hash(verifier), code_challenge_method: 'S256'
  });
  // Start through a same-origin fetch, then navigate in the browser. A form POST
  // combined with Referrer-Policy: no-referrer can send Origin: null and fail
  // the origin guard; returning JSON also avoids fetch following Google's URL.
  return json({ authorizationUrl: url.href }, 200, {
    'Set-Cookie': `oauth_state=${state}; Path=/oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  });
}
async function finishOAuth(request, env) {
  const url = new URL(request.url), state = url.searchParams.get('state');
  const cookie = (request.headers.get('Cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith('oauth_state='))?.slice(12);
  if (!state || state !== cookie) throw new AppError(400, 'ההתחברות לא תואמת לדפדפן. חזור למסך הניהול והתחבר שוב.');
  const record = await env.DB.prepare('DELETE FROM oauth_states WHERE state=? RETURNING *').bind(state).first();
  if (!record || record.expires_at < Date.now()) throw new AppError(400, 'תוקף בקשת ההתחברות פג. התחל שוב ממסך הניהול.');
  if (url.searchParams.has('error') || !url.searchParams.get('code')) throw new AppError(400, 'ההרשאה לגוגל לא אושרה.');
  const tokens = await tokenRequest(env, {
    grant_type: 'authorization_code', code: url.searchParams.get('code'),
    redirect_uri: `${origin(env)}/oauth/callback`, code_verifier: record.verifier
  });
  // Verify this Google account can actually read the configured Placebo location
  // before replacing the working connection, even if the user selected another account.
  const summary = await google(`${reviewsUrl(env)}?pageSize=1`, tokens.access_token);
  if (!tokens.refresh_token) throw new AppError(409, 'לא התקבלה הרשאה לעדכון אוטומטי. התחל התחברות חדשה עם אישור גישה.');
  await setSetting(env, 'refresh_token', await encrypt(tokens.refresh_token, env));
  await saveSummary(env, summary);
  return new Response(null, { status: 303, headers: {
    Location: `${origin(env)}/admin`, 'Set-Cookie': 'oauth_state=; Path=/oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
  } });
}
async function publicReviews(env) {
  const summary = JSON.parse(await getSetting(env, 'summary') || 'null');
  if (!summary || summary.checkedAt < Date.now() - DAY) return json({ reviews: [], available: false }, 503);
  const { results } = await env.DB.prepare("SELECT payload FROM decisions WHERE status='approved' AND checked_at>? AND payload IS NOT NULL ORDER BY updated_at DESC LIMIT 12").bind(Date.now() - DAY).all();
  return json({
    available: true, rating: summary.rating, total: summary.total, updatedAt: summary.checkedAt,
    mapsUrl: env.GOOGLE_MAPS_URL || MAPS, reviews: results.map(r => normalizeReview(JSON.parse(r.payload)))
  });
}
async function moderate(request, env, id) {
  const body = await request.json();
  if (!['approved', 'hidden', 'pending'].includes(body.status)) throw new AppError(400, 'פעולת פרסום לא תקינה.');
  if (body.status !== 'approved') {
    await env.DB.prepare(`INSERT INTO decisions (id,status,updated_at) VALUES (?,?,?)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status,payload=NULL,digest=NULL,updated_at=excluded.updated_at`)
      .bind(id, body.status, Date.now()).run();
    return json({ status: body.status });
  }
  const review = await google(`${reviewsUrl(env)}/${encodeURIComponent(id)}`, await accessToken(env));
  const digest = await reviewDigest(review);
  if (body.digest !== digest) throw new AppError(409, 'הביקורת השתנתה מאז שטענת אותה. רענן וקרא אותה שוב לפני אישור.');
  // The cap and write are one statement so concurrent approvals cannot exceed it.
  const result = await env.DB.prepare(`INSERT INTO decisions (id,status,digest,payload,checked_at,updated_at)
    SELECT ?,'approved',?,?,?,? WHERE
    (SELECT COUNT(*) FROM decisions WHERE status='approved' AND id<>?) < ?
    ON CONFLICT(id) DO UPDATE SET status='approved',digest=excluded.digest,payload=excluded.payload,
    checked_at=excluded.checked_at,updated_at=excluded.updated_at`)
    .bind(id, digest, JSON.stringify(review), Date.now(), Date.now(), id, MAX_SELECTED).run();
  if (!result.meta.changes) throw new AppError(409, 'אפשר להציג עד 12 ביקורות נבחרות. הסתר אחת כדי להוסיף אחרת.');
  return json({ status: 'approved' });
}
async function route(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (path === '/api/reviews' && request.method === 'GET') return publicReviews(env);
  if (path === '/' && request.method === 'GET') return new Response('Placebo Reviews — /admin', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  if (!await authenticate(request, env)) return json({ error: 'נדרשת כניסה לניהול.' }, 401, { 'WWW-Authenticate': 'Basic realm="Placebo Reviews", charset="UTF-8"' });
  if (!['GET', 'HEAD'].includes(request.method)) {
    if (request.headers.get('Origin') !== origin(env)) throw new AppError(403, 'הפעולה מותרת רק ממסך הניהול.');
    if (Number(request.headers.get('Content-Length') || 0) > 4096) throw new AppError(413, 'הבקשה גדולה מדי.');
  }
  if (path === '/admin' && request.method === 'GET') return new Response(ADMIN_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  if (path === '/admin.js' && request.method === 'GET') return new Response(ADMIN_JS, { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } });
  if (path === '/oauth/start' && request.method === 'POST') return beginOAuth(env);
  if (path === '/oauth/callback' && request.method === 'GET') return finishOAuth(request, env);
  if (path === '/api/admin/status' && request.method === 'GET') {
    return json({ connected: !!await getSetting(env, 'refresh_token'), lastSync: await getSetting(env, 'last_sync'),
      syncError: await getSetting(env, 'sync_error'), summary: JSON.parse(await getSetting(env, 'summary') || 'null') });
  }
  if (path === '/api/admin/reviews' && request.method === 'GET') {
    const token = await accessToken(env);
    const query = new URLSearchParams({ pageSize: '50', orderBy: 'updateTime desc' });
    const pageToken = url.searchParams.get('pageToken');
    if (pageToken) { if (pageToken.length > 2048) throw new AppError(400, 'עמוד לא תקין.'); query.set('pageToken', pageToken); }
    const data = await google(`${reviewsUrl(env)}?${query}`, token);
    await saveSummary(env, data);
    const { results: decisions } = await env.DB.prepare('SELECT * FROM decisions').all();
    const known = new Map(decisions.map(row => [row.id, row]));
    const reviews = [];
    // Sequential DB operations are intentional: decisions are preserved while we
    // refresh review content, and modified approvals become pending.
    for (const review of data.reviews || []) {
      reviews.push({ ...normalizeReview(review), status: await reconcile(env, review, known.get(review.reviewId) || null), digest: await reviewDigest(review) });
    }
    return json({ reviews, nextPageToken: data.nextPageToken || '' });
  }
  if (path === '/api/admin/selected' && request.method === 'GET') {
    const { results } = await env.DB.prepare("SELECT * FROM decisions WHERE status='approved' AND payload IS NOT NULL ORDER BY updated_at DESC").all();
    return json({ reviews: results.map(row => ({ ...normalizeReview(JSON.parse(row.payload)), digest: row.digest, status: row.status })) });
  }
  if (path.startsWith('/api/admin/reviews/') && request.method === 'PUT') return moderate(request, env, reviewId(decodeURIComponent(path.slice('/api/admin/reviews/'.length))));
  if (path === '/api/admin/sync' && request.method === 'POST') { await synchronize(env); return json({ ok: true }); }
  if (path === '/api/admin/disconnect' && request.method === 'POST') {
    // Disconnection must hide the public feed even if Google's revoke service fails.
    const stored = await getSetting(env, 'refresh_token');
    await env.DB.batch([
      env.DB.prepare("DELETE FROM settings WHERE key IN ('refresh_token','summary','last_sync','sync_error')"),
      env.DB.prepare('UPDATE decisions SET payload=NULL,checked_at=NULL'),
      env.DB.prepare('DELETE FROM oauth_states')
    ]);
    if (stored) {
      try {
        await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: await decrypt(stored, env) }), signal: AbortSignal.timeout(10000) });
      } catch { /* Local disconnection already complete. */ }
    }
    return json({ ok: true });
  }
  throw new AppError(404, 'העמוד לא נמצא.');
}

export function createWorker() {
  let ready;
  async function initialize(env) {
    if (!env.DB || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 20) {
      throw new AppError(503, 'השירות עדיין בהגדרה. נדרשים DB, פרטי Google וסיסמת ניהול של 20 תווים לפחות.');
    }
    // D1 exec() treats newlines as query separators, including inside CREATE
    // TABLE. Prepare complete statements so the multi-line schema stays intact.
    if (!ready) ready = env.DB.batch(SCHEMA.split(';').map(sql => sql.trim()).filter(Boolean)
      .map(sql => env.DB.prepare(sql))).catch(error => { ready = undefined; throw error; });
    await ready;
  }
  return {
    async fetch(request, env) {
      const headers = {
        'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src https: data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
      };
      const url = new URL(request.url);
      const allowed = (env.PUBLIC_ORIGINS || 'https://hagbu.github.io,https://placebo.co.il,https://www.placebo.co.il').split(',').map(s => s.trim());
      const publicRequest = url.pathname === '/api/reviews';
      if (publicRequest && allowed.includes(request.headers.get('Origin'))) {
        headers['Access-Control-Allow-Origin'] = request.headers.get('Origin');
        headers.Vary = 'Origin';
      }
      let response;
      try {
        if (url.origin !== origin(env)) throw new AppError(400, 'כתובת השירות אינה תואמת להגדרות.');
        if (publicRequest && request.method === 'OPTIONS') response = new Response(null, { status: 204, headers: { 'Access-Control-Allow-Methods': 'GET' } });
        else { await initialize(env); response = await route(request, env); }
      } catch (error) {
        response = json({ error: error instanceof AppError ? error.message : 'הפעולה נכשלה. נסה שוב מאוחר יותר.' }, error instanceof AppError ? error.status : 500);
      }
      const secured = new Response(response.body, response);
      for (const [name, value] of Object.entries(headers)) secured.headers.set(name, value);
      return secured;
    },
    async scheduled(_event, env, ctx) {
      ctx.waitUntil((async () => {
        await initialize(env);
        try { await synchronize(env); }
        catch { await setSetting(env, 'sync_error', 'העדכון האוטומטי נכשל. בדוק חיבור לגוגל ונסה לרענן.'); }
      })());
    }
  };
}
export default createWorker();
