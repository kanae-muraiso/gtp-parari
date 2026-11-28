"use client";
import {useState} from "react";
import {classRequest} from "@/lib/classRequests";
import {defaultServiceLabels,serviceLabelKeys,defaultRoleLabels,roleLabelKeys,allLabelPatch,type ServiceLabels,type RoleLabels} from "@/lib/classServiceLabels";
export default function ClassServiceLabelSettings({labels,roles,onSaved,preview=false,schoolId}:{labels:ServiceLabels;roles:RoleLabels;onSaved:(labels:ServiceLabels,roles:RoleLabels)=>void;preview?:boolean;schoolId:string}){
 const [draft,setDraft]=useState(labels),[roleDraft,setRoleDraft]=useState(roles),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[failed,setFailed]=useState(false);
 const roleTitles={operator:"運営者",learner:"参加者",proxy:"代理申込者",admission:"手続き"};
 const field="min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-base";
 async function save(){
  if(busy)return;
  const patch=allLabelPatch(draft,roleDraft);
  if(!patch){setFailed(true);setMessage("呼び方は1〜24文字で入力してください。");return;}
  setBusy(true);setMessage("");setFailed(false);
  try{
   const clean=Object.fromEntries(serviceLabelKeys.map(key=>[key,draft[key].trim()])) as ServiceLabels;
   const cleanRoles=Object.fromEntries(roleLabelKeys.map(key=>[key,roleDraft[key].trim()])) as RoleLabels;
   if(preview)sessionStorage.setItem("class-labels:"+schoolId,JSON.stringify(patch));
   else await classRequest("/admissions",{action:"allLabels",labels:clean,roles:cleanRoles});
   setDraft(clean);setRoleDraft(cleanRoles);onSaved(clean,cleanRoles);setMessage(preview?"このブラウザ内に保存しました。":"保存しました。");
  }catch(e){setFailed(true);setMessage(e instanceof Error?e.message:"保存できませんでした。");}
  finally{setBusy(false);}
 }
 return <form onSubmit={e=>{e.preventDefault();void save();}} className="grid gap-4 rounded-xl border border-neutral-200 bg-white p-4">
  <fieldset className="grid gap-3"><legend className="mb-2 text-lg font-bold">サービス</legend>
   {serviceLabelKeys.map(key=><label key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-center gap-2 text-base">{defaultServiceLabels[key]}<input required maxLength={24} disabled={busy} value={draft[key]} onChange={e=>setDraft(old=>({...old,[key]:e.target.value}))} className={field}/></label>)}
  </fieldset>
  <fieldset className="grid gap-3 border-t pt-3"><legend className="mb-2 text-lg font-bold">人・手続き</legend>
   {roleLabelKeys.map(key=><label key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-center gap-2 text-base">{roleTitles[key]}<input required maxLength={24} disabled={busy} value={roleDraft[key]} onChange={e=>setRoleDraft(old=>({...old,[key]:e.target.value}))} className={field}/></label>)}
  </fieldset>
  <div className="flex flex-wrap gap-2">
   <button type="submit" disabled={busy||!allLabelPatch(draft,roleDraft)} className="min-h-11 flex-1 rounded-lg bg-emerald-800 px-3 text-base font-semibold text-white disabled:opacity-50">一括保存</button>
   <button type="button" disabled={busy} onClick={()=>{setDraft({...defaultServiceLabels});setRoleDraft({...defaultRoleLabels});setMessage("");}} className="min-h-11 rounded-lg border px-3 text-base">標準に戻す</button>
  </div>
  {message&&<p role={failed?"alert":"status"} className={failed?"text-red-800":"text-emerald-800"}>{message}</p>}
 </form>;
}
