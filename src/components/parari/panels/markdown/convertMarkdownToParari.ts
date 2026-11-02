import {serializeTablePanel} from "@/components/parari/panels/table/tableSsot";
import {serializeListPanel} from "@/components/parari/panels/list/serializeListPanel";
import {inspectMarkdownSource,inspectConvertedParari} from "./markdownSecurity";
import {safeParariUrl} from "@/lib/parari/security/safeParariUrl";

export type ConversionPanel={tag:"TEXT"|"TABLE"|"LIST"|"NOTICE"|"IMAGE";label:string;summary:string;ssot:string};
export type MarkdownConversion={panels:ConversionPanel[];ssot:string;errors:string[];warnings:string[];ok:boolean};

/** Compute a preview only. Never alter the source panel until explicitly confirmed. */
export function convertMarkdownToParari(source:string):MarkdownConversion {
 const sourceErrors=inspectMarkdownSource(source);
 if(sourceErrors.length)return {panels:[],ssot:"",errors:sourceErrors,warnings:[],ok:false};
 const lines=String(source??"").replace(/\r\n?/g,"\n").split("\n");
 const panels:ConversionPanel[]=[];const errors:string[]=[];const warnings:string[]=[];
 let text:string[]=[];let i=0;
 function add(tag:ConversionPanel["tag"],label:string,summary:string,ssot:string){
  panels.push({tag,label,summary,ssot});
 }
 function flush(){
  const content=text.join("\n").trim();text=[];
  if(content)add("TEXT","文章",content.replace(/\n/g," ").slice(0,70),"[T]\n"+content);
 }
 function paragraph(content:string){
  if(text.length&&text[text.length-1]!=="")text.push("");
  text.push(content);
 }
 while(i<lines.length){
  const line=lines[i],trimmed=line.trim(),lineNo=i+1;
  if(!trimmed){if(text.length&&text[text.length-1]!=="")text.push("");i++;continue;}
  if(/^\s*(?:\x60{3,}|~{3,})/.test(line)){errors.push(lineNo+"行目：コードブロックは変換対象外です。");i++;continue;}
  if(/^\s*<[/!]?[a-z][^>]*>/i.test(line)){errors.push(lineNo+"行目：HTMLは変換対象外です。");i++;continue;}
  if(/^\s*\[(?:T|PAGE|BOOK|TABLE|LIST|NOTICE|IMAGE|MARKDOWN|\/MARKDOWN)\]\s*$/i.test(line)){
   errors.push(lineNo+"行目：PARARIタグに見える行を含みます。");i++;continue;
  }
  if(/\]\(\s*(?:javascript|data|vbscript):/i.test(line)){
   errors.push(lineNo+"行目：安全でないリンクを含みます。");i++;continue;
  }
  const image=trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
  if(image){
   const url=safeParariUrl(image[2].trim(),"image");
   if(!url){
    errors.push(lineNo+"行目：画像URLがサポートされていません。");
   }else{
    flush();const caption=image[1].trim();
    add("IMAGE","画像",caption||url,["[IMAGE]","url: "+url,...(caption?["caption: "+caption]:[])].join("\n"));
   }
   i++;continue;
  }
  if(/!\[[^\]]*\]\([^)]+\)/.test(line)){errors.push(lineNo+"行目：文章途中の画像は未対応です。");i++;continue;}
  if(i+1<lines.length&&line.includes("|")&&isDivider(lines[i+1],splitRow(line).length)){
   flush();const headers=splitRow(line),rows=[headers];i+=2;
   while(i<lines.length&&lines[i].trim()&&lines[i].includes("|")){
    const row=splitRow(lines[i]);
    if(row.length!==headers.length){errors.push((i+1)+"行目：表の列数が一致しません。");break;}
    rows.push(row);i++;
   }
   add("TABLE","表",headers.join(" / "),serializeTablePanel({caption:"",header:true,rows}));
   continue;
  }
  const heading=trimmed.match(/^(#{1,6})\s+(.+)$/);
  if(heading){
   if(heading[1].length>3)warnings.push(lineNo+"行目：見出し4〜6は小見出しに変換します。");
   paragraph((heading[1].length<=2?"## ":"### ")+heading[2]);i++;continue;
  }
  if(/^\s*(?:[-*+]|\d+[.)])\s+/.test(line)){
   flush();const items:string[]=[];let ordered:boolean|null=null;
   while(i<lines.length){
    const m=lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
    if(!m)break;
    const currentOrdered=/^\d/.test(m[2]);
    if(ordered!==null&&ordered!==currentOrdered)break;
    if(m[1].length)errors.push((i+1)+"行目：入れ子リストは未対応です。");
    if(/^\[[ xX]\]\s/.test(m[3]))errors.push((i+1)+"行目：チェックリストは未対応です。");
    ordered=currentOrdered;
    items.push(currentOrdered?m[2].replace(/[.)]$/,".")+" "+m[3]:m[3]);i++;
   }
   if(items.length)add("LIST","リスト",items[0],serializeListPanel({variant:"",title:"",items}));
   continue;
  }
  if(/^\s*>/.test(line)){
   flush();const quote:string[]=[];
   while(i<lines.length&&/^\s*>/.test(lines[i]))quote.push(lines[i++].replace(/^\s*>\s?/,""));
   const body=quote.join("\n").trim();
   add("NOTICE","引用",body.slice(0,70),"[NOTICE] 引用\n"+body);continue;
  }
  if(/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)){
   paragraph("――――――");warnings.push(lineNo+"行目：水平線は文字の区切りに変換します。");i++;continue;
  }
  if(/^\s{4,}\S/.test(line))errors.push(lineNo+"行目：インデント付きコードは未対応です。");
  text.push(line);i++;
 }
 flush();
 const ssot=panels.map(p=>p.ssot).join("\n\n");
 if(!ssot.trim()&&!errors.length)errors.push("変換できる本文がありません。");
 if(!errors.length)errors.push(...inspectConvertedParari(panels,ssot));
 return {panels,ssot,errors,warnings,ok:errors.length===0&&panels.length>0};
}
function splitRow(line:string):string[]{
 return line.trim().replace(/^\|/,"").replace(/\|$/,"").split(/(?<!\\)\|/).map(x=>x.replace(/\\\|/g,"|").trim());
}
function isDivider(line:string,count:number):boolean{
 const cols=splitRow(line);
 return count>=2&&cols.length===count&&cols.every(x=>/^:?-{3,}:?$/.test(x.replace(/\s/g,"")));
}
