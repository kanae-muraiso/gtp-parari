const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
const cheerio=require("cheerio");
function load(path,deps={}){
 const js=ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const moduleExports={};
 vm.runInNewContext(js,{
  exports:moduleExports,URL,
  Node:{ELEMENT_NODE:1,TEXT_NODE:3,COMMENT_NODE:8},
  DOMParser:class {
   parseFromString(html){
    const $=cheerio.load(html);
    const wrap=node=>{
     if(node.type==="text")return {nodeType:3,textContent:node.data??""};
     if(node.type==="comment")return {nodeType:8,textContent:node.data??""};
     const elem={
      nodeType:1,
      tagName:(node.name??"unknown").toUpperCase(),
      attributes:Object.entries(node.attribs??{}).map(([name,value])=>({name,value})),
      getAttribute:name=>node.attribs?.[name]??null,
      get childNodes(){return (node.children??[]).map(wrap);},
      get children(){return (node.children??[]).filter(x=>x.type==="tag").map(wrap);},
      querySelectorAll:selector=>{
       const results=[];
       const tags=selector.split(",").map(x=>x.trim().toLowerCase());
       const search=n=>{for(const child of n.children??[]){
        if(tags.includes(child.name))results.push(wrap(child));
        search(child);
       }};
       search(node);return results;
      },
      querySelector:selector=>elem.querySelectorAll(selector)[0]??null,
     };
     return elem;
    };
    return {
     head:{childNodes:($( "head" ).get(0)?.children??[]).map(wrap)},
     body:{childNodes:($( "body" ).get(0)?.children??[]).map(wrap)},
     querySelector:()=>null,
    };
   }
  },
  require:id=>{if(id in deps)return deps[id];throw Error("Unexpected import "+id);}
 },{filename:path});
 return moduleExports;
}
const safe=load("src/lib/parari/security/safeParariUrl.ts");
const mockSecurity={MARKDOWN_LIMITS:{maxSourceChars:300000,maxTableRows:1000,maxTableColumns:40}};
const convert=load("src/lib/parari/markdown/htmlToSafeMarkdown.ts",{
 "@/lib/parari/security/safeParariUrl":safe,
 "@/components/parari/panels/markdown/markdownSecurity":mockSecurity
}).htmlToSafeMarkdown;
const valid=convert('<h2>旅の記録</h2><p>京都を <strong>散歩</strong> しました。</p><table><tr><th>項目</th><th>内容</th></tr><tr><td>A</td><td>B</td></tr></table>');
assert.equal(valid.ok,true,JSON.stringify(valid));
assert.match(valid.markdown,/## 旅の記録/);
assert.match(valid.markdown,/\*\*散歩\*\*/);
assert.match(valid.markdown,/\| 項目 \| 内容 \|/);
for(const bad of [
 '<script>alert(1)</script><p>本文</p>',
 '<iframe src="https://example.com"></iframe>',
 '<svg onload="alert(1)"></svg>',
 '<a href="javascript:alert(1)">リンク</a>',
 '<img src="data:image/svg+xml,evil">',
 '<form><input name="password"></form>',
 '<pre><code>some JS</code></pre>',
 '<table><tr><td colspan="2">bad</td><td>x</td></tr></table>',
 '<unknown>unexpected</unknown>',
]){
 const result=convert(bad);
 assert.equal(result.ok,false,bad+" -> "+JSON.stringify(result));
}
console.log("Inert HTML conversion tests passed");
