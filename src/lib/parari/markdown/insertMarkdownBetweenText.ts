import {splitTextAtMarker} from "./splitTextAtMarker";
import {convertMarkdownToParari} from "@/components/parari/panels/markdown/convertMarkdownToParari";
import {inspectConvertedParari} from "@/components/parari/panels/markdown/markdownSecurity";
import {parseBlocks} from "@/lib/parari/ssot-v2/parseBlocks";

/**
 * Compose an already-validated conversion BETWEEN exactly two TEXT segments.
 * Does not access the clipboard or mutate the editor. Structural failures are fatal.
 */
export function insertMarkdownBetweenText(
 markedText:string,marker:string,markdown:string,
):{ok:true;replacementSsot:string}|{ok:false;reason:string}{
 const split=splitTextAtMarker(markedText,marker);
 if(!split.ok)return {ok:false,reason:split.reason};
 const converted=convertMarkdownToParari(markdown);
 if(!converted.ok)return {ok:false,reason:converted.errors[0]??"Markdownの検査に失敗しました。"};
 if(!split.before.trim()||!split.after.trim())return {ok:false,reason:"空のTEXTは生成できません。"};
 // Do not allow untrusted author text to look like a new panel on reparse.
 const segments=[
  {tag:"TEXT",ssot:"[T]\n"+split.before},
  ...converted.panels,
  {tag:"TEXT",ssot:"[T]\n"+split.after},
 ];
 const replacementSsot=segments.map(x=>x.ssot).join("\n\n");
 const failures=inspectConvertedParari(segments,replacementSsot);
 if(failures.length)return {ok:false,reason:failures[0]};
 const parsed=parseBlocks(replacementSsot);
 if(parsed.length!==segments.length)return {ok:false,reason:"挿入後のパネル数が一致しません。"};
 return {ok:true,replacementSsot};
}
