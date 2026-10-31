// src/components/parari/WorkLimitsNotice.tsx
// 2026-10-31 JST — PART: Explain PAGE limits and preserve rejected drafts.
"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { contentIssues, pageLengths } from "@/lib/parari/limits/workLimits";
import type { PlanEntitlements } from "@/lib/billing/plan";

export function WorkLimitsNotice({source}:{source:string}) {
  const [limits,setLimits] = useState<PlanEntitlements|null>(null);
  useEffect(()=>{
    let cancelled=false;
    void (async()=>{
      const {data:{session}}=await supabase.auth.getSession();
      if (!session) return;
      const r=await fetch("/api/works/limits",{headers:{Authorization:`Bearer ${session.access_token}`}});
      const result=await r.json();
      if (!cancelled && r.ok && result.ok) setLimits(result.limits);
    })().catch(()=>{});
    return ()=>{cancelled=true;};
  },[]);
  if (!limits) return null;
  const issues=contentIssues(source,limits);
  const max=Math.max(...pageLengths(source));
  return <div className="my-3 rounded-xl border border-neutral-200 bg-white p-3 text-xs leading-6 text-neutral-600">
    <p>1 BOOK：{limits.pageLimitPerWork ?? "無制限"} PAGE ／ 1 PAGE：{limits.charactersPerPage?.toLocaleString() ?? "無制限"}字{limits.charactersPerPage === null ? "" : `（現在最大 ${max.toLocaleString()}字）`}</p>
    <p>PAGEは内容のひとまとまりです。画面の表示枚数とは異なります。空白・改行・構造設定を除いて数えます。</p>
    {issues.length ? <p className="whitespace-pre-wrap font-bold text-amber-800">{issues.join("\n")}<br/>本文を切り詰めずに分割・整理してください。</p>:null}
  </div>;
}

export function DraftRecovery({workId,source}:{workId:string;source:string}) {
  const [backup,setBackup]=useState("");
  const [stored,setStored]=useState(false);
  const key=`parari-unsaved-ssot:${workId}`;
  useEffect(()=>{
    try { const saved=localStorage.getItem(key); if(saved) {setBackup(saved);setStored(true);} } catch {}
  },[key]);
  useEffect(()=>{
    if(!source) return;
    setBackup(source);
    try { localStorage.setItem(key,source);setStored(true); } catch {setStored(false);}
  },[key,source]);
  if(!backup) return null;
  function download(){
    const url=URL.createObjectURL(new Blob([backup],{type:"text/plain;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download=`PARARI-${workId}-未保存原稿.txt`;document.body.appendChild(a);a.click();a.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <div className="my-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-6 text-amber-950">
    <p>{stored ? "未保存の原稿をこの端末に退避しました。" : "保存できない原稿があります。"}ダウンロードして保管し、必要な本文を編集画面へ戻せます。</p>
    <button type="button" onClick={download} className="mr-3 rounded-full border border-amber-400 bg-white px-3 py-1 font-bold">退避原稿をダウンロード</button>
    <button type="button" onClick={()=>{try{localStorage.removeItem(key);}catch{}setBackup("");}} className="underline">退避を削除</button>
  </div>;
}
