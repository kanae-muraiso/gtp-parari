"use client";
import {useEffect,useState} from "react";
import {buildFlow,flowKey,initialFlow,parseFlowDraft,stepLabel,type FlowTarget,type FlowDraft,type FlowStep} from "@/lib/classRecruitmentFlowDesign";
const field="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base";
const btn="min-h-11 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base font-medium";
const notesLabels:Record<FlowStep,string>={page:"紹介文・募集ページの構成",eligibility:"参加資格の案内",booking:"予約方法・日時・場所の案内",briefing:"説明会・体験の内容",application:"申込フォームで確認する項目・案内文",test:"テストの内容・合格条件の案内",approval:"確認手順・許可の連絡",terms:"規約・同意事項",class:"開催枠の選択方法",payment:"決済方法・支払い案内",confirmation:"確定後の案内・メッセージ",onsite:"当日の支払い案内"};
const rowKey=(t:FlowTarget)=>t.kind+":"+t.id;
export function ClassServiceQualification({schoolId,target,membership}:{schoolId:string;target:FlowTarget;membership:boolean}){
 const [draft,setDraft]=useState<FlowDraft>(()=>initialFlow(target));
 const [message,setMessage]=useState("");
 useEffect(()=>{try{setDraft(parseFlowDraft(sessionStorage.getItem(flowKey(schoolId,target)),target));}catch{setDraft(initialFlow(target));}setMessage("");},[schoolId,target.kind,target.id]);
 const invalid=draft.audience==="members_only"&&!membership;
 return <section className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
 <h3 className="text-lg font-bold">参加資格（設計案）</h3>
 <p className="text-base text-neutral-700">{target.title}に誰が参加できるかを決めます。募集画面はこの条件を引き継ぎます。</p>
 <label className="grid gap-1 text-base">参加対象<select className={field} value={draft.audience} onChange={e=>{setDraft(old=>({...old,audience:e.target.value as FlowDraft["audience"]}));setMessage("");}}><option value="everyone">一般の方も参加可能</option><option value="members_only" disabled={!membership}>事業への入会者限定</option></select></label>
 {invalid&&<p className="text-base text-red-800">入会制度を設けない事業では会員限定にできません。</p>}
 <button type="button" className={btn} disabled={invalid} onClick={()=>{try{const current=parseFlowDraft(sessionStorage.getItem(flowKey(schoolId,target)),target);sessionStorage.setItem(flowKey(schoolId,target),JSON.stringify({...current,audience:draft.audience}));setMessage("このブラウザ内に参加資格の設計案を保存しました。");}catch{setMessage("保存できませんでした。");}}}>参加資格の設計案を保存</button>
 {message&&<p role="status" className="text-base">{message}</p>}
 </section>;
}
export default function ClassRecruitmentFlowWorkspace({schoolId,targets,membership,onOpenLegacy,onOpenDesign}:{schoolId:string;targets:FlowTarget[];membership:boolean;onOpenLegacy:(target:FlowTarget,step:FlowStep)=>void;onOpenDesign:(target:FlowTarget)=>void}){
 const [drafts,setDrafts]=useState<Record<string,FlowDraft>>({});
 const [selection,setSelection]=useState<{id:string;step:FlowStep}|null>(null);
 const [message,setMessage]=useState("");
 const [ready,setReady]=useState(false);
 const identity=targets.map(rowKey).join("|");
 useEffect(()=>{
  const next:Record<string,FlowDraft>={};
  for(const target of targets){try{next[rowKey(target)]=parseFlowDraft(sessionStorage.getItem(flowKey(schoolId,target)),target);}catch{next[rowKey(target)]=initialFlow(target);}}
  setDrafts(next);setReady(true);setMessage("");setSelection(old=>old&&next[old.id]?old:null);
 },[schoolId,identity]);
 const target=targets.find(t=>rowKey(t)===selection?.id);
 const draft=target?drafts[rowKey(target)]??initialFlow(target):null;
 const step=selection?.step??"page";
 function update(patch:Partial<FlowDraft>){
  if(!target||!draft)return;
  const next={...draft,...patch};
  setDrafts(old=>({...old,[rowKey(target)]:next}));setMessage("未保存の変更があります。");
 }
 function save(){
  if(!target||!draft)return;
  if(!membership&&draft.audience==="members_only"){setMessage("設計で参加資格を見直してください。");return;}
  try{sessionStorage.setItem(flowKey(schoolId,target),JSON.stringify(draft));setMessage("このサービスの募集設計案をブラウザ内に保存しました。");}catch{setMessage("保存できませんでした。");}
 }
 return <section className="grid gap-4">
  <h2 className="text-xl font-bold">募集の構成図</h2>
  <p className="text-base text-neutral-600">募集ページから参加まで。工程を押すと下の編集欄が切り替わります。事業への入会と個々のサービスを混ぜません。</p>
  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-base">設計確認用：新しい工程の設定はブラウザ内の下書きです。実際の受付・公開・決済は変更しません。</p>
  <div className="grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
  {targets.map(t=>{
   const d=drafts[rowKey(t)]??initialFlow(t);
   return <div key={rowKey(t)} className="grid gap-2 border-b border-emerald-200 pb-4 last:border-0 last:pb-0">
    <div className="flex flex-wrap items-center gap-2"><strong className="text-lg text-emerald-950">{t.title}</strong>{t.kind==="membership"&&<span className="text-sm text-neutral-600">事業単位</span>}</div>
    <div className="flex flex-wrap items-center gap-2">
    {buildFlow(t,d).map((s,i)=><div key={s} className="flex items-center gap-2">
     {i>0&&<span aria-hidden="true" className="text-emerald-700">→</span>}
     <button type="button" disabled={!ready} aria-pressed={selection?.id===rowKey(t)&&step===s} onClick={()=>{setSelection({id:rowKey(t),step:s});setMessage("");}} className={"min-h-11 rounded-lg border px-3 py-2 text-base font-medium "+(selection?.id===rowKey(t)&&step===s?"border-emerald-800 bg-emerald-800 text-white":"border-emerald-300 bg-white text-emerald-950")}>{stepLabel(s,t,d)}</button>
    </div>)}
    </div>
    <button type="button" className={btn+" w-fit"} onClick={()=>{setSelection({id:rowKey(t),step:"page"});setMessage("");}}>工程を設定</button>
   </div>;
  })}
  {!targets.length&&<p className="text-base">設計でサービスを作ると、ここに募集の流れが表示されます。</p>}
  </div>
  {target&&draft&&<section className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5" aria-label="選択中の募集工程">
   <p className="text-base text-neutral-600">選択中：{target.title}</p>
   <h3 className="text-xl font-bold">{stepLabel(step,target,draft)}</h3>
   {target.kind!=="membership"&&<div className="grid gap-2 rounded-lg bg-neutral-50 p-3 text-base"><p>参加資格：{draft.audience==="members_only"?"事業への入会者限定":"一般の方も参加可能"}</p>{target.priceText&&<p>設計で決めた料金：{target.priceText}</p>}<button type="button" className={btn+" w-fit"} onClick={()=>onOpenDesign(target)}>設計で変更する</button></div>}
   {step==="page"&&<fieldset className="grid gap-3 rounded-xl border p-3">
    <legend className="font-bold">工程の構成</legend>
    <label className="grid gap-1 text-base">申込方法<select className={field} value={draft.route} onChange={e=>update({route:e.target.value as FlowDraft["route"]})}><option value="direct">直接申込</option><option value="briefing">説明会・体験を経て申込</option></select></label>
    <label className="flex min-h-11 items-center gap-2 text-base"><input type="checkbox" checked={draft.test} onChange={e=>update({test:e.target.checked})}/>テストを行う</label>
    <label className="grid gap-1 text-base">参加の確定<select className={field} value={draft.confirmation} onChange={e=>update({confirmation:e.target.value as FlowDraft["confirmation"]})}><option value="automatic">手続き完了後に自動確定</option><option value="review">運営者が確認して確定</option></select></label>
    <label className="grid gap-1 text-base">規約・同意（空欄なら省略）<textarea className={field} rows={3} maxLength={8000} value={draft.terms} onChange={e=>update({terms:e.target.value})}/></label>
    <label className="grid gap-1 text-base">支払いのタイミング<select className={field} value={target.paid===false?"free":draft.payment} disabled={target.paid===false} onChange={e=>update({payment:e.target.value as FlowDraft["payment"]})}>{target.paid!==true&&<option value="free">無料</option>}<option value="before">事前払い</option><option value="onsite">当日払い</option>{target.kind==="course"&&<option value="recurring">月謝・継続払い</option>}</select></label>
   </fieldset>}
   {step==="terms"?<label className="grid gap-1 text-base">規約・同意事項<textarea className={field} rows={5} maxLength={8000} value={draft.terms} onChange={e=>update({terms:e.target.value})}/></label>:<label className="grid gap-1 text-base">{notesLabels[step]}<textarea className={field} rows={4} maxLength={8000} value={draft.notes[step]??""} onChange={e=>update({notes:{...draft.notes,[step]:e.target.value}})}/></label>}
   {step==="class"&&<div className="grid gap-1 rounded-lg bg-neutral-50 p-3"><strong>設計済みの開催枠</strong>{target.classNames?.map((name,i)=><p key={i}>{name}</p>)}{!target.classNames?.length&&<p>開催枠を設計で追加してください。</p>}</div>}
   <div className="flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 text-base font-semibold text-white" onClick={save}>このサービスの募集設計案を保存</button><button type="button" className={btn} onClick={()=>onOpenLegacy(target,step)}>既存の実際の設定を確認</button></div>
   {message&&<p role="status" className="text-base text-neutral-700">{message}</p>}
  </section>}
 </section>;
}
