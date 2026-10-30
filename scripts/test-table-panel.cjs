// 2026-10-07 20:15 JST
// PART: Compatibility, shared rendering and reading-progress regression checks
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return originalResolve.call(this, name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : name, ...args);
};
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
}

// scripts/test-table-panel.cjs
// 2026-10-30 JST
// PART: TABLE round-trip, React editing, reader and real EPUB output.
const {JSDOM} = require('jsdom');
const {parseTablePanel, serializeTablePanel, createTablePanel} = require('../src/components/parari/panels/table/tableSsot.ts');
const {parseBlocks} = require('../src/lib/parari/ssot-v2/parseBlocks.ts');
const {serializeBlocks} = require('../src/lib/parari/ssot-v2/serializeBlocks.ts');
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-only';
const {TablePanelEditor} = require('../src/components/parari/panels/table/TablePanelEditor.tsx');
const {TablePanelRenderer} = require('../src/components/parari/panels/table/TablePanelRenderer.tsx');
const {buildEpubModel} = require('../src/lib/parari/epub/buildEpubModel.ts');
const {buildEpub} = require('../src/lib/parari/epub/buildEpub.ts');
const JSZip = require('jszip');
const fixture = { caption: '比較表 & <タイトル>', header: true, rows: [['項目', '内容'], ['空白と記号', '  a|b\\c\n[PAGE] 偽のページ\n[/TABLE]\n<script>x</script>  '], ['', '日本語']] };
const raw = serializeTablePanel(fixture);
assert.deepEqual(parseTablePanel(raw), fixture);
const ssot = `[BOOK]\ntitle: 表の確認\ncover: false\ntitlePage: false\ntoc: false\n\n[PAGE] 表のPAGE\n[T]\n表の前\n${raw}\n[T]\n表の後`;
const blocks = parseBlocks(ssot);
assert.equal(blocks.filter(b=>b.tag==='TABLE').length, 1);
assert.equal(blocks.filter(b=>b.tag==='PAGE').length, 1);
assert.deepEqual(parseTablePanel(parseBlocks(serializeBlocks(blocks)).find(b=>b.tag==='TABLE').raw), fixture);
const html = renderToStaticMarkup(React.createElement(TablePanelRenderer, {data:fixture}));
const doc = new JSDOM(html).window.document;
assert.equal(doc.querySelectorAll('th[scope="col"]').length, 2);
assert.equal(doc.querySelectorAll('td')[1].textContent, fixture.rows[1][1]);
assert.equal(doc.querySelector('script'), null);
assert.equal(doc.querySelector('caption').textContent, fixture.caption);

const {ReaderBodyPanelRenderer} = require('../src/components/parari/reader/ReaderBodyPanelRenderer.tsx');
async function main() {
  const model = buildEpubModel(ssot);
  assert.equal(model.items.length, 1);
  assert.deepEqual(model.items[0].blocks.find(b=>b.type==='table'), {type:'table', ...fixture});
  const epub = await buildEpub(model);
  const bytes = Buffer.from(await epub.blob.arrayBuffer());
  const zip = await JSZip.loadAsync(bytes);
  const xhtml = await zip.file('EPUB/text/0001.xhtml').async('string');
  const xml = new JSDOM(xhtml, {contentType:'application/xhtml+xml'}).window.document;
  assert.equal(xml.querySelectorAll('th[scope="col"]').length, 2);
  assert.equal(xml.querySelectorAll('td').length, 4);
  assert.equal(xml.querySelector('script'), null);
  assert.ok(xml.body.textContent.includes('表の前') && xml.body.textContent.includes('表の後'));
  const sample = process.argv.indexOf('--sample');
  if(sample >= 0) fs.writeFileSync(process.argv[sample + 1], bytes);
  const dom = new JSDOM('<div id="root"></div>', {url:'https://table.test/'});
  for(const k of ['window','document','HTMLElement','Event','MouseEvent','HTMLTextAreaElement']) global[k] = dom.window[k];
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const {createRoot} = require('react-dom/client');
  let saved = createTablePanel();
  function Harness() {
    const [value,setValue] = React.useState(saved);
    return React.createElement(TablePanelEditor, {data:parseTablePanel(value), onChangeRaw: next=>{saved=next;setValue(next);}});
  }
  const view = createRoot(document.getElementById('root'));
  await React.act(async()=>view.render(React.createElement(Harness)));
  const click = async label => {const button=[...document.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(button);await React.act(async()=>button.click());};
  const cell = document.querySelector('[aria-label="2行2列"]');
  await React.act(async()=>cell.focus());
  await React.act(async()=>{
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(cell,'本文\n二行目 | \\');
    cell.dispatchEvent(new Event('input',{bubbles:true}));
  });
  assert.equal(parseTablePanel(saved).rows[1][1], '本文\n二行目 | \\');
  await click('下に行を追加');
  assert.deepEqual(parseTablePanel(saved).rows[2], ['', '']);
  await click('右に列を追加');
  assert.equal(parseTablePanel(saved).rows[0].length, 3);
  window.confirm=()=>false;
  await click('選択行を削除');
  assert.equal(parseTablePanel(saved).rows.length, 4);
  window.confirm=()=>true;
  await click('選択行を削除');
  assert.equal(parseTablePanel(saved).rows.length, 3);
  await click('選択列を削除');
  assert.equal(parseTablePanel(saved).rows[0].length, 2);
  await React.act(async()=>document.querySelector('input[type="checkbox"]').click());
  assert.equal(parseTablePanel(saved).header, false);
  await React.act(async()=>view.unmount());
  assert.deepEqual(parseTablePanel(serializeTablePanel(parseTablePanel(saved))), parseTablePanel(saved));

  const reader = renderToStaticMarkup(React.createElement(ReaderBodyPanelRenderer, {bodySsot:raw, renderTextBlock:()=>null}));
  assert.equal(new JSDOM(reader).window.document.querySelectorAll('table').length, 1);
  const {PagePanelComposer} = require('../src/components/parari/mvp/PagePanelComposer.tsx');
  const composer = createRoot(document.getElementById('root'));
  function ComposerHarness() {
    const [value,setValue] = React.useState(createTablePanel());
    return React.createElement(PagePanelComposer, {value, onChange:next=>{saved=next;setValue(next);}});
  }
  await React.act(async()=>composer.render(React.createElement(ComposerHarness)));
  const directCell = document.querySelector('[aria-label="1行1列"]');
  assert.ok(directCell, 'TABLE opens directly in editing mode');
  for (const value of ['a', 'ab', 'abc']) {
    await React.act(async()=>{
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(directCell,value);
      directCell.dispatchEvent(new Event('input',{bubbles:true}));
    });
  }
  assert.equal(parseTablePanel(parseBlocks(saved).find(b=>b.tag==='TABLE').raw).rows[0][0], 'abc');
  assert.equal(document.querySelector('[aria-label="1行1列"]'), directCell, 'typing retains the same cell DOM');
  await React.act(async()=>composer.unmount());
  dom.window.close();
  console.log('TABLE: SSOT round-trip, editing, delete cancellation, semantic display and EPUB passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
