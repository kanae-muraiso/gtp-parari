import type {PanelRendererProps} from "../panelDefinitionTypes";
import type {MarkdownPanelData} from "./markdownSsot";
import RichTextRenderer from "@/components/parari/richText/RichTextRenderer";
import {parseRichText} from "@/lib/parari/richText/parseRichText";
function splitCells(line:string){return line.trim().replace(/^\|/,"").replace(/\|$/,"").split("|").map(x=>x.trim());}
function separator(line:string,width:number){const cells=splitCells(line);return cells.length===width&&cells.every(c=>/^:?-{3,}:?$/.test(c.replace(/\s/g,"")));}
export function MarkdownPanelRenderer({data}:PanelRendererProps<MarkdownPanelData>){
 const lines=data.source.replace(/\r\n/g,"\n").split("\n");
 const output:React.ReactNode[]=[];
 let text:string[]=[];
 const flush=()=>{if(text.some(line=>line.trim()))output.push(<div key={output.length} className="my-3"><RichTextRenderer document={parseRichText(text.join("\n").replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,"[[$1]]($2)").replace(/^#\s+/gm,"## "))}/></div>);text=[];};
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(i+1<lines.length&&line.includes("|")&&separator(lines[i+1],splitCells(line).length)){
   flush();const headers=splitCells(line);const rows:string[][]=[];i++;
   while(i+1<lines.length&&lines[i+1].includes("|")&&lines[i+1].trim()){rows.push(splitCells(lines[++i]));}
   output.push(<div key={output.length} className="my-4 max-w-full overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr>{headers.map((h,j)=><th key={j} className="border bg-neutral-100 p-2">{h}</th>)}</tr></thead><tbody>{rows.map((row,j)=><tr key={j}>{row.map((cell,k)=><td key={k} className="border p-2">{cell}</td>)}</tr>)}</tbody></table></div>);
  }else text.push(line);
 }
 flush();return <div className="max-w-full break-words">{output}</div>;
}
