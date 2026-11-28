"use client";
import {useEffect,useState,type ReactNode} from "react";
import ClassSalesPanel from "./ClassSalesPanel";
const emptySalesAnswers:string[]=[];
import ClassRecruitmentStepEditor from "./ClassRecruitmentStepEditor";
import {availableFlowSteps,flowOrder,flowOrderIssue,flowKey,initialFlow,moveFlowStep,parseFlowDraft,requiredFlowSteps,stepConfigIssue,stepLabel,type FlowTarget,type FlowDraft,type FlowStep} from "@/lib/classRecruitmentFlowDesign";
const field="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base";
const btn="min-h-11 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base font-medium";
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
export default function ClassRecruitmentFlowWorkspace({schoolId,targets,membership,onMembershipChange,onOpenLegacy,onOpenDesign,overviewHeader,preview,initialDraftsJson,onSaveDrafts,membershipConfigured}:{schoolId:string;targets:FlowTarget[];membership:boolean;membershipConfigured:boolean;onMembershipChange:(enabled:boolean)=>Promise<void>;onOpenLegacy:(target:FlowTarget,step:FlowStep)=>void;onOpenDesign:(target:FlowTarget)=>void;overviewHeader?:ReactNode;preview:boolean;initialDraftsJson:string;onSaveDrafts:(drafts:Record<string,FlowDraft>)=>Promise<void>}){
 const [drafts,setDrafts]=useState<Record<string,FlowDraft>>({});
 const [selection,setSelection]=useState<{id:string;step:FlowStep}|null>(null);
 const [checklist,setChecklist]=useState<string|null>(null);
 const [checked,setChecked]=useState<FlowStep[]>([]);
 const [message,setMessage]=useState("");
 const [ready,setReady]=useState(false);
 const [saving,setSaving]=useState(false);
 const [choice,setChoice]=useState<boolean|null>(null);
 const [confirmed,setConfirmed]=useState(false);
 const [drag,setDrag]=useState<{row:string;step:FlowStep}|null>(null);
 const identity=targets.map(rowKey).join("|");
 const shared:FlowTarget={kind:"membership",id:schoolId,title:"共通の入会手続き"};
 const sharedKey=rowKey(shared);
 const allTargets=[shared,...targets.filter(t=>t.kind!=="membership")];
 const visibleTargets=allTargets.filter(t=>t.kind!=="membership"||membership);
 const sharedConfigured=!!drafts[sharedKey]?.order?.length&&!flowOrderIssue(shared,drafts[sharedKey].order,true,true);
 useEffect(()=>{
  const next:Record<string,FlowDraft>={};
  let saved:Record<string,unknown>={};
  if(!preview)try{const parsed=JSON.parse(initialDraftsJson||"{}");if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))saved=parsed;}catch{}
  for(const t of allTargets){
   const key=rowKey(t);
   try{
    const raw=preview?sessionStorage.getItem(flowKey(schoolId,t)):typeof saved[key]==="string"?saved[key] as string:JSON.stringify(saved[key]??null);
    next[key]=parseFlowDraft(raw,t);
   }catch{next[key]=initialFlow(t);}
  }
  setDrafts(next);setReady(true);setSelection(old=>old&&next[old.id]?old:null);
 },[schoolId,identity,preview,initialDraftsJson]);
 useEffect(()=>{
  if(preview){
   try{const stored=sessionStorage.getItem("class-common-intake-choice:"+schoolId);setConfirmed(stored==="yes"||stored==="no");setChoice(stored===null?null:stored==="yes");}
   catch{setConfirmed(false);setChoice(null);}
  }else{setConfirmed(membershipConfigured);setChoice(membershipConfigured?membership:null);}
 },[schoolId,membership,membershipConfigured,preview]);
 const target=visibleTargets.find(t=>rowKey(t)===selection?.id);
 const draft=target?drafts[rowKey(target)]??initialFlow(target):null;
 const step=selection?.step??"page";
 const configuring=visibleTargets.find(t=>rowKey(t)===checklist);
 function openChecklist(t:FlowTarget){
  const d=drafts[rowKey(t)]??initialFlow(t);
  setChecklist(rowKey(t));const current=flowOrder(t,d,membership);const required=requiredFlowSteps(t);setChecked(required.every(s=>current.includes(s))?current:availableFlowSteps(t,membership).filter(s=>current.includes(s)||required.includes(s)));setSelection(null);setMessage("");
 }
 async function chooseMembership(){
  if(choice===null||saving)return;
  setSaving(true);setMessage("");
  try{
   if(preview)sessionStorage.setItem("class-common-intake-choice:"+schoolId,choice?"yes":"no");
   await onMembershipChange(choice);
   setConfirmed(true);setSelection(null);setChecklist(null);setMessage(preview?"このブラウザに選択を保存しました。":"事業設定に選択を保存しました。");
  }catch(cause){setMessage(cause instanceof Error?cause.message:"共通入会手続きを保存できませんでした。");}
  finally{setSaving(false);}
 }
 async function persist(t:FlowTarget,d:FlowDraft){
  const next={...drafts,[rowKey(t)]:d};
  setSaving(true);
  try{
   if(preview)sessionStorage.setItem(flowKey(schoolId,t),JSON.stringify(d));
   else await onSaveDrafts(next);
   setDrafts(next);return true;
  }catch(cause){setMessage(cause instanceof Error?cause.message:"募集フローを保存できませんでした。");return false;}
  finally{setSaving(false);}
 }
 async function saveChecklist(){
  if(!configuring)return;
  const t=configuring,d=drafts[rowKey(t)]??initialFlow(t);
  if(!membership&&d.audience==="members_only"){setMessage("設計で参加資格を見直してください。");return;}
  const issue=flowOrderIssue(t,checked,membership,sharedConfigured);
  if(issue){setMessage(issue);return;}
  const next:FlowDraft={...d,order:[...checked],route:checked.includes("briefing")?"briefing":"direct",test:checked.includes("test"),confirmation:checked.includes("approval")?"review":"automatic",payment:checked.includes("onsite")?"onsite":checked.includes("payment")?(t.defaultPayment==="recurring"?"recurring":"before"):"free"};
  if(await persist(t,next)){setChecklist(null);setSelection({id:rowKey(t),step:checked[0]});setMessage(preview?"このブラウザに設計案を保存しました。":"事業設定にフローを保存しました。");}
 }
 function update(patch:Partial<FlowDraft>){
  if(!target||!draft)return;
  setDrafts(old=>({...old,[rowKey(target)]:{...draft,...patch}}));setMessage("未保存の変更があります。");
 }
 async function save(){
  if(!target||!draft)return;
  if(!membership&&draft.audience==="members_only"){setMessage("設計で参加資格を見直してください。");return;}
  const issue=flowOrderIssue(target,flowOrder(target,draft,membership),membership,sharedConfigured);
  if(issue){setMessage(issue);return;}
  const configIssue=stepConfigIssue(step,draft.config?.[step]??{});
  if(configIssue){setMessage(configIssue);return;}
  if(step==="terms"&&!draft.terms.trim()){setMessage("同意する規約を入力してください。");return;}
  if(await persist(target,draft))setMessage(preview?"このブラウザに設計案を保存しました。":"事業設定にフローを保存しました。");
 }
 async function reorder(t:FlowTarget,from:FlowStep,to:FlowStep){
  const d=drafts[rowKey(t)]??initialFlow(t);
  const order=moveFlowStep(flowOrder(t,d,membership),from,to);
  const issue=flowOrderIssue(t,order,membership,sharedConfigured);
  if(issue){setMessage(issue);return;}
  if(await persist(t,{...d,order})){setMessage(preview?"このブラウザに設計案を保存しました。":"事業設定にフローを保存しました。");}
 }
 const primary="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 text-base font-semibold text-white disabled:opacity-50";
 return <section className="min-w-0 grid gap-4">
  {!configuring&&!target&&<>{overviewHeader}<h2 className="text-xl font-bold">個別サービスの申込導線（設計）</h2></>}
  <p className="text-sm text-neutral-600">{preview?"ブラウザ内の設計案です。実際の受付・公開・決済は変更しません。":"フロー設計は事業設定に保存されます。申込受付・募集公開・決済への反映は別途接続が必要です。"}</p>
  {!confirmed?<section className="grid gap-3 rounded-xl border border-emerald-200 bg-white p-4">
    <h3 className="text-lg font-bold">共通の入会手続きを設けますか？</h3>
    <label className="flex min-h-11 items-center gap-2 text-base"><input type="radio" name="commonIntake" checked={choice===true} onChange={()=>setChoice(true)}/> 設ける</label>
    <label className="flex min-h-11 items-center gap-2 text-base"><input type="radio" name="commonIntake" checked={choice===false} onChange={()=>setChoice(false)}/> 設けない</label>
    <p className="text-sm text-neutral-600">設ける場合だけ、事業共通の入会手続きと各サービスで利用する選択肢が表示されます。</p>
    <button type="button" disabled={choice===null||!ready||saving} className={primary} onClick={()=>void chooseMembership()}>{saving?"保存中…":"設定を確定"</button>
  </section>:<>
  {!configuring&&!target&&<div className="flex flex-wrap items-center justify-between gap-2"><p className="text-base text-neutral-600">共通入会手続き：{membership?"あり":"なし"}</p><button type="button" className={btn} onClick={()=>{setChoice(membership);setConfirmed(false);setSelection(null);setChecklist(null);setMessage("");}}>再設定</button></div>}
  {!configuring&&!target&&<div className="min-w-0 grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
  {visibleTargets.map(t=>{
   const d=drafts[rowKey(t)]??initialFlow(t);
   const order=flowOrder(t,d,membership);
   const configured=!!d.order?.length;
   return <div key={rowKey(t)} className="min-w-0 grid gap-2 border-b border-emerald-200 pb-4 last:border-0 last:pb-0">
    <button type="button" className="min-h-11 text-left text-lg font-bold text-emerald-950" onClick={()=>{if(configured&&order.length){setSelection({id:rowKey(t),step:order[0]});setMessage("");}else openChecklist(t);}}>{t.title}　›</button>
    {configured?<div className="min-w-0 overflow-x-auto"><div className="flex w-max items-center gap-2">
    {order.map((s,i)=><div key={s} className="flex shrink-0 items-center gap-2" draggable onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",s);setDrag({row:rowKey(t),step:s});}} onDragEnd={()=>setDrag(null)} onDragOver={e=>{if(drag?.row===rowKey(t))e.preventDefault();}} onDrop={e=>{e.preventDefault();if(drag?.row===rowKey(t))void reorder(t,drag.step,s);setDrag(null);}}>{i>0&&<span aria-hidden="true" className="text-emerald-700">→</span>}<button type="button" disabled={!ready} aria-pressed={selection?.id===rowKey(t)&&step===s} onClick={()=>{setChecklist(null);setSelection({id:rowKey(t),step:s});setMessage("");}} className={"min-h-11 cursor-grab whitespace-nowrap rounded-lg border px-3 py-2 text-base font-medium "+(selection?.id===rowKey(t)&&step===s?"border-emerald-800 bg-emerald-800 text-white":"border-emerald-300 bg-white text-emerald-950")}>{stepLabel(s,t,d)}</button></div>)}
    </div></div>:<p className="text-base text-neutral-600">必要な工程を選んでください。</p>}

    {configured&&flowOrderIssue(t,order,membership,sharedConfigured)&&<p className="text-sm text-red-800">{flowOrderIssue(t,order,membership,sharedConfigured)}</p>}
   </div>;
  })}
  {!visibleTargets.length&&<p className="text-base">設計でサービスを作ると、ここに募集の導線が表示されます。</p>}
  </div>}
  {(configuring||target)&&<div className="flex items-center gap-3"><button type="button" className={btn} onClick={()=>{setSelection(null);setChecklist(null);setMessage("");}}>‹ 導線一覧に戻る</button><h2 className="flex-1 text-xl font-bold">{(configuring??target)?.title}</h2></div>}
  {configuring&&<section className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4">
   <h3 className="text-lg font-bold">必要な工程を選ぶ</h3>
   <p className="text-sm text-neutral-600">チェックした工程を保存すると、フロー図が自動生成されます。</p>
   {availableFlowSteps(configuring,membership).map(s=>{
    const required=requiredFlowSteps(configuring).includes(s);
    const d=drafts[rowKey(configuring)]??initialFlow(configuring);
    return <label key={s} className="flex min-h-11 items-center gap-3 border-b border-neutral-100 px-1 text-base"><input className="h-5 w-5" type="checkbox" checked={checked.includes(s)} disabled={required} onChange={e=>{const next=e.target.checked?[...checked,s]:checked.filter(x=>x!==s);if(e.target.checked){const available=availableFlowSteps(configuring,membership);const position=checked.findIndex(x=>available.indexOf(x)>available.indexOf(s));if(position>=0){next.pop();next.splice(position,0,s);}}setChecked(next);setMessage("");}}/>{stepLabel(s,configuring,d)}{required&&<span className="ml-auto text-sm text-neutral-500">必須</span>}</label>;
   })}
   <div className="flex flex-wrap gap-2"><button type="button" className={primary} disabled={saving||!ready} onClick={()=>void saveChecklist()}>{saving?"保存中…":"工程を保存してフロー図を作る"}</button></div>
  </section>}
  {target&&draft&&<section className="min-w-0 grid gap-4 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5" aria-label="選択中の募集工程">
   <div className="min-w-0 grid gap-2">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">募集フロー</p><button type="button" className={btn} onClick={()=>openChecklist(target)}>工程を再設定</button></div>
    <p className="text-sm text-neutral-600">工程を左右にドラッグして順番を変更できます。押すと編集欄が切り替わります。</p>
    <div className="min-w-0 overflow-x-auto rounded-xl bg-emerald-50 p-3" aria-label="募集の横型フロー図">
     <div className="flex w-max min-w-full items-center gap-2">
      {flowOrder(target,draft,membership).map((s,i,order)=><div key={s} className="flex shrink-0 items-center gap-2">
       {i>0&&<span aria-hidden="true" className="text-xl text-emerald-700">→</span>}
       <button type="button" draggable aria-pressed={step===s}
        aria-label={stepLabel(s,target,draft)+"を編集"}
        onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",s);setDrag({row:rowKey(target),step:s});}}
        onDragEnd={()=>setDrag(null)}
        onDragOver={e=>{if(drag?.row===rowKey(target)){e.preventDefault();e.dataTransfer.dropEffect="move";}}}
        onDrop={e=>{e.preventDefault();if(drag?.row===rowKey(target))void reorder(target,drag.step,s);setDrag(null);}}
        onClick={()=>{setSelection({id:rowKey(target),step:s});setMessage("");}}
        className={"min-h-12 cursor-grab whitespace-nowrap rounded-lg border px-4 py-2 text-base font-semibold active:cursor-grabbing "+(step===s?"border-emerald-800 bg-emerald-800 text-white":"border-emerald-300 bg-white text-emerald-950")+(drag?.row===rowKey(target)&&drag.step===s?" opacity-50":"")}>{stepLabel(s,target,draft)}</button>
      </div>)}
     </div>
    </div>
    {(()=>{const order=flowOrder(target,draft,membership),i=order.indexOf(step);return <div className="flex items-center justify-end gap-2"><button type="button" className={btn+" disabled:opacity-30"} disabled={i<=0} onClick={()=>void reorder(target,step,order[i-1])}>← 左へ</button><button type="button" className={btn+" disabled:opacity-30"} disabled={i<0||i===order.length-1} onClick={()=>void reorder(target,step,order[i+1])}>右へ →</button></div>;})()}
   </div>
   <div className="grid gap-3 border-t pt-4"><h3 className="text-lg font-bold">{stepLabel(step,target,draft)}の編集</h3>
   {target.kind!=="membership"&&step==="page"&&<div className="grid gap-2 text-base"><p>参加資格：{draft.audience==="members_only"?"事業への入会者限定":"一般の方も参加可能"}</p>{target.priceText&&<p>設計で決めた料金：{target.priceText}</p>}<button type="button" className={btn+" w-fit"} onClick={()=>onOpenDesign(target)}>設計で変更する</button></div>}
   <ClassRecruitmentStepEditor key={rowKey(target)+":"+step} step={step} target={target} draft={draft} onChange={update} onCommon={()=>openChecklist(shared)}/>
   {step!=="common"&&<div className="flex flex-wrap gap-2"><button type="button" className={primary} disabled={saving} onClick={()=>void save()}>{saving?"保存中…":"保存"}</button></div>}
   {step==="page"&&<details className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer py-2 text-base font-medium">募集内容を改善する（16項目）</summary><ClassSalesPanel key={rowKey(target)+":sales"} schoolId={schoolId} answers={emptySalesAnswers} revision={0} onSaved={()=>{}} draftKey={"class-page-sales:"+schoolId+":"+rowKey(target)} pageTitle={target.title}/></details>}
   {step!=="common"&&<details className="text-sm text-neutral-600"><summary className="min-h-11 cursor-pointer py-2">{step==="page"?"既存ページの編集・公開設定":"移行前の設定を確認する"}</summary><button type="button" className={btn} onClick={()=>onOpenLegacy(target,step)}>既存の設定を開く</button></details>}
   </div>
  </section>}
  {message&&<p role="status" className="rounded-lg bg-neutral-50 p-3 text-base">{message}</p>}
  </>}
 </section>;
}
