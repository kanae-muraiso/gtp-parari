const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const ts=require("typescript");

function load(path,deps={}){
 const js=ts.transpileModule(fs.readFileSync(path,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const exports={};
 vm.runInNewContext(js,{
  exports,URL,
  require:id=>{
   if(Object.prototype.hasOwnProperty.call(deps,id))return deps[id];
   throw Error("Unexpected import: "+id);
  }
 },{filename:path});
 return exports;
}

const codec=load("src/components/parari/panels/markdown/markdownSsot.ts");
const types=load("src/lib/parari/ssot-v2/panelTypes.ts");
const parser=load("src/lib/parari/ssot-v2/parseBlocks.ts",{"./panelTypes":types});
const urls=load("src/lib/parari/security/safeParariUrl.ts");
const security=load("src/components/parari/panels/markdown/markdownSecurity.ts",{
 "@/lib/parari/ssot-v2/parseBlocks":parser,
 "@/lib/parari/security/safeParariUrl":urls
});
const table=load("src/components/parari/panels/table/tableSsot.ts");
const list=load("src/components/parari/panels/list/serializeListPanel.ts");
const convert=load("src/components/parari/panels/markdown/convertMarkdownToParari.ts",{
 "@/components/parari/panels/table/tableSsot":table,
 "@/components/parari/panels/list/serializeListPanel":list,
 "@/lib/parari/security/safeParariUrl":urls,
 "./markdownSecurity":security
}).convertMarkdownToParari;

for(const input of [
 "[BUTTON] リンク | https://example.com",
 "[GATEWAY type:paywall] start",
 "[APPLICATION id: test]",
 "[T]\nText",
 "[MARKDOWN]\nTest",
 "こちらが本文\n[/MARKDOWN]\n続き",
 "本文\n[SECRET_PANEL] unexpected",
 "Hello <script>alert(1)</script>",
 "<img src=x onerror=alert(1)>",
 "<svg/onload=alert(1)>",
 "Hi <iframe src=https://example.com>",
 "[bad](javascript:alert(1))",
 "[bad](data:text/html,hello)",
 "[bad](vbscript:msgbox(1))",
 "[bad](java&#115;cript:alert)",
 "![bad](data:image/svg+xml,boom)",
 "[fake](//other.example.com)",
 "[bad](https://user:pass@example.com)",
 "before\u0000after",
 "invisible\u202ereversed",
]){
 const result=convert(input);
 assert.equal(result.ok,false,"Must reject untrusted source: "+JSON.stringify(input));
 assert.ok(result.errors.length>0,"Must report reason: "+JSON.stringify(input));
}
assert.equal(convert("## 正常な文章\n\n[参考](https://example.com)").ok,true);
assert.equal(convert("[メール](mailto:example@example.com)").ok,true);
assert.equal(convert("[内部](/p/example)").ok,true);
assert.equal(convert("![画像](https://example.com/a.png)").ok,true);
assert.equal(convert("~~~js\nalert(1)\n~~~").ok,false);

assert.equal(urls.safeParariUrl("javascript:alert(1)"),null);
assert.equal(urls.safeParariUrl("data:text/html,hello"),null);
assert.equal(urls.safeParariUrl("blob:https://example.com/abc"),null);
assert.equal(urls.safeParariUrl("//evil.example.com"),null);
assert.equal(urls.safeParariUrl("https://user:password@example.com"),null);
assert.equal(urls.safeParariUrl("mailto:test@example.com","image"),null);
assert.ok(urls.safeParariUrl("https://example.com"));
assert.ok(urls.safeParariUrl("/p/abc"));
assert.ok(urls.safeParariUrl("mailto:test@example.com"));

const injection="[T]\n本文\n\n[BUTTON] 偽の操作 | https://example.com";
const mismatched=security.inspectConvertedParari([{tag:"TEXT",ssot:injection}],injection);
assert.ok(mismatched.length>0,"Unexpected panel must be detected after serialization");
assert.ok(security.inspectConvertedParari([{tag:"FORM",ssot:"[FORM]"}],"[FORM]").length>0);
assert.ok(security.inspectConvertedParari([{tag:"TEXT",ssot:"[T]\n許可される文章"}],"[T]\n許可される文章").length===0);

assert.equal(convert("x".repeat(300001)).ok,false,"Oversized source must fail");
assert.equal(convert(("短い行\n").repeat(10001)).ok,false,"Excessive lines must fail");
const tooMany=Array.from({length:301},()=>({tag:"TEXT",ssot:"[T]\nHi"}));
assert.ok(security.inspectConvertedParari(tooMany,tooMany.map(p=>p.ssot).join("\n\n")).length>0);

const original="## 引用されたタグ\n\nこれは文章です\n[/MARKDOWN]\n次の段落\n\n**太字**";
const serialized=codec.serializeMarkdownPanel({source:original});
assert.ok(serialized.startsWith("[MARKDOWN:json]\n"),"Escape a false closing tag");
assert.equal(codec.parseMarkdownPanel(serialized).source,original,"Markdown must roundtrip byte-for-byte except normalized CRLF");
const blocks=parser.parseBlocks(serialized);
assert.equal(blocks.length,1,"Must remain one MARKDOWN panel");
assert.equal(blocks[0].tag,"MARKDOWN");
assert.equal(blocks[0].raw.trim(),serialized.trim());
const ordinary="## バリの旅\n\n| A | B |\n| --- | --- |\n| 一 | 二 |";
const normal=codec.serializeMarkdownPanel({source:ordinary});
assert.ok(normal.startsWith("[MARKDOWN]\n"));
assert.equal(codec.parseMarkdownPanel(normal).source,ordinary);
const utf="絵文字😀\n\uD800\n[/MARKDOWN]";
assert.equal(codec.parseMarkdownPanel(codec.serializeMarkdownPanel({source:utf})).source,utf);
console.log("Markdown security and SSOT isolation tests passed");
