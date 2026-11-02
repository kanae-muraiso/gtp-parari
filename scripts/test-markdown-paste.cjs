const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync("src/lib/parari/markdown/parseMarkdownForParari.ts", "utf8");
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleExports = {};
const serializeTablePanel = data => JSON.stringify(data);
vm.runInNewContext(compiled, {exports:moduleExports,require: name => {
  if (name.includes("tableSsot")) return {serializeTablePanel};
  throw new Error("Unexpected import: "+name);
}}, {filename:"parseMarkdownForParari.js"});
const parse = moduleExports.parseMarkdownForParari;
assert.equal(typeof parse,"function");
const sample = ["# 旅の日記","","**太字**と[参考](https://example.com)","","| 日付 | 場所 |","| --- | --- |","| 11/1 | ウブド |","| 11/2 | ヌサドゥア |","","- 散歩","- 食事"].join("\n");
const parts = parse(sample);
assert.deepEqual(Array.from(parts, p=>p.kind), ["text","table","text"]);
assert.match(parts[0].ssot,/## 旅の日記/);
assert.match(parts[0].ssot,/\*\*太字\*\*/);
assert.match(parts[0].ssot,/\[\[参考\]\]\(https:\/\/example.com\)/);
const table = JSON.parse(parts[1].ssot);
assert.equal(table.header,true);
assert.deepEqual(Array.from(table.rows, row=>Array.from(row)), [["日付","場所"],["11/1","ウブド"],["11/2","ヌサドゥア"]]);
assert.match(parts[2].ssot,/・散歩/);
assert.equal(parse("普通の文章")[0].ssot,"普通の文章");
assert.equal(parse("```md\n| a | b |\n|---|---|\n```").some(p=>p.kind==="table"),false);
assert.equal(parse("| A | B |\n|---|---|\n| X | Y |").length,1);
console.log("Markdown conversion behavior tests passed");