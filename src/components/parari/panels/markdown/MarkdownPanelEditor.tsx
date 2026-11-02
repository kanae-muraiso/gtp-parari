"use client";
import {useState,useRef,useEffect} from "react";
import type {PanelEditorProps} from "../panelDefinitionTypes";
import {serializeMarkdownPanel,type MarkdownPanelData} from "./markdownSsot";
import {MarkdownPanelRenderer} from "./MarkdownPanelRenderer";
export function MarkdownPanelEditor({block,data,onChangeRaw}:PanelEditorProps<MarkdownPanelData>){
 const [preview,setPreview]=useState(false);
 const inputRef=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{inputRef.current?.focus();},[]);
 return <div className="space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <p className="text-xs text-neutral-500">Markdownをそのまま貼り付けます。原文を保持して保存します。</p>
   <button type="button" className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold" onClick={()=>setPreview(p=>!p)}>{preview?"原文を編集":"表示を確認"}</button>
  </div>
  {preview?<div className="rounded-lg border border-neutral-200 bg-white p-4"><MarkdownPanelRenderer block={block} data={data}/></div>:
  <textarea ref={inputRef} aria-label="Markdown本文" spellCheck={false} value={data.source}
   onChange={e=>onChangeRaw?.(serializeMarkdownPanel({source:e.target.value}))}
   rows={14} className="w-full rounded-lg border border-neutral-300 bg-white p-3 font-mono text-sm leading-6"/>}
 </div>;
}
