"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CppLiveSpace from "@/components/parari/matching/CppLiveSpace";
import CppLiveQueueStatus from "@/components/parari/matching/CppLiveQueueStatus";
import CppLiveStayWarning from "@/components/parari/matching/CppLiveStayWarning";
import CppLiveStageMarker from "@/components/parari/matching/CppLiveStageMarker";
import CppLiveRoleLegend from "@/components/parari/matching/CppLiveRoleLegend";
import CppLiveOperators from "./CppLiveOperators";

/** Admin operator presence does not require CPP-R / CPP-C matching membership. */
export default function CppLiveModeGate() {
 const [mode,setMode]=useState<"admin"|"other"|null>(null);
 useEffect(()=>{
   let active=true;
   async function refresh(){
     if (!supabase) { if(active)setMode("other"); return; }
     const {data,error}=await supabase.rpc("cpp_mode_status");
     if(active)setMode(!error && data?.[0]?.mode==="admin"?"admin":"other");
   }
   void refresh();
   // Handle switching the display mode in settings followed by returning to LIVE.
   const onVisible=()=>{if(document.visibilityState==="visible")void refresh();};
   document.addEventListener("visibilitychange",onVisible);
   return()=>{active=false;document.removeEventListener("visibilitychange",onVisible);};
 },[]);
 if(mode===null)return <p className="mx-auto max-w-5xl p-6 text-sm">LIVEの参加資格を確認しています…</p>;
 if(mode==="admin")return <section className="mx-auto max-w-5xl px-4 py-8">
   <h1 className="text-2xl font-bold">CPP LIVE · 運営者入口</h1>
   <p className="mt-2 text-sm text-neutral-600">
     管理者として運営参加できます。研究者・企業のマッチング候補には表示されません。
   </p>
   <CppLiveOperators />
   <p className="mt-5 text-xs text-neutral-500">
     会場の参加者一覧や個別会話への接続は、開催型LIVEとの統合後に利用できるようになります。
   </p>
 </section>;
 return <><CppLiveOperators/><CppLiveSpace/><CppLiveQueueStatus/><CppLiveStageMarker/><CppLiveStayWarning/><CppLiveRoleLegend/></>;
}
