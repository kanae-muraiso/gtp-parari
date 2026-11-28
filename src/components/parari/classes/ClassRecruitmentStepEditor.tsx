"use client";
import {applicationFields} from "@/lib/classBriefingWorkflow";
import {flowFieldIds,formRules,type StepConfig,type FlowStep,type FlowDraft,type FlowTarget,type FieldRule} from "@/lib/classRecruitmentFlowDesign";
const field="min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base";
type Props={step:FlowStep;target:FlowTarget;draft:FlowDraft;onChange:(patch:Partial<FlowDraft>)=>void;onCommon:()=>void};
export default function ClassRecruitmentStepEditor({step,target,draft,onChange,onCommon}:Props){
 const c=draft.config?.[step]??{};
 const set=(patch:StepConfig)=>onChange({config:{...draft.config,[step]:{...c,...patch}}});
 const text=(key:"title"|"subject"|"location"|"url",label:string,placeholder="")=><label className="grid gap-1 text-base">{label}<input className={field} value={c[key]??""} placeholder={placeholder} maxLength={key==="url"?2000:300} onChange={e=>set({[key]:e.target.value})}/></label>;
 const area=(label:string)=><label className="grid gap-1 text-base">{label}<textarea className={field} rows={3} maxLength={4000} value={c.body??draft.notes[step]??""} onChange={e=>set({body:e.target.value})}/></label>;
 const select=(key:"mode"|"method",label:string,options:[string,string][],fallback:string)=><label className="grid gap-1 text-base">{label}<select className={field} value={c[key]??fallback} onChange={e=>set({[key]:e.target.value})}>{options.map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label>;
 const number=(key:"duration"|"maxScore"|"passScore"|"capacity",label:string,min:number,max:number)=><label className="grid gap-1 text-base">{label}<input className={field} type="number" min={min} max={max} step={1} value={c[key]??""} onChange={e=>set({[key]:e.target.value===""?undefined:Number(e.target.value)})}/></label>;
 const notify=<label className="flex min-h-11 items-center gap-2 text-base"><input type="checkbox" checked={c.notify??true} onChange={e=>set({notify:e.target.checked})}/> 結果・案内の通知を送る（設計案）</label>;
 const applicant=target.audience??c.audience??"adult";
 const rules=formRules(c,applicant);
 const form=<div className="grid gap-3">
  {target.audience?<p className="text-base">設計で決めた対象：{target.audience==="minor"?"未成年":"成人"}</p>:<label className="grid gap-1 text-base">申込者の対象<select className={field} value={applicant} onChange={e=>set({audience:e.target.value as "adult"|"minor"})}><option value="adult">成人向け</option><option value="minor">未成年向け</option></select></label>}
  <div className="grid gap-2"><p className="font-bold">申込フォームの項目</p>{flowFieldIds.filter(key=>applicant==="minor"||!key.startsWith("guardian")).map(key=>{
   const fixed=key==="name"||key==="email"||applicant==="minor"&&key.startsWith("guardian");
   return <label key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 border-b border-neutral-100 py-1 text-base"><span>{applicationFields[key]}</span><select aria-label={applicationFields[key]+"の入力設定"} className={field} value={rules[key]} disabled={fixed} onChange={e=>set({rules:{...rules,[key]:e.target.value as FieldRule}})}><option value="required">必須</option><option value="optional">任意</option><option value="hidden">表示しない</option></select></label>;
  })}</div>
  <details className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer py-2 font-medium">申込者に見えるフォームを確認</summary><div className="grid gap-3 pt-2">{flowFieldIds.filter(key=>rules[key]!=="hidden").map(key=><label key={key} className="grid gap-1 text-base">{applicationFields[key]}{rules[key]==="required"?"（必須）":""}<input className={field} disabled placeholder="入力欄"/></label>)}<p className="text-sm text-neutral-600">確認用のフォームです。個人情報は収集・送信しません。</p></div></details>
 </div>;
 const reservation=<>
  {select("mode","予約方法",[["manual","運営者と個別調整"],["scheduled","候補日時を指定"]],"manual")}
  {c.mode==="scheduled"&&<div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1">候補日<input className={field} type="date" value={c.date??""} onChange={e=>set({date:e.target.value})}/></label><label className="grid gap-1">開始時刻<input className={field} type="time" value={c.time??""} onChange={e=>set({time:e.target.value})}/></label></div>}
  {text("location","会場・実施場所")}
  {area("予約時の案内（任意）")}
 </>;
 if(step==="common")return <div className="grid gap-2"><p>事業共通の入会手続きを利用します。入会済みの場合は繰り返さない設計です。</p><button type="button" className={field+" w-fit"} onClick={onCommon}>共通の入会手続きを開く</button></div>;
 if(step==="page")return <>{text("title","ページのタイトル")}{area("紹介文")}{select("mode","募集ページの構成",[["service","サービス紹介と申込ボタン"],["page","PARARI PAGEの紹介と申込ボタン"]],"service")}<p className="text-sm text-neutral-600">料金・開催枠は設計から引き継ぎます。実際のPAGE作成・公開は移行前の設定で確認できます。</p></>;
 if(step==="application")return <>{form}{area("申込時の補足案内（任意）")}</>;
 if(step==="booking"||step==="testBooking")return <>{reservation}{form}</>;
 if(step==="briefing"||step==="test")return <>
  {select("method","実施方法",[["onsite","対面"],["online","オンライン"],["hybrid","対面・オンライン"]],"onsite")}
  {text("location","実施場所・接続案内")}{number("duration","所要時間（分）",1,480)}
  {area(step==="test"?"テストの内容・実施方法":"説明会・体験の内容")}
 </>;
 if(step==="result")return <>
  {select("mode","合否の判定方法",[["manual","運営者が合否を記録"],["score","点数を基準に判定"]],"manual")}
  {c.mode==="score"&&<div className="grid grid-cols-2 gap-2">{number("maxScore","満点",1,1000000)}{number("passScore","合格点",0,c.maxScore??1000000)}</div>}
  {notify}{area("結果通知の案内（任意）")}
 </>;
 if(step==="approval")return <><p className="text-base">運営者が申込内容を確認し、承認・保留・不承認を記録します。</p>{select("mode","確認方法",[["review","申込内容を確認"],["interview","面談して確認"]],"review")}{notify}{area("確認する項目・案内（任意）")}</>;
 if(step==="terms")return <><label className="grid gap-1 text-base">同意する規約<textarea className={field} rows={5} maxLength={8000} value={draft.terms} onChange={e=>onChange({terms:e.target.value})}/></label><p className="text-base">申込者の同意を必須にします。</p></>;
 if(step==="class")return <>{select("mode","開催枠の選択方法",[["choose","申込者が選択"],["assigned","運営者が指定"]],"choose")}<div className="grid gap-1"><strong>設計済みの開催枠</strong>{target.classNames?.map((name,i)=><p key={i}>{name}</p>)}{!target.classNames?.length&&<p>開催枠を設計で追加してください。</p>}</div>{area("選択時の案内（任意）")}</>;
 if(step==="payment"||step==="onsite")return <>
  <p className="text-base font-medium">設計済みの料金：{target.priceText??"未設定"}</p>
  {step==="payment"?select("method","決済方法",[["parari","PARARI内決済（接続予定）"],["external","外部決済URL"],["transfer","銀行振込"]],"parari"):select("method","当日の支払方法",[["cash","現金"],["card","カード等の現地決済"]],"cash")}
  {step==="payment"&&c.method==="external"&&text("url","決済ページURL","https://")}
  {area("支払い案内（任意）")}
 </>;
 if(step==="confirmation")return <><p className="text-base">選択した必要手続きがすべて完了した時点で確定する設計です。</p>{notify}{text("subject","通知の件名")}{area("確定後の案内・メッセージ")}</>;
 return <p>参加資格は設計画面から引き継ぎます。</p>;
}
