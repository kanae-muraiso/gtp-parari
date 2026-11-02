export type MarkdownPanelData={source:string};

/**
 * Markdown is always data. In particular, a pasted [/MARKDOWN] line must not
 * be interpreted by the SSOT parser as the end of the enclosing panel.
 */
const closingTagLine=/^[ \t]*\[\/MARKDOWN\][ \t]*$/im;

export function parseMarkdownPanel(raw:string):MarkdownPanelData{
 const lines=String(raw??"").replace(/\r\n?/g,"\n").split("\n");
 const encoded=/^\[MARKDOWN:json\]\s*$/i.test(lines[0]??"");
 const payload=lines.slice(1,lines[lines.length-1]?.trim()==="[/MARKDOWN]"?-1:undefined).join("\n");
 if(encoded){
  try{
   const decoded=JSON.parse(payload);
   if(typeof decoded==="string")return {source:decoded};
  }catch{
   // Preserve broken/legacy payload as data; never interpret it as markup.
  }
 }
 return {source:payload};
}

export function serializeMarkdownPanel(data:MarkdownPanelData):string{
 const source=String(data.source??"").replace(/\r\n?/g,"\n");
 if(closingTagLine.test(source)){
  // JSON strings encode line breaks, and bracket escaping ensures even an
  // embedded literal closing tag cannot terminate this container.
  const payload=JSON.stringify(source).replace(/\[/g,"\\u005b");
  return "[MARKDOWN:json]\n"+payload+"\n[/MARKDOWN]";
 }
 return "[MARKDOWN]\n"+source+"\n[/MARKDOWN]";
}
