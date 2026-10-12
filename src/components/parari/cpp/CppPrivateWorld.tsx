"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CppDailyAudioTest from "./CppDailyAudioTest";

type Chat={sender_id:string;body:string;created_at:string};
export default function CppPrivateWorld({
 callId,endsAt,selfId,messages,busy,sendMessage,now,reviewing,onExit,onReturn,
}:{
 callId:string;endsAt:string;selfId:string;messages:Chat[];busy:boolean;
 sendMessage:(message:string)=>void;now:number;reviewing:boolean;
 onExit:()=>void;onReturn:()=>void;
}) {
 const [showChat,setShowChat]=useState(false);
 const [draft,setDraft]=useState("");
 const [starred,setStarred]=useState(false);
 const [memo,setMemo]=useState("");
 const [showMemo,setShowMemo]=useState(false);
 const [noteBusy,setNoteBusy]=useState(false);
 const [noteError,setNoteError]=useState("");
 const [noteLoaded,setNoteLoaded]=useState(false);
 useEffect(()=>{
   let live=true;
   void supabase?.rpc("cpp_live_note_get",{p_call_id:callId}).then(({data,error})=>{
     if(!live)return;
     if(error){setNoteError("記録を読み込めませんでした。");return;}
     const note=(data??[])[0] as {starred:boolean;memo:string}|undefined;
     setStarred(note?.starred??false);setMemo(note?.memo??"");setNoteLoaded(true);
   });
   return()=>{live=false;};
 },[callId]);
 const saveNote=useCallback(async(nextStarred:boolean,nextMemo:string)=>{
   if(!supabase)return;
   setNoteBusy(true);setNoteError("");
   const {error}=await supabase.rpc("cpp_live_note_save",{p_call_id:callId,p_starred:nextStarred,p_memo:nextMemo});
   if(error)setNoteError("保存できませんでした。もう一度お試しください。");
   else{setStarred(nextStarred);setMemo(nextMemo);}
   setNoteBusy(false);
 },[callId]);

 const remaining=Math.max(0,Math.ceil((Date.parse(endsAt)-now)/1000));
 const clock=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,"0")}`;
 return <main className="min-h-[80vh] bg-neutral-50 px-4 py-6">
  <section className="mx-auto max-w-4xl space-y-5 rounded-2xl border bg-white p-5">
   <div className="flex items-center justify-between gap-4 border-b pb-4">
    <div><h2 className="text-xl font-bold">{reviewing?"PRIVATE TALK · 振り返り":"PRIVATE TALK"}</h2>
     <p className="text-xs text-neutral-500">{reviewing?"通信は終了しました。メモは時間制限なく残せます。":"会話は最大10分。終了後は振り返り画面に移ります。"}</p></div>
    {!reviewing&&<div aria-live="off" className="font-mono text-2xl font-bold tabular-nums">{clock}</div>}
   </div>
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
   <section className="space-y-2 rounded-xl border bg-neutral-50 p-3" aria-label="自分だけの会話記録">
     <div className="flex flex-wrap items-center justify-between gap-2">
       <div><p className="text-sm font-semibold">この出会いを記録</p>
         <p className="text-xs text-neutral-500">相手には通知されません。後から変更できます。</p></div>
       <button type="button" aria-pressed={starred} disabled={!noteLoaded||noteBusy}
         onClick={()=>void saveNote(!starred,memo)}
         className={`rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-50 ${starred?"border-amber-400 bg-amber-100 text-amber-900":"bg-white"}`}>
         {starred?"★ 気になる（記録済み）":"☆ 気になる"}
       </button>
     </div>
     <button type="button" aria-expanded={reviewing||showMemo} onClick={()=>setShowMemo(v=>!v)}
       className="text-xs font-medium underline">{showMemo?"メモを閉じる":"メモを残す（任意）"}</button>
     {(reviewing||showMemo)&&<form className="space-y-2" onSubmit={e=>{e.preventDefault();void saveNote(starred,memo);}}>
       <textarea aria-label="自分だけのメモ" value={memo} onChange={e=>setMemo(e.target.value)}
         maxLength={2000} rows={2} placeholder="話題、次に聞きたいことなど（相手には見えません）"
         className="w-full rounded-lg border bg-white p-2 text-sm"/>
       <button type="submit" disabled={!noteLoaded||noteBusy}
         className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
         {noteBusy?"保存中…":"メモを保存"}</button>
     </form>}
     {noteError&&<p role="alert" className="text-xs text-red-700">{noteError}</p>}
   </section>

   {!reviewing&&showChat&&<div className="space-y-3 rounded-xl border p-4">
     <section className="max-h-72 min-h-32 space-y-2 overflow-y-auto rounded-xl bg-neutral-50 p-4" aria-label="会話メッセージ">
       {messages.map((m,i)=><p key={i} className="text-sm">
         <b>{m.sender_id===selfId?"自分":"相手"}：</b>{m.body}
       </p>)}
     </section>
     <form onSubmit={e=>{e.preventDefault();if(draft.trim()&&remaining>0){
       sendMessage(draft.trim());setDraft("");
     }}} className="flex gap-2">
       <input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={2000}
         placeholder="メッセージを入力" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"/>
       <button type="submit" disabled={busy||remaining===0||!draft.trim()}
         className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40">送信</button>
     </form>
   </div>}
   {reviewing?<button type="button" onClick={onReturn} disabled={noteBusy}
     className="w-full rounded-lg bg-neutral-900 px-5 py-3 font-semibold text-white disabled:opacity-50">LIVE会場に戻る</button>
     :<button type="button" onClick={onExit} disabled={busy}
       className="w-full rounded-lg border px-5 py-3 font-semibold disabled:opacity-50">Talk Roomを退出</button>}
  </section>
 </main>;
}
