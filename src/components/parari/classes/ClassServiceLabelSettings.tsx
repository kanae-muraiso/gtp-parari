"use client";
import {useState} from "react";
import {classRequest} from "@/lib/classRequests";
import {defaultServiceLabels,serviceLabelKeys,type ServiceLabels} from "@/lib/classServiceLabels";
export default function ClassServiceLabelSettings({labels,onSaved}:{labels:ServiceLabels;onSaved:(labels:ServiceLabels)=>void}){
 const [draft,setDraft]=useState(labels),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[failed,setFailed]=useState(false);
 async function save(){
  if(busy)return;setBusy(true);setMessage("");setFailed(false);
  try{
   const clean=Object.fromEntries(serviceLabelKeys.map(key=>[key,draft[key].trim()])) as ServiceLabels;
   await classRequest("/admissions",{action:"serviceLabels",labels:clean});
   setDraft(clean);onSaved(clean);setMessage("呼び方を保存しました。");
  }catch(e){setFailed(true);setMessage(e instanceof Error?e.message:"保存できませんでした。");}
  finally{setBusy(false);}
 }
 return <form onSubmit={e=>{e.preventDefault();void save();}} className="grid gap-4 rounded-xl border border-neutral-200 p-4">
  <h3 className="text-lg font-bold">サービスの呼び方</h3>
  <p className="text-base text-neutral-600">この事業の画面に表示する名称を変更できます。サービスの種類・利用枠・料金は変わりません。</p>
  {serviceLabelKeys.map(key=><label key={key} className="grid gap-1 text-base font-medium sm:grid-cols-2 sm:items-center">{defaultServiceLabels[key]}<input required maxLength={24} disabled={busy} value={draft[key]} onChange={e=>setDraft(old=>({...old,[key]:e.target.value}))} className="min-h-11 rounded-lg border border-neutral-300 px-3 py-2 text-base"/></label>)}
  <div className="grid grid-cols-2 gap-2">{serviceLabelKeys.map(key=><div key={key} className="rounded-lg bg-emerald-50 p-3 text-base text-emerald-900">＋ {draft[key].trim()||defaultServiceLabels[key]}を{key==="class"?"追加する":"作る"}</div>)}</div>
  <button type="button" disabled={busy} onClick={()=>{setDraft({...defaultServiceLabels});setMessage("");}} className="min-h-11 rounded-lg border px-3 text-base">標準の名称に戻す</button>
  <button disabled={busy||serviceLabelKeys.some(k=>!draft[k].trim())} className="min-h-11 rounded-lg bg-emerald-800 px-3 text-base font-semibold text-white disabled:opacity-50">呼び方を保存</button>
  {message&&<p role={failed?"alert":"status"} className={failed?"text-red-800":"text-emerald-800"}>{message}</p>}
 </form>;
}
