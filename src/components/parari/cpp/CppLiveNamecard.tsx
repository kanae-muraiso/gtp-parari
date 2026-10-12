"use client";
import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabaseClient";
import SocialProfileCard from "@/components/parari/matching/SocialProfileCard";

type Card={display_name:string;photo_url:string|null;live_role:string;affiliation:string|null;role_title:string|null;topics:string[]|null;intro:string|null};
const labels:Record<string,string>={admin:"管理者",alumni:"同窓会",researcher:"研究者",company:"企業"};

export default function CppLiveNamecard({eventId,userId,label="名札を見る"}:{
 eventId:string;userId:string;label?:string;
}){
 const [open,setOpen]=useState(false);
 const [card,setCard]=useState<Card|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 useEffect(()=>{
   if(!open)return;
   let active=true;
   setLoading(true);setError("");setCard(null);
   void supabase?.rpc("cpp_live_event_namecard",{p_event_id:eventId,p_user_id:userId})
     .then(({data,error:e})=>{
       if(!active)return;
       setLoading(false);
       if(e||!data?.length){setError("名札を表示できませんでした。");return;}
       setCard(data[0] as Card);
     });
   return()=>{active=false;};
 },[open,eventId,userId]);
 return <>
   <button type="button" onClick={()=>setOpen(true)}
     className="rounded-full border border-neutral-400 bg-white px-4 py-2 text-sm font-semibold text-neutral-900">
     {label}
   </button>
   {open&&<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      role="presentation" onClick={()=>setOpen(false)}>
     <div role="dialog" aria-modal="true" aria-label="相手の名札"
       onClick={e=>e.stopPropagation()}
       className="max-h-[85vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
       <div className="flex justify-end">
         <button type="button" onClick={()=>setOpen(false)} className="rounded-full border px-4 py-2 text-sm">
           閉じる
         </button>
       </div>
       {loading&&<p className="text-sm text-neutral-600">名札を読み込んでいます…</p>}
       {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
       {card&&<>
         <p className="text-xs font-bold text-neutral-500">{labels[card.live_role]??"CPP参加者"}</p>
         <SocialProfileCard displayName={card.display_name} photoUrl={card.photo_url}
           affiliation={card.affiliation} roleTitle={card.role_title}
           topics={card.topics} intro={card.intro}/>
       </>}
     </div>
   </div>}
 </>;
}
