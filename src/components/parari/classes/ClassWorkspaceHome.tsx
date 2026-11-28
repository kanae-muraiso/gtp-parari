"use client";
import {defaultServiceLabels,type ServiceLabels} from "@/lib/classServiceLabels";
export type ClassWorkspaceTab="home"|"classes"|"admission"|"homepage"|"events"|"workshops"|"operation"|"improve"|"accounting"|"settings"|"services";
export function classAreaForTab(tab:ClassWorkspaceTab){
 if(tab==="classes")return "設計";
 if(["admission","homepage","services","events","workshops","improve"].includes(tab))return "募集";
 if(tab==="operation")return "運営";
 if(tab==="accounting")return "会計";
 if(tab==="settings")return "事業設定・契約・利用枠";
 return "CLASS";
}
const entries=[["classes","設計","事業・コース・クラス"],["services","募集","サービスの申込・募集ページ"],["operation","運営","生徒・出欠・開催予定"],["accounting","会計","月謝・入金・売上"]] as const;
function HomeIcon({kind}:{kind:ClassWorkspaceTab}){
 return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-9 w-9 text-emerald-700 sm:h-11 sm:w-11">
 {kind==="classes"?<><circle cx="12" cy="5" r="2"/><path d="m11 7-7 14m9-14 7 14M5 12c4 4 10 4 14 0"/></>:kind==="services"?<><path d="M3 9v5l17 4V5L3 9Zm2 5 2 6h4l-2-5"/></>:kind==="operation"?<><circle cx="9" cy="7" r="3"/><circle cx="19" cy="8" r="2.5"/><path d="M2 21v-2a7 7 0 0 1 14 0v2m1-7a5 5 0 0 1 5 5v2"/></>:<><path d="M3 7V5a2 2 0 0 1 2-2h14v4M3 7h17v14H5a2 2 0 0 1-2-2V7Zm17 5h-4a2 2 0 0 0 0 4h4"/></>}
 </svg>;
}
export default function ClassWorkspaceHome({disabled,onNavigate,labels=defaultServiceLabels}:{disabled:boolean;onNavigate:(tab:ClassWorkspaceTab)=>void;labels?:ServiceLabels}){
 return <section className="rounded-3xl border border-neutral-200 bg-white p-3 sm:p-5" aria-labelledby="class-home-heading">
  <h1 id="class-home-heading" className="mb-4 text-center text-2xl font-bold sm:text-3xl">CLASS</h1>
  {disabled&&<p className="mb-4 text-center text-base text-neutral-600">事業を選択すると操作できます。</p>}
  <div className="grid grid-cols-2 gap-2 sm:gap-3">
   {entries.map(([tab,title,description])=><button key={tab} type="button" disabled={disabled} onClick={()=>onNavigate(tab)}
    className="flex min-h-[156px] flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white px-2 py-5 text-center transition-colors hover:border-emerald-700 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50 sm:min-h-[182px] sm:px-4">
    <HomeIcon kind={tab}/><span className="text-xl font-bold sm:text-2xl">{title}</span><span className="text-base leading-6 text-neutral-600">{tab==="classes"?"事業・"+labels.course+"・"+labels.class:tab==="services"?"サービスの申込・募集ページ":description}</span>
   </button>)}
  </div>
  <button type="button" disabled={disabled} onClick={()=>onNavigate("settings")} className="mt-3 flex min-h-[56px] w-full items-center gap-3 rounded-xl px-3 text-left text-base hover:bg-neutral-50 disabled:opacity-50">
   <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 2h4l1 3 3 1 3-1 2 4-2 3 2 3-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-3-2-3 2-4 3 1 3-1z"/><circle cx="12" cy="12" r="3"/></svg>
   <span className="flex-1 font-medium">事業設定（設計）</span><span aria-hidden="true" className="text-2xl">›</span>
  </button>
 </section>;
}
