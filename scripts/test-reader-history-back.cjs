// Isolated unit checks of the actual TSX with mocked React hooks / Next pathname.
// No Auth, database, browser layout or full-app integration is claimed here.
// Run with: node scripts/test-reader-history-back.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/components/parari/navigation/ReaderHistoryBackButton.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness(length = 1) {
  let visible = false;
  let effect;
  let cleanup;
  let pathname = '/p/work-one';
  let backCalls = 0;
  let historyLength = length;
  let historyReads = 0;
  const listeners = new Map();
  const browser = {
    history: {
      get length() { historyReads++; return historyLength; },
      back() { backCalls++; },
    },
    addEventListener(name, handler) {
      const handlers = listeners.get(name) || new Set();
      handlers.add(handler); listeners.set(name, handlers);
    },
    removeEventListener(name, handler) { listeners.get(name)?.delete(handler); },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    // Reading the window itself during server/first render must not be needed.
    window: browser,
    require(name) {
      if (name === 'react') return {
        useState: () => [visible, value => { visible = value; }],
        useEffect: (callback, deps) => { effect = callback; assert.equal(deps[0], pathname); },
      };
      if (name === 'next/navigation') return { usePathname: () => pathname };
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  }, { filename: 'ReaderHistoryBackButton.js' });
  const Component = module.exports.default;
  return {
    render: () => Component(),
    mount: () => { cleanup = effect(); },
    unmount: () => { cleanup?.(); },
    route: value => { pathname = value; },
    setLength: value => { historyLength = value; },
    emit: name => { for (const listener of listeners.get(name) || []) listener(); },
    calls: () => backCalls,
    reads: () => historyReads,
    listenerCount: () => [...listeners.values()].reduce((n, items) => n + items.size, 0),
  };
}

let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }

check('SSR / first render is empty without accessing history', () => {
  const h = harness(2); assert.equal(h.render(), null); assert.equal(h.reads(), 0);
});
check('fresh tab with one entry stays hidden', () => {
  const h = harness(1); h.render(); h.mount(); assert.equal(h.render(), null); h.unmount();
});
check('multiple entries display a labelled native button without a referrer', () => {
  const h = harness(2); h.render(); h.mount(); const button = h.render();
  assert.equal(button.type, 'button'); assert.equal(button.props.type, 'button');
  assert.equal(button.props['aria-label'], '前の画面に戻る');
  assert.match(button.props.className, /shrink-0/);
  assert.match(button.props.className, /focus-visible/);
  button.props.onClick(); assert.equal(h.calls(), 1); h.unmount();
});
check('a stale button rechecks history before navigating', () => {
  const h = harness(2); h.render(); h.mount(); const button = h.render();
  h.setLength(1); button.props.onClick(); assert.equal(h.calls(), 0); assert.equal(h.render(), null); h.unmount();
});
check('popstate and page-cache restoration refresh visibility', () => {
  const h = harness(1); h.render(); h.mount(); h.setLength(3); h.emit('popstate');
  assert.ok(h.render()); h.setLength(1); h.emit('pageshow'); assert.equal(h.render(), null); h.unmount();
});
check('route remount refreshes state and cleans event listeners', () => {
  const h = harness(1); h.render(); h.mount(); assert.equal(h.listenerCount(), 2);
  h.unmount(); assert.equal(h.listenerCount(), 0);
  h.route('/p/work-two'); h.setLength(2); h.render(); h.mount();
  assert.ok(h.render()); assert.equal(h.listenerCount(), 2); h.unmount(); assert.equal(h.listenerCount(), 0);
});
check('forward-only history remains the documented simple heuristic', () => {
  const h = harness(2); h.render(); h.mount(); assert.ok(h.render()); h.unmount();
});
check('only the public shell opts in for reader and owner views', () => {
  const shell = fs.readFileSync(path.join(root, 'src/components/parari/PublicViewerShell.tsx'), 'utf8');
  for (const name of ['ParariOwnerTopBar', 'ParariBrandTopBar']) {
    assert.match(shell, new RegExp(`<${name}\\s+readerNavigation\\b`));
  }
  const bars = fs.readFileSync(path.join(root, 'src/components/parari/ParariTopBars.tsx'), 'utf8');
  assert.equal((bars.match(/readerNavigation = false/g) || []).length, 2);
  assert.ok(bars.includes('readerNavigation ? "flex-nowrap" : "flex-wrap"'));
});
console.log(`${checks} isolated reader-back checks passed.`);
