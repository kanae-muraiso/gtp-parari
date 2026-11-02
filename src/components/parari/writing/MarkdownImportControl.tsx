"use client";
import React from "react";
import {parseMarkdownForParari} from "@/lib/parari/markdown/parseMarkdownForParari";

export default function MarkdownImportControl({value,onChange}:{value:string;onChange:(next:string)=>void}){
 const [open,setOpen]=React.useState(false);
 const [markdown,setMarkdown]=React.useState("");
 const [error,setError]=React.useState("");
 function apply(){
  const parts=parseMarkdownForParari(markdown);
  if(!parts.length){setError("貼り付ける文章を入力してください。");return;}
  if(parts.some(p=>p.kind==="table")&&!window.confirm("Markdown表をTABLEパネルに変換します。よろしいですか？"))return;
  const addition=parts.map(p=>p.kind==="table"?p.ssot:"[T]\n"+p.ssot).join("\n\n");
  onChange([value.trimEnd(),addition].filter(Boolean).join("\n\n"));
  setMarkdown("");setError("");setOpen(false);
 }
 return <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-3">
  <button type="button" className="text-sm font-semibold underline" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>Markdownを貼り付け</button>
  {open&&<div className="mt-3 space-y-2">
   <textarea aria-label="Markdown本文" value={markdown} onChange={e=>setMarkdown(e.target.value)} rows={8} className="w-full rounded-lg border p-3 font-mono text-sm" placeholder="Markdown文章を貼り付けてください"/>
   <p className="text-xs text-neutral-500">既存本文は保持し、末尾に追加します。表は確認後TABLEパネルに変換します。</p>
   {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
   <button type="button" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white" onClick={apply}>変換して追加</button>
  </div>}
 </div>;
}
