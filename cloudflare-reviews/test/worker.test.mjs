import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createWorker, encrypt, reviewDigest, synchronize } from '../src/worker.mjs';

class Database {
  constructor() { this.db = new DatabaseSync(':memory:'); }
  // Match D1's newline-separated exec queries instead of accepting SQLite's
  // more permissive multiline script execution.
  async exec(sql) { for (const line of sql.trim().split('\n')) if (line.trim()) this.db.exec(line); }
  prepare(sql) {
    const db = this.db;
    const make = values => ({
      bind: (...args) => make(args),
      first: async () => db.prepare(sql).get(...values) || null,
      all: async () => ({ results: db.prepare(sql).all(...values) }),
      run: async () => ({ meta: { changes: db.prepare(sql).run(...values).changes } })
    });
    return make([]);
  }
  async batch(statements) { return Promise.all(statements.map(s => s.run())); }
}
const base = 'https://placebo-reviews.hagbior.workers.dev';
const password = 'a-test-only-password-over-20-chars';
const authorization = 'Basic '+btoa('placebo:'+password);
const sample = (id = 'review_1') => ({ reviewId: id, reviewer: { displayName: '<script>unsafe</script>', profilePhotoUrl: 'https://example.com/photo.png' },
  starRating: 'FIVE', comment: 'Sample text used only in automated tests', createTime: '2026-01-01T00:00:00Z', updateTime: '2026-01-01T00:00:00Z' });
async function fixture() {
  const worker = createWorker();
  const env = { DB: new Database(), ADMIN_PASSWORD: password, GOOGLE_CLIENT_ID: 'test-client-id', GOOGLE_CLIENT_SECRET: 'test-secret' };
  const request = (path, method = 'GET', body, headers = {}) => worker.fetch(new Request(base+path, {
    method, headers: { Authorization: authorization, ...(method !== 'GET' ? { Origin: base, 'Content-Type':'application/json' } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  }),env);
  await request('/api/admin/status');
  await env.DB.prepare('INSERT INTO settings (key,value) VALUES (?,?)').bind('refresh_token', await encrypt('test-refresh-token', env)).run();
  return { worker, env, request };
}
function mockGoogle(t, reviews = [sample()]) {
  const state = { reviews, fail: false };
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input);
    if(url.hostname === 'oauth2.googleapis.com') return Response.json({access_token:'test-access-token'});
    assert.equal(url.hostname,'mybusiness.googleapis.com');
    assert.equal(init.headers.Authorization,'Bearer test-access-token');
    if(state.fail) return Response.json({error:'upstream-error'}, {status:500});
    const id = url.pathname.split('/reviews/')[1];
    if(id) {
      const r=state.reviews.find(r=>r.reviewId===id);
      return r?Response.json(r):Response.json({error:'missing'},{status:404});
    }
    return Response.json({reviews:state.reviews, averageRating:4.8, totalReviewCount:1321, nextPageToken:'next-page'});
  };
  t.after(()=>{globalThis.fetch=original;});
  return state;
}

test('admin requires credentials, cross-origin writes fail, public errors contain no secrets', async () => {
  const {worker,env,request}=await fixture();
  const denied=await worker.fetch(new Request(base+'/admin'),env);
  assert.equal(denied.status,401);
  assert.ok(denied.headers.get('WWW-Authenticate').startsWith('Basic '));
  assert.equal((await request('/api/admin/sync','POST',{}, {Origin:'https://attacker.example'})).status,403);
  const unavailable=await worker.fetch(new Request(base+'/api/reviews',{headers:{Origin:'https://hagbu.github.io'}}),env);
  assert.equal(unavailable.status,503);
  assert.equal(unavailable.headers.get('Access-Control-Allow-Origin'),'https://hagbu.github.io');
  assert.equal(unavailable.headers.get('Cache-Control'),'no-store');
  assert.ok(!(await unavailable.text()).includes('test-refresh-token'));
  const privateResponse=await request('/api/admin/status','GET',undefined,{Origin:'https://hagbu.github.io'});
  assert.equal(privateResponse.headers.get('Access-Control-Allow-Origin'),null);
});

