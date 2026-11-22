"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Choice = "new" | "existing";
type MailKey = "booking" | "approval" | "completed" | "withdrawal";
type MailSettings = { custom: boolean; subject: string; body: string };
type Draft = {
  categoryBusiness: string; categoryService: string; categorySlot: string;
  teacherLabel: string; learnerLabel: string; guardianLabel: string;
  minors: boolean; gradeExpiry: boolean; expiryApproval: boolean;
  businessMode: Choice; businessName: string;
  serviceMode: Choice; serviceName: string;
  slotMode: Choice; slotName: string;
  briefing: "none" | "briefing" | "trial" | "both";
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
  minors: true, gradeExpiry: false, expiryApproval: true,
  businessMode: "existing", businessName: "村磯優子英語教室",
  serviceMode: "existing", serviceName: "中1コース",
  slotMode: "existing", slotName: "月曜クラス",
  briefing: "briefing", briefingLabel: "説明会",
  briefingFields: ["name", "email", "phone"], approvalMode: "teacher",
  approvalLink: "standard", approvalLinkText: "入会を許可しました。参加クラスを選択してください。",
  admissionFields: ["name", "email", "guardian", "consent"],
  withdrawal: "guardian_teacher",
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
  hierarchy:"分類名", roles:"呼び方", minor:"未成年の参加", grade:"学年と卒業予定",
  business:"事業の選択", service:"コースの選択", slot:"クラスの選択",
  briefing:"説明会・体験の必要性", briefingName:"説明会・体験の名称", briefingFields:"説明会・体験の申込項目",
  bookingMail:"予約受付メール", approval:"入会許可の方法", approvalMail:"入会許可メール",
  approvalLink:"許可メールから申込フォームへ", admissionFields:"入会申込フォームの項目",
  completedMail:"入会完了メール", home:"生徒HOME", withdrawal:"退会届の扱い", withdrawalMail:"退会届受付メール", review:"設計内容の確認",
};
const sections: {name:string; ids:StepId[]}[] = [
  {name:"基本ルール",ids:["hierarchy","roles","minor","grade"]},
  {name:"事業とサービス",ids:["business","service","slot"]},
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
  const change=(next:Partial<MailSettings>)=>setDraft({...draft,messages:{...draft.messages,[kind]:{...setting,...next}}});
  return <div className="space-y-3">
    <Radio options={[{value:"default",label:"既成の文面を使う",note:"後から変更できます"},{value:"custom",label:"自分で文章を編集する"}]}
      value={setting.custom?"custom":"default"} onChange={v=>change({custom:v==="custom"})}/>
    <div className="rounded-xl bg-neutral-50 p-4">
      <p className="mb-2 text-xs font-semibold text-neutral-600">メールのプレビュー（実際には送信しません）</p>
      {setting.custom?<div className="space-y-3">
        <label className={label}>件名<input className={field} value={setting.subject} onChange={e=>change({subject:e.target.value})}/></label>
        <label className={label}>本文<textarea className={field} rows={5} value={setting.body} onChange={e=>change({body:e.target.value})}/></label>
      </div>:<><p className="text-sm font-bold">{setting.subject}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{setting.body}</p></>}
    </div>
  </div>;
}
export default function ClassSetupWizardPreview(){
  const [draft,setDraft]=useState<Draft>(defaults);
  const [cursor,setCursor]=useState(0);
  const [finished,setFinished]=useState(false);
  const steps=useMemo(()=>{
    const ids:StepId[]=["hierarchy","roles","minor"];
    if(draft.minors)ids.push("grade");
    ids.push("business","service","slot","briefing");
    if(draft.briefing!=="none")ids.push("briefingName","briefingFields","bookingMail");
    ids.push("approval");
    if(draft.approvalMode==="teacher")ids.push("approvalMail","approvalLink");
    ids.push("admissionFields","completedMail","home","withdrawal","withdrawalMail","review");
    return ids;
  },[draft.minors,draft.briefing,draft.approvalMode]);
  const step=steps[Math.min(cursor,steps.length-1)];
  const category=sections.find(section=>section.ids.includes(step))?.name??"確認";
  const update=(patch:Partial<Draft>)=>setDraft(previous=>({...previous,...patch}));
  const toggle=(key:"briefingFields"|"admissionFields",id:string)=>{
    const current=draft[key];
    const next=current.includes(id)?current.filter(item=>item!==id):[...current,id];
    update({[key]:next} as Partial<Draft>);
  };
  const required=step==="business"?draft.businessName.trim():step==="service"?draft.serviceName.trim():step==="slot"?draft.slotName.trim():true;
  const advance=()=>{if(cursor>=steps.length-1){setFinished(true);return;}setCursor(value=>Math.min(value+1,steps.length-1));};
  const editCurrent=(id:StepId)=>{const index=steps.indexOf(id);if(index>=0){setCursor(index);setFinished(false);}};
  return <main className="min-h-screen bg-neutral-100 py-8 text-neutral-950">
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/my/class-flow-preview" className="text-sm text-neutral-600 underline underline-offset-4">← フロー設計へ</Link>
        <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">試作・DB保存なし</span>
      </div>
      <header className="mt-8">
        <p className="text-xs font-bold tracking-widest text-emerald-800">PARARI CLASS · 先生の設計ガイド</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">一つずつ答えて、クラスを設計する</h1>
        <p className="mt-3 text-sm leading-7 text-neutral-600">最初に基本ルールを決めます。以降は必要な項目だけを表示し、メール文面も既成のものから始められます。</p>
      </header>
      <div className="mt-7 flex flex-wrap gap-2" aria-label="設計の進行状況">
        {sections.map(section=>{
          const members=steps.filter(id=>section.ids.includes(id));if(!members.length)return null;
          const start=steps.indexOf(members[0]);
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
          <p className="text-sm">事業・サービス・時間枠の3階層です。表示名は教室に合わせて変更できます。</p>
          {([["categoryBusiness","① 事業"],["categoryService","② サービス"],["categorySlot","③ 時間枠"]] as const).map(([id,title])=><label className={label} key={id}>{title}<input className={field} maxLength={20} value={draft[id]} onChange={e=>update({[id]:e.target.value} as Partial<Draft>)}/></label>)}
        </div>}
        {step==="roles"&&<div className="space-y-3">
          <p className="text-sm">申込画面・HOME・メールで使う呼び方です。</p>
          {([["teacherLabel","先生"],["learnerLabel","生徒"],["guardianLabel","保護者"]] as const).map(([id,title])=><label className={label} key={id}>{title}の呼び方<input className={field} maxLength={20} value={draft[id]} onChange={e=>update({[id]:e.target.value} as Partial<Draft>)}/></label>)}
        </div>}
        {step==="minor"&&<Radio value={draft.minors?"yes":"no"} onChange={v=>update({minors:v==="yes"})} options={[{value:"yes",label:"未成年も受け入れる",note:"保護者の連絡先・同意・退会時の確認を適用"},{value:"no",label:"成人のみを受け入れる"}]}/>}
        {step==="grade"&&<div className="space-y-3">
          <Radio value={draft.gradeExpiry?"yes":"no"} onChange={v=>update({gradeExpiry:v==="yes"})} options={[
            {value:"no",label:"生徒ごとに最終受講日を設定する",note:"おすすめ：学年が変わっても自動終了しません"},
            {value:"yes",label:"学年から卒業予定日を提案する",note:"高校3年生なら3月末を提案。予定日の確定前に先生が確認します"},
          ]}/>
          {draft.gradeExpiry&&<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.expiryApproval} onChange={e=>update({expiryApproval:e.target.checked})}/>卒業予定日を先生が確認してから終了を確定する</label>}
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
          <p className="text-sm">必要な項目を選択してください。氏名・メール・同意は必須です。</p>
          {fields.map(item=>{
            const key=step==="briefingFields"?"briefingFields":"admissionFields";
            const locked=["name","email","consent"].includes(item.id);
            const checked=draft[key].includes(item.id)||locked;
            return <label key={item.id} className="flex items-center gap-2 rounded-lg border border-neutral-200 p-3 text-sm">
              <input type="checkbox" checked={checked} disabled={locked} onChange={()=>toggle(key,item.id)}/>
              {item.label}{locked&&<span className="text-xs text-neutral-500">（必須）</span>}
            </label>;
          })}
          {draft.minors&&<p className="text-xs text-neutral-600">未成年者の入会時には、保護者の本人確認・同意が必要です。</p>}
        </div>}
        {(step==="bookingMail"||step==="approvalMail"||step==="completedMail"||step==="withdrawalMail")&&<MailEditor
          draft={draft} setDraft={setDraft} kind={step==="bookingMail"?"booking":step==="approvalMail"?"approval":step==="completedMail"?"completed":"withdrawal"}/>}
        {step==="approval"&&<Radio value={draft.approvalMode} onChange={v=>update({approvalMode:v as Draft["approvalMode"]})} options={[
          {value:"teacher",label:"先生が確認して入会を許可する",note:"必要なら参加できるクラスを制限"},
          {value:"automatic",label:"条件が揃ったら入会申込へ自動で進む"},
        ]}/>}
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
          {value:"guardian_teacher",label:"保護者の確認＋先生の確定",note:"未成年向けのおすすめ。届出時点では契約を終わらせません"},
          {value:"notice_teacher",label:"生徒から届け出 → 先生が確認",note:"保護者確認が不要な成人向けなど"},
          {value:"teacher",label:"退会希望は先生へ直接相談して手続き"},
        ]}/>}
        {step==="review"&&<div className="space-y-3 text-sm">
          <p className="font-bold">{draft.businessName} ＞ {draft.serviceName} ＞ {draft.slotName}</p>
          <p>分類：{draft.categoryBusiness}／{draft.categoryService}／{draft.categorySlot} ・ 呼称：{draft.teacherLabel}／{draft.learnerLabel}／{draft.guardianLabel}</p>
          <p>未成年：{draft.minors?"受け入れる":"受け入れない"} ・ 卒業予定日の提案：{draft.gradeExpiry?"あり":"なし"}</p>
          <p>説明会・体験：{draft.briefing==="none"?"なし":draft.briefingLabel} ・ 先生の入会確認：{draft.approvalMode==="teacher"?"必要":"不要"}</p>
          <p>退会の手続き：{draft.withdrawal==="guardian_teacher"?"保護者と先生の確認":draft.withdrawal==="notice_teacher"?"届出と先生の確認":"先生との相談"}</p>
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
      <p className="mt-5 text-center text-xs text-neutral-500">この画面では事業・コース・クラスの保存、メール送信、予約、決済、請求変更を行いません。</p>
    </div>
  </main>;
}
