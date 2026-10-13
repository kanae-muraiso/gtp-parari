"use client";
// src/components/parari/cpp/CppPrivateWorld.tsx / 2026-10-13 JST
// PART: Preserve private drafts independently of the media view.
import { useState } from "react";
import { CppLiveNote } from "./CppLiveNote";
import CppDailyAudioTest from "./CppDailyAudioTest";
import CppLiveNamecard from "./CppLiveNamecard";

type Chat={sender_id:string;body:string;created_at:string};
export default function CppPrivateWorld({
 callId,endsAt,selfId,messages,busy,sendMessage,now,reviewing,onExit,onReturn,eventId,partnerId,partnerName,
}:{
 callId:string;endsAt:string;selfId:string;messages:Chat[];busy:boolean;
 sendMessage:(message:string)=>Promise<boolean>;now:number;reviewing:boolean;
 onExit:()=>void;onReturn:()=>void;eventId:string;partnerId:string;partnerName:string;
}) {
 const [showChat,setShowChat]=useState(false);
 const [draft,setDraft]=useState("");
 const remaining=Math.max(0,Math.ceil((Date.parse(endsAt)-now)/1000));
 const clock=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,"0")}`;
 return <div className="min-h-[80vh] bg-neutral-50 px-4 py-6">
  <section className="mx-auto max-w-4xl space-y-5 rounded-2xl border bg-white p-5">
   <div className="flex items-center justify-between gap-4 border-b pb-4">
    <div><h2 className="text-xl font-bold">{reviewing?"PRIVATE TALK · 振り返り":"PRIVATE TALK"}</h2>
     <p className="text-sm font-semibold text-neutral-700">{partnerName}さんとの{reviewing?"会話の振り返り":"10分間"}</p>
     <p className="text-xs text-neutral-500">{reviewing?"通信は終了しました。メモは時間制限なく残せます。":"会話は最大10分。終了後は振り返り画面に移ります。"}</p></div>
    {!reviewing&&<div aria-live="off" className="font-mono text-2xl font-bold tabular-nums">{clock}</div>}
   </div>
   <div className="flex flex-wrap gap-2 items-center"><CppLiveNamecard eventId={eventId} userId={partnerId} label="お相手の名札を見る"/></div>
   {!reviewing&&<><div className="flex flex-wrap gap-2" aria-label="利用できる会話方法">
     <span className="rounded-full border px-4 py-2 text-sm">ビデオ（カメラON）</span>
     <span className="rounded-full bg-neutral-900 px-4 py-2 text-sm text-white">音声（初期状態）</span>
     <button type="button" aria-expanded={showChat} onClick={()=>setShowChat(v=>!v)}
       className="rounded-full border px-4 py-2 text-sm font-semibold">
       {showChat?"テキストを閉じる":"テキストを開く"}
       {messages.length>0?`（${messages.length}件）`:""}
     </button>
   </div>
   <CppDailyAudioTest callId={callId} endsAt={endsAt}/></>}
   <CppLiveNote userId={selfId} eventId={eventId} callId={callId} partnerName={partnerName} onReturn={reviewing?onReturn:undefined}/>

   {!reviewing&&showChat&&<div className="space-y-3 rounded-xl border p-4">
     <section className="max-h-72 min-h-32 space-y-2 overflow-y-auto rounded-xl bg-neutral-50 p-4" aria-label="会話メッセージ">
       {messages.map((m,i)=><p key={i} className="text-sm">
         <b>{m.sender_id===selfId?"自分":"相手"}：</b>{m.body}
       </p>)}
     </section>
     <form onSubmit={e=>{e.preventDefault();if(draft.trim()&&remaining>0){
       const sent=draft;void sendMessage(sent.trim()).then(ok=>{if(ok)setDraft(current=>current===sent?"":current);});
     }}} className="flex gap-2">
       <input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={2000}
         placeholder="メッセージを入力" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"/>
       <button type="submit" disabled={busy||remaining===0||!draft.trim()}
         className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40">送信</button>
     </form>
   </div>}
   {!reviewing&&<button type="button" onClick={onExit} disabled={busy}
       className="w-full rounded-lg border px-5 py-3 font-semibold disabled:opacity-50">Talk Roomを退出</button>}
  </section>
 </div>;
}
