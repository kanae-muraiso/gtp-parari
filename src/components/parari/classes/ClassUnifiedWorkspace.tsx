"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { classRequest } from "@/lib/classRequests";
import { classSchedule, type ClassManagement, type SchoolClass } from "@/lib/classes";
import { supabase } from "@/lib/supabaseClient";
import { starterClassHomeSsot } from "@/lib/classHomePage";
import { classCalendarToday } from "@/lib/classCalendar";
import { classEventDate, type ClassEvent, type ClassEventKind } from "@/lib/classEvents";
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
import ClassSalesPanel from "./ClassSalesPanel";
import ClassServiceLabelSettings from "./ClassServiceLabelSettings";
import ClassBusinessModelSettings from "./ClassBusinessModelSettings";
import ClassCourseRecruitmentPanel from "./ClassCourseRecruitmentPanel";
import ClassRecruitmentFlowWorkspace,{ClassServiceQualification} from "./ClassRecruitmentFlowWorkspace";
import type {FlowTarget,FlowStep} from "@/lib/classRecruitmentFlowDesign";
import {legacyBusinessModel,parseBusinessModel,visibleServiceKinds,type ClassBusinessModel,type ServiceKind} from "@/lib/classBusinessModel";
import {defaultServiceLabels,readServiceLabels,type ServiceLabels} from "@/lib/classServiceLabels";
import ClassBCheckoutPanel from "@/components/parari/billing/ClassBCheckoutPanel";
import ClassWorkspaceHome, {classAreaForTab,type ClassWorkspaceTab} from "./ClassWorkspaceHome";

