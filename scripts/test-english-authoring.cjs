// 2026-10-07 JST — Real routes, React and Lexical; only Supabase/network and browser geometry are simulated.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://editor.test', pretendToBeVisual: true });
for (const key of ['window', 'document', 'Node', 'Text', 'HTMLElement', 'Element', 'Event', 'MouseEvent', 'KeyboardEvent', 'MutationObserver', 'NodeFilter', 'DOMParser', 'Range']) global[key] = dom.window[key];
global.self = dom.window;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.requestAnimationFrame = window.requestAnimationFrame.bind(window);
global.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
const rect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 40, width: 400, height: 40 });
Range.prototype.getBoundingClientRect = rect;
Range.prototype.getClientRects = () => [rect()];
HTMLElement.prototype.getBoundingClientRect = rect;
global.CSS = { highlights: new Map(), escape: value => value };
window.Highlight = class { constructor(...ranges) { this.ranges = ranges; } };

let user = { id: 'editor-user', user_metadata: {} };
let billing = { plan: 'free', billing_status: 'active' };
let monitor = false;
let failTable = '';
let dictionaryReads = 0;
let saveFails = false;
let pendingLookup = null;
const authListeners = new Set();
const row = { word: 'acquire', normalized_word: 'acquire', lemma: 'acquire', pos: 'verb', form_type: 'base', sense_id: '1', meaning_ja: '獲得する', eiken_level: '2', eiken_levels: ['2'], entry_kind: 'word', importance: 1, active: true };
const admin = {
  auth: { getUser: async token => ({ data: { user: token === 'test-token' ? user : null }, error: null }) },
  from(table) {
    const filters = [];
    const query = {
      select() { return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      in(key, value) { filters.push([key, value]); return query; },
      maybeSingle() { return query; },
      then(resolve, reject) {
        if (table === 'parari_english_dictionary') dictionaryReads++;
        if (table !== 'parari_english_dictionary') assert.deepEqual(filters, [['user_id', 'editor-user']], 'Use authenticated editor, not work owner or request body');
        let data = table === 'user_billing' ? billing : table === 'profiles' ? { is_monitor: monitor } : [row].filter(r => filters.every(([key, value]) => Array.isArray(value) ? value.includes(r[key]) : r[key] === value));
        return Promise.resolve({ data: failTable === table ? null : data, error: failTable === table ? { message: 'fixture failure' } : null }).then(resolve, reject);
      },
    };
    return query;
  },
};
const client = { auth: {
  getSession: async () => ({ data: { session: user ? { access_token: 'test-token' } : null }, error: null }),
  onAuthStateChange(callback) { authListeners.add(callback); return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } }; },
  async updateUser({ data }) {
    if (saveFails) return { error: new Error('fixture failure') };
    user.user_metadata = { ...user.user_metadata, ...data };
    authListeners.forEach(callback => callback('USER_UPDATED'));
    return { data: { user }, error: null };
  },
} };
const rootPath = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) { return resolve.call(this, name.startsWith('@/') ? path.join(rootPath, 'src', name.slice(2)) : name, ...args); };
const load = Module._load;
Module._load = function(name, ...args) {
  if (name === 'server-only') return {};
  if (name === '@/lib/billing/supabaseAdmin' || name === './supabaseAdmin') return { supabaseAdmin: admin };
  if (name === '@/lib/supabaseClient') return { supabase: client };
  return load.call(this, name, ...args);
};
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);

const route = require('../src/app/api/english/authoring/route.ts');
const publicRoute = require('../src/app/api/english/dictionary/route.ts');
const { getEffectivePlan, getPlanEntitlements } = require('../src/lib/billing/plan.ts');
const request = (method = 'GET', token = 'test-token', words = ['ACQUIRE', 'unknown']) => new Request('https://editor.test/api/english/authoring', { method, headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {}, ...(method === 'POST' ? { body: JSON.stringify({ words, userId: 'work-owner', plan: 'pro' }) } : {}) });
global.fetch = async (url, options = {}) => {
  assert.equal(url, '/api/english/authoring', 'Editor must use authenticated dictionary endpoint');
  if (options.method === 'POST' && pendingLookup) await pendingLookup;
  const req = new Request(`https://editor.test${url}`, options);
  return options.method === 'POST' ? route.POST(req) : route.GET(req);
};

