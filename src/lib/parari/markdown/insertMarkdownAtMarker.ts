import type {MarkdownPart} from "./parseMarkdownForParari";

/** Split at the actual TEXT caret, insert parsed panels, then keep only necessary TEXT blocks. */
export function insertMarkdownAtMarker(markedText:string,marker:string,parts:MarkdownPart[]):string {
  const at=markedText.indexOf(marker);
  if(at<0) throw new Error("Paste position was lost");
  const before=markedText.slice(0,at);
  const after=markedText.slice(at+marker.length);
  const output:string[]=[];
  const pushText=(value:string)=>{
    if(!value.trim())return;
    const last=output.length-1;
    if(last>=0&&output[last].startsWith("[T]\n")){
      output[last]+="\n"+value;
    }else output.push("[T]\n"+value);
  };
  pushText(before);
  for(const part of parts){
    if(part.kind==="table")output.push(part.ssot);
    else pushText(part.ssot);
  }
  pushText(after);
  return output.join("\n\n");
}
