import {safeParariUrl} from "@/lib/parari/security/safeParariUrl";
import {MARKDOWN_LIMITS} from "@/components/parari/panels/markdown/markdownSecurity";

type HtmlResult={ok:true;markdown:string}|{ok:false;reason:string};
const ALLOWED_TAGS=new Set([
 "p","div","br","strong","b","em","i","s","del","h1","h2","h3","h4","h5","h6",
 "ul","ol","li","blockquote","pre","code","a","table","thead","tbody",
 "tfoot","tr","th","td","img","hr","span"
]);
const BLOCKED_TAGS=new Set(["script","style","iframe","object","embed","svg","math","form","input","button","audio","video","link","meta","base","template"]);
const MAX_NODES=12000;

/**
 * Parse inert HTML, reject all unsupported elements and attributes,
 * and compile only a safe Markdown subset. The HTML is never rendered.
 * The normal Markdown→PARARI security gate runs after this conversion.
 */
export function htmlToSafeMarkdown(source:string):HtmlResult{
 if(source.length>MARKDOWN_LIMITS.maxSourceChars)return {ok:false,reason:"HTMLが長すぎます。"};
 if(typeof DOMParser==="undefined")return {ok:false,reason:"この環境ではHTMLを安全に解析できません。"};
 let doc:Document;
 try{doc=new DOMParser().parseFromString(source,"text/html");}
 catch{return {ok:false,reason:"HTMLの解析に失敗しました。"};}
 if(doc.querySelector("parsererror"))return {ok:false,reason:"不正なHTMLです。"};
 let visited=0;
 const error:string[]=[];
 const escapeText=(value:string)=>value.replace(/\\/g,"\\\\").replace(/([*_~\[\]|])/g,"\\$1");
 const walk=(node:Node):string=>{
  if(error.length)return "";
  visited++;
  if(visited>MAX_NODES){error.push("HTMLの要素数が上限を超えています。");return "";}
  if(node.nodeType===Node.TEXT_NODE)return escapeText(node.textContent??"");
  if(node.nodeType===Node.COMMENT_NODE)return "";
  if(node.nodeType!==Node.ELEMENT_NODE){error.push("未対応のHTML要素が含まれています。");return "";}
  const el=node as Element;
  const tag=el.tagName.toLowerCase();
  if(BLOCKED_TAGS.has(tag)||!ALLOWED_TAGS.has(tag)){
   error.push("未対応または危険なHTML要素があります: "+tag);
   return "";
  }
  for(const attr of Array.from(el.attributes)){
   const key=attr.name.toLowerCase();
   if(key.startsWith("on")||key==="style"||key==="srcdoc"||key==="id"||key==="class")continue;
   if((tag==="a"&&key==="href")||(tag==="img"&&(key==="src"||key==="alt"))||
      ((tag==="td"||tag==="th")&&(key==="colspan"||key==="rowspan"))){
    if((key==="colspan"||key==="rowspan")&&attr.value!=="1"){error.push("複雑な結合セルには対応していません。");return "";}
    continue;
   }
   error.push("未対応のHTML属性があります: "+key);
   return "";
  }
  const children=()=>Array.from(el.childNodes).map(walk).join("");
  switch(tag){
   case "script":return "";
   case "br":return "\n";
   case "h1":case "h2":case "h3":case "h4":case "h5":case "h6":
    return "\n\n"+"#".repeat(Number(tag[1]))+" "+children().trim()+"\n\n";
   case "p":case "div":return "\n\n"+children().trim()+"\n\n";
   case "b":case "strong":return "**"+children()+"**";
   case "em":case "i":return "*"+children()+"*";
   case "del":case "s":return "~~"+children()+"~~";
   case "span":return children();
   case "a":{
    const href=safeParariUrl(el.getAttribute("href")??"","link");
    if(!href){error.push("リンク先が許可されていません。");return "";}
    return "["+children()+"]("+href+")";
   }
   case "img":{
    const src=safeParariUrl(el.getAttribute("src")??"","image");
    if(!src){error.push("画像URLが許可されていません。");return "";}
    return "\n\n!["+escapeText(el.getAttribute("alt")??"")+"]("+src+")\n\n";
   }
   case "blockquote":return "\n\n"+children().trim().split("\n").map(l=>"> "+l).join("\n")+"\n\n";
   case "ul":case "ol":{
    const items=Array.from(el.children);
    if(items.some(child=>child.tagName.toLowerCase()!=="li")){error.push("リストに未対応の要素があります。");return "";}
    const ordered=tag==="ol";
    return "\n\n"+items.map((li,i)=>(ordered?String(i+1)+". ":"- ")+walk(li).trim()).join("\n")+"\n\n";
   }
   case "li":{
    if(el.querySelector("ul,ol")){error.push("入れ子リストには対応していません。");return "";}
    return children();
   }
   case "hr":return "\n\n---\n\n";
   case "pre":case "code":
    error.push("コードを含むHTMLは自動変換できません。");
    return "";
   case "table":{
    const rows=Array.from(el.querySelectorAll("tr"));
    if(!rows.length){error.push("空の表は変換できません。");return "";}
    if(rows.length>MARKDOWN_LIMITS.maxTableRows){error.push("表の行数が上限を超えています。");return "";}
    const data=rows.map(row=>{
     const cells=Array.from(row.children);
     if(cells.some(c=>!["td","th"].includes(c.tagName.toLowerCase()))){error.push("不正な表セルがあります。");return [];}
     return cells.map(cell=>walk(cell).replace(/\n+/g," ").trim());
    });
    if(error.length)return "";
    const width=data[0].length;
    if(width<2||width>MARKDOWN_LIMITS.maxTableColumns||data.some(r=>r.length!==width)){
     error.push("表の列数が一致しません。");return "";
    }
    const row=(r:string[])=>"| "+r.join(" | ")+" |";
    return "\n\n"+[row(data[0]),row(Array(width).fill("---")),...data.slice(1).map(row)].join("\n")+"\n\n";
   }
   case "thead":case "tbody":case "tfoot":case "tr":case "th":case "td":
    return children();
   default:return children();
  }
 };
 // Reject dangerous markup in head rather than silently dropping it.
 for(const node of Array.from(doc.head.childNodes)){
  if(node.nodeType===Node.ELEMENT_NODE){
   const tag=(node as Element).tagName.toLowerCase();
   if(tag!=="title"){error.push("HTMLヘッダーに許可されない要素があります。");break;}
  }
 }
 const markdown=error.length?"":Array.from(doc.body.childNodes).map(walk).join("").trim();
 if(error.length)return {ok:false,reason:error[0]};
 if(!markdown)return {ok:false,reason:"変換可能なHTML本文がありません。"};
 return {ok:true,markdown};
}
