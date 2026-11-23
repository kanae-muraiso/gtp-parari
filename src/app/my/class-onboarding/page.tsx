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
  const [setupIndex,setSetupIndex]=useState(0);
  const [wizard,setWizard]=useState<Record<string,unknown>>({});
  const [answers,setAnswers]=useState<string[]>(defaultAnswers);
  const [pageId,setPageId]=useState<string|null>(null);
  const [revision,setRevision]=useState(0);
  const [busy,setBusy]=useState(false);
  const [pageBusy,setPageBusy]=useState(false);
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
      setSetupIndex(typeof result.draft.wizard?._setupStep==="number"
        ? Math.max(0, Math.min(9,result.draft.wizard._setupStep as number)) : 0);
      setAnswers(Array.from({length:16},(_,i)=>result.draft.sales_answers?.[i]??""));
      setPageId(result.draft.landing_page_id);setRevision(result.draft.revision);
      setLoading(false);
    }).catch(cause=>{if(!abort.signal.aborted){setError(cause instanceof Error?cause.message:"設計の取得に失敗しました。");setLoading(false);}});
    return ()=>abort.abort();
  },[schoolId]);
  function fillKnownFacts(){
    if(!data)return;
    const course=data.courses[0];
    const places=data.classes.map(slot=>slot.name).join("、");
    const monthlyFee=course?.design?.monthlyFee;
    const visits=course?.design?.monthlyVisits;
    const prefilled:Record<number,string>={
      1:course?.name||data.school.name,
      5:[course?.name,visits?"月"+visits+"回":"",places].filter(Boolean).join("／"),
      13:monthlyFee!=null&&Number.isFinite(monthlyFee)?"月謝 "+monthlyFee.toLocaleString("ja-JP")+"円（詳細の条件を確認してください）":"",
      15:data.recruitment?.enabled?data.recruitment.route==="direct"?"入会申込へご案内":"説明会・体験の予約をご案内":"",
    };
    setAnswers(old=>old.map((answer,i)=>answer.trim()?answer:prefilled[i]||""));
    setNotice("コース名・回数・料金・受付方法を下書きに反映しました。内容を確認してから保存してください。");
  }
  async function createStarterPage(){
    if(!data||pageBusy)return;
    setPageBusy(true);setNotice("");setError("");
    try {
      const session=await supabase?.auth.getSession();
      const token=session?.data.session?.access_token;
      if(!token)throw new Error("ログインしてください。");
      const safe=(value:string)=>value.replace(/^\s*\[/gm,"［").replace(/\r/g,"").slice(0,5000);
      const title=safe(data.school.name+"のご案内").replace(/\n/g," ").slice(0,120);
      const selected=answers.map((answer,i)=>({answer:answer.trim(),title:questions[i].title}))
        .filter(item=>item.answer);
      const body=selected.length?selected.map(item=>item.title+"\n"+safe(item.answer)).join("\n\n"):
        "このページは先生が自由に編集できる教室紹介の下書きです。";
      // Operational fees, schedule, enrollment and CTA URLs are never copied
      // into editable SSOT; those remain authoritative CLASS data.
      const ssot="[PAGE]\ntitle: "+title+"\n[T]\n"+body;
      const response=await fetch("/api/works/create",{
        method:"POST",cache:"no-store",
        headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
        body:JSON.stringify({
          createRequestId:crypto.randomUUID(),
          stableSlug:"class-page-"+crypto.randomUUID().slice(0,12),
          template:{kind:"page",initialTitle:title,ssot},
        }),
      });
      const created=await response.json() as {ok:boolean;id?:string;message?:string};
      if(!response.ok||!created.ok||!created.id)throw new Error(created.message||"PAGEを作成できませんでした。");
      setPageId(created.id);
      setData(old=>old?{...old,pages:[{id:created.id,title,visibility:"private",is_public:false},...old.pages]}:old);
      try {
        const bound=await classRequest<{revision:number}>("/onboarding?school="+schoolId,{
          action:"bindPage",revision,pageId:created.id,
        });
        setRevision(bound.revision);
        setNotice("非公開のPARARI PAGEを作成し、教室に関連付けました。作品の編集画面で文章と写真を整えてください。");
      }catch(cause){
        setError("PAGEは作成されましたが、教室への関連付けが未完了です。関連付けを保存してください。"+
          (cause instanceof Error?cause.message:""));
      }
    }catch(cause){
      setError(cause instanceof Error?cause.message:"PAGEを作成できませんでした。");
    }finally{setPageBusy(false);}
  }
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
  const audience=String(wizard.audience??"adults");
  const setupSteps=[
    {id:"audience",title:"どんな年齢の方を受け入れますか？",hint:"後から表示される申込項目が変わります。未成年を受け入れる場合だけ保護者情報を扱います。"},
    {id:"teacherLabel",title:"教える方を何と呼びますか？",hint:"申込画面やメールで使う呼び方です。先生、講師、インストラクターなど。"},
    {id:"learnerLabel",title:"受講する方を何と呼びますか？",hint:"生徒、受講生、参加者など、普段使う言葉を設定します。"},
    ...(audience!=="adults"?[{id:"guardianLabel",title:"保護者を何と呼びますか？",hint:"未成年の申込者についてのみ保護者情報・同意を求めます。"}]:[]),
    ...(audience==="minors"?[{id:"gradeExpiry",title:"学年から卒業予定日を提案しますか？",hint:"例：高校3年生には3月末を提案。退会や請求停止は先生の確認後に確定します。"}]:[]),
    {id:"courseList",title:"どんなコースを開講していますか？",hint:"既存のコースを確認します。追加・料金変更は正本のクラス管理画面で行います。"},
    {id:"classList",title:"コースにはどんなクラスがありますか？",hint:"曜日・時間・定員はクラス管理の設定が正本です。ここでは確認だけを行います。"},
    {id:"intake",title:"入会前の説明会・体験は必要ですか？",hint:"現在の受付設定を表示します。コース別の説明会や予約日時は、募集・入会設定画面で調整してください。"},
    {id:"review",title:"教室の設計内容を確認しましょう",hint:"ここで回答を確認して保存し、次は教室の魅力を伝える16の質問へ進みます。"},
  ];
  const activeSetup=setupSteps[Math.min(setupIndex,setupSteps.length-1)];
  async function setupMove(next:number){
    if(busy||!schoolId)return;
    const destination=Math.max(0,Math.min(next,setupSteps.length-1));
    const newWizard={...wizard,_setupStep:destination};
    setBusy(true);setError("");setNotice("");
    try{
      const result=await classRequest<{revision:number}>("/onboarding?school="+schoolId,{
        action:"saveWizard",revision,wizard:newWizard,
      });
      setRevision(result.revision);setWizard(newWizard);setSetupIndex(destination);
      setNotice(destination===setupSteps.length-1?"ここまでの回答を保存しました。":"回答を保存しました。");
    }catch(cause){
      setError(cause instanceof Error?cause.message:"設計を保存できませんでした。");
    }finally{setBusy(false);}
  }
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
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
              <span>教室の設計：質問 {Math.min(setupIndex+1,setupSteps.length)} / {setupSteps.length}</span>
              <span>{data.school.name}</span>
            </div>
            <div className="h-1.5 rounded bg-neutral-100">
              <div className="h-full rounded bg-emerald-700" style={{width:((Math.min(setupIndex+1,setupSteps.length))/setupSteps.length*100)+"%"}}/>
            </div>
            <h3 className="text-lg font-bold">{activeSetup.title}</h3>
            <p className="rounded-lg bg-emerald-50 p-3 text-sm leading-7 text-emerald-900">{activeSetup.hint}</p>
            {activeSetup.id==="audience"&&<fieldset className="space-y-2">
              <legend className="sr-only">受講者の年齢</legend>
              {([
                ["adults","成人のみ","保護者情報は不要"],
                ["minors","未成年のみ","保護者情報が必要。学年からの終了予定日設定も可能"],
                ["mixed","成人と未成年の両方","未成年者の申込時だけ保護者情報を必須にする"],
              ] as const).map(([value,title,hint])=><label key={value}
                className={"flex cursor-pointer gap-3 rounded-xl border p-3 "+(audience===value?"border-emerald-700 bg-emerald-50":"border-neutral-200")}>
                  <input type="radio" checked={audience===value} onChange={()=>update("audience",value)}/>
                  <span className="grid gap-1"><span className="text-sm font-semibold">{title}</span><span className="text-xs text-neutral-600">{hint}</span></span>
                </label>)}
            </fieldset>}
            {(["teacherLabel","learnerLabel","guardianLabel"].includes(activeSetup.id))&&<label className="block text-sm font-semibold">呼び方
              <input className={field+" mt-2"} maxLength={30}
                value={String(wizard[activeSetup.id]??({teacherLabel:"先生",learnerLabel:"生徒",guardianLabel:"保護者"} as Record<string,string>)[activeSetup.id])}
                onChange={e=>update(activeSetup.id,e.target.value)}/>
              <p className="mt-2 text-xs font-normal text-neutral-500">後からいつでも変更できます。</p>
            </label>}
            {activeSetup.id==="gradeExpiry"&&<fieldset className="space-y-2">
              {([["no","学年による終了予定日は設定しない"],["yes","学年から終了予定日を提案する"]] as const).map(([value,title])=>
                <label key={value} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                  <input type="radio" checked={String(wizard.gradeExpiry??"no")===value} onChange={()=>update("gradeExpiry",value)}/>{title}
                </label>)}
              <p className="text-xs text-neutral-600">どちらを選んでも、学年だけで退会や月謝停止を確定しません。</p>
            </fieldset>}
            {activeSetup.id==="courseList"&&<div className="space-y-3">
              <p className="text-sm">登録済みのコース：{data.courses.length}件</p>
              <div className="rounded-xl bg-neutral-50 p-4">
                {data.courses.length?data.courses.map(course=><p key={course.id} className="border-b py-2 text-sm">{course.name}：月謝 {course.design?.monthlyFee?.toLocaleString("ja-JP")??"未設定"}円／月 {course.design?.monthlyVisits??"未設定"}回</p>):<p className="text-sm">コースはまだありません。</p>}
              </div>
              <Link className={button} href={"/my/manage?tab=class&business="+data.school.id}>コースを作成・変更する</Link>
            </div>}
            {activeSetup.id==="classList"&&<div className="space-y-3">
              <p className="text-sm">登録済みのクラス：{data.classes.length}件</p>
              <div className="rounded-xl bg-neutral-50 p-4">
                {data.classes.length?data.classes.map(slot=><p key={slot.id} className="border-b py-2 text-sm">
                  {slot.name}（{slot.starts_at?.slice(0,5)}〜 ／ {slot.duration_minutes}分）
                </p>):<p className="text-sm">クラスはまだありません。</p>}
              </div>
              <Link className={button} href={"/my/manage?tab=class&business="+data.school.id}>クラスを作成・変更する</Link>
            </div>}
            {activeSetup.id==="intake"&&<div className="space-y-3">
              <p className="rounded-xl bg-neutral-50 p-4 text-sm">現在の受付：{data.recruitment?.enabled?(data.recruitment.route==="direct"?"直接入会":"説明会・体験の受付あり"):"受付未設定・停止中"}</p>
              <p className="text-sm text-neutral-600">コースごとの入会方法や申込項目は、既存の募集・入会設定から編集できます。</p>
              <Link className={button} href={"/my/manage?tab=class&business="+data.school.id+"&setup=1"}>募集・入会方法を確認する</Link>
            </div>}
            {activeSetup.id==="review"&&<div className="space-y-3 rounded-xl border p-4 text-sm">
              <p>事業：<strong>{data.school.name}</strong></p>
              <p>対象：{audience==="adults"?"成人のみ":audience==="minors"?"未成年のみ":"成人・未成年の両方"}</p>
              <p>教える人：{String(wizard.teacherLabel??"先生")} ／ 受講者：{String(wizard.learnerLabel??"生徒")}</p>
              {audience!=="adults"&&<p>保護者：{String(wizard.guardianLabel??"保護者")}</p>}
              {audience==="minors"&&<p>卒業予定日の提案：{wizard.gradeExpiry==="yes"?"あり（先生確認必須）":"なし"}</p>}
              <p>コース：{data.courses.length}件 ／ クラス：{data.classes.length}件</p>
              <p>入会受付：{data.recruitment?.enabled?"設定済み":"未設定"}</p>
            </div>}
            <div className="flex flex-wrap items-center gap-3 border-t pt-5">
              <button className={button} disabled={busy||setupIndex===0} onClick={()=>void setupMove(setupIndex-1)}>← 前へ</button>
              {activeSetup.id==="review"?
                <button className={primary} disabled={busy} onClick={async()=>{if(await save("saveWizard"))view(1);}}>保存して16の質問へ →</button>:
                <button className={primary} disabled={busy} onClick={()=>void setupMove(setupIndex+1)}>
                  {busy?"保存中…":"保存して次へ →"}</button>}
            </div>
            <p className="text-xs text-neutral-500">回答は「次へ」を押すごとに保存します。再び開くと続きから始められます。</p>
          </div>}
          {stage===1&&<div className="mt-6 space-y-4">
            <div className="rounded-xl bg-emerald-50 p-3 text-sm">
              <p className="font-semibold">入力済みの教室情報を再利用できます</p>
              <p className="mt-1 text-xs text-neutral-600">コース名・月謝・開催枠・申込方法だけを未回答の質問へ転記します。すでに入力した回答は変更しません。</p>
              <button className={button+" mt-2"} onClick={fillKnownFacts}>教室の設定から下書きを作る</button>
            </div>
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
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
              <p className="text-sm font-semibold">この教室のPARARI PAGEを新しく作る</p>
              <p className="mt-2 text-xs text-neutral-600">16の回答を編集可能な文章の下書きに整理してPAGEを作成します。AI生成はまだ行いません。作成時は通常のPARARI作品上限が適用されます。</p>
              <button type="button" className={primary+" mt-3"} disabled={pageBusy||busy} onClick={()=>void createStarterPage()}>
                {pageBusy?"PAGEを作成中…":"回答からPAGEの下書きを作成"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={primary} disabled={busy||pageBusy} onClick={()=>void save("bindPage")}>関連付けを保存する</button>
              <Link className={button} href="/my/works">PARARI作品を作成・編集する</Link>
              {pageId&&<Link className={button} href={"/editor-v2/"+pageId}>選択したPAGEを編集する</Link>}
              <button className={button} onClick={()=>view(3)}>公開確認へ</button>
            </div>
            <p className="text-xs text-amber-900">新規作成PAGEは非公開で始まります。作品を公開し、教室の募集ページを公開すると、紹介リンクに表示されます。CLASSの予約・請求データはPAGEには保存しません。</p>
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
