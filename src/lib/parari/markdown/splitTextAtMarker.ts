/**
 * Split a single TEXT panel at an ephemeral insertion marker.
 * This pure operation never mutates Lexical, SSOT, or the saved work.
 */
export type TextSplitResult =
  | {ok:true;before:string;after:string;rejoined:string}
  | {ok:false;reason:string};

export function splitTextAtMarker(markedText:string,marker:string):TextSplitResult{
 if(typeof markedText!=="string"||typeof marker!=="string"||marker.length<12){
  return {ok:false,reason:"挿入位置の情報が不正です。"};
 }
 const position=markedText.indexOf(marker);
 if(position<0||markedText.indexOf(marker,position+marker.length)>=0){
  return {ok:false,reason:"挿入位置を一意に特定できません。"};
 }
 const before=markedText.slice(0,position);
 const after=markedText.slice(position+marker.length);
 // An empty side would create accidental empty TEXT panels.
 if(!before.trim()||!after.trim()){
  return {ok:false,reason:"先頭または末尾ではTEXTを2つに分割できません。"};
 }
 const rejoined=before+after;
 if(rejoined!==markedText.replace(marker,"")){
  return {ok:false,reason:"分割によって文章が変わるため中止しました。"};
 }
 return {ok:true,before,after,rejoined};
}
