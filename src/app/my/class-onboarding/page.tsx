"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { classRequest } from "@/lib/classRequests";

type School={ id:string; name:string };
type Course={id:string;name:string;design:{monthlyFee?:number;monthlyVisits?:number}};
type Slot={id:string;name:string;product_id:string|null;starts_at:string;duration_minutes:number};
type Page={id:string;title:string;visibility:string|null;is_public:boolean};
type Draft={wizard:Record<string,unknown>;sales_answers:string[];landing_page_id:string|null;revision:number};
type Details={school:School;courses:Course[];classes:Slot[];pages:Page[];published:boolean;recruitment:{enabled:boolean;public_id:string;route:string}|null;draft:Draft};
const questions=[
  {
    "title": "誰のための商品か",
    "question": "この商品・サービスは、どんな人のためのものですか？"
  },
  {
    "title": "商品名",
    "question": "商品・サービスの名前は何ですか？"
  },
  {
    "title": "何を実現するか",
    "question": "この商品で、お客様は何ができるようになりますか？"
  },
  {
    "title": "どんな悩みに応えるか",
    "question": "お客様は、今どんな悩みや不便を感じていますか？"
  },
  {
    "title": "約束する未来",
    "question": "その悩みが解決したら、お客様の日常はどう変わりますか？"
  },
  {
    "title": "内容・方法",
    "question": "具体的に何を、どんな方法で提供しますか？"
  },
  {
    "title": "なぜ解決できるか",
    "question": "なぜ、その方法でお客様の悩みを解決できるのですか？"
  },
  {
    "title": "他商品との差",
    "question": "ほかの選択肢と比べて、どこに特徴がありますか？"
  },
  {
    "title": "なぜ提供するのか",
    "question": "あなたは、なぜこの商品やサービスを始めたのですか？"
  },
  {
    "title": "顧客の喜び",
    "question": "実際のお客様から、どんな喜びの声が届いていますか？"
  },
  {
    "title": "専門家の評価",
    "question": "第三者や専門家による評価・推薦はありますか？"
  },
  {
    "title": "購入前の不安・疑問への回答",
    "question": "申込前によく聞かれる疑問は何ですか？ どう答えますか？"
  },
  {
    "title": "選ばなかった場合の未来",
    "question": "今のまま何もしなければ、どんな機会を逃す可能性がありますか？"
  },
  {
    "title": "価格・購入条件",
    "question": "料金と、申し込むための条件は何ですか？"
  },
  {
    "title": "今選ぶ特典",
    "question": "今申し込む理由や特典はありますか？"
  },
  {
    "title": "イベント案内・連絡先登録",
    "question": "興味を持った人に、次に何をしてもらいたいですか？"
  }
];
const defaultAnswers=Array(16).fill("") as string[];
const button="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold disabled:opacity-50";
const primary="rounded-full bg-emerald-800 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50";
const field="w-full rounded-xl border border-neutral-300 p-3 text-sm";
function stageDescription(n:number){return [
  "すでにある教室の設定を確認し、先生の言葉を記録します。",
  "16の質問に答え、募集で伝える内容を整理します。",
  "PARARI PAGEを教室に関連付けます。PAGEの文章や写真は通常のエディタで編集します。",
  "公開ページ・説明会・入会申込の接続を確認します。",
][n];}

