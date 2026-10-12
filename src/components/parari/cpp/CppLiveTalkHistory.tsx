"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "@/lib/supabaseClient";
import SocialProfileCard from "@/components/parari/matching/SocialProfileCard";
import {cppMessageHref} from "@/lib/cppMessageNavigation";
type Item={call_id:string;event_id:string;event_title:string;started_at:string;ended_at:string|null;
 partner_id:string;display_name:string;photo_url:string|null;affiliation:string|null;role_title:string|null;
 topics:string[]|null;intro:string|null;starred:boolean;memo:string};
export default function CppLiveTalkHistory(){
 const [items,setItems]=useState<Item[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [expanded,setExpanded]=useState<string|null>(null);
 const [drafts,setDrafts]=useState<Record<string,string>>({});
 const [stars,setStars]=useState<Record<string,boolean>>({});
 const [saving,setSaving]=useState<string|null>(null);
 const load=useCallback(async()=>{
   if(!supabase){setError("接続設定を確認できません。");setLoading(false);return;}
   const {data,error:e}=await supabase.rpc("cpp_live_my_talk_history");
   setLoading(false);
   if(e){setError("会話履歴を読み込めませんでした。");return;}
   const rows=(data??[]) as Item[];
   setItems(rows);
   setDrafts(Object.fromEntries(rows.map(r=>[r.call_id,r.memo])));
   setStars(Object.fromEntries(rows.map(r=>[r.call_id,r.starred])));
 },[]);
 useEffect(()=>{void load();},[load]);
 async function save(item:Item){
   if(!supabase||saving)return;
   setSaving(item.call_id);setError("");
   const {error:e}=await supabase.rpc("cpp_live_note_save",{
     p_call_id:item.call_id,p_starred:stars[item.call_id]??false,p_memo:drafts[item.call_id]??""
   });
   if(e)setError("保存できませんでした。内容は画面に残っています。");
   else setItems(old=>old.map(r=>r.call_id===item.call_id?{...r,starred:stars[r.call_id]??false,memo:drafts[r.call_id]??""}:r));
   setSaving(null);
 }
 function dateLabel(value:string){return new Intl.DateTimeFormat("ja-JP",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value));}
 return <section className="mx-auto max-w-5xl space-y-5 px-4 py-8">
   <header className="flex flex-wrap items-center justify-between gap-3">
     <div><h1 className="text-2xl font-bold">会話履歴</h1>
       <p className="mt-1 text-sm text-neutral-500">実際に話した方との記録。印象とメモは自分だけに表示されます。</p></div>
     <Link href="/my/cpp/live" className="text-sm font-semibold underline">← LIVEへ戻る</Link>
   </header>
   {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
   {loading?<p>読み込み中…</p>:items.length===0?
     <div className="rounded-xl border bg-white p-6 text-sm text-neutral-600">会話履歴はまだありません。PRIVATE TALKを開始すると自動的に記録されます。</div>:
     items.map(item=><article key={item.call_id} className="rounded-2xl border bg-white p-5 space-y-3">
       <p className="text-xs text-neutral-500">{dateLabel(item.started_at)} · {item.event_title}</p>
       <div className="flex flex-wrap items-center gap-3">
         {item.photo_url?<img src={item.photo_url} alt="" className="h-12 w-12 rounded-full object-cover"/>:
           <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">{item.display_name.slice(0,1)}</div>}
         <div className="min-w-0 flex-1"><h2 className="font-bold">{item.display_name}</h2>
           <p className="text-xs text-neutral-500">{[item.affiliation,item.role_title].filter(Boolean).join(" · ")}</p></div>
         <button type="button" onClick={()=>setStars(o=>({...o,[item.call_id]:!o[item.call_id]}))}
           aria-pressed={stars[item.call_id]??false}
           className="rounded-full border px-3 py-2 text-sm">{stars[item.call_id]?"★ 気になる":"☆ 気になる"}</button>
         <button type="button" onClick={()=>setExpanded(v=>v===item.call_id?null:item.call_id)}
           className="rounded-full border px-3 py-2 text-sm">{expanded===item.call_id?"閉じる":"名札・メモを見る"}</button>
       </div>
       {expanded===item.call_id&&<div className="space-y-3">
         <SocialProfileCard displayName={item.display_name} photoUrl={item.photo_url}
           affiliation={item.affiliation} roleTitle={item.role_title} topics={item.topics} intro={item.intro} compact/>
         <label className="block text-sm font-semibold">自分だけのメモ
           <textarea rows={3} maxLength={2000} value={drafts[item.call_id]??""}
             onChange={e=>setDrafts(o=>({...o,[item.call_id]:e.target.value}))}
             className="mt-2 w-full rounded-xl border p-3 font-normal" placeholder="今後聞きたいことなど"/>
         </label>
       </div>}
       <div className="flex flex-wrap items-center gap-3">
         <button type="button" disabled={saving!==null} onClick={()=>void save(item)}
           className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
           {saving===item.call_id?"保存中…":"印・メモを保存"}</button>
         <Link href={cppMessageHref("cpp",{to:item.partner_id})}
           className="rounded-full border px-5 py-2 text-sm font-bold">メッセージへ →</Link>
       </div>
       <p className="text-xs text-neutral-500">連絡の可否はCPPのメッセージ利用資格と相手の受付設定に従います。LIVEで話しただけでは送信権限は増えません。</p>
     </article>)}
 </section>;
}