const React = require('react');
const { createRoot } = require('react-dom/client');
const { $getRoot } = require('lexical');
const { EnglishAuthoringProvider } = require('../src/components/parari/english/EnglishAuthoringProvider.tsx');
const Settings = require('../src/components/parari/settings/EnglishAuthoringSettings.tsx').default;
const { RichTextPanelEditor } = require('../src/components/parari/panels/richText/RichTextPanelEditor.tsx');
const { parseTextReadingSupportAttrs, serializeTextReadingSupportAttrs } = require('../src/lib/parari/richText/textReadingSupport.ts');
let root;
async function settle(ms = 25) { await React.act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); }); }
async function mount(component) {
  if (root) await React.act(async () => root.unmount());
  root = createRoot(document.getElementById('root'));
  await React.act(async () => root.render(component));
  await settle();
}
function button(label) { const found = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label || b.getAttribute('aria-label') === label); assert.ok(found, `Missing button: ${label}`); return found; }
async function click(label) { const target = button(label); assert.equal(target.disabled, false); await React.act(async () => target.click()); await settle(); }
async function focusEditor() {
  const element = document.querySelector('[contenteditable="true"]');
  assert.ok(element);
  await React.act(async () => element.focus());
  await settle();
  return element.__lexicalEditor;
}
async function chooseWord(word) {
  const editor = await focusEditor();
  await React.act(async () => editor.update(() => {
    const node = $getRoot().getAllTextNodes().find(node => node.getTextContent().includes(word));
    const index = node.getTextContent().indexOf(word);
    node.select(index, index + word.length);
  }, { discrete: true }));
  await settle();
}
let textChanges = [];
let attrs = 'custom:keep dictionary:on eiken:on notes:on noteFrom:3';
function panel(source = 'Acquire unknown.') {
  return React.createElement(EnglishAuthoringProvider, null, React.createElement(PanelFixture, { source }));
}
function PanelFixture({ source }) {
  const [support, setSupport] = React.useState(() => parseTextReadingSupportAttrs(attrs));
  return React.createElement(RichTextPanelEditor, {
    ssotText: source, readingSupport: support,
    onChangeSsotText: value => textChanges.push(value),
    onChangeReadingSupport: value => { attrs = serializeTextReadingSupportAttrs(attrs, value); setSupport(value); },
  });
}
async function edit() {
  await React.act(async () => document.querySelector('[title="クリックして本文を編集"]').click());
  await focusEditor();
}

