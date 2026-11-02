"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import type {PanelEditorProps} from "../panelDefinitionTypes";
import {serializeMarkdownPanel,type MarkdownPanelData} from "./markdownSsot";
import {MarkdownPanelRenderer} from "./MarkdownPanelRenderer";
import {convertMarkdownToParari} from "./convertMarkdownToParari";
import {MARKDOWN_LIMITS} from "./markdownSecurity";

export function MarkdownPanelEditor({block,data,onChangeRaw,onReplaceWithSsot}:PanelEditorProps<MarkdownPanelData>){
 const [preview,setPreview]=useState(false);
 const [review,setReview]=useState(false);
 const [sizeError,setSizeError]=useState("");
 const inputRef=useRef<HTMLTextAreaElement>(null);
 const conversion=useMemo(()=>convertMarkdownToParari(data.source),[data.source]);
 useEffect(()=>{inputRef.current?.focus();},[]);
 useEffect(()=>{setReview(false);},[data.source]);
 const smallButton="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50";
 return <div className="space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <p className="text-xs text-neutral-500">Markdownを貼り付けて編集できます。変換を確定するまでは原文を保持します。</p>
   <div className="flex flex-wrap gap-2">
    <button type="button" className={smallButton} onClick={()=>setPreview(p=>!p)}>{preview?"原文を編集":"表示を確認"}</button>
    <button type="button" className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 disabled:opacity-40" disabled={!data.source.trim()||!onReplaceWithSsot} onClick={()=>setReview(r=>!r)}>PARARI形式に変換</button>
   </div>
  </div>
  {preview?<div className="rounded-lg border border-neutral-200 bg-white p-4"><MarkdownPanelRenderer block={block} data={data}/></div>:
   <textarea ref={inputRef} aria-label="Markdown本文" spellCheck={false} value={data.source}
    onPaste={e=>{
      const pasted=e.clipboardData.getData("text/plain");
      const textarea=e.currentTarget;
      const nextLength=data.source.length-(textarea.selectionEnd-textarea.selectionStart)+pasted.length;
      if(nextLength>MARKDOWN_LIMITS.maxSourceChars){
        e.preventDefault();
        setSizeError("貼り付け内容が30万文字の上限を超えます。原文は変更していません。分割して貼り付けてください。");
      }
    }}
    onChange={e=>{
      if(e.target.value.length>MARKDOWN_LIMITS.maxSourceChars){
        setSizeError("Markdownは30万文字までです。原文は変更していません。");
        return;
      }
      setSizeError("");
      onChangeRaw?.(serializeMarkdownPanel({source:e.target.value}));
    }}
    rows={14} className="w-full rounded-lg border border-neutral-300 bg-white p-3 font-mono text-sm leading-6"/>}
  {sizeError&&<p role="alert" className="text-xs text-red-700">{sizeError}</p>}
  {review&&<section aria-label="PARARI変換の確認" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/60 p-4">
   <h3 className="font-semibold text-neutral-900">変換内容を確認</h3>
   <p className="text-sm text-neutral-700">このMARKDOWNパネルを以下のPARARIパネルに置き換えます。確定するまでは原文を変更しません。</p>
   {conversion.panels.length>0&&<ol className="space-y-2">
    {conversion.panels.map((panel,index)=><li key={index} className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
      <span className="min-w-16 font-semibold text-neutral-800">{panel.label}</span>
      <span className="min-w-0 flex-1 break-words text-neutral-600">{panel.summary||"（内容なし）"}</span>
    </li>)}
   </ol>}
   {conversion.ok&&<p role="status" className="text-sm text-green-800">安全性検査に合格しました。許可されたPARARIパネルだけを生成します。</p>}
   {conversion.warnings.length>0&&<div className="space-y-1 text-sm text-amber-900">{conversion.warnings.map((msg,i)=><p key={i}>{msg}</p>)}</div>}
   {conversion.errors.length>0&&<div role="alert" className="space-y-1 text-sm text-red-700">
    <p className="font-semibold">原稿を安全に変換できないため、置き換えを停止しています。</p>
    {conversion.errors.map((msg,i)=><p key={i}>{msg}</p>)}
   </div>}
   <p className="text-xs text-neutral-600">確定後は元のMARKDOWNパネルが置き換わります。元の原文を残したい場合は、先にコピーしてください。</p>
   <div className="flex flex-wrap justify-end gap-2">
    <button type="button" className={smallButton} onClick={()=>setReview(false)}>キャンセル</button>
    <button type="button" disabled={!conversion.ok||!onReplaceWithSsot}
      className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      onClick={()=>{if(conversion.ok&&onReplaceWithSsot)onReplaceWithSsot(conversion.ssot);}}>この内容でPARARI形式に変換</button>
   </div>
  </section>}
 </div>;
}
