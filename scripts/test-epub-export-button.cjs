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


// scripts/test-epub-export-button.cjs
// 2026-10-30 JST — PART: Current editor EPUB download and save guard.
process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-only';
const {JSDOM}=require('jsdom');
const {supabase}=require('../src/lib/supabaseClient.ts');
const {EpubExportButton}=require('../src/components/parari/EpubExportButton.tsx');
async function main(){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://editor.test/'});
 for(const key of ['window','document','HTMLElement'])global[key]=dom.window[key];
 window.requestAnimationFrame=callback=>setTimeout(callback,0);
 global.IS_REACT_ACT_ENVIRONMENT=true;
 const {createRoot}=require('react-dom/client');
 const root=createRoot(document.getElementById('root'));
 let blocked='保存待ち',message='',calls=0,download='',status=200;
 supabase.auth.getSession=async()=>({data:{session:{access_token:'test-token'}}});
 global.fetch=async(url,options)=>{
  calls++;assert.equal(url,'/api/epub/export');assert.deepEqual(JSON.parse(options.body),{workId:'work-1'});
  assert.equal(options.headers.Authorization,'Bearer test-token');
  return status===200?new Response('epub',{headers:{'content-disposition':"attachment; filename*=UTF-8''sample.epub",'x-parari-epub-warnings':encodeURIComponent('動画はリンクに変換')}}):new Response(JSON.stringify({message:'PAGE 2: FORMは非対応'}),{status});
 };
 URL.createObjectURL=()=> 'blob:sample';URL.revokeObjectURL=()=>{};
 dom.window.HTMLAnchorElement.prototype.click=function(){download=this.download;};
 const render=()=>root.render(React.createElement(EpubExportButton,{workId:'work-1',title:'作品',getBlockedReason:()=>blocked,onMessage:value=>message=value}));
 await React.act(async()=>render());
 assert.equal(document.querySelector('button').disabled,true);
 blocked='';await React.act(async()=>render());
 await React.act(async()=>{document.querySelector('button').click();await new Promise(r=>setTimeout(r,30));});
 assert.equal(calls,1);assert.equal(download,'sample.epub');assert.ok(message.includes('動画はリンク'));
 status=422;download='';
 await React.act(async()=>{document.querySelector('button').click();await new Promise(r=>setTimeout(r,30));});
 assert.equal(download,'');assert.ok(message.includes('FORMは非対応'));
 // A draft committed during blur must block the export even after the click.
 await React.act(async()=>{document.querySelector('button').click();blocked='保存待ち';await new Promise(r=>setTimeout(r,30));});
 assert.equal(calls,2);assert.equal(message,'保存待ち');
 await React.act(async()=>root.unmount());dom.window.close();
 console.log('PASS: export button save guard, authenticated request, download, warnings and rejection.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
