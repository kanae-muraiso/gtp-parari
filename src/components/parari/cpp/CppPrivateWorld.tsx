"use client";
import { useState } from "react";
import CppDailyAudioTest from "./CppDailyAudioTest";

type Chat = { sender_id:string; body:string; created_at:string };
export default function CppPrivateWorld({
 callId,endsAt,selfId,messages,busy,sendMessage,now,
}:{
 callId:string;endsAt:string;selfId:string;messages:Chat[];busy:boolean;
 sendMessage:(message:string)=>void;now:number;
}) {
 const [mode,setMode]=useState<"chat"|"audio"|"video">("chat");
 const [draft,setDraft]=useState("");
 const remaining=Math.max(0,Math.ceil((Date.parse(endsAt)-now)/1000));
 const clock=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,"0")}`;
 return <main className="min-h-[80vh] bg-neutral-50 px-4 py-6">
  <section className="mx-auto max-w-4xl space-y-5 rounded-2xl border bg-white p-5">
   <div className="flex items-center justify-between gap-4 border-b pb-4">
    <div><h2 className="text-xl font-bold">2人だけの会話</h2>
     <p className="text-xs text-neutral-500">10分経過後、自動で会場へ戻ります。</p></div>
    <div aria-live="off" className="font-mono text-2xl font-bold tabular-nums">{clock}</div>
   </div>
   <div className="flex flex-wrap gap-2" role="group" aria-label="会話の方法">
    {(["chat","audio","video"] as const).map(m=><button type="button" key={m} onClick={()=>setMode(m)}
      className={`rounded-full px-5 py-2 text-sm font-semibold ${mode===m?"bg-neutral-900 text-white":"border"}`}>
      {m==="chat"?"チャット":m==="audio"?"音声":"ビデオ"}</button>)}
   </div>
   <section className="max-h-80 min-h-48 space-y-2 overflow-y-auto rounded-xl bg-neutral-50 p-4" aria-label="会話メッセージ">
    {messages.map((m,i)=><p key={i} className="text-sm"><b>{m.sender_id===selfId?"自分":"相手"}：</b>{m.body}</p>)}
   </section>
   <form onSubmit={e=>{e.preventDefault();if(draft.trim()&&remaining>0){sendMessage(draft.trim());setDraft("");}}} className="flex gap-2">
    <input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={2000}
      placeholder="メッセージを入力" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"/>
    <button type="submit" disabled={busy||remaining===0||!draft.trim()} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40">送信</button>
   </form>
   {mode!=="chat"&&<CppDailyAudioTest key={`${callId}-${mode}`} callId={callId} endsAt={endsAt} initialMode={mode}/>}
  </section>
 </main>;
}