test('new reviews are pending; approve exact content; hide survives resync; real aggregate is preserved', async t => {
  mockGoogle(t);
  const {env,request}=await fixture();
  const page=await (await request('/api/admin/reviews')).json();
  assert.equal(page.nextPageToken,'next-page');
  assert.equal(page.reviews[0].status,'pending');
  assert.equal((await (await request('/api/reviews')).json()).reviews.length,0);
  assert.equal((await request('/api/admin/reviews/review_1','PUT',{status:'approved',digest:page.reviews[0].digest})).status,200);
  const published=await (await request('/api/reviews')).json();
  assert.equal(published.reviews.length,1);
  assert.equal(published.rating,4.8);
  assert.equal(published.total,1321);
  assert.equal(published.reviews[0].name,'<script>unsafe</script>'); // Client must render as text.
  const settings=await (await request('/api/admin/status')).text();
  assert.ok(!settings.includes('refresh_token'));
  await request('/api/admin/reviews/review_1','PUT',{status:'hidden'});
  await synchronize(env);
  assert.equal((await (await request('/api/reviews')).json()).reviews.length,0);
  const again=await (await request('/api/admin/reviews')).json();
  assert.equal(again.reviews[0].status,'hidden');
});

test('updated review cannot be approved with an old digest and existing approval becomes pending', async t => {
  const google=mockGoogle(t);
  const {env,request}=await fixture();
  const digest=await reviewDigest(sample());
  await request('/api/admin/reviews/review_1','PUT',{status:'approved',digest});
  google.reviews[0]={...sample(),comment:'Changed text',updateTime:'2026-02-01T00:00:00Z'};
  assert.equal((await request('/api/admin/reviews/review_1','PUT',{status:'approved',digest})).status,409);
  await synchronize(env);
  assert.equal((await (await request('/api/reviews')).json()).reviews.length,0);
  assert.equal((await env.DB.prepare('SELECT status FROM decisions WHERE id=?').bind('review_1').first()).status,'pending');
});

test('deleted reviews disappear and outdated content is not served during an outage', async t => {
  const google=mockGoogle(t);
  const {env,request}=await fixture();
  await request('/api/admin/reviews/review_1','PUT',{status:'approved',digest:await reviewDigest(sample())});
  await synchronize(env);
  await env.DB.prepare('UPDATE decisions SET checked_at=?').bind(Date.now()-2*86400000).run();
  assert.equal((await (await request('/api/reviews')).json()).reviews.length,0);
  google.reviews=[];
  await synchronize(env);
  assert.equal((await env.DB.prepare('SELECT payload FROM decisions WHERE id=?').bind('review_1').first()).payload,null);
  await env.DB.prepare("UPDATE settings SET value=? WHERE key='summary'").bind(JSON.stringify({rating:4.8,total:1321,checkedAt:Date.now()-2*86400000})).run();
  assert.equal((await request('/api/reviews')).status,503);
  await env.DB.prepare("UPDATE decisions SET payload=?,checked_at=? WHERE id='review_1'").bind(JSON.stringify(sample()),Date.now()-30*86400000).run();
  google.fail=true;
  await assert.rejects(()=>synchronize(env));
  assert.equal((await env.DB.prepare("SELECT payload FROM decisions WHERE id='review_1'").first()).payload,null);
});

test('approved selection cap is enforced and invalid IDs/statuses are rejected', async t => {
  mockGoogle(t,Array.from({length:13},(_,i)=>sample('id_'+i)));
  const {request}=await fixture();
  for(let i=0;i<12;i++) assert.equal((await request('/api/admin/reviews/id_'+i,'PUT',{status:'approved',digest:await reviewDigest(sample('id_'+i))})).status,200);
  assert.equal((await request('/api/admin/reviews/id_12','PUT',{status:'approved',digest:await reviewDigest(sample('id_12'))})).status,409);
  assert.equal((await request('/api/admin/reviews/id_0','PUT',{status:'invented'})).status,400);
  assert.equal((await request('/api/admin/reviews/bad%2Fid','PUT',{status:'hidden'})).status,400);
});

