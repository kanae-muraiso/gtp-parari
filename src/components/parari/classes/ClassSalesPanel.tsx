"use client";
import { useEffect, useState } from "react";
import { classRequest } from "@/lib/classRequests";

const emptyAnswers:string[]=[];
const questions=[
  ["誰のための商品か","どんな人のための教室・コースですか？"],
  ["商品名","このコースの名前は何ですか？"],
  ["何を実現するか","受講者は何ができるようになりますか？"],
  ["どんな悩みに応えるか","受講者は今、どんな悩みを抱えていますか？"],
  ["約束する未来","学んだ後、受講者の日常はどう変わりますか？"],
  ["内容・方法","何をどのように教えますか？"],
  ["なぜ解決できるか","なぜその方法が役に立つのですか？"],
  ["他商品との差","ほかの選択肢と比べてどんな特徴がありますか？"],
  ["なぜ提供するのか","なぜこの教室を始めましたか？"],
  ["顧客の喜び","受講者から届いた声はありますか？"],
  ["専門家の評価","第三者からの評価はありますか？"],
  ["不安・疑問への回答","申込前によく聞かれる質問は何ですか？"],
  ["選ばなかった場合の未来","今のまま何もしなければどんな機会を逃すでしょうか？"],
  ["価格・購入条件","料金と申込条件は何ですか？"],
  ["今選ぶ特典","今申し込む理由や特典はありますか？"],
  ["次の行動","興味を持った人に何をしてもらいたいですか？"],
] as const;
const button="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50";
const primary="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
export default function ClassSalesPanel({schoolId,answers:initial,revision,onSaved,draftKey,pageTitle}:{
  schoolId:string;answers:string[];revision:number;onSaved:()=>void;draftKey?:string;pageTitle?:string;
}){
  const [answers,setAnswers]=useState<string[]>(()=>Array.from({length:16},(_,i)=>initial[i]??""));
  const [index,setIndex]=useState(0);
  const [currentRevision,setRevision]=useState(revision);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    let values=initial??emptyAnswers;
    if(draftKey)try{const stored=JSON.parse(sessionStorage.getItem(draftKey)??"null");if(Array.isArray(stored)&&stored.every(v=>typeof v==="string"))values=stored;}catch{}
    setAnswers(Array.from({length:16},(_,i)=>(values[i]??"").slice(0,5000)));setRevision(revision);setIndex(0);
  },[schoolId,initial,revision,draftKey]);
  async function save(next:number){
    if(busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      if(draftKey){sessionStorage.setItem(draftKey,JSON.stringify(answers));setIndex(Math.max(0,Math.min(15,next)));setNotice("このページの改善案をブラウザ内に保存しました。");return;}
      const result=await classRequest<{revision:number}>("/onboarding?school="+schoolId,{
        action:"saveSales",revision:currentRevision,answers,
      });
      setRevision(result.revision);setIndex(Math.max(0,Math.min(15,next)));
      setNotice("回答を保存しました。いつでも続きから編集できます。");
      onSaved();
    }catch(cause){setError(cause instanceof Error?cause.message:"保存できませんでした。");}
    finally{setBusy(false);}
  }
  return <section className="space-y-4 rounded-2xl border bg-white p-4 sm:p-5">
    <div>
      <h2 className="text-xl font-bold">募集内容の改善（任意）</h2>
      {pageTitle&&<p className="mt-1 text-base font-medium">{pageTitle}</p>}
      <p className="mt-2 text-sm text-neutral-600">募集を始めるために、この16問に答える必要はありません。気が向いたときに、1問ずつ書き足せます。</p>
    </div>
    <div className="flex items-center justify-between text-xs text-neutral-600">
      <span>質問 {index+1} / 16</span><span>{answers.filter(x=>x.trim()).length}問記入済み</span>
    </div>
    <div className="h-1.5 rounded-full bg-neutral-100"><div className="h-full rounded-full bg-emerald-700" style={{width:(index+1)/16*100+"%"}}/></div>
    <h3 className="font-bold">{questions[index][0]}</h3>
    <p className="text-sm">{questions[index][1]}</p>
    <textarea className="w-full rounded-xl border p-3 text-sm" rows={5} maxLength={5000} value={answers[index]}
      onChange={e=>setAnswers(old=>old.map((value,i)=>i===index?e.target.value:value))}
      placeholder="無理に書く必要はありません。空欄のままでも進めます。"/>
    <div className="flex flex-wrap gap-2">
      <button className={button} disabled={busy||index===0} onClick={()=>void save(index-1)}>← 前へ</button>
      <button className={primary} disabled={busy} onClick={()=>void save(index+1)}>{index===15?"回答を保存":"保存して次へ →"}</button>
    </div>
    {error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
    {notice&&<p role="status" className="text-sm text-emerald-800">{notice}</p>}
    <details className="rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer font-semibold">16問の一覧</summary>
      <div className="mt-3 grid gap-1">{questions.map(([title],i)=><button type="button" key={i}
        onClick={()=>void save(i)} className="rounded px-2 py-1 text-left hover:bg-neutral-50">
        {i+1}. {title}{answers[i]?.trim()?" ✓":""}</button>)}</div>
    </details>
  </section>;
}
