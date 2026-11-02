export type MarkdownPanelData={source:string;format?:"markdown"|"html"};
const closingTagLine=/^[ \t]*\[\/MARKDOWN\][ \t]*$/im;

export function parseMarkdownPanel(raw:string):MarkdownPanelData{
 const lines=String(raw??"").replace(/\r\n?/g,"\n").split("\n");
 const first=lines[0]?.trim()??"";
 const html=first==="[MARKDOWN:html]";
 const encoded=html||first==="[MARKDOWN:json]";
 const payload=lines.slice(1,lines[lines.length-1]?.trim()==="[/MARKDOWN]"?-1:undefined).join("\n");
 if(encoded){
  try{
   const decoded=JSON.parse(payload);
   if(typeof decoded==="string")return {source:decoded,format:html?"html":"markdown"};
  }catch{
   // Invalid serialized content is never executed.
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
