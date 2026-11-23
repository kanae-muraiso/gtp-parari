"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { classRequest } from "@/lib/classRequests";
import { classSchedule, type ClassManagement, type SchoolClass } from "@/lib/classes";
import { supabase } from "@/lib/supabaseClient";
import { starterClassHomeSsot } from "@/lib/classHomePage";
import { classCalendarToday } from "@/lib/classCalendar";
import type { ClassProduct, NamedClassProduct } from "@/lib/classProduct";
import ClassProductPanel from "@/components/parari/manage/ClassProductPanel";
import ClassSlotSettingsPanel from "@/components/parari/manage/ClassSlotSettingsPanel";
import ClassCalendarPanel from "@/components/parari/manage/ClassCalendarPanel";
import ClassRecruitmentPanel, { type ClassRecruitmentData } from "@/components/parari/manage/ClassRecruitmentPanel";
import ClassAdmissionBlueprint from "@/components/parari/manage/ClassAdmissionBlueprint";
import ClassAdmissionsPanel from "@/components/parari/manage/ClassAdmissionsPanel";
import ClassAbsencesPanel from "@/components/parari/manage/ClassAbsencesPanel";
import ClassBusinessFrontPanel from "@/components/parari/manage/ClassBusinessFrontPanel";
import ClassEventsPanel from "@/components/parari/manage/ClassEventsPanel";

type Business={id:string;name:string;business_type:"school"|"studio"|"other";archived_at?:string|null};
type HomeDraft={wizard:Record<string,unknown>;landing_page_id:string|null;revision:number};
type OwnerDetails={
  draft:HomeDraft;pages:{id:string;title:string;visibility:string|null;is_public:boolean}[];
  published:boolean;recruitment:{enabled:boolean;public_id:string;route:string}|null;
};
type Tab="classes"|"admission"|"homepage"|"operation";
type Selection={kind:"business"|"course"|"class";id:string};
type FlowFocus="recruitment"|"agreement"|"blueprint"|"admissions";
type FirstDraft={
  name:string;cadence:"weekly"|"monthly";date:string;time:string;duration:string;
  delivery:"onsite"|"online"|"hybrid";location:string;meetingUrl:string;
  fee:string;monthlyVisits:string;capacity:string;audience:"adult"|"minor";
};
const field="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm";
const button="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50";
const primary="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const panel="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5";
const firstDraft=():FirstDraft=>({name:"",cadence:"weekly",date:classCalendarToday(),time:"",duration:"60",delivery:"onsite",
  location:"",meetingUrl:"",fee:"0",monthlyVisits:"4",capacity:"10",audience:"adult"});
const firstQuestions=[
  ["クラスの名前","まず、どんなクラスを開きますか？"],
  ["開催日時・繰り返し","いつ、どのくらいの頻度で開催しますか？"],
  ["開催場所","どこで開催しますか？"],
  ["受講費用","費用はいくらですか？"],
  ["定員・対象者","何人まで参加できますか？"],
  ["確認","この内容でクラスを作りますか？"],
] as const;
const money=(fee:number|undefined|null)=>fee==null?"未設定":fee.toLocaleString("ja-JP")+"円";

