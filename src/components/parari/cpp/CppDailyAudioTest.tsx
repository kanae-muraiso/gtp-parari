"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ConnectionState="idle"|"connecting"|"ready"|"left"|"error";

/**
 * One Daily call per 10-minute conversation. Audio and video are independent
 * local permissions inside Daily; switching Chat visibility never unmounts it.
 */
export default function CppDailyAudioTest({callId,endsAt}:{callId:string;endsAt:string}) {
 const [enabled,setEnabled]=useState(false);
 const [url,setUrl]=useState("");
 const [error,setError]=useState("");
 const [state,setState]=useState<ConnectionState>("idle");
 const [clock,setClock]=useState(Date.now());
 const attempt=useRef(0);
 const remaining=Math.max(0,Math.ceil((Date.parse(endsAt)-clock)/1000));

 useEffect(()=>{
   let current=true;
   void fetch("/api/parari/live/cpp/audio-test",{cache:"no-store"})
     .then(res=>res.ok?res.json():null)
     .then(data=>{if(current)setEnabled(data?.enabled===true);})
     .catch(()=>{if(current)setEnabled(false);});
   return()=>{current=false;};
 },[]);
 useEffect(()=>{
   const interval=window.setInterval(()=>setClock(Date.now()),500);
   return()=>window.clearInterval(interval);
 },[]);
 useEffect(()=>{
   if(remaining>0)return;
   attempt.current+=1;
   setUrl("");
   setState("left");
 },[remaining]);
 useEffect(()=>()=>{attempt.current+=1;},[]);

 const connect=useCallback(async()=>{
   if(!supabase||Date.parse(endsAt)<=Date.now())return;
   const id=++attempt.current;
   setState("connecting");setError("");
   try{
     const {data:{session}}=await supabase.auth.getSession();
     if(!session?.access_token)throw Error("PARARIにログインしてください。");
     const res=await fetch("/api/parari/live/cpp/audio-test",{
       method:"POST",
       headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},
       body:JSON.stringify({callId}),cache:"no-store",
     });
     const json=await res.json();
     if(!res.ok)throw Error(res.status===503?"通話機能が有効になっていません。":
       res.status===502?`Daily接続エラー（段階：${typeof json.stage==="string"?json.stage:"unknown"}）`:
       json.error??"接続できません。");
     const daily=new URL(json.roomUrl);
     if(daily.protocol!=="https:"||!daily.hostname.endsWith(".daily.co"))
       throw Error("Daily接続先を確認できません。");
     if(Date.parse(json.sessionExpiresAt)<=Date.now())
       throw Error("10分間が終了しました。");
     daily.searchParams.set("t",json.token);
     if(id!==attempt.current)return;
     setUrl(daily.toString());
     setState("ready");
   }catch(e){
     if(id!==attempt.current)return;
     setState("error");
     setError(e instanceof Error?e.message:"接続できません。");
   }
 },[callId,endsAt]);

 // Prepare once for both users, regardless of their preferred media.
 useEffect(()=>{
   if(!enabled||state!=="idle")return;
   void connect();
 },[enabled,state,connect]);

 function disconnect(){
   attempt.current+=1;
   setUrl("");
   setState("left");
   setError("");
 }
 if(!enabled)return <p className="text-sm text-neutral-500">音声・ビデオ接続は現在利用できません。テキストは利用できます。</p>;
 return <section className="space-y-3" aria-label="Daily通話パネル">
   <div className="flex items-center justify-between gap-3">
     <h3 className="font-bold">通話（音声・ビデオ共通）</h3>
     <span className="text-xs text-neutral-500">{state==="ready"?"接続画面を表示中":state==="connecting"?"接続準備中":state==="left"?"通話から退出しました":"接続待機中"}</span>
   </div>
   <p className="text-xs text-neutral-600">
    2人は同じ通話ルームを使います。マイクとカメラはDaily画面内でそれぞれ自由にON/OFFできます。カメラは最初OFFです。
   </p>
   {url&&remaining>0?<iframe title="Daily通話" src={url} allow="microphone; camera; autoplay"
     className="h-[420px] w-full rounded-xl border"/>:null}
   {url?<button type="button" onClick={disconnect} className="rounded-full border px-4 py-2 text-sm">
       Daily通話から退出
     </button>
     :<button type="button" disabled={state==="connecting"||remaining===0}
       onClick={()=>void connect()}
       className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-40">
       {state==="connecting"?"接続準備中…":"通話に接続する"}
     </button>}
   {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 </section>;
}
