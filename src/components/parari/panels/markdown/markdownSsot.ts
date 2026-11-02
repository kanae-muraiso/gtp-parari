export type MarkdownPanelData={source:string;format?:"markdown"|"html"};
const closingTagLine=/^[ \t]*\[\/MARKDOWN\][ \t]*$/im;

/** The last nonblank line is the ONLY SSOT terminator. */
export function parseMarkdownPanel(raw:string):MarkdownPanelData{
 const lines=String(raw??"").replace(/\r\n?/g,"\n").split("\n");
 const first=(lines[0]??"").trim();
 const variant=first.match(/^\[MARKDOWN(?::([a-z]+))?(?:\s+[^\]]+)?\]$/i)?.[1]?.toLowerCase();
 const encoded=variant==="json"||variant==="html";
 let last=lines.length-1;
 while(last>=1&&!lines[last].trim())last--;
 const end=lines[last]?.trim()==="[/MARKDOWN]"?last:lines.length;
 const payload=lines.slice(1,end).join("\n");
 if(encoded){
  try{
   const decoded=JSON.parse(payload);
   if(typeof decoded==="string")return {source:decoded,format:variant==="html"?"html":"markdown"};
  }catch{
   // Safe fallback for legacy or malformed data: never execute the source.
  }
 }
 return {source:payload,format:"markdown"};
}
export function serializeMarkdownPanel(data:MarkdownPanelData):string{
 const source=String(data.source??"").replace(/\r\n?/g,"\n");
 if(data.format==="html"||closingTagLine.test(source)){
  const encoded=JSON.stringify(source).replace(/\[/g,"\\u005b");
  return (data.format==="html"?"[MARKDOWN:html]":"[MARKDOWN:json]")+"\n"+encoded+"\n[/MARKDOWN]";
 }
 return "[MARKDOWN]\n"+source+"\n[/MARKDOWN]";
}
