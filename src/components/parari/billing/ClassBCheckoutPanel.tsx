"use client";
import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabaseClient";
import {classBClassAllowance,classBMonthlyPrice} from "@/lib/classBPolicy";
type School={id:string;name:string;plan:"a"|"b";blocks:number;status:string;requestedBlocks?:number|null;paidUntil?:string|null;canManageBilling:boolean};
export default function ClassBCheckoutPanel(){
 const [schools,setSchools]=useState<School[]>([]),[schoolId,setSchoolId]=useState(""),[quantity,setQuantity]=useState(1),[ready,setReady]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const current=schools.find(s=>s.id===schoolId);
 async function load(){
  setLoading(true);setMessage("");
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session?.access_token)throw Error("ログインしてください。");
   const response=await fetch("/api/billing/class-b/status",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const result=await response.json();
   if(!response.ok||!result.ok)throw Error(result.message||"契約情報を確認できませんでした。");
   setSchools(result.schools);setReady(result.ready);
   const selected=(result.schools as School[]).find(s=>s.id===schoolId)??result.schools[0];
   setSchoolId(selected?.id??"");setQuantity(selected?.requestedBlocks??1);
  }catch(e){setReady(false);setMessage(e instanceof Error?e.message:"読み込みに失敗しました。");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 async function open(action:"checkout"|"portal"){
  if(busy||!current)return;
  setBusy(true);setMessage("");
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session?.access_token)throw Error("ログインしてください。");
   const response=await fetch("/api/billing/class-b/"+action,{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({schoolId,quantity})});
   const result=await response.json();
   if(!response.ok||!result.ok||typeof result.url!=="string")throw Error(result.message||"決済画面を開けませんでした。");
   window.location.assign(result.url);
  }catch(e){setMessage(e instanceof Error?e.message:"決済画面を開けませんでした。");}
  finally{setBusy(false);}
 }
 const statusLabels:Record<string,string>={active:"契約中",pending:"購入手続き中",past_due:"支払い確認中",canceled:"解約済み",expired:"期限切れ",none:"未契約",unavailable:"販売準備中"};
 return <section id="class-b" className="mt-8 grid gap-4 rounded-3xl border border-emerald-200 bg-white p-5">
 <div><p className="text-sm font-semibold text-emerald-800">CLASS B</p><h2 className="mt-1 text-2xl font-bold">事業ごとの契約・請求管理</h2><p className="mt-2 text-base">月額1,000円で通常5クラス。追加5クラスごとに月額1,000円です。WRITERSの契約とは独立しています。</p></div>
 {loading?<p>契約情報を確認中…</p>:!schools.length?<p>最初にCLASS Aで事業を開設してください。</p>:<>
 <label className="grid gap-1 text-base font-semibold">対象の事業<select disabled={busy} className="min-h-11 rounded-xl border p-3 text-base" value={schoolId} onChange={e=>{setSchoolId(e.target.value);setQuantity(schools.find(s=>s.id===e.target.value)?.requestedBlocks??1);setMessage("");}}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
 {current&&<div className="rounded-xl bg-neutral-50 p-4"><p className="text-base">契約状況：{statusLabels[current.status]??current.status}</p><p className="mt-1 text-base">現在の通常クラス枠：{current.plan==="b"?classBClassAllowance(current.blocks):1}件</p>{current.paidUntil&&<p className="mt-1 text-sm">支払済み期間：{new Date(current.paidUntil).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"})}まで</p>}</div>}
 {ready&&current&&current.plan!=="b"&&["none","pending"].includes(current.status)&&<>
 <label className="grid gap-1 text-base">契約する5クラス枠の数<input type="number" min={1} max={1000000} step={1} disabled={busy||current.status==="pending"} value={quantity} onChange={e=>setQuantity(Number(e.target.value))} className="min-h-11 rounded-xl border p-3"/></label>
 <p className="text-xl font-bold">{classBClassAllowance(quantity)}クラス / 月額{classBMonthlyPrice(quantity).toLocaleString("ja-JP")}円</p>
 <button disabled={busy||quantity<1||quantity>1000000||!Number.isSafeInteger(quantity)} onClick={()=>void open("checkout")} className="min-h-12 rounded-xl bg-emerald-800 p-3 text-lg font-bold text-white disabled:opacity-50">{current.status==="pending"?"購入手続きを再開":"Stripeで申し込む"}</button>
 </>}
 {current?.canManageBilling&&<button disabled={busy} onClick={()=>void open("portal")} className="min-h-12 rounded-xl border p-3 text-base font-bold">CLASS Bの請求管理を開く</button>}
 {!ready&&<p className="rounded-xl bg-amber-50 p-3 text-base text-amber-900">販売開始前のため、購入受付は停止しています。</p>}
 <button disabled={busy} onClick={()=>void load()} className="min-h-11 rounded-xl border p-3 text-base">最新の契約状況を確認</button>
 </>}
 {message&&<p role="alert" className="text-base text-red-700">{message}</p>}
 </section>;
}
