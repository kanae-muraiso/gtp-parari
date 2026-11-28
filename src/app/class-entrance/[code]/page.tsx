"use client";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import Link from "next/link";
import {supabase} from "@/lib/supabaseClient";
import ClassEntranceReceiptCard, {type ClassEntranceReceipt as Receipt} from "@/components/parari/classes/ClassEntranceReceiptCard";
export default function ClassEntrancePage(){
  const {code}=useParams<{code:string}>();
  const [token,setToken]=useState<string|null|undefined>(undefined);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[receipt,setReceipt]=useState<Receipt|null>(null);
  useEffect(()=>{
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>{
      setToken(session?.access_token??null);setReceipt(null);
    });
    return ()=>data.subscription.unsubscribe();
  },[]);
  async function enter(){
    if(!token||busy)return;
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/classes/event-checkin",{method:"POST",cache:"no-store",
        headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({action:"checkin",code})});
      const data=await response.json();
      if(!response.ok||!data.ok||!data.receipt)throw new Error(data.message||"受付できませんでした。");
      setReceipt(data.receipt);
    }catch(e){setError(e instanceof Error?e.message:"受付できませんでした。");}
    finally{setBusy(false);}
  }
  const valid=/^[0-9a-f]{16}$/.test(code);
  return <main className="min-h-screen bg-neutral-100 p-4">
    <article className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-sm">
      <p className="text-base font-semibold text-neutral-600">PARARI CLASS</p>
      {!valid?<p className="mt-6 text-lg">受付コードが正しくありません。</p>:receipt?<ClassEntranceReceiptCard receipt={receipt}/>:<>
        <h1 className="mt-6 text-2xl font-bold">セルフ受付</h1>
        {token===undefined?<p className="mt-6">ログイン状態を確認しています…</p>:token?<button onClick={()=>void enter()} disabled={busy} className="mt-6 min-h-12 w-full rounded-xl bg-emerald-700 p-4 text-lg font-bold text-white disabled:opacity-50">{busy?"受付中…":"入場受付をする"}</button>:<Link href={"/login?returnTo="+encodeURIComponent("/class-entrance/"+code)} className="mt-6 block min-h-12 rounded-xl bg-emerald-700 p-4 text-lg font-bold text-white">ログインして受付する</Link>}
        <p className="mt-4 text-base text-neutral-700">申込・入金状況を確認します。受付できない場合はスタッフにお声がけください。</p>
      </>}
      {error&&<p className="mt-4 rounded-xl bg-red-50 p-4 text-base text-red-800" role="alert">{error}</p>}
    </article>
  </main>;
}
