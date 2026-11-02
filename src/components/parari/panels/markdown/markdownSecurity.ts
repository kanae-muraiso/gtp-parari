import {parseBlocks} from "@/lib/parari/ssot-v2/parseBlocks";
import {safeParariUrl} from "@/lib/parari/security/safeParariUrl";

export const MARKDOWN_LIMITS = {
  maxSourceChars: 300_000,
  maxSourceLines: 10_000,
  maxPanels: 300,
  maxSsotChars: 450_000,
  maxTableColumns: 40,
  maxTableRows: 1_000,
} as const;

export type VerifiedPanel = {tag:string;ssot:string};

/**
 * Fail closed: pasted markdown stays untrusted data until its syntax,
 * permitted destinations and limits have all been checked.
 */
export function inspectMarkdownSource(source:string):string[]{
  const errors:string[]=[];
  if(typeof source!=="string"){
    return ["貼り付け内容が文字列ではありません。"];
  }
  if(source.length>MARKDOWN_LIMITS.maxSourceChars){
    return ["Markdownが長すぎます（上限30万文字）。分割して取り込んでください。"];
  }
  const lines=source.replace(/\r\n?/g,"\n").split("\n");
  if(lines.length>MARKDOWN_LIMITS.maxSourceLines){
    return ["Markdownの行数が多すぎます（上限1万行）。分割して取り込んでください。"];
  }

  for(let index=0;index<lines.length;index++){
    const line=lines[index];
    const number=index+1;
    if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(line)){
      errors.push(number+"行目：制御文字を含みます。");
    }
    if(/[\u202a-\u202e\u2066-\u2069]/.test(line)){
      errors.push(number+"行目：文字の表示方向を操作する制御文字を含みます。");
    }
    // Any PARARI-looking top-level tag is forbidden, including unknown or
    // newly introduced tags, not merely a hardcoded list of current panels.
    if(/^\s*\[\/?[A-Za-z][A-Za-z0-9_]*(?::[^\]]+|\s+[^\]]*)?\](?=\s|$)/.test(line)){
      errors.push(number+"行目：PARARIの内部タグと誤認される記法があります。");
    }
    // HTML (including inline tags, script and iframe) is never passed
    // through this converter as executable markup.
    if(/<\s*\/?\s*[a-z][a-z0-9:-]*(?:\s|\/|>)/i.test(line)||/<!\s*(?:doctype|--)/i.test(line)){
      errors.push(number+"行目：HTML記法には対応していません。");
    }
    // Scan link/image destinations, including [[label]](url) used by PARARI.
    const targets=line.matchAll(/\]\(([^)]*)\)/g);
    for(const match of targets){
      const target=match[1].trim();
      const prefix=line.slice(0,match.index);
      const isImage=/!\[[^\]\n]*$/.test(prefix);
      if(!target||/\s/.test(target)||!safeParariUrl(target,isImage?"image":"link")){
        errors.push(number+"行目：許可されていないリンクまたは画像URLです。");
      }
    }
    if(errors.length>=20){
      errors.push("安全上の問題が多数あるため、検査を中断しました。");
      break;
    }
  }
  return errors;
}

/**
 * Verify the already serialized SSOT against the exact list of intended blocks.
 * A line of author content must never silently become PAGE/BUTTON/unknown panel.
 */
export function inspectConvertedParari(
  panels:readonly VerifiedPanel[],
  ssot:string,
):string[]{
  if(panels.length===0)return ["変換できるパネルがありません。"];
  if(panels.length>MARKDOWN_LIMITS.maxPanels){
    return ["生成されるパネルが多すぎます（上限300）。分割して取り込んでください。"];
  }
  if(ssot.length>MARKDOWN_LIMITS.maxSsotChars){
    return ["変換後のデータ量が上限を超えます。"];
  }
  const allowed=new Set(["TEXT","TABLE","LIST","NOTICE","IMAGE"]);
  for(let i=0;i<panels.length;i++){
    const panel=panels[i];
    if(!allowed.has(panel.tag)){
      return ["許可されていない種類のパネルが含まれています。"];
    }
    if(panel.tag==="TABLE"){
      const tableRows=panel.ssot.split("\n").filter(line=>line.startsWith("|"));
      if(tableRows.length>MARKDOWN_LIMITS.maxTableRows){
        return ["表の行数が多すぎます（1つの表につき上限1000行）。"];
      }
      if(tableRows.some(line=>line.split(/(?<!\\)\|/).length-2>MARKDOWN_LIMITS.maxTableColumns)){
        return ["表の列数が多すぎます（上限40列）。"];
      }
    }
  }
  let blocks:ReturnType<typeof parseBlocks>;
  try {
    blocks=parseBlocks(ssot);
  }catch{
    return ["PARARI構造の解析に失敗しました。"];
  }
  if(blocks.length!==panels.length){
    return ["変換後のパネル数が予定と一致しません。内部タグの混入を検出しました。"];
  }
  for(let i=0;i<panels.length;i++){
    const planned=panels[i],actual=blocks[i];
    const expected=planned.tag;
    if(expected==="TEXT"){
      if(actual.kind!=="text"){
        return [(i+1)+"番目の文章が別のパネルとして解釈されました。変換を停止しました。"];
      }
      const plannedBody=planned.ssot.replace(/^\[T\]\n/,"").trim();
      if(actual.raw.trim()!==plannedBody){
        return [(i+1)+"番目の文章の内容が変わる可能性があるため、変換を停止しました。"];
      }
    }else{
      if(actual.kind!=="panel"||actual.tag!==expected){
        return [(i+1)+"番目のパネル構造が予定と一致しません。変換を停止しました。"];
      }
      if(actual.raw.trim()!==planned.ssot.trim()){
        return [(i+1)+"番目のパネル内容が予定と一致しません。変換を停止しました。"];
      }
    }
  }
  return [];
}