type Business={id:string;name:string;business_type:"school"|"studio"|"other";archived_at?:string|null};
type HomeDraft={wizard:Record<string,unknown>;sales_answers:string[];landing_page_id:string|null;revision:number};
type OwnerDetails={
  draft:HomeDraft;pages:{id:string;title:string;visibility:string|null;is_public:boolean}[];
  published:boolean;recruitment:{enabled:boolean;public_id:string;route:string}|null;
};
type Tab=ClassWorkspaceTab;
type Selection={kind:"business"|"course"|"class";id:string};
type FlowFocus="recruitment"|"agreement"|"blueprint"|"admissions";
type FirstDraft={
  name:string;cadence:"weekly"|"monthly";date:string;time:string;duration:string;
  delivery:"onsite"|"online"|"hybrid";location:string;meetingUrl:string;
  feeMode:"monthly"|"per_visit";fee:string;monthlyVisits:string;capacity:string;audience:"adult"|"minor";
};
const field="block min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base";
const button="min-h-11 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base font-medium disabled:opacity-50";
const primary="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 text-base font-semibold text-white disabled:opacity-50";
const panel="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5";
const firstDraft=():FirstDraft=>({name:"",cadence:"weekly",date:classCalendarToday(),time:"",duration:"60",delivery:"onsite",
  location:"",meetingUrl:"",feeMode:"monthly",fee:"0",monthlyVisits:"4",capacity:"10",audience:"adult"});
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
  const [model,setModel]=useState<ClassBusinessModel>(legacyBusinessModel);
  const [showModel,setShowModel]=useState(false);
  const [recruitService,setRecruitService]=useState<{kind:ServiceKind;id:string}|null>(null);
  const [legacyRecruit,setLegacyRecruit]=useState(false);
  const preview=process.env.NEXT_PUBLIC_VERCEL_ENV==="preview";
  const [serviceLabels,setServiceLabels]=useState<ServiceLabels>(defaultServiceLabels);
  const [labelsLoaded,setLabelsLoaded]=useState(false);
  const [schoolName,setSchoolName]=useState("");
  const [businessKind,setBusinessKind]=useState<Business["business_type"]>("school");
  const [editingBusinessName,setEditingBusinessName]=useState("");
  const [showCreateBusiness,setShowCreateBusiness]=useState(false);
  const [management,setManagement]=useState<ClassManagement|null>(null);
  const [products,setProducts]=useState<NamedClassProduct[]>([]);
  const [details,setDetails]=useState<OwnerDetails|null>(null);
  const [recruitment,setRecruitment]=useState<ClassRecruitmentData|null>(null);
  const [tab,setTab]=useState<Tab>("home");
  const [selected,setSelected]=useState<Selection|null>(null);
  const [first,setFirst]=useState<FirstDraft>(firstDraft);
  const [firstStep,setFirstStep]=useState(0);
  const [firstActive,setFirstActive]=useState(false);
  const [newCourse,setNewCourse]=useState(false);
  const [chooseCourse,setChooseCourse]=useState(false);
  const [eventDesign,setEventDesign]=useState<{kind:ClassEventKind;id?:string}|null>(null);
  const [designEvents,setDesignEvents]=useState<ClassEvent[]>([]);
  const [designWorkshops,setDesignWorkshops]=useState<ClassEvent[]>([]);
  const [designError,setDesignError]=useState("");
  const [designLoading,setDesignLoading]=useState(false);
  const [canDesignEvents,setCanDesignEvents]=useState(false);
  const [newSlot,setNewSlot]=useState<{id:string;productId:string}|null>(null);
  const [flowFocus,setFlowFocus]=useState<FlowFocus>("recruitment");
  const [pageBusy,setPageBusy]=useState(false);
  const [welcome,setWelcome]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [refreshKey,setRefreshKey]=useState(0);
  const [editorKey,setEditorKey]=useState(0);
  const [operationFocus,setOperationFocus]=useState<"admissions"|"attendance"|"calendar"|"roster"|"events"|"workshops">("roster");

  const refresh=useCallback(()=>setRefreshKey(k=>k+1),[]);
  function selectBusiness(id:string){
    window.history.replaceState(null,"",id?"/my/class-onboarding?business="+encodeURIComponent(id):"/my/class-onboarding");
    setBusiness(id);setModel(legacyBusinessModel);setShowModel(false);setRecruitService(null);setLegacyRecruit(false);setServiceLabels(defaultServiceLabels);setLabelsLoaded(false);setManagement(null);setDetails(null);setRecruitment(null);setProducts([]);setDesignEvents([]);setDesignWorkshops([]);setCanDesignEvents(false);setDesignError("");setLoading(Boolean(id));
    setNewCourse(false);setChooseCourse(false);setEventDesign(null);setShowCreateBusiness(false);
    setSelected(id?{kind:"business",id}:null);
    setFirstActive(false);setNewSlot(null);setTab("home");setOperationFocus("roster");setError("");setNotice("");
  }

  useEffect(()=>{
    const requested=new URLSearchParams(window.location.search).get("business")??"";
    setBusiness(requested);setSelected(requested?{kind:"business",id:requested}:null);
    const controller=new AbortController();
    void classRequest<{businesses:Business[]}>("?businesses=1",undefined,controller.signal)
      .then(data=>{if(!controller.signal.aborted){const active=data.businesses.filter(item=>!item.archived_at);setBusinesses(active);if(requested&&!active.some(item=>item.id===requested))selectBusiness("");setLoading(false);}})
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
      const saved=parseBusinessModel(d.draft.wizard?.businessModel);
      let local:ClassBusinessModel|null=null;
      if(preview)try{local=parseBusinessModel(sessionStorage.getItem("class-model:"+business));}catch{}
      setModel(local??saved??legacyBusinessModel);
      setEditingBusinessName(m.school?.name??"");
      setWelcome(typeof d.draft.wizard?.welcome==="string"?d.draft.wizard.welcome:"");
      setLoading(false);
    }).catch(cause=>{
      if(!controller.signal.aborted){setError(cause instanceof Error?cause.message:"事業を読み込めませんでした。");setLoading(false);}
    });
    return ()=>controller.abort();
  },[business,refreshKey]);

  useEffect(()=>{
    if(!business)return;
    const controller=new AbortController();
    setLabelsLoaded(false);
    void classRequest<{settings:{labels:unknown}}>("/admissions?settings=1",undefined,controller.signal).then(data=>{
      if(!controller.signal.aborted){setServiceLabels(readServiceLabels(data.settings.labels));setLabelsLoaded(true);}
    }).catch(()=>{if(!controller.signal.aborted)setLabelsLoaded(false);});
    return ()=>controller.abort();
  },[business]);
  useEffect(()=>{
    if(!business)return;
    const controller=new AbortController();
    setDesignLoading(true);setDesignError("");setCanDesignEvents(false);
    void Promise.all([
      classRequest<{events:ClassEvent[];canCreateEvents:boolean}>("/events?kind=event",undefined,controller.signal),
      classRequest<{events:ClassEvent[];canCreateEvents:boolean}>("/events?kind=workshop",undefined,controller.signal)
    ]).then(([events,workshops])=>{
      if(controller.signal.aborted)return;
      setDesignEvents(events.events);setDesignWorkshops(workshops.events);setCanDesignEvents(events.canCreateEvents&&workshops.canCreateEvents);setDesignLoading(false);
    }).catch(cause=>{if(!controller.signal.aborted){setDesignError(cause instanceof Error?cause.message:"講習会・イベントの構成を取得できませんでした。");setDesignLoading(false);}});
    return ()=>controller.abort();
  },[business,tab,refreshKey]);
  function resetDesign(){
    setFirstActive(false);setNewSlot(null);setNewCourse(false);setChooseCourse(false);setEventDesign(null);setError("");setNotice("");
  }
  function pickDesign(kind:Selection["kind"],id:string){
    resetDesign();setSelected({kind,id});setEditorKey(k=>k+1);
  }
  function addClassToCourse(id:string){
    pickDesign("course",id);setNewSlot({id:crypto.randomUUID(),productId:id});
  }
  function startClass(){
    resetDesign();
    if(products.length===1)addClassToCourse(products[0].id);
    else if(products.length>1)setChooseCourse(true);
    else{setFirstActive(true);setFirstStep(0);setFirst(firstDraft());}
  }

  async function createBusiness(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      const id=crypto.randomUUID();
      await classRequest("",{action:"createBusiness",id,name:schoolName.trim(),businessType:businessKind});
      setBusinesses(old=>[...old,{id,name:schoolName.trim(),business_type:businessKind}]);
      setShowCreateBusiness(false);selectBusiness(id);setTab("settings");setShowModel(true);
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
  const chosenLabel=firstActive?"新しい"+serviceLabels.class:newSlot?serviceLabels.class+"の追加":
    selected?.kind==="course"?(activeProduct?.name??serviceLabels.course):
    selected?.kind==="class"?(activeSlot?.name??serviceLabels.class):(school?.name??"事業");
  const chosenKind=firstActive||newSlot?serviceLabels.class:selected?.kind==="course"?serviceLabels.course:
    selected?.kind==="class"?serviceLabels.class:"事業";

  async function renameBusiness(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!school || busy || editingBusinessName.trim()===school.name)return;
    setBusy(true);setError("");setNotice("");
    try{
      await classRequest("",{action:"renameBusiness",name:editingBusinessName.trim(),expectedName:school.name});
      setBusinesses(items=>items.map(item=>item.id===business?{...item,name:editingBusinessName.trim()}:item));
      setNotice("事業名を変更しました。");
      refresh();
    }catch(cause){setError(cause instanceof Error?cause.message:"事業名の変更に失敗しました。");}
    finally{setBusy(false);}
  }


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
      audience:first.audience,classIds:[],description:"",capacity,monthlyFee:first.feeMode==="monthly"?fee:0,monthlyVisits:first.feeMode==="monthly"?visits:1,
      booking:first.feeMode==="monthly"?"fixed":"flexible",extraFee:null,makeup:"none",makeupExpiry:"next_month",walkInFee:first.feeMode==="per_visit"?fee:null,
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
  const area=classAreaForTab(tab);
  const kinds=visibleServiceKinds(model,[...(products.length||slots.length?["course" as const]:[]),...(designWorkshops.length?["workshop" as const]:[]),...(designEvents.length?["event" as const]:[])]);
  const services=kinds.flatMap<{kind:ServiceKind;id:string;title:string;detail:string}>(kind=>kind==="course"?products.map(p=>({kind,id:p.id,title:p.name,detail:"受講申込"})):(kind==="workshop"?designWorkshops:designEvents).map(e=>({kind,id:e.id,title:e.title,detail:e.status==="draft"?"下書き":e.status==="open"?"公開中":"受付終了"})));
  const currentCourse=audienceProducts.find(p=>p.id===recruitService?.id);
  const flowTargets:FlowTarget[]=[
    ...(model.membership?[{kind:"membership" as const,id:business,title:"事業への入会"}]:[]),
    ...services.map((s):FlowTarget=>{
      if(s.kind==="course"){
        const p=products.find(p=>p.id===s.id);
        const fee=p?.design.walkInFee??p?.design.monthlyFee??0;
        return {...s,paid:fee>0,priceText:(p?.design.walkInFee!=null?"1回 ":"月額 ")+money(fee),defaultPayment:fee<=0?"free":p?.design.walkInFee!=null?"onsite":"recurring",classNames:slots.filter(c=>c.product_id===s.id).map(c=>c.name)};
      }
      const event=(s.kind==="event"?designEvents:designWorkshops).find(e=>e.id===s.id);
      const fee=event?.payment_amount??0;
      return {...s,paid:fee>0,priceText:fee>0?money(fee):"無料",defaultPayment:fee<=0?"free":event?.payment_method==="on_site"?"onsite":"before"};
    })
  ];
  function openFlowDesign(target:FlowTarget){
    if(target.kind==="membership"){go("settings");setShowModel(true);return;}
    go("classes");
    if(target.kind==="course")pickDesign("course",target.id);
    else setEventDesign({kind:target.kind,id:target.id});
  }
  function openLegacyFlow(target:FlowTarget,step:FlowStep){
    if(target.kind==="membership"){go("admission");setFlowFocus(step==="terms"?"agreement":step==="briefing"?"blueprint":"recruitment");return;}
    setRecruitService({kind:target.kind,id:target.id});setLegacyRecruit(true);
  }
  async function applyModel(next:ClassBusinessModel){
    if(!business||busy)return;
    if(preview){try{sessionStorage.setItem("class-model:"+business,JSON.stringify(next));}catch{}setModel(next);setShowModel(false);setNotice("このブラウザに事業の設計案を反映しました。本番データは変更していません。");return;}
    if(!details)return;
    setBusy(true);setError("");
    try{await classRequest("/onboarding?school="+business,{action:"saveWizard",revision:details.draft.revision,wizard:{...details.draft.wizard,businessModel:JSON.stringify(next)}});setModel(next);setShowModel(false);setNotice("事業の設計案を保存しました。");refresh();}
    catch(e){setError(e instanceof Error?e.message:"設計案を保存できませんでした。");}finally{setBusy(false);}
  }
  const recruitTabs=[["services","個別サービスの申込"],["homepage","事業の募集ページ"],...(kinds.includes("course")?[["admission",model.membership?"入会・共通設定":"継続サービスの共通設定"] as const]:model.membership?[["admission","入会制度の設計"] as const]:[]),["improve","募集の改善"]] as const;
  function go(next:Tab){
    resetDesign();setShowCreateBusiness(false);setRecruitService(null);setLegacyRecruit(false);
    if(next==="operation")setOperationFocus(model.primary==="event"?"events":model.primary==="workshop"?"workshops":"roster");
    setTab(next);
    window.scrollTo(0,0);
  }
  async function confirmSurcharge(memberId:string,classId:string,day:string){
    if(busy)return;
    setBusy(true);setError("");setNotice("");
    try{await classRequest("",{action:"confirmSurcharge",memberId,classId,day});setNotice("差額の入金を記録しました。");refresh();}
    catch(cause){setError(cause instanceof Error?cause.message:"入金を記録できませんでした。");}
    finally{setBusy(false);}
  }

  return <main className="min-h-screen bg-neutral-100 px-4 py-6 text-neutral-950 sm:px-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/my/studio" className="inline-flex min-h-11 items-center text-base font-medium text-neutral-700">← STUDIO</Link>
        {tab!=="home"&&<button className={button} onClick={()=>go("home")}>← CLASS ホーム</button>}
      </header>
      {process.env.NEXT_PUBLIC_VERCEL_ENV==="preview"&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-base text-amber-900">開発プレビュー：実データと接続している場合があります。既存事業の保存・公開・入金操作は行わず、画面と導線を確認してください。</p>}
      {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{notice}</p>}
      {!business?<section className={panel+" space-y-4"}>
        <h1 className="text-2xl font-bold">運営する事業</h1>
        <p className="text-base text-neutral-600">既存の事業を選ぶか、新しい事業を作って始めます。</p>
        {businesses.map(item=><button type="button" key={item.id} disabled={busy} onClick={()=>selectBusiness(item.id)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 text-left text-lg font-semibold hover:border-emerald-700">
          <span className="flex-1">{item.name}</span><span aria-hidden="true" className="text-2xl text-neutral-500">›</span>
        </button>)}
        {!businesses.length&&!loading&&!error&&<p className="text-base text-neutral-600">まだ事業がありません。最初の事業を作りましょう。</p>}
        {loading&&<p role="status">事業一覧を読み込んでいます…</p>}
        <button className={primary+" w-full"} type="button" disabled={busy||loading} onClick={()=>setShowCreateBusiness(v=>!v)}>{showCreateBusiness?"閉じる":"＋ 新しい事業を作る"}</button>
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

      </section>:<section className={panel+" flex min-h-16 items-center gap-3"}>
        <button type="button" className={button} disabled={busy||pageBusy} onClick={()=>selectBusiness("")}>‹ 戻る</button>
        <h1 className="flex-1 break-words text-center text-xl font-bold">{school?.name??businesses.find(item=>item.id===business)?.name??"事業を確認中…"}</h1>
        <span aria-hidden="true" className="w-16"/>
      </section>}
      {business&&tab==="home"&&<ClassWorkspaceHome disabled={!school||loading} onNavigate={go} labels={serviceLabels}/>}
      {tab!=="home"&&school&&<>
        <nav aria-label="CLASS 共通ナビゲーション" className="grid grid-cols-4 gap-1 rounded-xl border border-neutral-200 bg-white p-1 sm:gap-2 sm:p-2">
          {([["classes","設計"],["homepage","募集"],["operation","運営"],["accounting","会計"]] as const).map(([id,label])=>
            <button key={id} type="button" aria-current={area===label?"page":undefined} disabled={busy||pageBusy} onClick={()=>{if(area!==label)go(id==="homepage"?"services":id);}}
              className={"min-h-11 rounded-lg px-1 py-2 text-base font-semibold transition-colors disabled:opacity-50 "+(area===label?"bg-emerald-800 text-white":"text-neutral-700 hover:bg-emerald-50")}>{label}</button>)}
        </nav>
        <h2 className="px-1 text-2xl font-bold">{area}</h2>
      </>}
      {school&&tab==="classes"&&<>
        <section className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 sm:p-5" aria-label="事業の構成図">
          <button type="button" className="min-h-11 text-left text-xl font-bold text-emerald-950" onClick={()=>pickDesign("business",business)}>■ {school.name}</button>
          {kinds.includes("course")&&<div className="space-y-3 border-t border-emerald-200 pt-3">
            <h3 className="text-lg font-bold text-emerald-950">{serviceLabels.course}</h3>
            {!products.length&&<p className="text-base text-neutral-600">{serviceLabels.course}はまだありません。</p>}
            {products.map(product=>{
              const listed=slots.filter(slot=>slot.product_id===product.id);
              return <div key={product.id} className="ml-2 space-y-1 border-l-2 border-emerald-200 pl-3">
                <button type="button" aria-pressed={!newCourse&&!newSlot&&!firstActive&&!eventDesign&&selected?.kind==="course"&&selected.id===product.id} onClick={()=>pickDesign("course",product.id)} className="min-h-11 text-left text-base font-bold text-emerald-950 hover:underline">□ {product.name} <span className="font-normal text-neutral-600">({listed.length}{serviceLabels.class})</span></button>
                <div className="grid gap-1 pl-3">
                  {listed.map(slot=><button type="button" key={slot.id} aria-pressed={!eventDesign&&selected?.kind==="class"&&selected.id===slot.id} onClick={()=>pickDesign("class",slot.id)} className="min-h-11 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-left text-base hover:border-emerald-700">× {slot.name} · {slot.starts_at.slice(0,5)}</button>)}
                  {!listed.length&&<p className="py-1 text-base text-neutral-600">開催枠は未登録です。</p>}
                </div>
              </div>;
            })}
            {slots.filter(slot=>!slot.product_id).length>0&&<div className="grid gap-1"><p className="text-base text-amber-900">未分類の開催枠（既存データ）</p>{slots.filter(slot=>!slot.product_id).map(slot=><button key={slot.id} className={button+" text-left"} onClick={()=>pickDesign("class",slot.id)}>{slot.name}</button>)}</div>}
          </div>}
          {([["workshop",serviceLabels.workshop,designWorkshops],["event",serviceLabels.event,designEvents]] as const).filter(([kind])=>kinds.includes(kind)).sort((a,b)=>kinds.indexOf(a[0])-kinds.indexOf(b[0])).map(([kind,title,items])=><div key={kind} className="space-y-2 border-t border-emerald-200 pt-3">
            <h3 className="text-lg font-bold text-emerald-950">{title}</h3>
            {designLoading?<p className="text-base text-neutral-600">読み込み中…</p>:designError?<p className="text-base text-red-800">{designError}</p>:!items.filter(item=>item.status!=="closed").length?<p className="text-base text-neutral-600">現在の{title}はありません。</p>:null}
            {items.filter(item=>item.status!=="closed").map(item=><button type="button" key={item.id} onClick={()=>{resetDesign();setEventDesign({kind,id:item.id});}} className="flex min-h-11 w-full flex-wrap items-center gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-left text-base">
              <span className="flex-1 font-medium">{item.title}{kind==="workshop"&&item.class_event.sessions?"（全"+item.class_event.sessions.length+"回）":""}</span><span className="text-neutral-600">{item.status==="draft"?"下書き":"公開中"}</span>
            </button>)}
            {items.some(item=>item.status==="closed")&&<details><summary className="min-h-11 cursor-pointer py-2 text-base">受付終了の{title}を見る</summary>{items.filter(item=>item.status==="closed").map(item=><button key={item.id} type="button" className={button+" mb-1 block w-full text-left"} onClick={()=>{resetDesign();setEventDesign({kind,id:item.id});}}>{item.title} · {classEventDate(item.class_event.startsAt)}</button>)}</details>}
          </div>)}
        </section>
        <div className="grid grid-cols-2 gap-2" aria-label="新しいサービスを作る">
          {model.kinds.includes("course")&&<><button type="button" className={button+" min-h-14 font-semibold text-emerald-900"} onClick={()=>{resetDesign();setNewCourse(true);}}>＋ {serviceLabels.course}を作る</button>
          <button type="button" className={button+" min-h-14 font-semibold text-emerald-900"} onClick={startClass}>＋ {serviceLabels.class}を追加する</button></>}
          {model.kinds.includes("workshop")&&<button type="button" className={button+" min-h-14 font-semibold text-emerald-900"} disabled={!canDesignEvents||designLoading} onClick={()=>{resetDesign();setEventDesign({kind:"workshop"});}}>＋ {serviceLabels.workshop}を作る</button>}
          {model.kinds.includes("event")&&<button type="button" className={button+" min-h-14 font-semibold text-emerald-900"} disabled={!canDesignEvents||designLoading} onClick={()=>{resetDesign();setEventDesign({kind:"event"});}}>＋ {serviceLabels.event}を作る</button>}
        </div>
        <button type="button" className={button} onClick={()=>{go("settings");setShowModel(true);}}>提供するサービスの種類を変更</button>
        {model.kinds.some(k=>k!=="course")&&!canDesignEvents&&!designLoading&&!designError&&<p className="text-base text-neutral-600">{serviceLabels.workshop}・{serviceLabels.event}の作成はCLASS Bで利用できます。</p>}
        {chooseCourse&&<section className={panel+" grid gap-2"}><h3 className="text-lg font-bold">どの{serviceLabels.course}に{serviceLabels.class}を追加しますか？</h3>{products.map(product=><button type="button" key={product.id} className={button+" text-left"} onClick={()=>addClassToCourse(product.id)}>{product.name} ›</button>)}<button type="button" className={button} onClick={()=>setChooseCourse(false)}>閉じる</button></section>}
        {newCourse&&<section className="grid gap-2"><ClassProductPanel labels={serviceLabels} key={business+":new-course"} classes={slots} allowProductSelection={false} onSaved={id=>{setNewCourse(false);setSelected({kind:"course",id});setNotice("コースを保存しました。次に開催クラスを追加できます。");refresh();}}/><button type="button" className={button} onClick={()=>setNewCourse(false)}>閉じる</button></section>}
        {preview&&eventDesign?.id&&flowTargets.find(t=>t.kind===eventDesign.kind&&t.id===eventDesign.id)&&<ClassServiceQualification key={eventDesign.id} schoolId={business} target={flowTargets.find(t=>t.kind===eventDesign.kind&&t.id===eventDesign.id)!} membership={model.membership}/>}
        {eventDesign&&<ClassEventsPanel key={business+":"+eventDesign.kind+":"+(eventDesign.id??"new")} labels={serviceLabels} kind={eventDesign.kind} classes={slots} roster={roster} mode="design" initialCreate={!eventDesign.id} initialEventId={eventDesign.id} onChanged={refresh} onBack={()=>setEventDesign(null)}/>}
      </>}
      {school&&area==="募集"&&<nav aria-label="募集" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {recruitTabs.map(([id,label])=><button key={id} type="button" aria-pressed={tab===id} onClick={()=>go(id)}
          className={tab===id?primary:button}>{label}</button>)}
      </nav>}
      {loading&&business&&<p role="status" className="text-sm">教室の情報を確認しています…</p>}

      {school&&tab==="classes"&&!newCourse&&!chooseCourse&&!eventDesign&&<section className={panel+" space-y-5"} aria-labelledby="selected-class-settings">
        <div className="space-y-2 border-b border-neutral-200 pb-4">
          <p className="text-xs font-semibold tracking-wide text-emerald-800">上の図で選択中：{chosenKind}</p>
          <h2 id="selected-class-settings" className="text-xl font-bold">{firstActive?"新しい"+serviceLabels.class+"を作成":newSlot?serviceLabels.class+"の開催日時を設定":
            selected?.kind==="course"?"□ "+chosenLabel+" の設定":selected?.kind==="class"?"× "+chosenLabel+" の設定":"■ "+chosenLabel+" の事業設定"}</h2>
          <p className="text-sm text-neutral-600">{firstActive?"質問に答えるとコースと定期開催クラスを作成します。":
            newSlot?"選んだコースに、日時と場所のあるクラスを追加します。":
            selected?.kind==="course"?"コース共通の内容・料金・定員などを変更します。日時と場所は各クラスを選ぶと変更できます。":
            selected?.kind==="class"?"このクラスの日時・場所・開催ルールを変更します。共通の料金と定員はコースの設定で管理します。":
            "ここは事業全体の設定です。コースの料金を変更する場合は上の「□ コース」、日時を変更する場合は「× クラス」を押してください。"}</p>
        </div>
        {firstActive?<>
          <div className="flex justify-between gap-2 text-xs font-semibold text-emerald-800">
            <span>質問 {firstStep+1} / {firstQuestions.length}</span><span>最初の1クラス</span>
          </div>
          <div className="h-1.5 rounded-full bg-neutral-100"><div className="h-full rounded-full bg-emerald-700"
            style={{width:(firstStep+1)/firstQuestions.length*100+"%"}}/></div>
          <h3 className="font-bold">{firstQuestions[firstStep][1]}</h3>
          {firstStep===0&&<label className="grid gap-1 text-sm">{serviceLabels.class}の名前
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
            <label className="grid gap-1 text-sm sm:col-span-2">費用の決め方
              <select className={field} value={first.feeMode} onChange={e=>patchFirst("feeMode",e.target.value as FirstDraft["feeMode"])}>
                <option value="monthly">月謝制</option><option value="per_visit">1回払い（予約不要の当日参加）</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">{first.feeMode==="monthly"?"月謝（円）":"1回の参加費（円）"}
              <input className={field} inputMode="numeric" type="number" min={0} max={1000000}
                value={first.fee} onChange={e=>patchFirst("fee",e.target.value)}/></label>
            {first.feeMode==="monthly"&&<label className="grid gap-1 text-sm">月の受講回数
              <input className={field} type="number" min={1} max={100} value={first.monthlyVisits}
                onChange={e=>patchFirst("monthlyVisits",e.target.value)}/></label>}
            <p className="text-xs text-neutral-600 sm:col-span-2">どちらも定期開催するクラスです。1回払いは予約不要の当日参加として設定されます。</p>
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
            <p><strong>費用：</strong>{first.feeMode==="monthly"?"月 "+first.monthlyVisits+"回・月謝 ":"1回払い・参加費 "}{money(Number(first.fee))}</p>
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
        </>:newSlot&&activeProduct&&newSlot.productId===activeProduct.id?<>
          <h3 className="font-bold">□ {activeProduct.name}に開催クラスを追加</h3>
          <p className="text-sm text-neutral-600">曜日・時刻・場所を設定して保存します。費用・定員はこのコースの設定を引き継ぎます。</p>
          <ClassSlotSettingsPanel key={newSlot.id} startId={newSlot.id} productId={newSlot.productId}
            additionalSlots={[]} slotDefaults={activeProduct.design.slotDefaults}
            basicFee={activeProduct.design.walkInFee??activeProduct.design.monthlyFee}
            walkIn={activeProduct.design.walkInFee!=null} busy={busy}
            save={async rows=>{
              const saved=await saveSlotRows(rows);
              if(saved){setSelected({kind:"class",id:newSlot.id});setNewSlot(null);}
              return saved;
            }}/>
          <button className={button} type="button" onClick={()=>setNewSlot(null)}>追加をやめる</button>
        </>:activeProduct&&selected?.kind==="course"?<>
          <h3 className="font-bold">□ {activeProduct.name} ／ コースの内容・月謝・定員</h3>
          {preview&&flowTargets.find(t=>t.kind==="course"&&t.id===activeProduct.id)&&<ClassServiceQualification key={activeProduct.id} schoolId={business} target={flowTargets.find(t=>t.kind==="course"&&t.id===activeProduct.id)!} membership={model.membership}/>}
          <ClassProductPanel labels={serviceLabels} key={selected.id+":"+editorKey} classes={slots} initialProduct={activeProduct.id}
            allowProductSelection={false} onSaved={()=>{setNotice("コースを保存しました。");refresh();}}/>
          <div className="border-t pt-4"><button className={button} onClick={()=>{
            setNewSlot({id:crypto.randomUUID(),productId:activeProduct.id});setEditorKey(k=>k+1);
          }}>＋ この{serviceLabels.course}に{serviceLabels.class}を追加</button></div>
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
          <button type="button" className={button} onClick={()=>go("settings")}>事業設定を開く</button>
          <div className="border-t pt-4">
            <h3 className="font-semibold">この事業の構成</h3>
            <p className="mt-1 text-xs text-neutral-600">コースやクラスの詳しい設定は、上の図から選ぶとこの場所に表示されます。</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-neutral-50 p-3 text-sm"><strong>{products.length}</strong> {serviceLabels.course}</div>
              <div className="rounded-xl bg-neutral-50 p-3 text-sm"><strong>{slots.length}</strong> {serviceLabels.class}</div>
              <div className="rounded-xl bg-neutral-50 p-3 text-sm"><strong>{roster.filter(p=>p.status==="active").length}</strong> 在籍者</div>
            </div>
          </div>
        </>}
      </section>}

      {school&&tab==="services"&&<section className={panel+" grid gap-3"}>
        {preview&&!legacyRecruit?<><ClassRecruitmentFlowWorkspace key={business} schoolId={business} targets={flowTargets} membership={model.membership} onOpenLegacy={openLegacyFlow} onOpenDesign={openFlowDesign}/>{designLoading&&<p>サービスを読み込んでいます…</p>}{designError&&<p role="alert">{designError}</p>}</>:<>
        <h2 className="text-xl font-bold">個別サービスの申込導線</h2>
        <p className="text-base text-neutral-600">サービスを選んで、そのサービスの募集・申込を設定します。事業への入会とは別の入口です。</p>
        {recruitService?<><button type="button" className={button} onClick={()=>{setRecruitService(null);setLegacyRecruit(false);}}>← 募集の構成図に戻る</button>

          {recruitService.kind==="course"&&currentCourse?<ClassCourseRecruitmentPanel key={currentCourse.id} product={currentCourse} classes={slots} recruitment={recruitment} onSaved={refresh} preview={preview}/>:recruitService.kind!=="course"?<ClassEventsPanel key={recruitService.id} classes={slots} roster={roster} labels={serviceLabels} kind={recruitService.kind} mode="recruit" initialEventId={recruitService.id} onBack={()=>{setRecruitService(null);setLegacyRecruit(false);}} onChanged={refresh}/>:<p>サービスが見つかりません。</p>}
        </>:<>
          {designLoading&&<p>サービスを読み込んでいます…</p>}
          {designError&&<p role="alert" className="text-red-800">{designError}</p>}
          {kinds.map(kind=><div key={kind} className="grid gap-2 border-t pt-3">
            <h3 className="text-lg font-bold">{serviceLabels[kind]}{model.primary===kind&&<span className="ml-2 text-sm font-normal text-neutral-600">事業の中心</span>}</h3>
            {services.filter(s=>s.kind===kind).map(s=><button key={s.kind+":"+s.id} type="button" className={button+" flex min-h-14 items-center gap-3 text-left"} onClick={()=>setRecruitService({kind:s.kind,id:s.id})}><span className="flex-1 font-semibold">{s.title}</span><span className="text-sm text-neutral-600">{s.detail}</span><span>›</span></button>)}
            {!services.some(s=>s.kind===kind)&&<p className="text-base text-neutral-600">まだ登録されていません。</p>}
          </div>)}
          <button type="button" className={button} onClick={()=>go("classes")}>サービスを設計する</button>
        </>}
        </>}
      </section>}
      {school&&tab==="admission"&&<section className={panel+" space-y-5"}>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">{model.membership?"事業の入会・共通設定":"継続サービスの既存共通設定"}</h2>
          <p className="rounded-lg bg-amber-50 p-3 text-base">現行の入会エンジンは継続サービスの契約と連動しています。独立した事業会員制度への移行は未実装です。各サービスの設定は「個別サービスの申込」から開いてください。</p>
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
        <h2 className="text-xl font-bold">事業の募集ページ</h2>
        <div className="grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h3 className="font-bold">事業に合わせた掲載構成案</h3><p className="text-base">事業紹介</p>{kinds.map(kind=><p key={kind} className="text-base">{serviceLabels[kind]}の紹介・申込{model.primary===kind?"（最優先）":""}</p>)}{model.membership&&<p className="text-base">入会案内（事業への入会制度）</p>}<p className="text-sm text-neutral-600">構成案です。既存の公開ページを自動変更しません。</p><button className={button} onClick={()=>{go("settings");setShowModel(true);}}>事業の形態を見直す</button></div>
        <p className="text-sm">公開URL：<Link className="underline" href={"/class-business/"+business} target="_blank">/class-business/{business}</Link></p>
        <div className="grid gap-2 rounded-xl bg-neutral-50 p-4 text-sm">
          <p>PARARIで編集する部分：ご挨拶・写真・教室紹介</p>
          <p>CLASSが管理する部分：提供サービス・料金・日時・申込ボタン</p>
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
        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer font-bold">募集ページの掲載・公開設定</summary>
          <div className="mt-3"><ClassBusinessFrontPanel key={business+":front"} schoolId={business} name={school.name}
            products={products} onOpenRecruitment={()=>setTab("admission")} onOpenSchedule={()=>setTab("classes")} onSaved={refresh}/></div>
        </details>
        {kinds.includes("course")&&<details className="rounded-xl border p-3">
          <summary className="cursor-pointer font-bold">継続サービスの既存共通受付</summary>
          <div className="mt-3"><ClassRecruitmentPanel key={business+":publish"} view="settings" publicationOnly classes={slots}
            products={audienceProducts} onOpenSettings={()=>setTab("admission")} onSaved={refresh}/></div>
        </details>}
      </section>}

      {school&&tab==="settings"&&<>
        {showModel?<ClassBusinessModelSettings key={business} model={model} labels={serviceLabels} onApply={next=>void applyModel(next)} preview={preview} busy={busy}/>:<section className={panel+" grid gap-3"}><h2 className="text-xl font-bold">事業の形態</h2><p className="text-base">中心：{serviceLabels[model.primary]} ／ {model.membership?"入会制度あり":"入会制度なし"}</p><p className="text-base">提供サービス：{model.kinds.map(k=>serviceLabels[k]).join("・")}</p><button type="button" className={button} onClick={()=>setShowModel(true)}>事業の形態を設定する</button></section>}
        <section className={panel+" space-y-4"}><h2 className="text-xl font-bold">事業の基本設定</h2>
          <form onSubmit={e=>void renameBusiness(e)} className="grid max-w-lg gap-3">
            <label className="grid gap-1 text-sm font-medium">事業名
              <input className={field} required maxLength={120} value={editingBusinessName} onChange={e=>setEditingBusinessName(e.target.value)}/>
            </label>
            <button className={primary+" w-fit"} disabled={busy||!editingBusinessName.trim()||editingBusinessName.trim()===school.name}>事業名を保存</button>
          </form>
          <details className="rounded-xl border p-3">
            <summary className="cursor-pointer font-semibold">先生・生徒・手続きの呼び方</summary>
            <div className="mt-3"><ClassAdmissionsPanel mode="labels" /></div>
          </details>

        </section>
        {labelsLoaded?<ClassServiceLabelSettings key={business} labels={serviceLabels} onSaved={setServiceLabels}/>:<p className="text-base text-neutral-600">サービスの呼び方を読み込めません。再読み込みしてください。</p>}
        <ClassBCheckoutPanel key={business} initialSchoolId={business} fixedSchool/>
        <section className={panel+" space-y-3"}><h2 className="text-xl font-bold">決済サービス</h2>
          <p className="text-base text-neutral-600">CLASS Bの利用契約と、受講者から受け取る月謝・参加費は別の設定です。</p>
          <Link href="/my/sales" className={button+" inline-flex items-center"}>販売・決済の設定を開く</Link>
        </section>
      </>}
      {school&&tab==="accounting"&&<section className={panel+" space-y-5"}>
        <h2 className="text-xl font-bold">料金・入金・売上</h2>
        {kinds.includes("course")&&<><section className="space-y-2 rounded-xl border p-4">
          <h3 className="text-lg font-bold">月謝・受講費の設定</h3>
          {products.map(product=><div key={product.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-3">
            <div><p className="font-semibold">{product.name}</p><p className="text-base text-neutral-700">{product.design.walkInFee!=null?"1回 "+money(product.design.walkInFee):"月額 "+money(product.design.monthlyFee)}</p></div>
            <button className={button} onClick={()=>{go("classes");pickDesign("course",product.id);}}>料金設定</button>
          </div>)}
          {!products.length&&<p>{serviceLabels.course}がまだありません。</p>}
          <p className="text-base text-neutral-600">月次の請求・回収・売上集計は準備中です。設定された料金は実際の入金額とは異なります。</p>
        </section>
        <section className="space-y-3 rounded-xl border p-4">
          <h3 className="text-lg font-bold">差額の入金確認</h3>
          {management?.surcharges?.map(charge=><div className="flex flex-wrap items-center justify-between gap-3 border-t py-3" key={charge.enrollment_id+charge.class_id+charge.visit_on}>
            <div><p>{roster.find(member=>member.id===charge.enrollment_id)?.name??"受講者"} · {charge.visit_on}</p><p>{slots.find(slot=>slot.id===charge.class_id)?.name??"開催枠"} · {money(charge.surcharge_yen)}</p></div>
            <button type="button" className={primary} disabled={busy} onClick={()=>void confirmSurcharge(charge.enrollment_id,charge.class_id,charge.visit_on)}>入金を確認</button>
          </div>)}
          {!management?.surcharges?.length&&<p className="text-base text-neutral-600">入金待ちの差額はありません。</p>}
          <h3 className="border-t pt-3 text-lg font-bold">最近の差額入金記録</h3>
          {management?.receipts?.map(receipt=><p key={receipt.id}>{roster.find(member=>member.id===receipt.enrollment_id)?.name??"受講者"} · {receipt.visit_on} · {money(receipt.amount_yen)}</p>)}
          {!management?.receipts?.length&&<p className="text-base text-neutral-600">入金記録はありません。</p>}
        </section>
        </>}
        {kinds.some(k=>k!=="course")&&<section className="grid gap-2 rounded-xl border p-4"><h3 className="text-lg font-bold">講習会・イベントの参加費</h3>{services.filter(s=>s.kind!=="course").map(s=>{const e=(s.kind==="workshop"?designWorkshops:designEvents).find(e=>e.id===s.id);return <p key={s.id}>{s.title}：{e?.payment_method==="none"?"無料":money(e?.payment_amount)}（設定額）</p>})}<p className="text-sm text-neutral-600">参加者ごとの入金状況は運営の受付画面で確認します。売上集計ではありません。</p></section>}
        <Link href="/my/sales" className={button+" inline-flex items-center"}>販売・売上管理を開く</Link>
      </section>}
      {school&&(tab==="events"||tab==="workshops")&&<ClassEventsPanel key={business+":"+tab} classes={slots} roster={roster} labels={serviceLabels} kind={tab==="events"?"event":"workshop"} mode="recruit"/>}
      {school&&tab==="improve"&&details&&<ClassSalesPanel schoolId={business}
        answers={details.draft.sales_answers??[]} revision={details.draft.revision} onSaved={refresh}/>}
      {school&&tab==="operation"&&<section className={panel+" space-y-5"}>
        <h2 className="text-xl font-bold">日々の運営</h2>
        <div className="flex flex-wrap gap-2">
          {([
            ["roster","継続サービスの名簿"],["admissions","既存の入会対応"],["attendance","欠席連絡"],["calendar","開催予定"],
            ["events",serviceLabels.event+"・受付"],["workshops",serviceLabels.workshop+"・受付"],
          ] as const).filter(([id])=>id==="events"?kinds.includes("event"):id==="workshops"?kinds.includes("workshop"):id==="admissions"?model.membership||kinds.includes("course"):kinds.includes("course")).map(([id,label])=><button type="button" key={id} onClick={()=>setOperationFocus(id)}
            aria-pressed={operationFocus===id} className={operationFocus===id?primary:button}>{label}</button>)}
        </div>
        {operationFocus==="admissions"&&<ClassAdmissionsPanel key={business+":ops-admission"} mode="admissions" onRosterChanged={refresh}/>}
        {operationFocus==="attendance"&&<ClassAbsencesPanel schoolId={business} classes={slots}/>}
        {operationFocus==="calendar"&&<ClassCalendarPanel classes={slots} onSaved={refresh}/>}
        {operationFocus==="roster"&&<div className="space-y-2">
          <p className="text-sm text-neutral-600">在籍中の受講者を確認できます。退会や請求停止は、保護者・先生の確認手続きと連動する必要があるため、ここで在籍状況を直接変更しません。</p>
          {roster.map(member=><div key={member.id} className="rounded-xl border p-3">
            <p className="font-semibold">{member.name} <span className="text-sm font-normal text-neutral-600">· {member.status==="active"?"在籍中":"終了"}</span></p>
            <p className="mt-1 text-xs text-neutral-600">登録{serviceLabels.class}：{(member.assignments??[]).map(a=>slots.find(s=>s.id===a.class_id)?.name).filter(Boolean).join("、")||"未登録"}</p>
          </div>)}
          {!roster.length&&<p className="text-sm">登録された受講者はまだいません。</p>}
        </div>}
        {operationFocus==="events"&&<ClassEventsPanel classes={slots} roster={roster} labels={serviceLabels} kind="event" mode="operation"/>}
        {operationFocus==="workshops"&&<ClassEventsPanel classes={slots} roster={roster} labels={serviceLabels} kind="workshop" mode="operation"/>}
      </section>}
      <footer className="pb-5 text-xs text-neutral-500">
        CLASSの設定・名簿・受付は既存の正本に保存されます。募集ページの文章はPARARI PAGEです。
        未完成の受付や未公開のPAGEは自動公開しません。
      </footer>
    </div>
  </main>;
}
