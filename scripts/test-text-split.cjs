const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
const vm=require("node:vm");
const path="src/lib/parari/markdown/splitTextAtMarker.ts";
const output=ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};vm.runInNewContext(output,{exports},{filename:path});
const split=exports.splitTextAtMarker;
const MARKER="PARARI_INSERT_MARKER_TEST_1234567";
for(const [left,right] of [
 ["左側の文章","右側の文章"],
 ["## 見出し\n\n本文","追加する内容"],
 ["太字**途中","の文章**とリンク[公式](https://example.com)"],
 ["改行前\n","改行後\n\n次の段落"],
 ["日本語😀絵文字","🏝️と半角 abc"],
 ["abc  ","  def"],
 ["[BUTTON] 原文にあるテキスト","内部タグっぽい文章"],
 ["Lorem ipsum ".repeat(4000),"dolor sit ".repeat(3000)],
]){
 const marked=left+MARKER+right;
 const result=split(marked,MARKER);
 assert.equal(result.ok,true,JSON.stringify({left:left.slice(0,20),right:right.slice(0,20),reason:result.reason}));
 assert.equal(result.before,left);
 assert.equal(result.after,right);
 assert.equal(result.rejoined,left+right);
}
for(const input of [
 ["marker not found",MARKER],
 [MARKER+"B"+MARKER,MARKER],
 [MARKER+"終端",MARKER],
 ["先頭"+MARKER,MARKER],
 ["先頭"+MARKER+"末尾","x"],
]){
 const result=split(...input);
 assert.equal(result.ok,false,JSON.stringify(input));
}
assert.equal(split("文字"+MARKER+"文字","x").ok,false);
console.log("TEXT split lossless tests passed");
