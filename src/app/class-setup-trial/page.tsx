"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Audience = "adults" | "minors" | "mixed";
type Briefing = "none" | "briefing" | "trial" | "both";
type BriefingSetup = { briefing: Briefing; briefingLabel: string; briefingFields: string[] };
type MailKey = "booking" | "approval" | "completed" | "withdrawal";
type MailSettings = { custom: boolean; subject: string; body: string };
type Draft = {
  categoryBusiness: string; categoryService: string; categorySlot: string;
  teacherLabel: string; learnerLabel: string; guardianLabel: string;
  audience: Audience; gradeExpiry: boolean; expiryApproval: boolean;
  businessName: string;
  serviceName: string;
  slotName: string;
  briefing: Briefing;
  briefingLabel: string; briefingFields: string[];
  approvalMode: "automatic" | "teacher";
  approvalLink: "standard" | "custom";
  approvalLinkText: string;
  admissionFields: string[];
  withdrawal: "teacher" | "guardian_teacher" | "notice_teacher";
  messages: Record<MailKey, MailSettings>;
};
type StepId = "hierarchy" | "roles" | "minor" | "grade" | "business" | "service" | "slot" |
  "briefing" | "briefingName" | "briefingFields" | "bookingMail" | "approval" | "approvalMail" |
  "approvalLink" | "admissionFields" | "completedMail" | "home" | "withdrawal" | "withdrawalMail" | "review";

