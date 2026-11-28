"use client";
import {useEffect,useState} from "react";
import {classRequest} from "@/lib/classRequests";
import {createQrVersion6M} from "@/lib/qr/qrVersion6M";
type Props={eventId:string;sessionAt:string;onRefresh:()=>void};
export default function ClassEventEntrance({eventId,sessionAt,onRefresh}:Props){
  const [url,setUrl]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    setUrl("");setError("");
    void classRequest<{code:string|null}>("/event-checkin",{action:"read",eventId,sessionAt},controller.signal)
      .then(result=>{if(!controller.signal.aborted)setUrl(result.code?new URL("/class-entrance/"+result.code,window.location.origin).href:"");})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return ()=>controller.abort();
  },[eventId,sessionAt]);
  async function change(action:"open"|"close"){
    setBusy(true);setError("");
    try{
      const result=await classRequest<{code:string|null}>("/event-checkin",{action,eventId,sessionAt});
      setUrl(result.code?new URL("/class-entrance/"+result.code,window.location.origin).href:"");onRefresh();
    }catch(e){setError(e instanceof Error?e.message:"受付を更新できませんでした。");}
    finally{setBusy(false);}
  }
  let modules:boolean[][]|null=null;
  if(url){try{modules=createQrVersion6M(url);}catch{/* Copyable URL is available even for unusually long host names. */}}
  return <section className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
    <h4 className="text-lg font-bold">入口の共通QRセルフ受付</h4>
    <p className="text-base">参加者は同じQRを読み、ログインして受付します。参加確定・入金済みの申込だけ受付できます。</p>
    {url?<div className="grid gap-3">
      <span className="font-bold text-emerald-900">受付中</span>
      {modules&&<svg viewBox="0 0 49 49" role="img" aria-label="共通受付QRコード" className="mx-auto w-full max-w-64 bg-white" shapeRendering="crispEdges">
        <rect width="49" height="49" fill="white"/>
        {modules.flatMap((row,y)=>row.map((dark,x)=>dark?<rect key={x+":"+y} x={x+4} y={y+4} width="1" height="1" fill="black"/>:null))}
      </svg>}
      <a href={url} target="_blank" rel="noreferrer" className="break-all text-base underline">参加者の受付画面を開く</a>
      <button type="button" onClick={()=>void navigator.clipboard.writeText(url).catch(()=>setError("リンクを長押ししてコピーしてください。"))} className="min-h-11 rounded-xl border bg-white px-4 text-base">受付URLをコピー</button>
      <button type="button" onClick={()=>void change("close")} disabled={busy} className="min-h-11 rounded-xl border bg-white px-4 text-base">QR受付を終了</button>
    </div>:<button type="button" disabled={busy} onClick={()=>void change("open")} className="min-h-11 rounded-xl bg-emerald-800 px-4 text-base font-bold text-white disabled:opacity-50">QR受付を開始</button>}
    <button type="button" onClick={onRefresh} className="min-h-11 rounded-xl border bg-white px-4 text-base">来場状況を更新</button>
    {error&&<p role="alert" className="text-base text-red-800">{error}</p>}
  </section>;
}