export default function IntegratedClassOnboarding() {
  const [schools,setSchools]=useState<School[]>([]);
  const [schoolId,setSchoolId]=useState("");
  const [data,setData]=useState<Details|null>(null);
  const [stage,setStage]=useState(0);
  const [question,setQuestion]=useState(0);
  const [wizard,setWizard]=useState<Record<string,unknown>>({});
  const [answers,setAnswers]=useState<string[]>(defaultAnswers);
  const [pageId,setPageId]=useState<string|null>(null);
  const [revision,setRevision]=useState(0);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    const abort=new AbortController();
    void classRequest<{businesses:School[]}>("?businesses=1",undefined,abort.signal).then(result=>{
      if(!abort.signal.aborted){setSchools(result.businesses);setLoading(false);}
    }).catch(cause=>{if(!abort.signal.aborted){setError(cause instanceof Error?cause.message:"事業の取得に失敗しました。");setLoading(false);}});
    return ()=>abort.abort();
  },[]);
  useEffect(()=>{
    if(!schoolId){setData(null);return;}
    const abort=new AbortController();
    setLoading(true);setError("");setNotice("");
    void classRequest<Details>("/onboarding?school="+schoolId,undefined,abort.signal).then(result=>{
      if(abort.signal.aborted)return;
      setData(result);setWizard(result.draft.wizard||{});
      setAnswers(Array.from({length:16},(_,i)=>result.draft.sales_answers?.[i]??""));
      setPageId(result.draft.landing_page_id);setRevision(result.draft.revision);
      setLoading(false);
    }).catch(cause=>{if(!abort.signal.aborted){setError(cause instanceof Error?cause.message:"設計の取得に失敗しました。");setLoading(false);}});
    return ()=>abort.abort();
  },[schoolId]);
  async function save(action:"saveWizard"|"saveSales"|"bindPage"){
    if(busy||!schoolId)return false;
    setBusy(true);setError("");setNotice("");
    try {
      const body=action==="saveWizard"?{wizard}:action==="saveSales"?{answers}:{pageId};
      const result=await classRequest<{revision:number}>("/onboarding?school="+schoolId,{action,revision,...body});
      setRevision(result.revision);setNotice("保存しました。");
      return true;
    }catch(cause){
      setError(cause instanceof Error?cause.message:"保存に失敗しました。");
      return false;
    }finally{setBusy(false);}
  }
  const view=(i:number)=>{setStage(i);setNotice("");setError("");};
  const update=(name:string,value:string)=>setWizard(old=>({...old,[name]:value}));
  return <main className="min-h-screen bg-neutral-100 px-4 py-8 text-neutral-950 sm:px-6">
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="space-y-2">
        <Link href="/my/manage?tab=class" className="text-sm underline">← 既存のクラス管理へ</Link>
        <p className="text-xs font-bold tracking-widest text-emerald-800">PARARI CLASS · モニター統合検証</p>
        <h1 className="text-2xl font-bold">教室の開設・募集ガイド</h1>
        <p className="text-sm leading-7 text-neutral-600">教室の設計 → 伝える内容 → PARARI PAGE → 募集公開をつなぐ実データ用の画面です。料金・予約・請求はここから直接変更しません。</p>
      </header>
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-950">
        <strong>段階的な実装の検証画面です。</strong>既存のモニター事業だけを対象に、設計回答と16問を保存します。
        PARARI作品の公開や実際の入会・請求は、先生がそれぞれの管理画面で確認して操作します。
      </div>
      <section className="rounded-xl bg-white p-5">
        <label className="text-sm font-semibold">設定する事業
          <select className={field+" mt-2"} value={schoolId} onChange={e=>setSchoolId(e.target.value)} disabled={loading&&schools.length===0}>
            <option value="">事業を選択</option>
            {schools.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        {!schools.length&&!loading&&<p className="mt-3 text-sm text-amber-900">事業がありません。まず既存のクラス管理画面で事業を登録してください。</p>}
      </section>
      {data&&<>
        <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="開設ガイドの工程">
          {["1 教室設計","2 魅力を伝える","3 PAGE作品","4 募集公開"].map((title,i)=><button type="button" key={title}
            className={"rounded-xl border p-3 text-left text-sm font-semibold "+(stage===i?"border-emerald-700 bg-emerald-50":"border-neutral-200 bg-white")}
            onClick={()=>view(i)}>{title}</button>)}
        </nav>
        <section className="rounded-2xl border bg-white p-5 sm:p-7">
          <h2 className="text-xl font-bold">{["教室を設計する","教室の魅力を伝える","PARARI作品を関連付ける","募集ページを確認する"][stage]}</h2>
          <p className="mt-2 text-sm text-neutral-600">{stageDescription(stage)}</p>
          {stage===0&&<div className="mt-6 space-y-4">
            <p className="font-semibold">{data.school.name}</p>
            <div className="rounded-lg bg-neutral-50 p-4 text-sm">
              <p>コース：{data.courses.length}件 ／ クラス：{data.classes.length}件</p>
              {data.courses.map(course=><div key={course.id} className="mt-2 border-t pt-2">
                <p className="font-semibold">{course.name}</p>
                <p className="text-xs text-neutral-600">{data.classes.filter(slot=>slot.product_id===course.id).map(slot=>slot.name).join("・")||"クラス未設定"}</p>
              </div>)}
            </div>
            <p className="text-sm">受講者の年齢や、先生・生徒の呼び方を設定できます。実際の料金・クラス・説明会は既存の管理画面が正本です。</p>
            <label className="block text-sm font-semibold">対象とする受講者
              <select className={field+" mt-1"} value={String(wizard.audience??"adults")} onChange={e=>update("audience",e.target.value)}>
                <option value="adults">成人のみ</option><option value="minors">未成年のみ</option><option value="mixed">成人と未成年の両方</option>
              </select>
            </label>
            {([["teacherLabel","先生の呼び方"],["learnerLabel","生徒の呼び方"]] as const).map(([id,text])=>
              <label key={id} className="block text-sm font-semibold">{text}
                <input className={field+" mt-1"} maxLength={30} value={String(wizard[id]??(id==="teacherLabel"?"先生":"生徒"))} onChange={e=>update(id,e.target.value)}/>
              </label>)}
            {wizard.audience!=="adults"&&<label className="block text-sm font-semibold">保護者の呼び方
              <input className={field+" mt-1"} maxLength={30} value={String(wizard.guardianLabel??"保護者")} onChange={e=>update("guardianLabel",e.target.value)}/>
            </label>}
            {wizard.audience==="minors"&&<label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={wizard.gradeExpiry==="yes"} onChange={e=>update("gradeExpiry",e.target.checked?"yes":"no")}/>
              学年から卒業予定日を提案する（先生の確認後に確定）
            </label>}
            <div className="flex flex-wrap gap-3">
              <button className={primary} disabled={busy} onClick={()=>void save("saveWizard")}>設計の回答を保存</button>
              <Link className={button} href={"/my/manage?tab=class&business="+data.school.id}>コース・クラスを編集</Link>
              <button className={button} onClick={()=>view(1)}>次の工程へ</button>
            </div>
          </div>}
          {stage===1&&<div className="mt-6 space-y-4">
            <p className="text-xs font-semibold text-emerald-800">質問 {question+1} / 16</p>
            <div className="h-1.5 rounded bg-neutral-100"><div className="h-full rounded bg-emerald-700" style={{width:((question+1)/16*100)+"%"}}/></div>
            <h3 className="text-lg font-bold">{questions[question].title}</h3>
            <p>{questions[question].question}</p>
            {([1,5,13,15].includes(question))&&<p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">この内容はすでに事業・コースで設定している可能性があります。必要なら内容を確認して簡単に補足してください。</p>}
            <textarea className={field} rows={6} maxLength={5000} placeholder="思いつくままに書いてください。空欄でも進めます。" value={answers[question]}
              onChange={e=>setAnswers(old=>old.map((x,i)=>i===question?e.target.value:x))}/>
            <div className="flex flex-wrap items-center gap-2">
              <button className={button} disabled={question===0} onClick={()=>setQuestion(i=>Math.max(0,i-1))}>前へ</button>
              <button className={button} disabled={question===15} onClick={()=>setQuestion(i=>Math.min(15,i+1))}>次へ</button>
              <button className={primary} disabled={busy} onClick={()=>void save("saveSales")}>16問の回答を保存</button>
              <button className={button} onClick={()=>view(2)}>PAGE作品へ進む</button>
            </div>
            <details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-semibold">16問の全体を確認する</summary>
              {questions.map((item,i)=><button key={i} className="mt-2 block text-left text-sm text-emerald-800 underline" onClick={()=>setQuestion(i)}>{i+1}. {item.title}{answers[i]?" ✓":""}</button>)}
            </details>
          </div>}
          {stage===2&&<div className="mt-6 space-y-4">
            <p className="text-sm">教室紹介の文章・写真・レイアウトはPARARI作品で編集します。料金や申込ボタンはCLASSが管理するため、PAGE内にURLを直接書き込む必要はありません。</p>
            <label className="block text-sm font-semibold">この教室のトップページに使う作品
              <select className={field+" mt-2"} value={pageId??""} onChange={e=>setPageId(e.target.value||null)}>
                <option value="">まだPAGEを選択していません</option>
                {data.pages.map(p=><option key={p.id} value={p.id}>{p.title}{p.is_public||p.visibility==="public"?"（公開）":"（非公開・下書き）"}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button className={primary} disabled={busy} onClick={()=>void save("bindPage")}>関連付けを保存する</button>
              <Link className={button} href="/my/works">PARARI作品を作成・編集する</Link>
              {pageId&&<Link className={button} href={"/editor-v2/"+pageId}>選択したPAGEを編集する</Link>}
              <button className={button} onClick={()=>view(3)}>公開確認へ</button>
            </div>
            <p className="text-xs text-amber-900">ここでは既存PAGEの関連付けまで行います。PAGEの生成・公開設定とCLASS画面への表示は別途完成検証が必要です。</p>
          </div>}
          {stage===3&&<div className="mt-6 space-y-4">
            <div className="grid gap-2 rounded-xl bg-neutral-50 p-4 text-sm">
              <p>コース：{data.courses.length}件 ／ クラス：{data.classes.length}件</p>
              <p>PARARI PAGE：{pageId?"選択済み":"未選択"}</p>
              <p>募集受付：{data.recruitment?.enabled?"受付設定あり":"受付設定なし"}</p>
              <p>事業トップページ：{data.published?"公開中":"未公開"}</p>
            </div>
            <p className="text-sm">作品は文章・写真の編集に使用します。公開トップページの申込ボタンはCLASSの設定に基づいて生成されます。</p>
            <div className="flex flex-wrap gap-2">
              <Link className={primary} href={"/my/manage?tab=class&business="+data.school.id}>募集・公開の設定を確認</Link>
              <Link className={button} href={"/class-business/"+data.school.id} target="_blank">現在の公開ページを見る</Link>
            </div>
            {!data.published&&<p className="text-xs text-amber-900">公開操作は既存のCLASS管理画面で行います。確認せずに自動公開されることはありません。</p>}
          </div>}
        </section>
      </>}
      {notice&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {loading&&<p role="status" className="text-sm">読み込み中…</p>}
    </div>
  </main>;
}