export default function ClassUnifiedWorkspace(){
  const [businesses,setBusinesses]=useState<Business[]>([]);
  const [business,setBusiness]=useState("");
  const [schoolName,setSchoolName]=useState("");
  const [businessKind,setBusinessKind]=useState<Business["business_type"]>("school");
  const [showCreateBusiness,setShowCreateBusiness]=useState(false);
  const [management,setManagement]=useState<ClassManagement|null>(null);
  const [products,setProducts]=useState<NamedClassProduct[]>([]);
  const [details,setDetails]=useState<OwnerDetails|null>(null);
  const [recruitment,setRecruitment]=useState<ClassRecruitmentData|null>(null);
  const [tab,setTab]=useState<Tab>("classes");
  const [operating,setOperating]=useState(false);
  const [selected,setSelected]=useState<Selection|null>(null);
  const [first,setFirst]=useState<FirstDraft>(firstDraft);
  const [firstStep,setFirstStep]=useState(0);
  const [firstActive,setFirstActive]=useState(false);
  const [flowFocus,setFlowFocus]=useState<FlowFocus>("recruitment");
  const [pageBusy,setPageBusy]=useState(false);
  const [welcome,setWelcome]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [refreshKey,setRefreshKey]=useState(0);
  const [editorKey,setEditorKey]=useState(0);
  const [operationFocus,setOperationFocus]=useState<"admissions"|"attendance"|"calendar"|"roster"|"events"|"workshops">("admissions");

  const refresh=useCallback(()=>setRefreshKey(k=>k+1),[]);
  function selectBusiness(id:string){
    window.history.replaceState(null,"",id?"/my/class-onboarding?business="+encodeURIComponent(id):"/my/class-onboarding");
    setBusiness(id);setManagement(null);setDetails(null);setRecruitment(null);
    setSelected(id?{kind:"business",id}:null);
    setFirstActive(false);setTab("classes");setError("");setNotice("");
  }

  useEffect(()=>{
    const requested=new URLSearchParams(window.location.search).get("business")??"";
    setBusiness(requested);
    const controller=new AbortController();
    void classRequest<{businesses:Business[]}>("?businesses=1",undefined,controller.signal)
      .then(data=>{if(!controller.signal.aborted){setBusinesses(data.businesses.filter(item=>!item.archived_at));setLoading(false);}})
      .catch(cause=>{if(!controller.signal.aborted){setError(cause instanceof Error?cause.message:"事業一覧を取得できませんでした。");setLoading(false);}});
    return ()=>controller.abort();
  },[]);

  useEffect(()=>{
    if(!business)return;
    const controller=new AbortController();
    setLoading(true);
    void Promise.all([
      classRequest<ClassManagement>("",undefined,controller.signal),
      classRequest<{products:NamedClassProduct[]}>("?product=1",undefined,controller.signal),
      classRequest<OwnerDetails>("/onboarding?school="+business,undefined,controller.signal),
      classRequest<ClassRecruitmentData>("/recruitment",undefined,controller.signal),
    ]).then(([m,p,d,r])=>{
      if(controller.signal.aborted)return;
      if(m.school?.id!==business)throw new Error("表示中の事業を確認できませんでした。");
      setManagement(m);setProducts(p.products);setDetails(d);setRecruitment(r);
      setWelcome(typeof d.draft.wizard?.welcome==="string"?d.draft.wizard.welcome:"");
      setOperating(Boolean(d.published));setLoading(false);
    }).catch(cause=>{
      if(!controller.signal.aborted){setError(cause instanceof Error?cause.message:"事業を読み込めませんでした。");setLoading(false);}
    });
    return ()=>controller.abort();
  },[business,refreshKey]);

  async function createBusiness(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      const id=crypto.randomUUID();
      await classRequest("",{action:"createBusiness",id,name:schoolName.trim(),businessType:businessKind});
      setBusinesses(old=>[...old,{id,name:schoolName.trim(),business_type:businessKind}]);
      setShowCreateBusiness(false);selectBusiness(id);
    }catch(cause){setError(cause instanceof Error?cause.message:"事業を作成できませんでした。");}
    finally{setBusy(false);}
  }

  const school=management?.school;
  const slots=school?.classes??[];
  const activeProduct=selected?.kind==="course"?products.find(p=>p.id===selected.id):
    selected?.kind==="class"?products.find(p=>p.id===slots.find(s=>s.id===selected.id)?.product_id):null;
  const activeSlot=selected?.kind==="class"?slots.find(s=>s.id===selected.id):undefined;
  const childSlots=activeSlot?slots.filter(s=>s.schedule_rules?.parentSlotId===activeSlot.id):[];
  const audienceProducts=management?.products??[];

  async function createFirstClass(){
    if(!business||busy)return;
    const duration=Number(first.duration),fee=Number(first.fee);
    const visits=Number(first.monthlyVisits),capacity=Number(first.capacity);
    const day=new Date(first.date+"T00:00:00Z");
    if(!first.name.trim()||!first.time||!Number.isInteger(duration)||duration<5||duration>480||
      !Number.isInteger(fee)||fee<0||fee>1000000||!Number.isInteger(visits)||visits<1||visits>100||
      !Number.isInteger(capacity)||capacity<1||capacity>1000||
      !first.date||Number.isNaN(day.getTime())||day.toISOString().slice(0,10)!==first.date||
      (first.delivery!=="online"&&!first.location.trim())||
      (first.delivery!=="onsite"&&!/^https:\/\//.test(first.meetingUrl))){
      setError("クラス名・初回日時・場所・費用・定員を確認してください。");return;
    }
    setBusy(true);setError("");setNotice("");
    const productId=crypto.randomUUID();
    const classId=crypto.randomUUID();
    const design:ClassProduct={
      audience:first.audience,classIds:[],description:"",capacity,monthlyFee:fee,monthlyVisits:visits,
      booking:"fixed",extraFee:null,makeup:"none",makeupExpiry:"next_month",walkInFee:null,
      slotDefaults:{duration,delivery:first.delivery,location:first.location.trim()},
    };
    try {
      await classRequest("",{action:"saveContentProduct",productId,name:first.name.trim(),design});
      try {
        await classRequest("",{action:"create",classId,name:first.name.trim(),schoolName:school?.name,
          date:first.date,time:first.time,cadence:first.cadence,location:first.location,
          delivery:first.delivery,meetingUrl:first.meetingUrl,duration,productId,feeOverride:""});
      }catch(cause){
        setFirstActive(false);setSelected({kind:"course",id:productId});
        setNotice("コースの内容と料金は保存されましたが、開催日時の登録は完了していません。コースから開催枠を追加してください。");
        setError(cause instanceof Error?cause.message:"開催日時を保存できませんでした。");
        refresh();return;
      }
      setFirstActive(false);setFirstStep(0);setFirst(firstDraft());
      setSelected({kind:"class",id:classId});setEditorKey(k=>k+1);
      setNotice("定期開催するクラスが完成しました。いつでも選択して変更できます。");
      refresh();
    }catch(cause){setError(cause instanceof Error?cause.message:"クラスを保存できませんでした。");}
    finally{setBusy(false);}
  }
  function patchFirst<K extends keyof FirstDraft>(key:K,value:FirstDraft[K]){
    setFirst(old=>({...old,[key]:value}));setError("");
  }
  async function saveSlotRows(rows:object[]){
    if(busy)return false;
    setBusy(true);setError("");setNotice("");
    try{await classRequest("",{action:"saveSlotRows",rows});setNotice("開催日時・場所を保存しました。");refresh();return true;}
    catch(cause){setError(cause instanceof Error?cause.message:"開催枠を保存できませんでした。");return false;}
    finally{setBusy(false);}
  }
  async function createHomePage(){
    if(!business||!school||pageBusy)return;
    setPageBusy(true);setError("");setNotice("");
    try{
      const session=await supabase.auth.getSession();
      const token=session.data.session?.access_token;
      if(!token)throw new Error("ログインが必要です。");
      const title=school.name+"のご案内";
      const response=await fetch("/api/works/create",{
        method:"POST",cache:"no-store",
        headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
        body:JSON.stringify({
          createRequestId:crypto.randomUUID(),
          stableSlug:"class-page-"+crypto.randomUUID().slice(0,12),
          template:{kind:"page",initialTitle:title,ssot:starterClassHomeSsot(title,business,welcome)},
        }),
      });
      const data=await response.json();
      if(!response.ok||!data.ok||!data.id)throw new Error(data.message||"紹介ページを作成できませんでした。");
      try{
        await classRequest("/onboarding?school="+business,{action:"bindPage",revision:details?.draft.revision??0,pageId:data.id});
        setNotice("紹介PAGEを作成して教室に関連付けました。通常のPARARIエディタで編集できます。");
      }catch(cause){
        setError("PAGE自体は作成されました。教室への関連付けが未完了です。もう一つ作成せず、再読み込みしてください。"+
          (cause instanceof Error?cause.message:""));
      }
      refresh();
    }catch(cause){setError(cause instanceof Error?cause.message:"紹介PAGEを作成できませんでした。");}
    finally{setPageBusy(false);}
  }
  async function linkExistingPage(id:string){
    if(!business||!details||busy)return;
    setBusy(true);setError("");
    try{await classRequest("/onboarding?school="+business,{action:"bindPage",revision:details.draft.revision,pageId:id});
      setNotice("作成済みの紹介PAGEを教室に結び付けました。");refresh();}
    catch(cause){setError(cause instanceof Error?cause.message:"関連付けできませんでした。");}
    finally{setBusy(false);}
  }
  const flow=(recruitment?.recruitment?.route==="briefing"
    ? ["説明会を予約","説明会・体験","入会申込","確認・名簿登録"]
    : ["募集ページ","入会申込","同意・支払","確認・名簿登録"]);
  const flowAction:FlowFocus[]=["recruitment","blueprint","agreement","admissions"];
  const roster=management?.roster??[];
  const navs:{id:Tab;label:string}[]=[
    {id:"classes",label:"クラス設計"},{id:"admission",label:"入会フロー"},
    {id:"homepage",label:"募集ページ"},{id:"operation",label:"名簿・日々の運営"},
  ];

  return <main className="min-h-screen bg-neutral-100 px-4 py-6 text-neutral-950 sm:px-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-bold tracking-wider text-emerald-900">PARARI CLASS</p>
          <h1 className="text-2xl font-bold">{operating?"日々の運営":"教室の開設・準備"}</h1>
          <p className="text-sm text-neutral-600">設計も運営も同じ場所で。クラスと入会の流れは、いつでも変更できます。</p>
        </div>
        {business&&<button className={button} onClick={()=>setOperating(v=>!v)}>
          {operating?"開設・設計の表示に切り替え":"日々の運営の表示に切り替え"}
        </button>}
      </header>

      {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{notice}</p>}
      <section className={panel+" space-y-3"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">あなたのクラス環境</h2>
          <button className={button} type="button" onClick={()=>setShowCreateBusiness(v=>!v)}>
            {showCreateBusiness?"閉じる":"＋ 事業を作る"}
          </button>
        </div>
        {showCreateBusiness&&<form onSubmit={e=>void createBusiness(e)} className="grid gap-3 rounded-xl bg-neutral-50 p-4 sm:grid-cols-3">
          <label className="grid gap-1 text-sm">事業名
            <input className={field} required maxLength={120} value={schoolName} onChange={e=>setSchoolName(e.target.value)} placeholder="例：〇〇英語教室"/>
          </label>
          <label className="grid gap-1 text-sm">事業の種類
            <select className={field} value={businessKind} onChange={e=>setBusinessKind(e.target.value as Business["business_type"])}>
              <option value="school">教室・スクール</option><option value="studio">スタジオ・サークル</option><option value="other">その他</option>
            </select>
          </label>
          <button className={primary+" self-end"} disabled={busy}>事業を保存</button>
        </form>}
        {!businesses.length&&!loading&&<p className="text-sm text-neutral-600">最初に事業を一つ作りましょう。その中にクラスを開設します。</p>}
        <div className="flex flex-wrap gap-2">
          {businesses.map(item=><button key={item.id} type="button" onClick={()=>selectBusiness(item.id)}
            className={"rounded-lg border px-3 py-2 text-sm "+(business===item.id?"border-emerald-800 bg-emerald-50 font-bold":"border-neutral-300")}>
            ■ {item.name}
          </button>)}
        </div>
        {school&&<div className="space-y-2 rounded-xl bg-neutral-50 p-3 sm:p-4">
          <button onClick={()=>{setSelected({kind:"business",id:business});setFirstActive(false);setTab("classes");}}
            className={"text-left font-bold "+(selected?.kind==="business"?"text-emerald-900 underline":"")} type="button">
            ■ {school.name} <span className="text-xs font-normal text-neutral-500">事業</span>
          </button>
          {products.map(product=>{
            const listed=slots.filter(slot=>slot.product_id===product.id);
            return <div key={product.id} className="ml-3 space-y-2 border-l-2 border-neutral-300 pl-4 sm:ml-5">
              <button className={"text-left text-sm font-semibold "+(selected?.kind==="course"&&selected.id===product.id?"text-emerald-900 underline":"")}
                type="button" onClick={()=>{setTab("classes");setSelected({kind:"course",id:product.id});setFirstActive(false);}}>
                □ {product.name} <span className="font-normal text-neutral-500">コース · {listed.length}クラス</span>
              </button>
              <div className="flex flex-wrap gap-2 pl-4">
                {listed.length?listed.map(slot=><button type="button" key={slot.id}
                  onClick={()=>{setTab("classes");setSelected({kind:"class",id:slot.id});setFirstActive(false);}}
                  className={"rounded-md border px-2 py-1 text-xs "+(selected?.kind==="class"&&selected.id===slot.id?"border-emerald-700 bg-emerald-100":"border-neutral-300 bg-white")}>
                  × {slot.name} · {slot.starts_at.slice(0,5)}
                </button>):<span className="text-xs text-amber-800">開催日時が未登録です</span>}
              </div>
            </div>;
          })}
          {slots.filter(slot=>!slot.product_id).length>0&&<p className="pl-5 text-xs text-amber-800">未分類の開催枠：{slots.filter(slot=>!slot.product_id).length}件（既存データ）</p>}
          <button type="button" className={primary+" mt-2"} onClick={()=>{
            setTab("classes");setFirstActive(true);setFirstStep(0);setFirst(firstDraft());setError("");
          }}>＋ クラスを作る</button>
        </div>}
      </section>

      {business&&<nav aria-label="クラス環境の操作" className="flex flex-wrap gap-2">
        {navs.map(item=><button type="button" key={item.id} onClick={()=>{setTab(item.id);setError("");}}
          className={"rounded-lg border px-3 py-2 text-sm font-semibold "+(tab===item.id?"border-emerald-800 bg-emerald-50 text-emerald-900":"border-neutral-200 bg-white")}>
          {item.label}
        </button>)}
      </nav>}
      {loading&&business&&<p role="status" className="text-sm">教室の情報を確認しています…</p>}

      {school&&tab==="classes"&&<section className={panel+" space-y-5"}>
        <h2 className="text-xl font-bold">クラスを設計する</h2>
        {firstActive?<>
          <div className="flex justify-between gap-2 text-xs font-semibold text-emerald-800">
            <span>質問 {firstStep+1} / {firstQuestions.length}</span><span>最初の1クラス</span>
          </div>
          <div className="h-1.5 rounded-full bg-neutral-100"><div className="h-full rounded-full bg-emerald-700"
            style={{width:(firstStep+1)/firstQuestions.length*100+"%"}}/></div>
          <h3 className="font-bold">{firstQuestions[firstStep][1]}</h3>
          {firstStep===0&&<label className="grid gap-1 text-sm">クラスの名前
            <input className={field} value={first.name} maxLength={120} placeholder="例：初心者の英語クラス"
              onChange={e=>patchFirst("name",e.target.value)}/></label>}
          {firstStep===1&&<div className="grid max-w-lg gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">繰り返し
              <select className={field} value={first.cadence} onChange={e=>patchFirst("cadence",e.target.value as FirstDraft["cadence"])}>
                <option value="weekly">毎週</option><option value="monthly">毎月（毎月同じ日）</option>
              </select></label>
            <label className="grid gap-1 text-sm">初回開催日
              <input type="date" className={field} value={first.date} onChange={e=>patchFirst("date",e.target.value)}/></label>
            <label className="grid gap-1 text-sm">開始時刻
              <input type="time" className={field} value={first.time} onChange={e=>patchFirst("time",e.target.value)}/></label>
            <label className="grid gap-1 text-sm">授業時間（分）
              <input type="number" min={5} max={480} className={field} value={first.duration} onChange={e=>patchFirst("duration",e.target.value)}/></label>
            <p className="sm:col-span-2 text-xs text-neutral-600">例：初回が水曜なら、毎週水曜に開催。休講や例外日はあとから開催予定で変更できます。</p>
          </div>}
          {firstStep===2&&<div className="grid max-w-lg gap-3">
            <label className="grid gap-1 text-sm">開催方法
              <select className={field} value={first.delivery} onChange={e=>patchFirst("delivery",e.target.value as FirstDraft["delivery"])}>
                <option value="onsite">対面</option><option value="online">オンライン</option><option value="hybrid">対面・オンライン併用</option>
              </select></label>
            {first.delivery!=="online"&&<label className="grid gap-1 text-sm">会場
              <input className={field} value={first.location} maxLength={200} placeholder="例：京都教室A"
                onChange={e=>patchFirst("location",e.target.value)}/></label>}
            {first.delivery!=="onsite"&&<label className="grid gap-1 text-sm">オンライン参加URL（HTTPS）
              <input className={field} type="url" value={first.meetingUrl} placeholder="https://..."
                onChange={e=>patchFirst("meetingUrl",e.target.value)}/></label>}
          </div>}
          {firstStep===3&&<div className="grid max-w-lg gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">月謝（円）
              <input className={field} inputMode="numeric" type="number" min={0} max={1000000}
                value={first.fee} onChange={e=>patchFirst("fee",e.target.value)}/></label>
            <label className="grid gap-1 text-sm">月の受講回数
              <input className={field} type="number" min={1} max={100} value={first.monthlyVisits}
                onChange={e=>patchFirst("monthlyVisits",e.target.value)}/></label>
            <p className="text-xs text-neutral-600 sm:col-span-2">まず月謝制の定期クラスを作ります。1回払いなどの変更は、作成後に「コース」を選んで設定できます。</p>
          </div>}
          {firstStep===4&&<div className="grid max-w-lg gap-3">
            <label className="grid gap-1 text-sm">定員
              <input type="number" className={field} min={1} max={1000} value={first.capacity}
                onChange={e=>patchFirst("capacity",e.target.value)}/></label>
            <label className="grid gap-1 text-sm">受講者
              <select className={field} value={first.audience} onChange={e=>patchFirst("audience",e.target.value as FirstDraft["audience"])}>
                <option value="adult">成人向け</option><option value="minor">未成年向け（保護者の手続きあり）</option>
              </select></label>
          </div>}
          {firstStep===5&&<div className="rounded-xl bg-neutral-50 p-4 text-sm leading-8">
            <p><strong>クラス：</strong>{first.name||"未入力"}</p>
            <p><strong>開催：</strong>{first.cadence==="weekly"?"毎週":"毎月"} ／ {first.date} {first.time}〜（{first.duration}分）</p>
            <p><strong>場所：</strong>{first.delivery==="online"?"オンライン":first.location||"未入力"}</p>
            <p><strong>費用：</strong>月 {first.monthlyVisits}回・{money(Number(first.fee))}</p>
            <p><strong>定員：</strong>{first.capacity}人</p>
            <p className="mt-2 text-xs text-neutral-600">保存すると、内部に初期コースも自動作成され、開催予定と料金が紐付きます。</p>
          </div>}
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <button type="button" className={button} onClick={()=>firstStep===0?setFirstActive(false):setFirstStep(x=>x-1)}>
              ← {firstStep===0?"閉じる":"戻る"}</button>
            {firstStep<5?<button className={primary} type="button" onClick={()=>{
              if(firstStep===0&&!first.name.trim()){setError("クラス名を入力してください。");return;}
              if(firstStep===1&&(!first.time||!first.date||Number(first.duration)<5)){setError("日時を入力してください。");return;}
              if(firstStep===2&&((first.delivery!=="online"&&!first.location.trim())||(first.delivery!=="onsite"&&!first.meetingUrl.startsWith("https://")))){setError("場所または参加URLを入力してください。");return;}
              setError("");setFirstStep(x=>x+1);
            }}>次へ →</button>:
              <button type="button" className={primary} disabled={busy} onClick={()=>void createFirstClass()}>
                {busy?"保存中…":"このクラスを作成する"}</button>}
          </div>
        </>:activeProduct&&selected?.kind==="course"?<>
          <h3 className="font-bold">□ {activeProduct.name} ／ コースの内容・月謝・定員</h3>
          <ClassProductPanel key={selected.id+":"+editorKey} classes={slots} initialProduct={activeProduct.id}
            allowProductSelection={false} onSaved={()=>{setNotice("コースを保存しました。");refresh();}}/>
          <div className="border-t pt-4"><button className={button} onClick={()=>{
            setSelected({kind:"class",id:crypto.randomUUID()});setEditorKey(k=>k+1);
          }}>＋ このコースにクラスを追加</button></div>
        </>:selected?.kind==="class"&&activeSlot&&activeProduct?<>
          <h3 className="font-bold">× {activeSlot.name} ／ 日時・場所を変更</h3>
          <p className="text-sm text-neutral-600">{classSchedule(activeSlot)} · {activeSlot.location||"オンライン"}</p>
          <ClassSlotSettingsPanel key={activeSlot.id+":"+editorKey} item={activeSlot} additionalSlots={childSlots} startId={activeSlot.id}
            productId={activeProduct.id} slotDefaults={activeProduct.design.slotDefaults}
            basicFee={activeProduct.design.monthlyFee} walkIn={activeProduct.design.walkInFee!=null} busy={busy}
            save={async rows=>saveSlotRows(rows)}/>
          <details className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">開催日や休講を確認</summary>
            <div className="mt-3"><ClassCalendarPanel classes={[activeSlot,...childSlots]} selectedClass={activeSlot} onSaved={refresh}/></div></details>
        </>:selected?.kind==="class"&&!activeSlot?<>
          <h3 className="font-bold">このコースに開催枠を追加</h3>
          <p className="text-sm">コースを選択して開催日時・場所を追加します。</p>
          {products.map(product=><button className={button+" mr-2"} key={product.id} onClick={()=>setSelected({kind:"course",id:product.id})}>{product.name}を選ぶ</button>)}
        </>:<>
          <p className="text-sm text-neutral-600">上の図で事業・コース・クラスを選ぶと、この場所で編集できます。最初のクラスは「＋ クラスを作る」から、一問ずつ設定します。</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-neutral-50 p-3 text-sm"><strong>{products.length}</strong> コース</div>
            <div className="rounded-xl bg-neutral-50 p-3 text-sm"><strong>{slots.length}</strong> クラス</div>
            <div className="rounded-xl bg-neutral-50 p-3 text-sm"><strong>{roster.filter(p=>p.status==="active").length}</strong> 在籍者</div>
          </div>
          <details className="rounded-xl border p-3">
            <summary className="cursor-pointer font-semibold">事業名・先生・生徒の呼び方</summary>
            <div className="mt-3"><ClassAdmissionsPanel mode="labels" /></div>
          </details>
        </>}
      </section>}

      {school&&tab==="admission"&&<section className={panel+" space-y-5"}>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">入会までの流れ</h2>
          <p className="text-sm text-neutral-600">矢印は実際の受付設定をもとに表示します。工程を選ぶと、すぐ下で設定を変更できます。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label="入会手続きの流れ">
          {flow.map((label,i)=><div key={label} className="flex items-center gap-2">
            <button type="button" onClick={()=>setFlowFocus(flowAction[i])}
              className={"rounded-xl border px-3 py-3 text-sm font-semibold "+(flowFocus===flowAction[i]?"border-emerald-800 bg-emerald-50":"border-neutral-300 bg-white")}>
              <span className="text-emerald-900">{["○","◎","△","※"][i]}</span> {label}
            </button>
            {i<flow.length-1&&<span aria-hidden className="text-xl text-neutral-500">→</span>}
          </div>)}
        </div>
        <div className="border-t pt-4">
          {flowFocus==="recruitment"&&<ClassRecruitmentPanel key={business+":recruit"} view="settings" classes={slots}
            products={audienceProducts} onOpenSettings={()=>setFlowFocus("recruitment")} onSaved={refresh} hidePublication/>}
          {flowFocus==="blueprint"&&<ClassAdmissionBlueprint key={business+":flow"} schoolId={business}
            schoolName={school.name} classProducts={audienceProducts}/>}
          {flowFocus==="agreement"&&<ClassAdmissionsPanel key={business+":agreement"} mode="settings" onSaved={refresh}/>}
          {flowFocus==="admissions"&&<ClassAdmissionsPanel key={business+":admissions"} mode="admissions" onRosterChanged={refresh}/>}
        </div>
      </section>}

      {school&&tab==="homepage"&&<section className={panel+" space-y-5"}>
        <h2 className="text-xl font-bold">募集ページを編集する</h2>
        <p className="text-sm">公開URL：<Link className="underline" href={"/class-business/"+business} target="_blank">/class-business/{business}</Link></p>
        <div className="grid gap-2 rounded-xl bg-neutral-50 p-4 text-sm">
          <p>PARARIで編集する部分：ご挨拶・写真・教室紹介</p>
          <p>CLASSが管理する部分：コース・料金・日時・申込ボタン</p>
        </div>
        {details?.draft.landing_page_id ? <div className="flex flex-wrap gap-2">
          <Link className={primary} href={"/editor-v2/"+details.draft.landing_page_id}>紹介文や写真を編集</Link>
          <Link className={button} href={"/class-business/"+business} target="_blank">公開ページを見る</Link>
        </div>:<>
          {details?.pages.length ? <div className="rounded-xl border bg-amber-50 p-3 text-sm">
            <p>以前作成した教室紹介PAGEがあります。作り直さずに再利用できます。</p>
            <button type="button" className={button+" mt-2"} onClick={()=>void linkExistingPage(details.pages[0].id)} disabled={busy}>以前のPAGEを使う</button>
          </div>:null}
          <label className="grid gap-1 text-sm">先生からのご挨拶（あとから変更可能）
            <textarea className={field} rows={3} value={welcome} maxLength={2000} onChange={e=>setWelcome(e.target.value)}/></label>
          <button type="button" className={primary} disabled={pageBusy||busy} onClick={()=>void createHomePage()}>この教室の紹介PAGEを作る</button>
        </>}
        <details className="rounded-xl border p-3" open={false}>
          <summary className="cursor-pointer font-bold">募集ページの掲載・公開設定</summary>
          <div className="mt-3"><ClassBusinessFrontPanel key={business+":front"} schoolId={business} name={school.name}
            products={products} onOpenRecruitment={()=>setTab("admission")} onOpenSchedule={()=>setTab("classes")} onSaved={refresh}/></div>
        </details>
        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer font-bold">申込フォームの公開・停止</summary>
          <div className="mt-3"><ClassRecruitmentPanel key={business+":publish"} view="settings" publicationOnly classes={slots}
            products={audienceProducts} onOpenSettings={()=>setTab("admission")} onSaved={refresh}/></div>
        </details>
      </section>}

      {school&&tab==="operation"&&<section className={panel+" space-y-5"}>
        <h2 className="text-xl font-bold">日々の運営</h2>
        <div className="flex flex-wrap gap-2">
          {([
            ["admissions","申込・入会"],["attendance","欠席連絡"],["calendar","開催予定"],
            ["roster","名簿"],["events","イベント"],["workshops","講習会"],
          ] as const).map(([id,label])=><button type="button" key={id} onClick={()=>setOperationFocus(id)}
            className={operationFocus===id?primary:button}>{label}</button>)}
        </div>
        {operationFocus==="admissions"&&<ClassAdmissionsPanel key={business+":ops-admission"} mode="admissions" onRosterChanged={refresh}/>}
        {operationFocus==="attendance"&&<ClassAbsencesPanel schoolId={business} classes={slots}/>}
        {operationFocus==="calendar"&&<ClassCalendarPanel classes={slots} onSaved={refresh}/>}
        {operationFocus==="roster"&&<div className="space-y-2">
          <p className="text-sm text-neutral-600">在籍・終了は名簿の正本です。編集する人を選択してください。</p>
          {roster.map(member=><details key={member.id} className="rounded-xl border p-3">
            <summary className="cursor-pointer font-semibold">{member.name} · {member.status==="active"?"在籍中":"終了"}</summary>
            <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={async event=>{
              event.preventDefault();const form=new FormData(event.currentTarget);
              setBusy(true);setError("");try{
                await classRequest("",{action:"member",memberId:member.id,name:form.get("name"),
                  status:form.get("status")});
                setNotice("名簿を保存しました。");refresh();
              }catch(cause){setError(cause instanceof Error?cause.message:"名簿を更新できませんでした。");}
              finally{setBusy(false);}
            }}>
              <label className="grid gap-1 text-sm">名前<input name="name" className={field} required defaultValue={member.name}/></label>
              <label className="grid gap-1 text-sm">在籍状況
                <select className={field} name="status" defaultValue={member.status}>
                  <option value="active">在籍中</option><option value="ended">終了</option>
                </select>
              </label>
              <p className="text-xs text-neutral-600 sm:col-span-2">月謝請求の停止・退会承認は、単なる在籍状況の編集とは別に確認が必要です。</p>
              <button className={primary} disabled={busy}>変更を保存</button>
            </form>
          </details>)}
          {!roster.length&&<p className="text-sm">登録された受講者はまだいません。</p>}
        </div>}
        {operationFocus==="events"&&<ClassEventsPanel classes={slots} roster={roster} kind="event"/>}
        {operationFocus==="workshops"&&<ClassEventsPanel classes={slots} roster={roster} kind="workshop"/>}
      </section>}
      <footer className="pb-5 text-xs text-neutral-500">
        CLASSの設定・名簿・受付は既存の正本に保存されます。募集ページの文章はPARARI PAGEです。
        未完成の受付や未公開のPAGEは自動公開しません。
      </footer>
    </div>
  </main>;
}
