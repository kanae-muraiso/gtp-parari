// 2026-10-14 JST / PART: Real React lifecycle; fake Auth/transport, no emails sent.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://parari.test', pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Event', 'Node', 'MutationObserver']) global[k] = dom.window[k];
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { createRoot } = require('react-dom/client');
const repo = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (n, ...a) { return resolve.call(this, n.startsWith('@/') ? path.join(repo, 'src', n.slice(2)) : n, ...a); };
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (m, n) => m._compile(ts.transpileModule(fs.readFileSync(n, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, n);
let session, sessionError, rpcError, allowed, listener, delay, root;
let sessions, exchanges, claims, calls, sent, redirects;
const client = {
  auth: {
    getSession: async () => { sessions++; return { data: { session }, error: sessionError }; },
    exchangeCodeForSession: async () => { exchanges++; return { error: null }; },
    onAuthStateChange: cb => { listener = cb; return { data: { subscription: { unsubscribe: () => { if (listener === cb) listener = null; } } } }; },
    signInWithOtp: async options => { sent.push(options); return { error: null }; },
  },
  rpc: () => ({ abortSignal: async () => { calls++; if (delay) await delay.promise; return { data: [{ id: 'event', title: '会場', can_enter: allowed }], error: rpcError }; } }),
};
const router = { replace: value => redirects.push(value) };
require.cache[require.resolve('next/navigation')] = { exports: { useRouter: () => router } };
require.cache[require.resolve('next/link')] = { exports: { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { ...props, href }, children) } };
require.cache[require.resolve('../src/lib/supabaseClient.ts')] = { exports: { supabase: client } };
require.cache[require.resolve('../src/components/parari/cpp/CppLiveUnifiedVenue.tsx')] = { exports: { __esModule: true, default: () => React.createElement('div', { 'data-venue': true }, 'venue') } };
global.fetch = async (url, options) => { assert.equal(url, '/api/application/claim-guest'); assert.equal(options.headers.Authorization, 'Bearer test-only'); claims++; return { ok: false }; };
const Callback = require('../src/app/auth/callback/page.tsx').default;
const Room = require('../src/components/parari/cpp/CppLiveEventRoom.tsx').default;
const Login = require('../src/app/login/page.tsx').default;
const { loginReturnTo } = require('../src/lib/auth/loginLinks.ts');
function reset(url) {
  window.history.replaceState(null, '', url); session = { user: { id: 'alice' }, access_token: 'test-only' };
  sessionError = rpcError = delay = null; allowed = true;
  sessions = exchanges = claims = calls = 0; sent = []; redirects = [];
}
async function settle() { await React.act(async () => { await new Promise(r => setTimeout(r, 5)); }); }
async function mount(Component, props = {}) { root = createRoot(document.getElementById('root')); await React.act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Component, props)))); await settle(); }
async function unmount() { await React.act(async () => root.unmount()); }
async function auth(next) { await React.act(async () => { session = next; listener('SIGNED_IN', next); }); await settle(); }
const venue = () => document.querySelector('[data-venue]');
(async () => {
  for (const raw of ['https://evil.test', '//evil.test', '/\\evil.test', '/\nevil.test', '/a/..//evil.test']) assert.equal(loginReturnTo(raw), '/mypage', raw);
  assert.equal(loginReturnTo('/membership/join/complete?requestId=abc'), '/membership/join/complete?requestId=abc');
  for (const error of ['#error=access_denied&error_code=otp_expired', '&error_code=otp_expired', '#error=server_error&error_description=DO_NOT_RENDER']) {
    reset('/auth/callback?returnTo=%2Fmy%2Fcpp%2Flive' + error); await mount(Callback);
    assert.ok(document.querySelector('[role=alert]')); assert.equal(sessions, 0); assert.equal(claims, 0); assert.deepEqual(redirects, []);
    assert.equal(document.body.textContent.includes('DO_NOT_RENDER'), false);
    assert.equal(document.querySelector('a').getAttribute('href'), '/login?returnTo=%2Fmy%2Fcpp%2Flive&reauth=1'); await unmount();
  }
  console.log('PASS invalid/expired/reused callbacks cannot claim or redirect an existing account; internal retry destination');
  reset('/auth/callback?returnTo=%2Fmembership%2Fjoin%2Fcomplete%3FrequestId%3Dabc'); await mount(Callback);
  assert.equal(claims, 1, 'Strict Mode claims once'); assert.deepEqual(redirects, ['/membership/join/complete?requestId=abc']); await unmount();
  reset('/auth/callback?returnTo=%2F%2Fevil.test'); await mount(Callback); assert.deepEqual(redirects, ['/']); await unmount();
  reset('/auth/callback'); session = null; await mount(Callback); assert.ok(document.body.textContent.includes('期限切れ')); assert.equal(claims, 0); await unmount();
  reset('/auth/callback'); sessionError = { code: 'network_error' }; await mount(Callback); assert.ok(document.body.textContent.includes('通信状態')); assert.deepEqual(redirects, []); await unmount();
  console.log('PASS successful membership callback, claim outage, missing session and network failure');
  reset('/my/cpp/live/room/event'); session = null; await mount(Room, { eventId: 'event' });
  assert.equal(calls, 0); assert.equal(venue(), null); assert.ok(document.body.textContent.includes('ログインが必要'));
  assert.ok(document.querySelector('a[href^="/login?"]'));
  await auth({ user: { id: 'alice' }, access_token: 'test-only' }); assert.ok(venue());
  await auth(null); assert.equal(venue(), null); assert.ok(document.body.textContent.includes('ログインが必要')); await unmount();
  reset('/my/cpp/live/room/event'); let done; delay = { promise: new Promise(r => { done = r; }) };
  await mount(Room, { eventId: 'event' }); await auth(null); done(); await settle(); assert.equal(venue(), null); await unmount();
  reset('/my/cpp/live/room/event'); allowed = false; await mount(Room, { eventId: 'event' }); assert.ok(document.body.textContent.includes('現在入室できません')); assert.equal(venue(), null); await unmount();
  reset('/my/cpp/live/room/event'); rpcError = { code: '42501' }; await mount(Room, { eventId: 'event' }); assert.ok(document.body.textContent.includes('開催状況を確認できません')); assert.equal(venue(), null); await unmount();
  console.log('PASS anonymous entry avoids RPC, login/logout update venue, stale admission cannot reopen after logout, denied/error stay closed');
  reset('/login?returnTo=%2Fmy%2Fcpp%2Flive'); await mount(Login); assert.ok(redirects.every(p => p === '/my/cpp/live')); await unmount();
  reset('/login?returnTo=%2Fmy%2Fcpp%2Flive&reauth=1'); await mount(Login); assert.ok(document.querySelector('form')); assert.deepEqual(redirects, []); await unmount();
  reset('/login?returnTo=%2Fmy%2Fcpp%2Flive'); session = null; await mount(Login);
  await React.act(async () => { const input = document.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'test@example.test'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await React.act(async () => document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); await settle();
  assert.equal(sent.length, 1); assert.equal(sent[0].options.emailRedirectTo, 'https://parari.test/auth/callback?returnTo=%2Fmy%2Fcpp%2Flive');
  assert.ok(document.body.textContent.includes('リンクを開いたブラウザー')); assert.ok(document.body.textContent.includes('一度だけ')); await unmount();
  console.log('PASS login destination, explicit email send and cross-browser/use-once guidance');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { dom.window.close(); });
