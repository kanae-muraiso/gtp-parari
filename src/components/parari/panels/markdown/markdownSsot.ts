export type MarkdownPanelData={source:string};
export function parseMarkdownPanel(raw:string):MarkdownPanelData {
 const lines=raw.replace(/\r\n/g,"\n").split("\n");
 return {source:lines.slice(1,lines[lines.length-1]?.trim()==="[/MARKDOWN]"?-1:undefined).join("\n")};
}
export function serializeMarkdownPanel(data:MarkdownPanelData):string {
 return "[MARKDOWN]\n"+data.source.replace(/\r\n/g,"\n")+"\n[/MARKDOWN]";
}
