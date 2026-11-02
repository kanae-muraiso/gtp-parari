const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(path,deps={}){
 const code=ts.transpileModule(fs.readFileSync(path,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
 }).outputText;
 const output={};
 vm.runInNewContext(code,{
  exports:output,
  require:id=>{
   if(Object.prototype.hasOwnProperty.call(deps,id))return deps[id];
   throw new Error("Unexpected import: "+id);
  }
 },{filename:path});
 return output;
}
const table=load("src/components/parari/panels/table/tableSsot.ts");
const list=load("src/components/parari/panels/list/serializeListPanel.ts");
const types=load("src/lib/parari/ssot-v2/panelTypes.ts");
const parser=load("src/lib/parari/ssot-v2/parseBlocks.ts",{"./panelTypes":types});
const convert=load("src/components/parari/panels/markdown/convertMarkdownToParari.ts",{
 "@/components/parari/panels/table/tableSsot":table,
 "@/components/parari/panels/list/serializeListPanel":list
}).convertMarkdownToParari;
const source=[
 "# 旅の記録","","本文の **強調** と [参考](https://example.com)","","| 日付 | 場所 |",
 "| --- | :---: |","| 11/1 | ウブド |","| 11/2 | ヌサドゥア |","",
 "- 海辺を歩く","- 写真を撮る","","> 旅の思い出","",
 "![海岸](https://example.com/beach.png)"
].join("\n");
const result=convert(source);
assert.equal(result.ok,true,JSON.stringify(result.errors));
assert.deepEqual(Array.from(result.panels,p=>p.tag),["TEXT","TABLE","LIST","NOTICE","IMAGE"]);
const parsed=parser.parseBlocks(result.ssot);
assert.deepEqual(Array.from(parsed,b=>b.kind==="text"?"TEXT":b.tag),["TEXT","TABLE","LIST","NOTICE","IMAGE"]);
assert.match(result.panels[0].ssot,/## 旅の記録/);
assert.match(result.panels[0].ssot,/\*\*強調\*\*/);
const tableData=table.parseTablePanel(result.panels[1].ssot);
assert.deepEqual(Array.from(tableData.rows,row=>Array.from(row)),[
 ["日付","場所"],["11/1","ウブド"],["11/2","ヌサドゥア"]
]);
assert.match(result.panels[2].ssot,/\[ITEM\]\n海辺を歩く/);
assert.match(result.panels[3].ssot,/^\[NOTICE\] 引用/);
assert.match(result.panels[4].ssot,/url: https:\/\/example.com\/beach.png/);
const paragraph=convert("普通の文章\n\n続きの文章");
assert.equal(paragraph.ok,true);
assert.equal(paragraph.panels.length,1);
assert.equal(paragraph.panels[0].tag,"TEXT");
const fenced=convert("~~~js\nconsole.log('hello');\n~~~");
assert.equal(fenced.ok,false);
assert.ok(fenced.errors.length>0);
const invalid=convert("| A | B |\n| --- | --- |\n| only one |");
assert.equal(invalid.ok,false);
const tag=convert("[PAGE]\nhello");
assert.equal(tag.ok,false);
const nesting=convert("- a\n  - nested");
assert.equal(nesting.ok,false);
const escaped=convert("| column | value |\n| --- | --- |\n| a\\|b | x |");
assert.equal(escaped.ok,true);
assert.equal(table.parseTablePanel(escaped.panels[0].ssot).rows[1][0],"a|b");
assert.equal(source.includes("[TABLE]"),false,"Markdown source is not mutated");
console.log("Markdown→PARARI panel conversion tests passed");