const defaults: Draft = {
  categoryBusiness: "事業", categoryService: "コース", categorySlot: "クラス",
  teacherLabel: "先生", learnerLabel: "生徒", guardianLabel: "保護者",
  audience: "adults", gradeExpiry: false, expiryApproval: true,
  businessName: "カルチャースクール",
  serviceName: "初心者向け講座",
  slotName: "土曜クラス",
  briefing: "briefing", briefingLabel: "説明会",
  briefingFields: ["name", "email", "phone"], approvalMode: "teacher",
  approvalLink: "standard", approvalLinkText: "入会を許可しました。参加クラスを選択してください。",
  admissionFields: ["name", "email", "consent"],
  withdrawal: "notice_teacher",
  messages: {
    booking: { custom: false, subject: "{教室名}：{説明会名}の予約受付", body: "{お名前}様\n{日時}のご予約を受け付けました。会場：{会場}。" },
    approval: { custom: false, subject: "{教室名}：入会のご案内", body: "{お名前}様\n入会が許可されました。以下の案内からクラスをお選びください。\n{入会URL}" },
    completed: { custom: false, subject: "{教室名}：入会手続き完了", body: "{お名前}様\nお申し込みありがとうございます。参加クラス：{クラス名}。\n{HOME_URL}" },
    withdrawal: { custom: false, subject: "{教室名}：退会届を受け付けました", body: "{お名前}様\n退会届を受け付けました。最終受講予定日：{最終受講日}。先生の確認後に確定します。" },
  },
};
const fields = [
  { id: "name", label: "氏名" }, { id: "email", label: "メールアドレス" },
  { id: "phone", label: "電話番号" }, { id: "school", label: "学校名・所属" },
  { id: "guardian", label: "保護者情報" }, { id: "address", label: "住所" },
  { id: "consent", label: "規約・個人情報への同意" },
];
const card = "rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7";
const field = "mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm";
const label = "text-sm font-semibold text-neutral-700";
const primary = "rounded-full bg-emerald-800 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40";
const secondary = "rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700";
const stepTitles: Record<StepId,string> = {
  hierarchy:"分類の呼び方", roles:"呼び方", minor:"参加者の年齢", grade:"学年と卒業予定",
  business:"事業の選択", service:"コースの選択", slot:"クラスの選択",
  briefing:"説明会・体験の必要性", briefingName:"説明会・体験の名称", briefingFields:"説明会・体験の申込項目",
  bookingMail:"予約受付メール", approval:"入会許可の方法", approvalMail:"入会許可メール",
  approvalLink:"許可メールから申込フォームへ", admissionFields:"入会申込フォームの項目",
  completedMail:"入会完了メール", home:"生徒HOME", withdrawal:"退会届の扱い", withdrawalMail:"退会届受付メール", review:"設計内容の確認",
};
const sections: {name:string; ids:StepId[]}[] = [
  {name:"基本ルール",ids:["minor","hierarchy","roles","grade"]},
  {name:"事業とコース",ids:["business","service","slot"]},
  {name:"説明会・入会",ids:["briefing","briefingName","briefingFields","bookingMail","approval","approvalMail","approvalLink","admissionFields","completedMail"]},
  {name:"入会後",ids:["home","withdrawal","withdrawalMail"]},
  {name:"確認",ids:["review"]},
];
function Radio({options,value,onChange}:{options:{value:string;label:string;note?:string}[];value:string;onChange:(value:string)=>void}) {
  return <div className="space-y-2">{options.map(option=><label key={option.value} className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${value===option.value?"border-emerald-700 bg-emerald-50":"border-neutral-200"}`}>
    <input type="radio" className="mt-1" checked={value===option.value} onChange={()=>onChange(option.value)}/>
    <span><strong>{option.label}</strong>{option.note?<span className="mt-1 block text-xs leading-5 text-neutral-600">{option.note}</span>:null}</span>
  </label>)}</div>;
}
function MailEditor({draft,setDraft,kind}:{draft:Draft;setDraft:(next:Draft)=>void;kind:MailKey}) {
  const setting=draft.messages[kind];
  const examples:Record<string,string>={
    "{教室名}":draft.businessName||"サンプル教室",
    "{説明会名}":draft.briefingLabel||"説明会",
    "{お名前}":"申込者A",
    "{日時}":"12月5日（土）10:00",
    "{会場}":"教室",
    "{入会URL}":"（入会申込フォームへの専用リンク）",
    "{クラス名}":draft.slotName||"土曜クラス",
    "{HOME_URL}":"（生徒HOMEへのリンク）",
    "{最終受講日}":"2027年3月31日",
  };
  const preview=(value:string)=>Object.entries(examples).reduce((result,[key,example])=>result.split(key).join(example),value);
  const change=(next:Partial<MailSettings>)=>setDraft({...draft,messages:{...draft.messages,[kind]:{...setting,...next}}});
  return <div className="space-y-3">
    <Radio options={[{value:"default",label:"既成の文面を使う",note:"後から変更できます"},{value:"custom",label:"自分で文章を編集する"}]}
      value={setting.custom?"custom":"default"} onChange={v=>change({custom:v==="custom"})}/>
    <div className="rounded-xl bg-neutral-50 p-4">
      <p className="mb-2 text-xs font-semibold text-neutral-600">メールのプレビュー（実際には送信しません）</p>
      <p className="mb-3 text-xs text-neutral-500">送信イメージです。{draft.audience==="adults"?"成人向けです。":draft.audience==="mixed"?"未成年者の申込だけ保護者へ連絡します。":"未成年者向けのため保護者の確認を伴います。"}</p>
      {setting.custom?<div className="space-y-3">
        <label className={label}>件名<input className={field} value={setting.subject} onChange={e=>change({subject:e.target.value})}/></label>
        <label className={label}>本文<textarea className={field} rows={5} value={setting.body} onChange={e=>change({body:e.target.value})}/></label>
      </div>:<><p className="text-sm font-bold">{preview(setting.subject)}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{preview(setting.body)}</p></>}
    </div>
  </div>;
}
export default function ClassSetupWizardPreview(){
  const [draft,setDraft]=useState<Draft>(defaults);
  const [cursor,setCursor]=useState(0);
  const [finished,setFinished]=useState(false);
  // Trial-only local catalog; the production business/roster database is not accessed.
  const [businesses,setBusinesses]=useState<string[]>([]);
  const [coursesByBusiness,setCoursesByBusiness]=useState<Record<string,string[]>>({});
  const [slotsByCourse,setSlotsByCourse]=useState<Record<string,string[]>>({});
  const [briefingByCourse,setBriefingByCourse]=useState<Record<string,BriefingSetup>>({});
  const [newEntry,setNewEntry]=useState(false);
  const [catalogMessage,setCatalogMessage]=useState("");
  const minorsIncluded=draft.audience!=="adults";
  const minorOnly=draft.audience==="minors";
  const courseKey=(business:string,course:string)=>JSON.stringify([business,course]);
  const courses=coursesByBusiness[draft.businessName]??[];
  const slots=slotsByCourse[courseKey(draft.businessName,draft.serviceName)]??[];
  const courseBriefing=briefingByCourse[courseKey(draft.businessName,draft.serviceName)]??{
    briefing:"briefing" as Briefing,briefingLabel:"説明会",briefingFields:["name","email","phone"]};
  function chooseBusiness(name:string){
    const nextCourse=(coursesByBusiness[name]??[])[0]??"";
    setDraft(previous=>({...previous,businessName:name,serviceName:nextCourse,
      slotName:(slotsByCourse[courseKey(name,nextCourse)]??[])[0]??""}));
    setNewEntry(false);setCatalogMessage("");
  }
  function chooseCourse(name:string){
    const key=courseKey(draft.businessName,name);
    const setup=briefingByCourse[key]??{briefing:"briefing" as Briefing,briefingLabel:"説明会",briefingFields:["name","email","phone"]};
    setDraft(previous=>({...previous,serviceName:name,slotName:(slotsByCourse[key]??[])[0]??"",...setup}));
    setNewEntry(false);setCatalogMessage("");
  }
  function addCatalog(level:"business"|"service"|"slot",value:string){
    const name=value.trim();
    if(!name){setCatalogMessage("名前を入力してください。");return;}
    const collection=level==="business"?businesses:level==="service"?courses:slots;
    if(collection.includes(name)){setCatalogMessage("同じ名前が既に登録されています。");return;}
    if(level==="business"){
      setBusinesses(current=>[...current,name]);
      setDraft(previous=>({...previous,businessName:name,serviceName:"",slotName:""}));
    }else if(level==="service"){
      setCoursesByBusiness(current=>({...current,[draft.businessName]:[...courses,name]}));
      const key=courseKey(draft.businessName,name);
      setBriefingByCourse(current=>({...current,[key]:{briefing:"briefing",briefingLabel:"説明会",briefingFields:["name","email","phone"]}}));
      setDraft(previous=>({...previous,serviceName:name,slotName:"",briefing:"briefing",briefingLabel:"説明会",briefingFields:["name","email","phone"]}));
    }else{
      const key=courseKey(draft.businessName,draft.serviceName);
      setSlotsByCourse(current=>({...current,[key]:[...slots,name]}));
      setDraft(previous=>({...previous,slotName:name}));
    }
    setNewEntry(false);setCatalogMessage("追加しました。続けて追加することもできます。");
  }
  const steps=useMemo(()=>{
    const ids:StepId[]=["minor","hierarchy","roles"];
    if(minorOnly)ids.push("grade");
    ids.push("business","service","slot","briefing");
    if(draft.briefing!=="none")ids.push("briefingName","briefingFields","bookingMail");
    // Direct enrollment needs no separate approval question.
    if(draft.briefing!=="none") {
      ids.push("approval");
      if(draft.approvalMode==="teacher")ids.push("approvalMail","approvalLink");
    }
    ids.push("admissionFields","completedMail","home","withdrawal","withdrawalMail","review");
    return ids;
  },[minorOnly,draft.briefing,draft.approvalMode]);
  const step=steps[Math.min(cursor,steps.length-1)];
  const isAdultOnly=draft.audience==="adults";
  const category=sections.find(section=>section.ids.includes(step))?.name??"確認";
  const update=(patch:Partial<Draft>)=>{
    setDraft(previous=>({...previous,...patch}));
    if("briefing" in patch||"briefingLabel" in patch||"briefingFields" in patch){
      const key=courseKey(draft.businessName,draft.serviceName);
      setBriefingByCourse(current=>({...current,[key]:{...courseBriefing,...patch} as BriefingSetup}));
    }
  };
  const toggle=(key:"briefingFields"|"admissionFields",id:string)=>{
    const current=draft[key];
    const next=current.includes(id)?current.filter(item=>item!==id):[...current,id];
    update({[key]:next} as Partial<Draft>);
  };
  const required=step==="business"?businesses.includes(draft.businessName):
    step==="service"?courses.includes(draft.serviceName):
    step==="slot"?slots.includes(draft.slotName):true;
  const advance=()=>{if(cursor>=steps.length-1){setFinished(true);return;}setCatalogMessage("");setNewEntry(false);setCursor(value=>Math.min(value+1,steps.length-1));};
  const editCurrent=(id:StepId)=>{const index=steps.indexOf(id);if(index>=0){setCursor(index);setFinished(false);}};
  return <main className="min-h-screen bg-neutral-100 py-8 text-neutral-950">
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm text-neutral-600 underline underline-offset-4">← PARARIへ戻る</Link>
        <span className="rounded-full border border-red-400 bg-red-50 px-3 py-1 text-xs font-bold text-red-800">試用版・保存されません</span>
      </div>
      <section role="alert" aria-label="試用版についての重要なお知らせ"
        className="mt-6 rounded-xl border-2 border-red-500 bg-red-50 p-4 text-red-900">
        <p className="text-base font-extrabold">【重要】この画面は試用版です。設定内容は保存されません。</p>
        <p className="mt-2 text-sm leading-7">
          実際の教室・生徒・予約・料金には反映されません。メールも送信されません。
          画面を閉じたり更新したりすると、入力した内容は失われます。実在する生徒の氏名や連絡先などの個人情報は入力しないでください。
        </p>
      </section>
      <header className="mt-8">
        <p className="text-xs font-bold tracking-widest text-emerald-800">PARARI CLASS · 先生の設計ガイド</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">一つずつ答えて、クラスを設計する</h1>
        <p className="mt-3 text-sm leading-7 text-neutral-600">最初に基本ルールを決めます。以降は必要な項目だけを表示し、メール文面も既成のものから始められます。</p>
      </header>
      <div className="mt-7 flex flex-wrap gap-2" aria-label="設計の進行状況">
        {sections.map(section=>{
          const members=steps.filter(id=>section.ids.includes(id));if(!members.length)return null;
          return <span key={section.name} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${category===section.name?"bg-emerald-800 text-white":"bg-white text-neutral-600"}`}>{section.name}</span>;
        })}
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-neutral-200"><div className="h-full rounded-full bg-emerald-700 transition-all" style={{width:`${(cursor+1)/steps.length*100}%`}}/></div>
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span>{category}</span><span>{cursor+1} / {steps.length} 項目</span>
      </div>
      <section className={`mt-5 ${card}`}>
        <h2 className="text-xl font-bold">{finished?"設計ガイドの確認が完了しました":stepTitles[step]}</h2>
        <p className="mt-2 text-sm text-neutral-600">{finished?"この画面の内容は保存されていません。DB接続時には既存の事業・クラス設定と連動させます。":"この項目を設定してから「次へ」を押してください。"}</p>
        <div className="mt-6 space-y-4">
        {step==="hierarchy"&&<div className="space-y-3">
          <p className="text-sm leading-7">先生には「事業 → コース → クラス」と表示します。内部ではコースを「サービス」、クラスを「時間枠」と呼びますが、設定中に覚える必要はありません。</p>
      <p className="text-xs text-neutral-600">教室によって名称を変えたい場合は、下の呼び方だけ変更できます。</p>
          <div className="rounded-xl bg-emerald-50 p-4 text-sm leading-7">
            {minorsIncluded?<>
              <p className="font-bold">未成年向けの学習教室なら、こんな関係です。</p>
              <p className="mt-2">① 事業：学習教室（教室全体）</p>
              <p>　↓ どんな内容を学ぶか</p>
              <p>② コース：小学生コース（受講料・月の回数などを設定）</p>
              <p>　↓ いつ通うか</p>
              <p>③ クラス：水曜クラス／土曜クラス（曜日・時間・定員などを設定）</p>
              <p className="mt-2 text-xs text-emerald-900">同じコースに曜日の異なるクラスがある場合、それぞれの定員や時間を管理できます。</p>
            </>:<>
              <p className="font-bold">成人向けのカルチャースクールなら、こんな関係です。</p>
              <p className="mt-2">① 事業：カルチャースクール（運営する講座全体）</p>
              <p>　↓ 何を学ぶ講座か</p>
              <p>② コース：初心者向け講座（受講料・月の回数などを設定）</p>
              <p>　↓ いつ参加するか</p>
              <p>③ クラス：平日夜クラス／土曜クラス（曜日・時間・定員などを設定）</p>
              <p className="mt-2 text-xs text-emerald-900">同じ講座を異なる曜日・時間帯に開く場合、それぞれを別クラスとして管理できます。</p>
            </>}
          </div>
          {([["categoryBusiness","① 事業"],["categoryService","② コース"],["categorySlot","③ クラス"]] as const).map(([id,title])=><label className={label} key={id}>{title}<input className={field} maxLength={20} value={draft[id]} onChange={e=>update({[id]:e.target.value} as Partial<Draft>)}/></label>)}
        </div>}
        {step==="roles"&&<div className="space-y-3">
          <p className="text-sm">申込画面・HOME・メールで使う呼び方です。</p>
          {([["teacherLabel","先生"],["learnerLabel","生徒"],...(minorsIncluded?[["guardianLabel","保護者"] as const]:[])] as const).map(([id,title])=><label className={label} key={id}>{title}の呼び方<input className={field} maxLength={20} value={draft[id]} onChange={e=>update({[id]:e.target.value} as Partial<Draft>)}/></label>)}
          {isAdultOnly&&<p className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">成人のみの教室なので、保護者の呼び方は設定する必要がありません。</p>}
        </div>}
        {step==="minor"&&<div className="space-y-3">
          <p className="text-sm leading-7">まず受講する人の年齢を確認します。この回答によって、後に表示するフォームやメールの設定項目が変わります。</p>
          <Radio value={draft.audience} onChange={v=>{
            const audience=v as Audience;
            const includesMinors=audience!=="adults";
            const neutralNames=["カルチャースクール","初心者向け講座","土曜クラス","学習教室","小学生コース","水曜クラス"];
            update({
              audience,gradeExpiry:audience==="minors"?draft.gradeExpiry:false,
              withdrawal:includesMinors?"guardian_teacher":"notice_teacher",
              admissionFields:includesMinors?[...new Set([...draft.admissionFields,"guardian"])]:draft.admissionFields.filter(id=>id!=="guardian"),
              briefingFields:draft.briefingFields.filter(id=>includesMinors||id!=="guardian"),
              ...(businesses.length===0&&neutralNames.includes(draft.businessName)?{businessName:includesMinors?"学習教室":"カルチャースクール"}:{}),
              ...(courses.length===0&&neutralNames.includes(draft.serviceName)?{serviceName:includesMinors?"小学生コース":"初心者向け講座"}:{}),
              ...(slots.length===0&&neutralNames.includes(draft.slotName)?{slotName:includesMinors?"水曜クラス":"土曜クラス"}:{}),
            });
          }} options={[
            {value:"adults",label:"成人のみ",note:"保護者欄を表示しません。学年による受講終了予定も設定しません。"},
            {value:"minors",label:"未成年のみ",note:"保護者情報を必須にできます。必要なら学年から卒業予定日を提案します。"},
            {value:"mixed",label:"成人と未成年の両方",note:"申込者が未成年の場合だけ保護者情報が必要です。学年による自動終了提案は使いません。"},
          ]}/>
        </div>}
        {step==="grade"&&<div className="space-y-3">
          <p className="text-sm leading-7">未成年だけを対象にする教室では、学年から受講終了の予定日を提案できます。例えば高校3年生なら、3月末で終了する可能性があります。</p>
          <div className="rounded-xl bg-emerald-50 p-4 text-sm leading-7">
            <p className="font-semibold">高校3年生の例</p>
            <p>2027年3月31日を「終了予定日」として提案 → 先生が継続・卒業を確認 → 確定した場合だけ翌月以降の定期請求を止めます。</p>
            <p className="mt-2 text-xs">浪人して継続する場合や卒業後も通う場合は、終了日を変更・解除できます。学年だけで退会を確定しません。</p>
          </div>
          <Radio value={draft.gradeExpiry?"yes":"no"} onChange={v=>update({gradeExpiry:v==="yes"})} options={[
            {value:"no",label:"学年から終了日を提案しない",note:"必要になった時、先生が生徒ごとに受講終了日を設定します"},
            {value:"yes",label:"学年から終了予定日を提案する",note:"高3などの最終学年で3月末を提案。先生が確認するまで退会・請求停止は確定しません"},
          ]}/>
          {draft.gradeExpiry&&<p className="rounded-lg bg-neutral-50 p-3 text-sm">先生の確認は必須です。卒業予定日から自動的に退会を確定することはありません。</p>}
          <p className="text-xs text-neutral-600">学年だけを理由に無断で退会確定・請求停止はしない設計です。</p>
        </div>}
        {(step==="business"||step==="service"||step==="slot")&&(()=>{
          const modeKey=step==="business"?"businessMode":step==="service"?"serviceMode":"slotMode";
          const nameKey=step==="business"?"businessName":step==="service"?"serviceName":"slotName";
          const term=step==="business"?draft.categoryBusiness:step==="service"?draft.categoryService:draft.categorySlot;
          return <div className="space-y-4">
            <Radio value={draft[modeKey]} onChange={v=>update({[modeKey]:v} as Partial<Draft>)} options={[
              {value:"existing",label:`既存の${term}を整備する`},
              {value:"new",label:`新しい${term}を作る`},
            ]}/>
            <label className={label}>{term}名
              <input className={field} maxLength={120} value={draft[nameKey]} onChange={e=>update({[nameKey]:e.target.value} as Partial<Draft>)}/>
            </label>
            <p className="text-xs text-neutral-600">試作なので既存データは読み込まず、名前だけで操作を確認します。</p>
          </div>;
        })()}
        {step==="briefing"&&<Radio value={draft.briefing} onChange={v=>update({briefing:v as Draft["briefing"]})} options={[
          {value:"none",label:"不要：入会申込へ直接進む"},
          {value:"briefing",label:"説明会を予約してから入会"},
          {value:"trial",label:"体験を予約してから入会"},
          {value:"both",label:"説明会と体験の両方を実施"},
        ]}/>}
        {step==="briefingName"&&<label className={label}>参加者に表示する名称
          <input className={field} value={draft.briefingLabel} onChange={e=>update({briefingLabel:e.target.value})}/>
          <p className="mt-2 text-xs font-normal text-neutral-500">例：説明会、体験レッスン、個別相談、入会面談</p>
        </label>}
        {(step==="briefingFields"||step==="admissionFields")&&<div className="space-y-3">
          <p className="text-sm">必要な項目を選択してください。氏名・メール・同意は必須です。{draft.audience==="mixed"?"成人・未成年で表示する項目は自動的に切り替えます。":""}</p>
          {fields.filter(item=>minorsIncluded||item.id!=="guardian").map(item=>{
            const key=step==="briefingFields"?"briefingFields":"admissionFields";
            const locked=["name","email","consent"].includes(item.id);
            const checked=draft[key].includes(item.id)||locked;
            return <label key={item.id} className="flex items-center gap-2 rounded-lg border border-neutral-200 p-3 text-sm">
              <input type="checkbox" checked={checked} disabled={locked} onChange={()=>toggle(key,item.id)}/>
              {item.id==="guardian"&&draft.audience==="mixed"?"保護者情報（未成年の申込時のみ必須）":item.id==="school"&&isAdultOnly?"所属（任意）":item.label}{locked&&<span className="text-xs text-neutral-500">（必須）</span>}
            </label>;
          })}
          {draft.audience==="mixed"&&<p className="rounded-lg bg-emerald-50 p-3 text-sm">申込者が「成人」なら保護者欄は表示しません。「未成年」なら保護者の連絡先と同意が必須です。</p>}
          {draft.audience==="minors"&&<p className="text-xs text-neutral-600">未成年者のみのため保護者の連絡先と同意が必要です。</p>}
          {isAdultOnly&&<p className="text-xs text-neutral-600">成人向けのため保護者情報は含みません。</p>}
        </div>}
        {(step==="bookingMail"||step==="approvalMail"||step==="completedMail"||step==="withdrawalMail")&&<MailEditor
          draft={draft} setDraft={setDraft} kind={step==="bookingMail"?"booking":step==="approvalMail"?"approval":step==="completedMail"?"completed":"withdrawal"}/>}
        {step==="approval"&&<div className="space-y-3">
          <p className="text-sm leading-7">このコースの説明会・体験が終わったあと、先生が個別に入会を許可する必要があるか選びます。直接入会のコースでは、この質問は省略します。</p>
          <Radio value={draft.approvalMode} onChange={v=>update({approvalMode:v as Draft["approvalMode"]})} options={[
          {value:"teacher",label:"先生が確認して入会を許可する",note:"必要なら参加できるクラスを制限"},
          {value:"automatic",label:"説明会・体験の参加確認後、入会申込へ進む",note:"先生が個別に入会許可メールを送る工程は省略します"},
        ]}/>
        </div>}
        {step==="approvalLink"&&<div className="space-y-3">
          <Radio value={draft.approvalLink} onChange={v=>update({approvalLink:v as Draft["approvalLink"]})} options={[
            {value:"standard",label:"既成の案内ボタンを使う",note:"「参加クラスを選ぶ」→ 許可されたクラスだけ表示"},
            {value:"custom",label:"ボタン前の案内を編集する"},
          ]}/>
          {draft.approvalLink==="custom"&&<label className={label}>案内文<textarea className={field} rows={3} value={draft.approvalLinkText} onChange={e=>update({approvalLinkText:e.target.value})}/></label>}
        </div>}
        {step==="home"&&<div className="space-y-3">
          <p className="text-sm">入会完了後は、生徒のHOMEで次の情報をまとめて表示します。</p>
          <div className="grid gap-2 sm:grid-cols-2">{["参加クラスと次回予定","カレンダー・欠席・振替","支払状況","先生からのお知らせ"].map(item=><div className="rounded-xl bg-neutral-50 p-3 text-sm" key={item}>✓ {item}</div>)}</div>
          <p className="text-xs text-neutral-600">ここは基本構成として固定し、必要な表示だけ自動で出します。</p>
        </div>}
        {step==="withdrawal"&&<Radio value={draft.withdrawal} onChange={v=>update({withdrawal:v as Draft["withdrawal"]})} options={[
          ...(minorsIncluded?[{value:"guardian_teacher",label:"未成年は保護者の確認＋先生の確定",note:"成人は本人の届出と先生の確認で進めます"}]:[]),
          {value:"notice_teacher",label:minorsIncluded?"受講者から届け出 → 先生が確認":"受講者から届け出 → 先生が確認",note:"届出を受理した日から終了予定日を計算し、先生の確認で確定"},
          {value:"teacher",label:"退会希望は先生へ直接相談して手続き"},
        ]}/>}
        {step==="review"&&<div className="space-y-3 text-sm">
          <p className="font-bold">{draft.businessName} ＞ {draft.serviceName} ＞ {draft.slotName}</p>
          <p>分類：{draft.categoryBusiness}／{draft.categoryService}／{draft.categorySlot} ・ 呼称：{draft.teacherLabel}／{draft.learnerLabel}{minorsIncluded?"／"+draft.guardianLabel:""}</p>
          <p>対象：{draft.audience==="adults"?"成人のみ":draft.audience==="minors"?"未成年のみ":"成人・未成年の両方"}{minorOnly?" ・ 学年から終了日を提案："+(draft.gradeExpiry?"あり":"なし"):""}</p>
          <p>{draft.serviceName}の説明会・体験：{draft.briefing==="none"?"なし":draft.briefingLabel}{draft.briefing!=="none"?" ・ 先生の入会確認："+(draft.approvalMode==="teacher"?"必要":"不要"):"（直接入会）"}</p>
          <p>退会の手続き：{minorsIncluded&&draft.withdrawal==="guardian_teacher"?"保護者と先生の確認":draft.withdrawal==="notice_teacher"?"届出と先生の確認":"先生との相談"}</p>
          <div className="border-t pt-3"><p className="font-bold">見直す項目</p>
            <div className="mt-2 flex flex-wrap gap-2">{steps.filter(id=>id!=="review").map(id=><button key={id} type="button" className="rounded-full border px-3 py-1 text-xs" onClick={()=>editCurrent(id)}>{stepTitles[id]}</button>)}</div>
          </div>
        </div>}
        </div>
        <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-neutral-200 pt-5">
          <button className={secondary} disabled={cursor===0} onClick={()=>{setFinished(false);setCursor(i=>Math.max(0,i-1));}}>← 戻る</button>
          {finished?<button className={primary} onClick={()=>{setCursor(0);setFinished(false);}}>最初から見直す</button>:
            <button className={primary} disabled={!required} onClick={advance}>{step==="review"?"設計ガイドを確認完了":"次へ →"}</button>}
        </div>
      </section>
      <p className="mt-5 text-center text-sm font-semibold text-red-800">試用版です。保存・メール送信・予約・決済・請求変更は行いません。</p>
    </div>
  </main>;
}
