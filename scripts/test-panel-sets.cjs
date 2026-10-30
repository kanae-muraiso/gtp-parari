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


// scripts/test-panel-sets.cjs
// 2026-10-30 JST
// PART: Saved preferences, non-destructive switching, editor choices and EPUB policy.
process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-only';
const {JSDOM}=require('jsdom');
const JSZip=require('jszip');
const {readPanelSet,writePanelSet,panelInSet,inspectPanelIssues}=require('../src/lib/parari/authoring/panelSets.ts');
const {parseBookSettings,updateBookSettings}=require('../src/lib/parari/book/pageRefs.ts');
const {buildEpubModel}=require('../src/lib/parari/epub/buildEpubModel.ts');
const {buildEpub}=require('../src/lib/parari/epub/buildEpub.ts');
const {PagePanelComposer}=require('../src/components/parari/mvp/PagePanelComposer.tsx');
const source='[PAGE] 原稿\n[T]\n本文\n[VIDEO] https://example.com/video\n[TITLE] 動画\n[T]\n末尾';
const kindle=writePanelSet(source,'kindle');
assert.equal(readPanelSet(source),'standard');
assert.equal(readPanelSet(kindle),'kindle');
assert.equal(kindle.replace('authoringSet: kindle\n',''),source);
assert.equal(writePanelSet(kindle,'standard').replace('authoringSet: standard\n',''),source);
assert.ok(panelInSet('VIDEO','standard'));
assert.ok(!panelInSet('VIDEO','kindle'));
assert.ok(panelInSet('TABLE','kindle'));
const book=writePanelSet('[BOOK]\ntitle: BOOK\n[PAGE_REF id=x]','kindle');
const settings=parseBookSettings(book);
assert.equal(settings.authoringSet,'kindle');
assert.equal(readPanelSet(updateBookSettings(book,{...settings,subtitle:'更新'})),'kindle');
assert.equal(inspectPanelIssues(kindle)[0].blocking,false);
assert.equal(inspectPanelIssues(source+'\n[CUSTOM] 未対応')[1].blocking,true);
const sample=`[BOOK]
title: パネル変換の確認
cover: false
titlePage: false
toc: false
[PAGE] パネルの出力
[NOTICE] 補足
本文の**強調**です。
[T]
通常本文
[LIST] 持ち物
[ITEM]
鉛筆
[ITEM]
ノート
[ACCORDION] 詳細
開いていなくても本文に出ます。
[BUTTON] PARARI | https://www.parari.app/
[LINKS]
公式サイト | https://www.parari.app/
[VIDEO] https://example.com/movie
[TITLE] 動画を見る
[AUDIO] https://example.com/audio
[TRANSCRIPT] 音声の書き起こしです。
[YOUTUBE] https://www.youtube.com/watch?v=test
[INSTAGRAM] https://www.instagram.com/p/test/
`;
async function main(){
 const model=buildEpubModel(sample);
 assert.equal(model.issues.filter(i=>i.blocking).length,0);
 const result=await buildEpub(model);
 assert.ok(result.warnings.length>=8);
 const bytes=Buffer.from(await result.blob.arrayBuffer());
 const zip=await JSZip.loadAsync(bytes);
 const doc=new JSDOM(await zip.file('EPUB/text/0001.xhtml').async('string'),{contentType:'application/xhtml+xml'}).window.document;
 assert.equal(doc.querySelectorAll('aside').length,2);
 assert.equal(doc.querySelectorAll('li').length,2);
 assert.equal(doc.querySelectorAll('video,audio,iframe').length,0);
 assert.ok(doc.body.textContent.includes('音声の書き起こし'));
 assert.ok(doc.body.textContent.includes('開いていなくても'));
 assert.ok(!doc.body.textContent.includes('[ACCORDION]'));
 await assert.rejects(()=>buildEpub(buildEpubModel(sample+'\n[FORM] 申込')),/変換できない/);
 const sampleArg=process.argv.indexOf('--sample');
 if(sampleArg>=0)fs.writeFileSync(process.argv[sampleArg+1],bytes);
 const dom=new JSDOM('<div id="root"></div>',{url:'https://editor.test/'});
 for(const k of ['window','document','HTMLElement','HTMLSelectElement','Event','MouseEvent'])global[k]=dom.window[k];
 global.IS_REACT_ACT_ENVIRONMENT=true;
 const {createRoot}=require('react-dom/client');
 let saved=source;
 function Harness(){const [value,setValue]=React.useState(saved);return React.createElement(PagePanelComposer,{value,onChange:next=>{saved=next;setValue(next);}});}
 const root=createRoot(document.getElementById('root'));
 await React.act(async()=>root.render(React.createElement(Harness)));
 const select=document.querySelector('[aria-label="パネルセット"]');
 await React.act(async()=>{select.value='kindle';select.dispatchEvent(new Event('change',{bubbles:true}));});
 assert.equal(readPanelSet(saved),'kindle');
 assert.ok(saved.includes('[VIDEO] https://example.com/video'));
 assert.ok(document.body.textContent.includes('外部リンクとして出力'));
 const plus=document.querySelector('[aria-label="パネルを追加"]');
 await React.act(async()=>plus.click());
 assert.ok(![...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='メディア ▾'));
 const panels=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='パネル ▾');
 await React.act(async()=>panels.click());
 assert.ok([...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='表'));
 assert.ok(![...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='QA'));
 await React.act(async()=>root.unmount());dom.window.close();
 console.log('PASS: panel sets, non-destructive SSOT, BOOK persistence, actual editor choices, static alternatives and blocked export.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