(async () => {
  for (const token of [null, 'forged']) {
    assert.equal((await route.GET(request('GET', token))).status, 401);
    assert.equal((await route.POST(request('POST', token))).status, 401);
  }
  for (const plan of ['free', 'plus', 'organizer', 'host', 'pro']) {
    billing = { plan, billing_status: 'active' };
    user.user_metadata = {};
    assert.deepEqual(await (await route.GET(request())).json(), { allowed: plan !== 'free', enabled: false });
    assert.equal((await route.POST(request('POST'))).status, 403, 'Opt-in required even for paid plans');
    user.user_metadata = { english_authoring_enabled: true, plan: 'pro', is_monitor: true };
    assert.equal((await route.POST(request('POST'))).status, plan === 'free' ? 403 : 200);
  }
  for (const status of ['none', 'past_due', 'canceled', 'unpaid', 'incomplete']) {
    billing = { plan: 'plus', billing_status: status };
    assert.equal(getPlanEntitlements(getEffectivePlan(billing)).canUseEnglishAuthoring, false);
    assert.equal((await route.POST(request('POST'))).status, 403);
  }
  monitor = true;
  assert.equal((await route.POST(request('POST'))).status, 200, 'Existing monitor entitlement policy is preserved');
  monitor = false;
  billing = { plan: 'plus', billing_status: 'trialing' };
  let response = await route.POST(request('POST'));
  const batch = await response.json();
  assert.equal(batch.results.acquire.best.meaningJa, '獲得する');
  assert.equal(batch.results.unknown.found, false);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const before = dictionaryReads;
  failTable = 'user_billing';
  assert.equal((await route.POST(request('POST'))).status, 503);
  assert.equal(dictionaryReads, before, 'Billing failure must not reach the dictionary');
  failTable = 'profiles';
  assert.equal((await route.GET(request())).status, 503);
  failTable = 'parari_english_dictionary';
  assert.equal((await route.POST(request('POST'))).status, 503, 'Lookup failure is distinct from unregistered');
  failTable = '';
  assert.equal((await route.POST(request('POST', 'test-token', 'invalid'))).status, 400);
  assert.equal((await publicRoute.POST(request('POST', null))).status, 200, 'Public reader remains available without author entitlement');

  billing = { plan: 'free', billing_status: 'active' };
  await mount(React.createElement(Settings));
  assert.equal(button('英語教材支援を有効にする').disabled, true);
  assert.ok(document.querySelector('a[href="/billing"]'));
  await mount(panel()); await edit();
  assert.doesNotMatch(document.body.textContent, /英語教材支援|読む支援|選択語/);
  billing = { plan: 'plus', billing_status: 'active' };
  user.user_metadata = { display_name: 'Keep me' };
  await mount(panel()); await edit();
  assert.doesNotMatch(document.body.textContent, /英語教材支援|読む支援/);
  await mount(React.createElement(Settings));
  assert.equal(button('英語教材支援を有効にする').getAttribute('aria-checked'), 'false');
  saveFails = true;
  await click('英語教材支援を有効にする');
  assert.match(document.body.textContent, /設定を保存できませんでした/);
  assert.equal(user.user_metadata.english_authoring_enabled, undefined);
  saveFails = false;
  await click('英語教材支援を有効にする');
  assert.equal(user.user_metadata.display_name, 'Keep me');
  assert.equal(button('英語教材支援を有効にする').getAttribute('aria-checked'), 'true');

  await mount(panel());
  assert.match(document.body.textContent, /獲得する/);
  await click('Acquire');
  assert.equal(document.querySelector('[contenteditable]'), null, 'Dictionary popup should not switch into editing');
  await edit();
  assert.equal([...document.querySelectorAll('button')].filter(b => b.textContent === '英語教材支援 ▾').length, 1);
  assert.equal(document.querySelector('[aria-label="TEXTの設定"]'), null, 'No second reading-support menu');
  await chooseWord('Acquire');
  await click('英語教材支援 ▾');
  await click('選択語を辞書で確認');
  assert.match(document.body.textContent, /獲得する/);
  assert.match(document.body.textContent, /英検2級/);
  await click('辞書確認を閉じる');
  await chooseWord('unknown'); await click('英語教材支援 ▾'); await click('選択語を辞書で確認');
  assert.match(document.body.textContent, /登録されていません/);
  failTable = 'parari_english_dictionary';
  await chooseWord('Acquire'); await click('英語教材支援 ▾'); await click('選択語を辞書で確認');
  assert.match(document.body.textContent, /辞書を取得できません/);
  assert.doesNotMatch(document.body.textContent, /登録されていません/);
  failTable = '';
  let finish;
  pendingLookup = new Promise(resolve => { finish = resolve; });
  await click('英語教材支援 ▾'); await click('選択語を辞書で確認');
  await click('辞書確認を閉じる');
  await React.act(async () => { finish(); });
  pendingLookup = null;
  await settle();
  assert.equal(document.querySelector('[aria-label="辞書確認を閉じる"]'), null, 'Closing cancels stale lookup result');

  await click('英語教材支援 ▾'); await click('辞書登録語に下線（編集中）');
  await settle(300);
  const highlight = CSS.highlights.get('parari-dictionary-editor');
  assert.ok(highlight);
  assert.deepEqual(highlight.ranges.map(range => range.toString()), ['Acquire']);
  const level = document.querySelector('select');
  await React.act(async () => level.focus());
  await settle(150);
  assert.ok(document.querySelector('[aria-label="英語教材支援"]'), 'Focusing the level selector must keep the toolbar open');
  await React.act(async () => { level.value = '2'; level.dispatchEvent(new Event('change', { bubbles: true })); });
  assert.match(attrs, /noteFrom:2/);
  await click('英検級を表示');
  assert.match(attrs, /custom:keep/);
  assert.doesNotMatch(attrs, /eiken:on/);
  assert.deepEqual(textChanges, [], 'Dictionary and support changes never rewrite the body');
  const savedAttrs = attrs;
  billing = { plan: 'plus', billing_status: 'canceled' };
  await React.act(async () => window.dispatchEvent(new Event('focus'))); await settle();
  assert.doesNotMatch(document.body.textContent, /英語教材支援|読む支援|選択語/);
  assert.equal(CSS.highlights.has('parari-dictionary-editor'), false);
  assert.equal(attrs, savedAttrs, 'Downgrading preserves saved attributes');
  assert.deepEqual(textChanges, []);
  billing = { plan: 'plus', billing_status: 'active' };
  await mount(panel('Acquire '.repeat(4000)));
  await React.act(async () => document.querySelector('[title="クリックして本文を編集"]').click());
  await click('英語教材支援 ▾');
  assert.match(document.body.textContent, /本文の確認表示/);
  assert.doesNotMatch(document.body.textContent, /選択語を辞書で確認/);
  await mount(React.createElement(Settings));
  await click('英語教材支援を有効にする');
  assert.equal(user.user_metadata.english_authoring_enabled, false);
  await mount(panel()); await edit();
  assert.doesNotMatch(document.body.textContent, /英語教材支援/);
  assert.equal(attrs, savedAttrs);
  await React.act(async () => root.unmount());
  console.log('PASS: Plus opt-in, authenticated dictionary, editor menu/lookup/highlights, cancellation, downgrade and SSOT preservation. DOM geometry and database are fixtures; no visual or live-data claim.');
  dom.window.close();
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close(); });
