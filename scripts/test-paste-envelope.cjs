const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
const p="src/lib/parari/markdown/identifyPasteEnvelope.ts";
const output=ts.transpileModule(fs.readFileSync(p,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleExports={};vm.runInNewContext(output,{exports:moduleExports},{filename:p});
const identify=moduleExports.identifyPasteEnvelope;
for(const [input,kind,body] of [
 ["普通の文字列","text","普通の文字列"],
 ["## 見出し\n\n|A|B|","text","## 見出し\n\n|A|B|"],
 ["<h2>あいさつ</h2>","text","<h2>あいさつ</h2>"],
 ["[markdown]\n## 見出し\n[/markdown]","markdown","## 見出し"],
 ["[MARKDOWN]\r\n## 見出し\r\n[/MARKDOWN]","markdown","## 見出し"],
 ["[html]\n<p>文章</p>\n[/html]","html","<p>文章</p>"],
 ["[html]\n<p>文章</p>\n[/html]\n","html","<p>文章</p>"],
 ["[markdown]本文[/markdown]","text","[markdown]本文[/markdown]"],
 ["[markdown]\n途中\n[/html]","text","[markdown]\n途中\n[/html]"],
 ["前置き\n[html]\n<p>本文</p>\n[/html]","text","前置き\n[html]\n<p>本文</p>\n[/html]"],
 ["[markdown]\n[html]\n<p>x</p>\n[/html]\n[/markdown]","text","[markdown]\n[html]\n<p>x</p>\n[/html]\n[/markdown]"],
 ["[javascript]\nalert(1)\n[/javascript]","text","[javascript]\nalert(1)\n[/javascript]"],
]){
 const result=identify(input);
 assert.equal(result.kind,kind);
 assert.equal(result.body,body);
}
console.log("Explicit paste envelope tests passed");
