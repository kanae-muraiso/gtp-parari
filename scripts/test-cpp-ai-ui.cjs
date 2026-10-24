// 2026-10-09 JST — Real React/DOM interactions. No visual browser/layout claim.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://parari.test/my/cpp/ai', pretendToBeVisual: true });
for (const key of ['window', 'document', 'HTMLElement', 'Event', 'MouseEvent']) global[key] = dom.window[key];
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { createRoot } = require('react-dom/client');
let session = { user: { id: 'owner-a' }, access_token: 'token-a' };
let listener;
const supabase = { auth: {
  getSession: async () => ({ data: { session } }),
  onAuthStateChange: (callback) => { listener = callback; callback('INITIAL_SESSION', session); return { data: { subscription: { unsubscribe() { listener = null; } } } }; },
} };
const cache = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths; cache.set(filename, mod);
  mod.require = (name) => {
    if (name === '@/lib/supabaseClient') return { supabase };
    if (name === 'next/link') return { default: (props) => React.createElement('a', props, props.children) };
    if (name.startsWith('@/')) { const base = path.resolve('src', name.slice(2)); return load(base + (fs.existsSync(base + '.tsx') ? '.tsx' : '.ts')); }
    return require(name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const Page = load('src/app/my/cpp/ai/page.tsx').default;
const settle = async () => React.act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
async function click(element) { assert.ok(element); await React.act(async () => element.click()); await settle(); }
async function type(value) {
  const input = document.querySelector('textarea');
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

test('consent, failure recovery, safe text, limits, profile opt-out and identity isolation', async () => {
  let mode = 'ready', sent = [], pendingResolve, pendingSignal;
  global.fetch = async (_url, init) => {
    if (init.method !== 'POST') return Response.json({ available: mode !== 'unavailable', message: 'CPP AIは準備中です。' });
    sent.push({ body: JSON.parse(init.body), token: init.headers.Authorization });
    if (mode === 'error') return Response.json({ error: 'AIに接続できません。' }, { status: 503 });
    if (mode === 'pending') { pendingSignal = init.signal; return new Promise((resolve) => { pendingResolve = resolve; }); }
    return Response.json({ message: { role: 'assistant', content: '<img src=x onerror=alert(1)> 具体的な経験を教えてください。' } });
  };
  const root = createRoot(document.getElementById('root'));
  try {
    await React.act(async () => root.render(React.createElement(Page))); await settle();
    assert.ok(document.querySelector('a[href="/my/cpp/home"]'));
    assert.ok(document.querySelector('a[href="/my/cpp"][target="_blank"]'));
    assert.equal(button('送信する').disabled, true);
    await type('私だけの研究相談'); assert.equal(button('送信する').disabled, true);
    const checks = document.querySelectorAll('input[type="checkbox"]');
    await click(checks[0]); // profile off
    await click(checks[1]); // explicit provider consent
    mode = 'error'; await click(button('送信する'));
    assert.equal(document.querySelector('textarea').value, '私だけの研究相談');
    assert.match(document.querySelector('[role="alert"]').textContent, /接続できません/);
    assert.equal(document.querySelectorAll('article').length, 0);
    mode = 'ready'; await click(button('送信する'));
    assert.equal(document.querySelectorAll('article').length, 2);
    assert.equal(document.querySelector('article img'), null);
    assert.match(document.body.textContent, /<img src=x onerror=alert\(1\)>/);
    assert.equal(document.querySelector('textarea').value, '');
    assert.equal(sent[1].body.useProfile, false); assert.equal(sent[1].body.consent, true); assert.equal(sent[1].token, 'Bearer token-a');
    assert.equal(window.localStorage.length, 0); assert.equal(window.sessionStorage.length, 0);

    // A different account must not see the old transcript or keep consent.
    session = { user: { id: 'owner-b' }, access_token: 'token-b' };
    await React.act(async () => listener('SIGNED_IN', session)); await settle();
    assert.equal(document.querySelectorAll('article').length, 0);
    assert.doesNotMatch(document.body.textContent, /私だけの研究相談/);
    assert.equal(document.querySelectorAll('input[type="checkbox"]')[1].checked, false);

    // Logout while a model response is in flight aborts the old UI and hides its content.
    await type('SECOND_PRIVATE'); await click(document.querySelectorAll('input[type="checkbox"]')[1]);
    mode = 'pending'; await click(button('送信する'));
    assert.equal(button('考え中…').disabled, true);
    const count = sent.length;
    await React.act(async () => document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    assert.equal(sent.length, count);
    session = null; await React.act(async () => listener('SIGNED_OUT', null)); await settle();
    assert.equal(pendingSignal.aborted, true);
    pendingResolve(Response.json({ message: { role: 'assistant', content: 'STALE_PRIVATE_REPLY' } })); await settle();
    assert.ok(document.querySelector('a[href="/login?returnTo=/my/cpp/ai"]'));
    assert.doesNotMatch(document.body.textContent, /SECOND_PRIVATE|STALE_PRIVATE_REPLY|私だけの研究相談/);

    mode = 'unavailable'; session = { user: { id: 'owner-a' }, access_token: 'token-a' };
    await React.act(async () => listener('SIGNED_IN', session)); await settle();
    assert.match(document.body.textContent, /CPP AIは準備中/); assert.equal(document.querySelector('textarea'), null);
  } finally { await React.act(async () => root.unmount()); dom.window.close(); }
});
