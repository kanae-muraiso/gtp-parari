"use client";
import React from "react";
import {parseMarkdownForParari} from "@/lib/parari/markdown/parseMarkdownForParari";

export default function MarkdownImportControl({value,onChange,open,onClose}:{value:string;onChange:(next:string)=>void;open:boolean;onClose:()=>void}){
 const [markdown,setMarkdown]=React.useState("");
 const [error,setError]=React.useState("");
 function apply(){
  const parts=parseMarkdownForParari(markdown);
  if(!parts.length){setError("貼り付ける文章を入力してください。");return;}
  if(parts.some(p=>p.kind==="table")&&!window.confirm("Markdown表をTABLEパネルに変換します。よろしいですか？"))return;
  const addition=parts.map(p=>p.kind==="table"?p.ssot:"[T]\n"+p.ssot).join("\n\n");
  onChange([value.trimEnd(),addition].filter(Boolean).join("\n\n"));
  setMarkdown("");setError("");onClose();
 }
 return open ? <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section role="dialog" aria-modal="true" aria-label="Markdownを貼り付け" className="w-full max-w-2xl rounded-xl bg-white p-5 text-neutral-900 shadow-xl">
   <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-bold">Markdownを貼り付け</h2><button type="button" onClick={onClose} className="rounded border px-3 py-1 text-sm">閉じる</button></div>
   <textarea autoFocus aria-label="Markdown本文" value={markdown} onChange={e=>setMarkdown(e.target.value)} rows={10} className="w-full rounded-lg border p-3 font-mono text-sm" placeholder="Markdown文章を貼り付けてください"/>
   <p className="mt-2 text-xs text-neutral-500">既存本文は保持し、末尾に追加します。表は確認後TABLEパネルに変換します。</p>
   {error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
   <div className="mt-4 flex justify-end gap-2"><button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={onClose}>キャンセル</button><button type="button" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white" onClick={apply}>変換して追加</button></div>
  </section>
 </div> : null;
}
