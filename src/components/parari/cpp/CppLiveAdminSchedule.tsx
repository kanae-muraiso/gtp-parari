"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import CppLiveSchedule from "@/components/parari/cpp/CppLiveSchedule";

const roles=[["alumni","同窓会"],["researcher","研究者"],["company","企業"]] as const;
export default function CppLiveAdminSchedule(){
 const [admin,setAdmin]=useState(false);
 const [checked,setChecked]=useState(false);
 const [title,setTitle]=useState("CPP LIVE");
 const [date,setDate]=useState("");
 const [hour,setHour]=useState("20:00");
 const [duration,setDuration]=useState(60);
 const [audience,setAudience]=useState<string[]>(["alumni"]);
 const [saving,setSaving]=useState(false);
 const [result,setResult]=useState("");
 const [devEventId,setDevEventId]=useState("");
 useEffect(()=>{
   let live=true;
   async function check(){
    const {data}=await supabase?.rpc("cpp_mode_status")??{data:null};
    if(live){setAdmin(data?.[0]?.mode==="admin");setChecked(true);}
   }
   void check();return()=>{live=false;};
 },[]);
 const createDevelopmentEvent=async()=>{
   if(!supabase||!admin||saving)return;
   setSaving(true);setResult("");
   const {data,error}=await supabase.rpc("cpp_live_create_development_event");
   if(error)setResult("開発イベントを作れませんでした："+error.message);
   else setDevEventId(String(data));
   setSaving(false);
 };
 const save=async()=>{
   if(!supabase||!admin||saving||!date||!title.trim()||audience.length===0)return;
   setSaving(true);setResult("");
   // Creator-facing scheduling is in JST, regardless of browser timezone.
   const start=new Date(`${date}T${hour}:00+09:00`);
   const end=new Date(start.getTime()+duration*60000);
   if(!Number.isFinite(start.valueOf())){setResult("日時を確認してください。");setSaving(false);return;}
   const {error}=await supabase.rpc("cpp_live_create_event",{
     p_title:title.trim(),p_starts_at:start.toISOString(),p_ends_at:end.toISOString(),
     p_audience:audience,p_timezone:"Asia/Tokyo",
   });
   setResult(error?"保存に失敗しました："+error.message:"開催予定を登録しました。");
   setSaving(false);
 };
 if(!checked)return <p className="p-6">管理者権限を確認しています…</p>;
 if(!admin)return <p className="p-6">管理者モードで開いてください。</p>;
 return <main className="mx-auto max-w-6xl px-4 py-8">
   <h1 className="text-2xl font-bold">CPP LIVE開催管理</h1>
   <p className="mt-2 text-sm text-neutral-600">日時は日本時間で登録します。参加者には現地時間で表示します。</p>
   <section className="mt-6 max-w-xl space-y-4 rounded-2xl border bg-white p-6">
     <label className="block text-sm font-semibold">イベント名
       <input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} className="mt-2 w-full rounded-lg border p-3" />
     </label>
     <label className="block text-sm font-semibold">開催日（日本時間）
       <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-2 w-full rounded-lg border p-3"/>
     </label>
     <label className="block text-sm font-semibold">開始時刻（日本時間）
       <input type="time" value={hour} onChange={e=>setHour(e.target.value)} className="mt-2 w-full rounded-lg border p-3"/>
     </label>
     <label className="block text-sm font-semibold">開催時間
       <select value={duration} onChange={e=>setDuration(Number(e.target.value))} className="mt-2 w-full rounded-lg border p-3">
         <option value={60}>60分</option><option value={90}>90分</option><option value={120}>120分</option>
       </select>
     </label>
     <fieldset><legend className="text-sm font-semibold">参加対象</legend>
       <div className="mt-3 flex flex-wrap gap-4">{roles.map(([key,name])=><label key={key} className="flex gap-2 text-sm">
         <input type="checkbox" checked={audience.includes(key)}
          onChange={e=>setAudience(old=>e.target.checked?[...old,key]:old.filter(x=>x!==key))}/>{name}
       </label>)}</div>
     </fieldset>
     <button onClick={()=>void save()} disabled={saving||!date||!title.trim()||audience.length===0}
       className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">
       {saving?"登録中…":"開催予定を登録"}
     </button>
     {result&&<p role="status" className="text-sm">{result}</p>}
   </section>
   <section className="mt-6 max-w-xl space-y-3 rounded-2xl border border-dashed bg-white p-6">
     <h2 className="text-lg font-bold">管理者専用・開発用LIVE</h2>
     <p className="text-sm text-neutral-600">一般の開催一覧には表示されません。開発イベントIDを発行すると60分間有効になります。</p>
     <button onClick={()=>void createDevelopmentEvent()} disabled={saving} className="rounded-full border px-5 py-3 text-sm font-bold disabled:opacity-40">開発用イベントIDを発行</button>
     {devEventId&&<div className="space-y-2">
       <p className="break-all text-xs">イベントID：{devEventId}</p>
       <Link className="inline-block rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white" href={`/my/cpp/live/room/${devEventId}`}>開発用会場を開く →</Link>
     </div>}
   </section>
   <div className="mt-8"><CppLiveSchedule/></div>
 </main>;
}
