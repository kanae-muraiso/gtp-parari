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


// scripts/test-epub-rich-text.cjs
// 2026-10-30 JST
// PART: Real EPUB package, rich notation, footnote targets and source preservation.
const {JSDOM} = require('jsdom');
const JSZip = require('jszip');
const {buildEpubModel} = require('../src/lib/parari/epub/buildEpubModel.ts');
const {buildEpub} = require('../src/lib/parari/epub/buildEpub.ts');
const {renderEpubInlines, renderEpubText} = require('../src/lib/parari/epub/renderEpubText.ts');
const source = `[BOOK]
title: PARARI 本文表現の確認
subtitle: 見出し・ルビ・リンク・引用・脚注
author: PARARI 検証用
cover: false
titlePage: true
toc: true

[PAGE] 第一のPAGE
[T]
## 見出しの確認

通常の本文です。**太字**、*斜体*、***太字と斜体***、!!red|赤色の強調!!、!!blue+italic|青色と斜体!!を確認します。
一度の改行は、段落内の改行です。

### 小見出しの確認

[[漢字|かんじ]]と[[東京|とうきょう]]のルビを確認します。

[[PARARI]](https://www.parari.app/)へのリンクと、[[この語句]]{本文の語句に付けた注釈です。脚注から本文へ戻れます。}を確認します。

> これは引用の一行目です。
> 引用の二行目です。**引用内の太字**も確認します。
引用の後に続く通常本文です。

[TABLE]
caption: 表も引き続き出力できます
header: true
|項目|内容|
|確認|表の本文|
[/TABLE]

[T]
別のTEXTパネルの[[注釈]]{二つ目の注釈です。番号は同じPAGE内で続きます。}

[PAGE] 第二のPAGE
[T]
ここから次のPAGEです。改ページを確認します。

[[このPAGEの注釈]]{このPAGEでは注番号が1から始まります。}
`;
const context = () => ({notes:[], warnings:[]});
async function main() {
  const before = source;
  const result = await buildEpub(buildEpubModel(source));
  assert.equal(source, before);
  assert.deepEqual(result.warnings, []);
  const bytes = Buffer.from(await result.blob.arrayBuffer());
  const zip = await JSZip.loadAsync(bytes);
  const docs = new Map();
  for (const name of Object.keys(zip.files).filter(n=>n.endsWith('.xhtml'))) {
    docs.set(name, new JSDOM(await zip.file(name).async('string'), {contentType:'application/xhtml+xml'}).window.document);
  }
  const first = docs.get('EPUB/text/0001.xhtml');
  assert.equal(first.querySelector('h2 + h2')?.textContent, '見出しの確認');
  assert.equal(first.querySelector('h3').textContent, '小見出しの確認');
  assert.equal(first.querySelectorAll('ruby').length, 2);
  assert.equal(first.querySelector('ruby rt').textContent, 'かんじ');
  assert.ok([...first.querySelectorAll('strong')].some(e=>e.textContent==='赤色の強調'));
  assert.ok([...first.querySelectorAll('strong em')].some(e=>e.textContent==='太字と斜体'));
  assert.ok(first.querySelector('blockquote strong'));
  assert.ok(!first.querySelector('blockquote').textContent.includes('引用の後'));
  assert.equal(first.querySelectorAll('aside').length, 2);
  assert.equal(first.querySelectorAll('table').length, 1);
  assert.equal(docs.get('EPUB/text/0002.xhtml').querySelectorAll('aside').length, 1);
  for (const [name, doc] of docs) {
    const ids = [...doc.querySelectorAll('[id]')].map(n=>n.id);
    assert.equal(ids.length,new Set(ids).size, `duplicate ID in ${name}`);
    for(const anchor of doc.querySelectorAll('a[href]')) {
      const href=anchor.getAttribute('href');
      if(/^https?:|mailto:/.test(href)) continue;
      const [file,fragment]=href.split('#');
      const target=path.posix.normalize(path.posix.join(path.posix.dirname(name),file||path.posix.basename(name)));
      assert.ok(zip.file(target), `missing file ${target}`);
      if(fragment) assert.ok(docs.get(target)?.getElementById(fragment), `missing ${href}`);
    }
    for(const note of doc.querySelectorAll('aside')) {
      assert.equal(note.getAttributeNS('http://www.idpf.org/2007/ops','type'),'footnote');
      assert.ok(doc.querySelector(`a[href="#${note.id}"]`));
    }
  }
  const css=await zip.file('EPUB/styles/book.css').async('string');
  assert.match(css,/page-break-before: always/);
  const c=context();
  const evil=renderEpubInlines('<script>alert(1)</script> [[危険]](javascript:alert) [[危険2|data:text/html,x]]',c);
  const safeDoc=new JSDOM(`<div>${evil}</div>`).window.document;
  assert.equal(safeDoc.querySelector('script,a'),null);
  assert.equal(c.warnings.length,1);
  assert.ok(safeDoc.body.textContent.includes('<script>'));
  for(const token of ['[[表示]](https://example.com/?a=1&b=2)','[[https://example.com|表示]]','[[表示|https://example.com]]','⟦lk:https://example.com|表示⟧','[表示](https://example.com)','[[メール]](mailto:someone@example.com)','[[サイト内]](/my/works)']) {
    const doc=new JSDOM(`<div>${renderEpubInlines(token,context())}</div>`).window.document;
    assert.ok(doc.querySelector('a'), token);
    assert.ok(!doc.querySelector('ruby'), token);
  }
  assert.equal(renderEpubInlines('未完の **記号と[[記号',context()),'未完の **記号と[[記号');
  assert.match(renderEpubText('#旧見出し#\n\n##旧小見出し##',context()),/<h2>旧見出し<\/h2>\n<h3>旧小見出し<\/h3>/);
  assert.match(renderEpubText('左\n右\n\n次',context()),/<p>左<br\/>右<\/p>\n<p>次<\/p>/);
  const sample=process.argv.indexOf('--sample');
  if(sample>=0) fs.writeFileSync(process.argv[sample+1],bytes);
  console.log('PASS: rich EPUB headings, ruby, emphasis, quotes, safe links, notes/backlinks across panels and PAGEs, table regression and page breaks.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
