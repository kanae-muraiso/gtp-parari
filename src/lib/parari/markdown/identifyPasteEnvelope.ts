export type ParariPasteEnvelope =
 | {kind:"text";body:string}
 | {kind:"markdown";body:string}
 | {kind:"html";body:string};

/**
 * An envelope is recognized only when both marker lines are the entire
 * boundary of the pasted content. No guessing from Markdown or clipboard HTML.
 * Malformed/unmatched wrappers remain ordinary text.
 */
export function identifyPasteEnvelope(input:string):ParariPasteEnvelope{
 const source=String(input??"").replace(/\r\n?/g,"\n");
 const matched=source.match(/^\[([a-z]+)\]\n([\s\S]*?)\n\[\/\1\]\s*$/i);
 if(!matched)return {kind:"text",body:source};
 const kind=matched[1].toLowerCase();
 if(kind!=="markdown"&&kind!=="html")return {kind:"text",body:source};
 const body=matched[2];
 // Do not accept nested or duplicate envelope marker lines.
 if(/^\s*\[\/?(?:markdown|html)\]\s*$/im.test(body))return {kind:"text",body:source};
 return {kind,body};
}
