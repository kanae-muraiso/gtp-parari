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
// Fixture grades cover the full palette, lower grades and a registered word without a grade.
const extraRows = [['apex', '1'], ['advanced', 'pre1'], ['ready', 'pre2'], ['simple', '3'], ['easy', '4'], ['basic', '5'], ['unrated', null]].map(([word, level]) => ({ ...row, word, normalized_word: word, lemma: word, eiken_level: level, eiken_levels: level ? [level] : [] }));
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
        let data = table === 'user_billing' ? billing : table === 'profiles' ? { is_monitor: monitor } : [row, ...extraRows].filter(r => filters.every(([key, value]) => Array.isArray(value) ? value.includes(r[key]) : r[key] === value));
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
  assert.ok(['/api/english/authoring', '/api/english/dictionary'].includes(url));
  if (options.method === 'POST' && pendingLookup) await pendingLookup;
  const req = new Request(`https://editor.test${url}`, options);
  if (url === '/api/english/dictionary') return publicRoute.POST(req);
  return options.method === 'POST' ? route.POST(req) : route.GET(req);
};

const React = require('react');
const { createRoot } = require('react-dom/client');
const { $getRoot } = require('lexical');
const { EnglishAuthoringProvider } = require('../src/components/parari/english/EnglishAuthoringProvider.tsx');
const Settings = require('../src/components/parari/settings/EnglishAuthoringSettings.tsx').default;
const { RichTextPanelEditor } = require('../src/components/parari/panels/richText/RichTextPanelEditor.tsx');
const { ViewerTextBlock } = require('../src/components/parari/viewer-v2/ViewerTextBlock.tsx');
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
async function clickEditorWord(word, offset = 1) {
  const editor = await focusEditor();
  await React.act(async () => editor.update(() => {
    const node = $getRoot().getAllTextNodes().find(node => node.getTextContent().includes(word));
    const index = node.getTextContent().indexOf(word) + offset;
    node.select(index, index);
  }, { discrete: true }));
  const selection = window.getSelection();
  const node = selection.anchorNode;
  const caret = selection.anchorOffset;
  await React.act(async () => node.parentElement.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await settle();
  assert.equal(window.getSelection().anchorNode, node, 'Dictionary click keeps the caret in the same text node');
  assert.equal(window.getSelection().anchorOffset, caret, 'Dictionary click does not move the caret');
}
function assertMarks() {
  const known = CSS.highlights.get('parari-dictionary-known');
  const missing = CSS.highlights.get('parari-dictionary-missing');
  assert.deepEqual(known?.ranges.map(range => range.toString()), ['Acquire']);
  assert.deepEqual(missing?.ranges.map(range => range.toString()), ['unknown']);
  const style = document.querySelector('style').textContent;
  assert.match(style, /parari-dictionary-known[\s\S]*?underline dotted #a3a3a3/);
  assert.match(style, /parari-dictionary-missing[\s\S]*?background-color: #fecaca/);
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
  await clickEditorWord('Acquire');
  assert.equal(document.querySelector('[aria-label="辞書の確認結果"]'), null);
  assert.equal(document.querySelector('button[aria-label="英語教材支援"]'), null, 'FREE cannot access the header menu');
  assert.doesNotMatch(document.body.textContent, /英語教材支援|読む支援|選択語/);
  billing = { plan: 'plus', billing_status: 'active' };
  user.user_metadata = { display_name: 'Keep me' };
  await mount(panel()); await edit();
  assert.equal(document.querySelector('button[aria-label="英語教材支援"]'), null, 'Opt-in is still required');
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

  const paletteText = 'Apex Advanced Acquire Ready Simple Easy Basic Unrated unknown.';
  const palette = [
    ['Apex', '1', 'rgb(251, 146, 60)', '#fb923c'],
    ['Advanced', 'pre1', 'rgb(253, 186, 116)', '#fdba74'],
    ['Acquire', '2', 'rgb(252, 211, 77)', '#fcd34d'],
    ['Ready', 'pre2', 'rgb(254, 240, 138)', '#fef08a'],
  ];
  await mount(panel(paletteText));
  assert.equal(document.body.textContent, paletteText, 'Legacy notes and grade labels must not lengthen the body');
  for (const [word, , background] of palette) assert.equal(button(word).style.backgroundColor, background);
  for (const word of ['Simple', 'Easy', 'Basic']) assert.equal(button(word).style.backgroundColor, 'rgb(220, 252, 231)', 'Grades 3–5 share one background');
  assert.equal(button('Unrated').style.backgroundColor, '');
  assert.ok(button('unknown').classList.contains('bg-red-200'));
  assert.equal(button('unknown').classList.contains('underline'), false);
  assert.equal(button('Apex').title, '英検1級', 'Grade remains available without relying on color alone');
  await edit(); await settle(300);
  for (const [word, grade, , hex] of palette) {
    assert.deepEqual(CSS.highlights.get(`parari-eiken-${grade}`)?.ranges.map(range => range.toString()), [word]);
    assert.ok(document.querySelector('style').textContent.includes(`::highlight(parari-eiken-${grade}) { background-color: ${hex}; }`));
  }
  assert.deepEqual(CSS.highlights.get('parari-eiken-basic')?.ranges.map(range => range.toString()), ['Simple', 'Easy', 'Basic']);
  assert.equal(CSS.highlights.size, 7, 'Five grade backgrounds plus registered/missing marks');
  await clickEditorWord('Apex');
  assert.match(document.querySelector('[aria-label="辞書の確認結果"]').textContent, /英検1級/);
  await click('辞書確認を閉じる');
  const headerTrigger = button('英語教材支援');
  assert.equal(headerTrigger.textContent.trim(), '…');
  assert.ok(button('完了').parentElement.contains(headerTrigger), 'English support belongs beside 完了');
  await React.act(async () => document.querySelector('[contenteditable]').blur());
  assert.ok(button('英語教材支援'), 'Header menu remains accessible after the editor loses focus');
  await click('英語教材支援');
  await React.act(async () => headerTrigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(document.querySelector('[aria-label="英語教材支援の設定"]'), null);
  assert.equal(document.activeElement, headerTrigger, 'Escape returns focus to the menu trigger');
  await click('英語教材支援');
  await React.act(async () => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
  assert.equal(headerTrigger.getAttribute('aria-expanded'), 'false', 'Outside click closes the header menu');
  await click('英語教材支援');
  assert.doesNotMatch(document.body.textContent, /語注|英検級を表示/);
  assert.equal(document.querySelector('select'), null, 'No annotation threshold selector');
  assert.ok(document.querySelector('[aria-label="英検級の色分け凡例"]'));
  await click('英検級で色分け'); await settle(300);
  assert.equal([...CSS.highlights.keys()].some(name => name.startsWith('parari-eiken-')), false);
  assert.ok(CSS.highlights.has('parari-dictionary-missing'), 'Turning colors off keeps missing-word marks');
  await click('英検級で色分け'); await settle(300);
  assert.equal([...CSS.highlights.keys()].filter(name => name.startsWith('parari-eiken-')).length, 5);
  assert.match(attrs, /notes:on noteFrom:3/, 'Retired annotation attributes remain intact');
  await click('完了');
  assert.equal(document.body.textContent, paletteText, 'Completing editing adds no translations or grade labels');
  for (const [word, , background] of palette) assert.equal(button(word).style.backgroundColor, background);
  assert.deepEqual(textChanges, [], 'Display toggles never rewrite the text');

  await mount(panel());
  assert.equal(document.body.textContent, 'Acquire unknown.');
  assert.ok(button('Acquire').classList.contains('decoration-neutral-400'));
  assert.ok(button('unknown').classList.contains('bg-red-200'));
  await click('unknown');
  assert.match(document.body.textContent, /登録されていません/);
  await click('unknown');
  await click('Acquire');
  assert.equal(document.querySelector('[contenteditable]'), null, 'Dictionary popup should not switch into editing');
  await edit();
  assert.equal([...document.querySelectorAll('button')].filter(b => b.getAttribute('aria-label') === '英語教材支援').length, 1);
  assert.equal(document.querySelector('[aria-label="TEXTの設定"]'), null, 'No second reading-support menu');
  await settle(300);
  assertMarks();
  await clickEditorWord('Acquire', 7);
  assert.match(document.querySelector('[aria-label="辞書の確認結果"]').textContent, /獲得する/);
  assert.match(document.querySelector('[aria-label="辞書の確認結果"]').textContent, /英検2級/);
  assert.ok(document.querySelector('[aria-label="辞書の確認結果"]').classList.contains('fixed'), 'Lookup remains visible when body is scrolled');
  await React.act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(document.querySelector('[aria-label="辞書の確認結果"]'), null);
  await clickEditorWord('unknown');
  assert.match(document.querySelector('[aria-label="辞書の確認結果"]').textContent, /登録されていません/);
  await React.act(async () => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
  assert.equal(document.querySelector('[aria-label="辞書の確認結果"]'), null);

  await chooseWord('Acquire');
  const selectedWord = window.getSelection().toString();
  await React.act(async () => button('英語教材支援').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
  await click('英語教材支援');
  assert.equal(window.getSelection().toString(), selectedWord, 'Opening the header menu preserves the selected word');
  await click('選択語を辞書で確認');
  assert.match(document.body.textContent, /獲得する/);
  assert.match(document.body.textContent, /英検2級/);
  await click('辞書確認を閉じる');
  await chooseWord('unknown'); await click('英語教材支援'); await click('選択語を辞書で確認');
  assert.match(document.body.textContent, /登録されていません/);
  failTable = 'parari_english_dictionary';
  await chooseWord('Acquire'); await click('英語教材支援'); await click('選択語を辞書で確認');
  assert.match(document.body.textContent, /辞書を取得できません/);
  assert.doesNotMatch(document.body.textContent, /登録されていません/);
  failTable = '';
  let finish;
  pendingLookup = new Promise(resolve => { finish = resolve; });
  await click('英語教材支援'); await click('選択語を辞書で確認');
  await click('辞書確認を閉じる');
  await React.act(async () => { finish(); });
  pendingLookup = null;
  await settle();
  assert.equal(document.querySelector('[aria-label="辞書確認を閉じる"]'), null, 'Closing cancels stale lookup result');

  await click('英語教材支援'); await click('辞書の目印を表示（編集中）');
  await settle(300);
  assert.equal(CSS.highlights.has('parari-dictionary-known'), false);
  assert.equal(CSS.highlights.has('parari-dictionary-missing'), false);
  assert.deepEqual(CSS.highlights.get('parari-eiken-2')?.ranges.map(range => range.toString()), ['Acquire'], 'Colors work independently of underlines');
  failTable = 'parari_english_dictionary';
  await click('辞書の目印を表示（編集中）'); await settle(300);
  assert.equal(CSS.highlights.has('parari-dictionary-missing'), false, 'Failed lookup must not paint words red');
  assert.equal([...CSS.highlights.keys()].some(name => name.startsWith('parari-eiken-')), false, 'Failed lookup must clear stale grade colors');
  await click('辞書の目印を表示（編集中）');
  failTable = '';
  await click('辞書の目印を表示（編集中）'); await settle(300);
  assertMarks();
  await React.act(async () => button('英検級で色分け').focus());
  await settle(150);
  assert.ok(document.querySelector('[aria-label="英語教材支援の設定"]'), 'Focusing the color toggle must keep the toolbar open');
  await click('英検級で色分け');
  assert.match(attrs, /noteFrom:3/);
  assert.match(attrs, /custom:keep/);
  assert.doesNotMatch(attrs, /eiken:on/);
  assert.deepEqual(textChanges, [], 'Dictionary and support changes never rewrite the body');
  const savedAttrs = attrs;
  billing = { plan: 'plus', billing_status: 'canceled' };
  await React.act(async () => window.dispatchEvent(new Event('focus'))); await settle();
  assert.equal(document.querySelector('button[aria-label="英語教材支援"]'), null, 'Downgrade removes the header menu');
  assert.doesNotMatch(document.body.textContent, /英語教材支援|読む支援|選択語/);
  assert.equal(CSS.highlights.has('parari-dictionary-known'), false);
  assert.equal(CSS.highlights.has('parari-dictionary-missing'), false);
  assert.equal([...CSS.highlights.keys()].some(name => name.startsWith('parari-eiken-')), false);
  assert.equal(attrs, savedAttrs, 'Downgrading preserves saved attributes');
  assert.deepEqual(textChanges, []);
  billing = { plan: 'plus', billing_status: 'active' };
  await mount(panel('Acquire '.repeat(4000)));
  await React.act(async () => document.querySelector('[title="クリックして本文を編集"]').click());
  await click('英語教材支援');
  assert.ok(button('完了').parentElement.contains(button('英語教材支援')), 'Long-text fallback uses the same header position');
  assert.match(document.body.textContent, /英検級で色分け/);
  assert.match(document.body.textContent, /色分けは「完了」後の本文で確認できます/);
  assert.doesNotMatch(document.body.textContent, /選択語を辞書で確認/);
  await mount(React.createElement(Settings));
  await click('英語教材支援を有効にする');
  assert.equal(user.user_metadata.english_authoring_enabled, false);
  await mount(panel()); await edit();
  assert.doesNotMatch(document.body.textContent, /英語教材支援/);
  assert.equal(attrs, savedAttrs);
  // Same marks in the reader; not-yet-queried and failed requests must remain unmarked.
  let releaseReader;
  pendingLookup = new Promise(resolve => { releaseReader = resolve; });
  await mount(React.createElement(ViewerTextBlock, { text: 'Acquire unknown.', dictionaryMode: 'study' }));
  assert.equal(document.querySelector('.bg-red-200'), null, 'Loading is not a missing dictionary entry');
  await React.act(async () => releaseReader()); pendingLookup = null; await settle();
  assert.ok(button('Acquire').classList.contains('decoration-neutral-400'));
  assert.ok(button('unknown').classList.contains('bg-red-200'));
  await click('Acquire'); assert.match(document.body.textContent, /獲得する/);
  await click('unknown'); assert.match(document.body.textContent, /まだ登録されていません/);
  failTable = 'parari_english_dictionary';
  await mount(React.createElement(ViewerTextBlock, { text: 'Acquire unknown.', dictionaryMode: 'study' }));
  assert.equal(document.querySelector('.bg-red-200'), null, 'Lookup failure is not a missing dictionary entry');
  failTable = '';
  await React.act(async () => root.unmount());
  console.log('PASS: Plus opt-in, authenticated dictionary, editor click/caret/lookup, five grade backgrounds, red missing backgrounds and header menu in editing and confirmation, no inline notes, shared known/missing marks, cancellation, downgrade and SSOT preservation. DOM geometry and database are fixtures; no visual or live-data claim.');
  dom.window.close();
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close(); });
