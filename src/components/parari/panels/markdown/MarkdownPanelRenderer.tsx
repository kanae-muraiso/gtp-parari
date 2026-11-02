import type {ReactNode} from "react";
import type {PanelRendererProps} from "../panelDefinitionTypes";
import type {MarkdownPanelData} from "./markdownSsot";
import {safeParariUrl} from "@/lib/parari/security/safeParariUrl";
import {MARKDOWN_LIMITS} from "./markdownSecurity";
import {htmlToSafeMarkdown} from "@/lib/parari/markdown/htmlToSafeMarkdown";

const safeUrl=(url:string,isImage:boolean)=>safeParariUrl(url,isImage?"image":"link");
function inline(source:string):ReactNode[]{
 const out:ReactNode[]=[];
 const pattern=/(!?\[[^\]]*\]\([^)]*\)|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|~~[^~\n]+~~|\`[^\`\n]+\`)/g;
 let at=0;let match:RegExpExecArray|null;
 while((match=pattern.exec(source))!==null){
  if(match.index>at)out.push(source.slice(at,match.index));
  const token=match[0];const key=out.length;
  if(token.startsWith("![")||token.startsWith("[")){
   const parsed=token.match(/^(!?)\[([^\]]*)\]\(([^)]*)\)$/);
   const url=parsed?safeUrl(parsed[3],parsed[1]==="!"):null;
   if(parsed&&url)out.push(parsed[1]?<img key={key} src={url} alt={parsed[2]} loading="lazy" className="my-3 h-auto max-w-full rounded-lg"/>:<a key={key} href={url} rel="noopener noreferrer" className="text-blue-700 underline">{parsed[2]}</a>);
   else out.push(token);
  }else if(token.startsWith("**")||token.startsWith("__"))out.push(<strong key={key}>{token.slice(2,-2)}</strong>);
  else if(token.startsWith("~~"))out.push(<del key={key}>{token.slice(2,-2)}</del>);
  else if(token.startsWith("\`"))out.push(<code key={key} className="rounded bg-neutral-100 px-1 font-mono text-[.9em]">{token.slice(1,-1)}</code>);
  else out.push(<em key={key}>{token.slice(1,-1)}</em>);
  at=pattern.lastIndex;
 }
 if(at<source.length)out.push(source.slice(at));
 return out;
}
function cells(line:string):string[]{
 const trimmed=line.trim().replace(/^\|/,"").replace(/\|$/,"");
 return trimmed.split(/(?<!\\)\|/).map(cell=>cell.replace(/\\\|/g,"|").trim());
}
function isDivider(line:string,count:number){
 const cols=cells(line);
 return cols.length===count&&cols.every(c=>/^:?-{3,}:?$/.test(c.replace(/\s/g,"")));
}
function isSpecial(line:string,next?:string):boolean{
 return /^\s*(#{1,6}\s|>|[-*+]\s|\d+[.)]\s|\`{3,}|~~~|---+\s*$|\*\*\*+\s*$)/.test(line)||
 Boolean(next&&line.includes("|")&&isDivider(next,cells(line).length));
}
export function MarkdownPanelRenderer({data}:PanelRendererProps<MarkdownPanelData>){
 if(data.source.length>MARKDOWN_LIMITS.maxSourceChars)return <p role="status" className="text-sm text-red-700">Markdownが30万文字の表示上限を超えています。分割してください。</p>;
 const converted=data.format==="html"?htmlToSafeMarkdown(data.source):null;
 if(converted&&!converted.ok)return <p role="status" className="text-sm text-red-700">HTMLを安全に表示できません。PARARI形式に変換する前に内容を修正してください。</p>;
 const source=converted&&converted.ok?converted.markdown:data.source;
 const lines=source.replace(/\r\n?/g,"\n").split("\n");
 if(lines.length>MARKDOWN_LIMITS.maxSourceLines)return <p role="status" className="text-sm text-red-700">Markdownが1万行の表示上限を超えています。分割してください。</p>;
 const result:ReactNode[]=[];let i=0;
 const add=(node:ReactNode)=>result.push(<div key={result.length}>{node}</div>);
 while(i<lines.length){
  const line=lines[i];
  if(!line.trim()){i++;continue;}
  const fence=line.match(/^\s*(\`{3,}|~{3,})(.*)$/);
  if(fence){
   const delimiter=fence[1][0];const count=fence[1].length;const language=fence[2].trim();
   i++;const code:string[]=[];
   while(i<lines.length&&!new RegExp("^\\s*"+(delimiter==="~"?"~":"\\`")+"{"+count+",}\\s*$").test(lines[i]))code.push(lines[i++]);
   if(i<lines.length)i++;
   add(<div className="my-3 overflow-x-auto rounded-lg bg-neutral-900 p-4 text-neutral-100">{language&&<div className="mb-2 text-xs text-neutral-400">{language}</div>}<pre className="whitespace-pre text-sm"><code>{code.join("\n")}</code></pre></div>);continue;
  }
  if(i+1<lines.length&&line.includes("|")&&isDivider(lines[i+1],cells(line).length)){
   const header=cells(line);i+=2;const rows:string[][]=[];
   while(i<lines.length&&lines[i].trim()&&lines[i].includes("|")){const row=cells(lines[i]);if(row.length!==header.length)break;rows.push(row);i++;}
   add(<div className="my-4 max-w-full overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr>{header.map((cell,k)=><th key={k} scope="col" className="border border-neutral-300 bg-neutral-100 px-3 py-2">{inline(cell)}</th>)}</tr></thead><tbody>{rows.map((row,r)=><tr key={r}>{row.map((cell,k)=><td key={k} className="border border-neutral-300 px-3 py-2">{inline(cell)}</td>)}</tr>)}</tbody></table></div>);continue;
  }
  const heading=line.match(/^\s*(#{1,6})\s+(.+)$/);
  if(heading){const level=heading[1].length;const sizes=["text-3xl","text-2xl","text-xl","text-lg","text-base","text-sm"];add(<div role="heading" aria-level={level} className={`mb-3 mt-5 font-semibold ${sizes[level-1]}`}>{inline(heading[2])}</div>);i++;continue;}
  if(/^\s*(?:---+|\*\*\*+)\s*$/.test(line)){add(<hr className="my-5 border-neutral-300"/>);i++;continue;}
  if(/^\s*>/.test(line)){const quote:string[]=[];while(i<lines.length&&/^\s*>/.test(lines[i]))quote.push(lines[i++].replace(/^\s*>\s?/,""));add(<blockquote className="my-3 border-l-4 border-neutral-300 pl-4 text-neutral-700">{quote.map((q,k)=><p key={k}>{inline(q)}</p>)}</blockquote>);continue;}
  const bullet=line.match(/^\s*([-*+]|\d+[.)])\s+(.+)$/);
  if(bullet){const ordered=/\d/.test(bullet[1]);const items:string[]=[];while(i<lines.length){const m=lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.+)$/);if(!m||/\d/.test(m[1])!==ordered)break;items.push(m[2]);i++;}
   const children=items.map((item,k)=><li key={k} className="my-1">{inline(item)}</li>);
   add(ordered?<ol className="my-3 list-decimal pl-6">{children}</ol>:<ul className="my-3 list-disc pl-6">{children}</ul>);continue;
  }
  const paragraph=[line];i++;
  while(i<lines.length&&lines[i].trim()&&!isSpecial(lines[i],lines[i+1]))paragraph.push(lines[i++]);
  add(<p className="my-3 leading-8">{paragraph.map((p,k)=><span key={k}>{k>0&&<br/>}{inline(p)}</span>)}</p>);
 }
 return <div className="max-w-full break-words text-neutral-900">{result}</div>;
}
