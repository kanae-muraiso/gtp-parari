"use client";
import {useState} from "react";
import Link from "next/link";
import ClassEntranceReceiptCard,{type ClassEntranceReceipt} from "@/components/parari/classes/ClassEntranceReceiptCard";
export default function EntranceDemo(){
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[receipt,setReceipt]=useState<ClassEntranceReceipt|null>(null);
 async function enter(paid:boolean){
  setBusy(true);setError("");setReceipt(null);
  try{
   const actions=["pay","event","paid","unpaid","open",paid?"enterPaid":"enterUnpaid"];
   const response=await fetch("/api/dev/class-b-lab",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({actions})});
   const data=await response.json();
   if(!response.ok||!data.ok)throw Error(data.message||"受付テストを実行できませんでした。");
   const last=data.results?.at(-1);
   if(!last?.ok)throw Error(last?.message||"受付できませんでした。");
   if(!data.receipt)throw Error("受付結果がありません。");
   setReceipt(data.receipt);
  }catch(e){setError(e instanceof Error?e.message:"受付できませんでした。");}finally{setBusy(false);}
 }
 return <main className="min-h-screen bg-neutral-100 p-4"><article className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-sm">
 <p className="rounded-lg bg-amber-50 p-3 text-base font-semibold text-amber-900">開発用・架空の参加者によるQR受付テスト</p>
 <h1 className="mt-4 text-2xl font-bold">ZUMBA セルフ受付</h1>
 <p className="mt-3 text-base">ダミーの参加者を選ぶと、本番と同じ受付DB処理を隔離DBで実行します。</p>
 <div className="mt-5 grid gap-3">
 <button disabled={busy} onClick={()=>void enter(true)} className="min-h-12 rounded-xl bg-emerald-700 p-4 text-lg font-bold text-white disabled:opacity-50">入金済の参加者として受付</button>
 <button disabled={busy} onClick={()=>void enter(false)} className="min-h-12 rounded-xl border p-4 text-lg font-bold disabled:opacity-50">未入金の参加者として受付</button></div>
 {busy&&<p role="status" className="mt-3">受付を確認中…</p>}
 {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-base text-red-800">{error}</p>}
 {receipt&&<ClassEntranceReceiptCard receipt={receipt}/>}
 <p className="mt-5 text-sm text-neutral-600">この試験は端末ごとに独立します。実在会員の認証、端末間の名簿同期や決済は行いません。</p>
 <Link href="/dev/class-b-lab" className="mt-4 block underline">運営テストへ戻る</Link>
 </article></main>;
}
