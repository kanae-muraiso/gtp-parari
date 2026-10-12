"use client";
import { useEffect,useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/** Small, explicitly activated audio-only proof-of-connectivity. */
export default function CppDailyAudioTest({callId,endsAt,initialMode="audio"}:{callId:string;endsAt:string;initialMode?:"audio"|"video"}) {
 const [enabled,setEnabled]=useState(false);
 const [mode,setMode]=useState<"audio"|"video">(initialMode);
 const [url,setUrl]=useState("");
 const [error,setError]=useState("");
 const [connecting,setConnecting]=useState(false);
 const [time,setTime]=useState(Date.now());
 const remaining=Math.max(0,Math.ceil((Date.parse(endsAt)-time)/1000));
 useEffect(()=>{
   let current=true;
   void fetch("/api/parari/live/cpp/audio-test",{cache:"no-store"})
     .then(res=>res.ok?res.json():null)
     .then(data=>{if(current)setEnabled(data?.enabled===true);})
     .catch(()=>{if(current)setEnabled(false);});
   return()=>{current=false;};
 },[]);
 useEffect(()=>{
   const interval=window.setInterval(()=>setTime(Date.now()),500);
   return()=>window.clearInterval(interval);
 },[]);
 useEffect(()=>{if(remaining===0)setUrl("");},[remaining]);
 async function start(){
   if(connecting||remaining<=0||!supabase)return;
   setConnecting(true);setError("");
   try{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session?.access_token)throw Error("PARARIにログインしてください。");
    const res=await fetch("/api/parari/live/cpp/audio-test",{
      method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},
      body:JSON.stringify({callId,mode}),cache:"no-store",
    });
    const json=await res.json();
    if(!res.ok)throw Error(res.status===503?"音声テスト機能がまだ有効になっていません。":res.status===502?`Daily接続エラー（段階：${typeof json.stage==="string"?json.stage:"unknown"}）`:json.error??"接続できません。");
    const daily=new URL(json.roomUrl);
    if(daily.protocol!=="https:"||!daily.hostname.endsWith(".daily.co"))throw Error("Daily接続先を確認できません。");
    if(Date.parse(json.sessionExpiresAt)<=Date.now())throw Error("10分間が終了しました。");
    daily.searchParams.set("t",json.token);
    setUrl(daily.toString());
   }catch(e){setError(e instanceof Error?e.message:"接続できません。");}
   finally{setConnecting(false);}
 }
 if(!enabled)return null;
 return <section className="rounded-xl border bg-white p-4 space-y-3">
   <h3 className="font-bold">Daily {mode==="audio"?"音声":"ビデオ"}接続</h3>
   <p className="text-xs text-neutral-600">2人で同じ10分間を共有します。映像を使う場合はカメラを許可してください。</p>
   <div className="flex gap-2">
     <button type="button" onClick={()=>{setUrl("");setMode("audio");}} className={`rounded-full px-4 py-2 text-sm ${mode==="audio"?"bg-neutral-900 text-white":"border"}`}>音声</button>
     <button type="button" onClick={()=>{setUrl("");setMode("video");}} className={`rounded-full px-4 py-2 text-sm ${mode==="video"?"bg-neutral-900 text-white":"border"}`}>ビデオ</button>
   </div>
   {!url?<button disabled={connecting||remaining<=0} onClick={()=>void start()} className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{connecting?"接続中…":mode==="audio"?"音声に接続":"ビデオに接続"}</button>:
     <><iframe title="Daily音声テスト" src={url} allow="microphone; autoplay; camera" className="h-[420px] w-full rounded-xl border"/>
     <button className="rounded-full border px-4 py-2 text-sm" onClick={()=>setUrl("")}>音声接続を終了</button></>}
   {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 </section>;
}
