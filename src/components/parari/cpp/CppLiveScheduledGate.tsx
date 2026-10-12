"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CppLiveSchedule from "./CppLiveSchedule";
import CppLiveModeGate from "./CppLiveModeGate";

type EventRow={id:string; title:string; starts_at:string; ends_at:string; audience:string[]; can_enter:boolean};
export default function CppLiveScheduledGate(){
 const [events,setEvents]=useState<EventRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
   if(!supabase){setError("開催情報を確認できません。");setLoading(false);return;}
   const {data,error:rpcError}=await supabase.rpc("cpp_live_upcoming_events");
   if(rpcError){setError("現在LIVE開催情報を取得できません。");setEvents([]);}
   else {setEvents((data??[]) as EventRow[]);setError("");}
   setLoading(false);
 },[]);
 useEffect(()=>{
   void load();
   const interval=window.setInterval(()=>void load(),15000);
   return ()=>window.clearInterval(interval);
 },[load]);
 const open=events.some(e=>e.can_enter);
 return <main className="min-h-screen bg-neutral-50 pt-16">
   <div className="mx-auto max-w-6xl px-4 pt-6">
     <h1 className="text-2xl font-bold">CPP MATCHING · LIVE</h1>
     <p className="mt-2 text-sm text-neutral-600">開催予定はいつでも確認できます。開催時間になると、参加資格のある方は会場に入れます。</p>
   </div>
   <CppLiveSchedule/>
   {loading ? <p className="mx-auto max-w-6xl px-4 py-4 text-sm text-neutral-600">開催状況を確認しています…</p>
    : error ? <p role="alert" className="mx-auto max-w-6xl px-4 py-4 text-sm text-red-700">{error} 会場への入室は停止しています。</p>
    : open ? <CppLiveModeGate/>
    : <section className="mx-auto max-w-6xl px-4 pb-10"><div className="rounded-2xl border bg-white p-6">
       <h2 className="text-lg font-bold">LIVE会場は現在閉場しています</h2>
       <p className="mt-2 text-sm text-neutral-600">開催日時と参加対象をご確認ください。入室可能な時間になると会場が表示されます。</p>
      </div></section>}
 </main>;
}
