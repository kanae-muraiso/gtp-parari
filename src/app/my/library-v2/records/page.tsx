"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "@/lib/supabaseClient";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import LibraryV2Menu from "@/components/parari/navigation/LibraryV2Menu";

type Purchase={id:string;kind:"commerce"|"application";title:string;status:string|null;amount:number|null;currency:string|null;createdAt:string};
type Application={id:string;title:string;status:string;paymentStatus:string|null;startsAt:string;timezone:string;location:string|null};
type Membership={id:string;name:string;status:string;joinedAt:string;updatedAt:string};
type PurchasedWork={workId:string;title:string;status:string;createdAt:string};
type Records={purchases:Purchase[];applications:Application[];memberships:Membership[];purchasedWorks:PurchasedWork[]};
const tabs=[{key:"purchases",label:"購入"},{key:"applications",label:"申込"},{key:"memberships",label:"メンバーシップ"}] as const;
type Tab=typeof tabs[number]["key"];
export default function LibraryRecordsPage(){
 const [tab,setTab]=useState<Tab>("purchases");
 useEffect(()=>{
  const sync=()=>{const value=new URLSearchParams(window.location.search).get("tab");setTab(value==="applications"||value==="memberships"?value:"purchases");};
  sync();window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync);
 },[]);
 function selectTab(value:Tab){setTab(value);window.history.replaceState(null,"","/my/library-v2/records?tab="+value);}
 const [records,setRecords]=useState<Records|null>(null);
 const [message,setMessage]=useState("記録を読み込んでいます…");
 useEffect(()=>{
  let active=true;
  async function load(){
   if(!supabase){setMessage("接続設定がありません。");return;}
   const {data:{session}}=await supabase.auth.getSession();
   if(!session){setMessage("ログインが必要です。");return;}
   const res=await fetch("/api/library-v2/records",{headers:{Authorization:"Bearer "+session.access_token}});
   if(!active)return;
   if(!res.ok){setMessage("記録を取得できませんでした。");return;}
   const body=await res.json();
   if(!body.ok){setMessage("記録を取得できませんでした。");return;}
   setRecords(body as Records);setMessage("");
  }
  void load();return()=>{active=false;};
 },[]);
 const date=(value:string)=>new Date(value).toLocaleString("ja-JP");
 return <main className="min-h-screen bg-white"><div className="mx-auto max-w-4xl px-4 py-6">
  <MyAreaHeader title="申込・購入" area="library" />
  <LibraryV2Menu active="records"/>
  <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="申込・購入の種類">{tabs.map(t=><button key={t.key} type="button" role="tab" aria-selected={tab===t.key} onClick={()=>selectTab(t.key)} className={"rounded-full border px-4 py-2 text-sm "+(tab===t.key?"bg-neutral-900 text-white":"bg-white")}>{t.label}</button>)}</div>
  {message&&<p role="status" className="mt-5 text-sm">{message}</p>}
  <div className="mt-5 space-y-3">
   {tab==="purchases"&&records&&<>
    <h2 className="font-semibold">購入記録</h2>
    {records.purchases.map(x=><div key={x.kind+":"+x.id} className="rounded-xl border p-4"><p className="font-medium">{x.title}</p><p className="mt-1 text-sm text-neutral-600">{x.kind==="commerce"?"作品・商品":"APPLICATION"} · {x.status} · {x.amount??"—"} {x.currency??""}</p><p className="text-xs text-neutral-500">{date(x.createdAt)}</p></div>)}
    <h2 className="pt-3 font-semibold">購入作品へのアクセス権</h2>
    {records.purchasedWorks.map(x=><Link key={x.workId} href={"/p/"+x.workId} className="block rounded-xl border p-4"><p className="font-medium">{x.title}</p><p className="text-xs text-neutral-500">{x.status}</p></Link>)}
    {!records.purchases.length&&!records.purchasedWorks.length&&<p className="text-sm text-neutral-500">購入記録はありません。</p>}
    <Link href="/my/purchases" className="inline-block text-sm underline">既存の購入管理を開く</Link>
   </>}
   {tab==="applications"&&records&&<>
    {records.applications.map(x=><div key={x.id} className="rounded-xl border p-4"><p className="font-medium">{x.title}</p><p className="mt-1 text-sm">{date(x.startsAt)} · {x.location||"場所未設定"}</p><p className="text-xs text-neutral-500">申込：{x.status} · 決済：{x.paymentStatus||"—"}</p></div>)}
    {!records.applications.length&&<p className="text-sm text-neutral-500">日時のある申込はありません。</p>}
    <Link href="/my/applications" className="inline-block text-sm underline">申込の詳細・取消を開く</Link>
   </>}
   {tab==="memberships"&&records&&<>
    {records.memberships.map(x=><div key={x.id} className="rounded-xl border p-4"><p className="font-medium">{x.name}</p><p className="text-sm text-neutral-600">{x.status==="active"?"参加中":"過去・停止中"} · {date(x.joinedAt)}</p></div>)}
    {!records.memberships.length&&<p className="text-sm text-neutral-500">メンバーシップ記録はありません。</p>}
    <p className="text-xs text-neutral-500">最上位の「参加先」は引き続き活動場所への移動に利用します。</p>
   </>}
  </div>
 </div></main>;
}
