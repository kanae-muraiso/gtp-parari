"use client";

import Link from "next/link";
import CppPrivateWorld from "./CppPrivateWorld";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Person={user_id:string;display_name:string;photo_url:string|null;live_role:string;is_me:boolean};
type Call={id:string;requester_id:string;invited_id:string;status:string;created_at:string;ends_at:string|null};
type Chat={sender_id:string;body:string;created_at:string};
const roleLabels:Record<string,string>={admin:"管理者",alumni:"同窓会",researcher:"研究者",company:"企業"};
const roleColors:Record<string,string>={admin:"bg-violet-500",alumni:"bg-emerald-600",researcher:"bg-indigo-600",company:"bg-orange-500"};

export default function CppLiveUnifiedVenue({eventId}:{eventId:string}) {
 const [joined,setJoined]=useState(false);
 const [people,setPeople]=useState<Person[]>([]);
 const [calls,setCalls]=useState<Call[]>([]);
 const [messages,setMessages]=useState<Chat[]>([]);
 const [draft,setDraft]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [selfId,setSelfId]=useState("");
 const [now,setNow]=useState(Date.now());
 const [talkId,setTalkId]=useState<string|null>(null);
 const [reviewing,setReviewing]=useState(false);
 const latest=calls.find(x=>x.status==="active"&&(x.ends_at?Date.parse(x.ends_at)>now:false))
   ??calls.find(x=>x.status==="pending");

 const refresh=useCallback(async()=>{
   if(!supabase)return;
   const [r,c]=await Promise.all([
     supabase.rpc("cpp_live_event_roster",{p_event_id:eventId}),
     supabase.rpc("cpp_live_event_my_calls",{p_event_id:eventId})
   ]);
   if(r.error||c.error){setError("会場の状態を更新できませんでした。");return;}
   setPeople((r.data??[]) as Person[]);
   const all=(c.data??[]) as Call[];
   setCalls(all);
   const active=all.find(x=>x.status==="active"&&x.ends_at&&Date.parse(x.ends_at)>Date.now());
   if(active){
     const m=await supabase.rpc("cpp_live_event_chat",{p_call_id:active.id});
     if(!m.error)setMessages((m.data??[]) as Chat[]);
   }else setMessages([]);
 },[eventId]);

 useEffect(()=>{
   let disposed=false;
   void supabase?.auth.getUser().then(({data})=>{if(!disposed)setSelfId(data.user?.id??"");});
   const interval=window.setInterval(()=>{
     setNow(Date.now());
     if(joined){void supabase?.rpc("cpp_live_event_join",{p_event_id:eventId,p_active:true}).then(({error:e})=>{
       if(e){setJoined(false);setError("イベントが終了したか、参加資格がありません。");}
     });void refresh();}
   },5000);
   return()=>{disposed=true;window.clearInterval(interval);};
 },[eventId,joined,refresh]);

 useEffect(()=>{
   if(!joined)return;
   const active=calls.find(c=>c.status==="active" && !!c.ends_at && Date.parse(c.ends_at)>now);
   if(active && !talkId){setTalkId(active.id);setReviewing(false);}
   if(talkId && !reviewing && (!active || active.id!==talkId)){setReviewing(true);}
 },[calls,joined,now,talkId,reviewing]);

 const exitTalk=()=>void act(async()=>{
   if(!supabase||!talkId)return {error:{message:"会話を確認できません"}};
   const res=await supabase.rpc("cpp_live_event_end_call",{p_call_id:talkId});
   if(!res.error)setReviewing(true);
   return res;
 });
 const returnToVenue=()=>{
   setReviewing(false);setTalkId(null);setMessages([]);
 };
 const act=async(fn:()=>Promise<{error: {message:string}|null}>)=>{
   setBusy(true);setError("");
   try{const res=await fn();if(res.error)setError(res.error.message);else await refresh();}
   catch{setError("操作に失敗しました。");}
   setBusy(false);
 };
 const enter=()=>void act(async()=>{
   if(!supabase)return {error:{message:"接続できません"}};
   const {error:e}=await supabase.rpc("cpp_live_event_join",{p_event_id:eventId,p_active:true});
   if(!e){setJoined(true);await refresh();}
   return {error:e};
 });
 const leave=()=>void act(async()=>{
   if(!supabase)return {error:{message:"接続できません"}};
   const {error:e}=await supabase.rpc("cpp_live_event_join",{p_event_id:eventId,p_active:false});
   if(!e){setJoined(false);setPeople([]);setCalls([]);}
   return {error:e};
 });
 const request=(id:string)=>void act(async()=>supabase!.rpc("cpp_live_event_request",{p_event_id:eventId,p_target_id:id}));
 const respond=(id:string,accept:boolean)=>void act(async()=>supabase!.rpc("cpp_live_event_respond",{p_call_id:id,p_accept:accept}));
 const send=()=>void act(async()=>{
   const text=draft.trim();
   if(!latest||latest.status!=="active"||!text)return {error:{message:"会話できません"}};
   const res=await supabase!.rpc("cpp_live_event_send",{p_call_id:latest.id,p_body:text});
   if(!res.error)setDraft("");
   return res;
 });
 const remaining=latest?.ends_at?Math.max(0,Math.ceil((Date.parse(latest.ends_at)-now)/1000)):0;
 const timeLabel=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,"0")}`;
 const trackedCall=talkId?calls.find(c=>c.id===talkId):undefined;
 if(joined && trackedCall?.ends_at) {
   return <CppPrivateWorld
     key={trackedCall.id}
     callId={trackedCall.id}
     endsAt={trackedCall.ends_at}
     selfId={selfId}
     messages={messages}
     busy={busy}
     now={now}
     reviewing={reviewing || trackedCall.status!=="active" || Date.parse(trackedCall.ends_at)<=now}
     onExit={exitTalk}
     onReturn={returnToVenue}
     sendMessage={(text)=>{void act(async()=>supabase!.rpc("cpp_live_event_send",{p_call_id:trackedCall.id,p_body:text}));}}
   />;
 }
 return <section className="mx-auto max-w-6xl space-y-5 px-4 pb-12">
   <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
     <div><h2 className="font-bold">CPP LIVE 会場</h2>
       <p className="text-sm text-neutral-500">研究者・企業・同窓会・管理者が同じ会場で交流します。</p></div>
     {joined?<button className="rounded-full border px-5 py-2 text-sm font-bold" disabled={busy} onClick={leave}>会場から退出</button>
       :<button className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-bold text-white" disabled={busy} onClick={enter}>会場に入る</button>}
   </div>
   {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
   {joined&&<>
     <div className="rounded-xl border bg-white p-5">
       <h2 className="font-bold">今ここにいる人（{people.length}人）</h2>
       <div className="mt-4 flex flex-wrap gap-4">{people.map(p=>
         <div key={p.user_id} className="w-32 space-y-2 text-center">
           <div className={`mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full text-white ${roleColors[p.live_role]??"bg-gray-500"}`}>
             {p.photo_url?<img src={p.photo_url} alt="" className="h-full w-full object-cover"/>:p.display_name.slice(0,1)}
           </div>
           <p className="break-words text-sm font-semibold">{p.display_name}{p.is_me?"（自分）":""}</p>
           <p className="text-xs text-neutral-500">{roleLabels[p.live_role]??p.live_role}</p>
           {!p.is_me&&(!latest||latest.status==="ended"||latest.status==="declined")&&
             <button disabled={busy} className="rounded-full border px-3 py-1 text-xs" onClick={()=>request(p.user_id)}>10分会話を申し込む</button>}
         </div>)}</div>
     </div>
     {latest&&<div className="space-y-3 rounded-xl border bg-white p-5">
       {latest.status==="pending"?
         <>{latest.invited_id===selfId?<><h3 className="font-bold">会話の申し込みがあります</h3>
             <div className="flex gap-2"><button disabled={busy} className="rounded-full bg-neutral-900 px-4 py-2 text-sm text-white" onClick={()=>respond(latest.id,true)}>承諾する</button>
             <button disabled={busy} className="rounded-full border px-4 py-2 text-sm" onClick={()=>respond(latest.id,false)}>辞退する</button></div></>
           :<p className="text-sm">相手の承諾を待っています（申し込みの有効期限は2分）。</p>}</>
       :latest.status==="active"&&<>
         <div className="flex items-center justify-between"><h3 className="font-bold">10分間の会話</h3><span className="font-mono text-lg font-bold">{timeLabel}</span></div>
         <div className="max-h-72 min-h-28 space-y-2 overflow-y-auto rounded-lg bg-neutral-50 p-3">
           {messages.map((m,i)=><p key={i} className="text-sm"><b>{m.sender_id===selfId?"自分":"相手"}：</b>{m.body}</p>)}
         </div>
         <form onSubmit={e=>{e.preventDefault();send();}} className="flex gap-2">
           <input className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" value={draft} maxLength={2000} onChange={e=>setDraft(e.target.value)} placeholder="メッセージを入力"/>
           <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white" disabled={busy||remaining<=0||!draft.trim()} type="submit">送信</button>
         </form>

         <p className="text-xs text-neutral-500">10分経過後は自動終了します。音声の実機接続は検証段階です。</p>
       </>}
     </div>}
   </>}
   <Link href="/my/cpp/live" className="inline-block text-sm underline">← 開催案内へ戻る</Link>
 </section>;
}