test('OAuth uses one-time browser-bound state, PKCE and encrypted refresh token', async t => {
  const {env,request}=await fixture();
  const start=await request('/oauth/start','POST',{});
  assert.equal(start.status,200);
  const redirect=new URL((await start.json()).authorizationUrl);
  assert.equal(redirect.searchParams.get('redirect_uri'),base+'/oauth/callback');
  assert.equal(redirect.searchParams.get('code_challenge_method'),'S256');
  assert.equal(redirect.searchParams.get('access_type'),'offline');
  const state=redirect.searchParams.get('state');
  const cookie='oauth_state='+state;
  assert.equal((await request('/oauth/callback?state='+state+'&code=code')).status,400);
  const original=globalThis.fetch;
  globalThis.fetch=async input => new URL(input).hostname==='oauth2.googleapis.com'
    ?Response.json({access_token:'fresh-access',refresh_token:'new-refresh'})
    :Response.json({reviews:[],averageRating:4.8,totalReviewCount:1321});
  t.after(()=>{globalThis.fetch=original;});
  assert.equal((await request('/oauth/callback?state='+state+'&code=code','GET',undefined,{Cookie:cookie})).status,303);
  const stored=await env.DB.prepare("SELECT value FROM settings WHERE key='refresh_token'").first();
  assert.ok(!stored.value.includes('new-refresh'));
  assert.equal((await request('/oauth/callback?state='+state+'&code=code','GET',undefined,{Cookie:cookie})).status,400);
});

test('failed OAuth account validation preserves the working connection',async t=>{
  const {env,request}=await fixture();
  const stored=(await env.DB.prepare("SELECT value FROM settings WHERE key='refresh_token'").first()).value;
  const start=await request('/oauth/start','POST',{});
  const state=new URL((await start.json()).authorizationUrl).searchParams.get('state');
  const original=globalThis.fetch;
  globalThis.fetch=async input=>new URL(input).hostname==='oauth2.googleapis.com'
    ?Response.json({access_token:'wrong-account',refresh_token:'wrong-refresh'})
    :Response.json({error:'denied'},{status:403});
  t.after(()=>{globalThis.fetch=original;});
  assert.equal((await request('/oauth/callback?state='+state+'&code=code','GET',undefined,{Cookie:'oauth_state='+state})).status,502);
  assert.equal((await env.DB.prepare("SELECT value FROM settings WHERE key='refresh_token'").first()).value,stored);
});

test('OAuth initiation rejects missing, opaque and foreign origins without creating state',async()=>{
  const {env,worker}=await fixture();
  for(const value of [null,'null','https://attacker.example']) {
    const headers={Authorization:authorization,'Content-Type':'application/json'};
    if(value!==null) headers.Origin=value;
    const response=await worker.fetch(new Request(base+'/oauth/start',{method:'POST',headers,body:'{}'}),env);
    assert.equal(response.status,403);
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS count FROM oauth_states').first()).count,0);
  }
});

test('disconnection removes credentials and public content without changing moderation choices',async t=>{
  mockGoogle(t);
  const {env,request}=await fixture();
  await request('/api/admin/reviews/review_1','PUT',{status:'approved',digest:await reviewDigest(sample())});
  await synchronize(env);
  assert.equal((await request('/api/admin/disconnect','POST',{})).status,200);
  assert.equal((await request('/api/reviews')).status,503);
  const row=await env.DB.prepare("SELECT * FROM decisions WHERE id='review_1'").first();
  assert.equal(row.payload,null);
  assert.equal(row.status,'approved');
  assert.equal((await (await request('/api/admin/status')).json()).connected,false);
});
