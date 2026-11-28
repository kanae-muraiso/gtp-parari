"use client";
import {useEffect,useState} from "react";
import type {ServiceKind} from "@/lib/classBusinessModel";
type Flow={audience:"everyone"|"members_only";route:"direct"|"briefing";confirmation:"automatic"|"review";terms:string;payment:"free"|"before"|"onsite"|"recurring"};
const initial=(kind:ServiceKind):Flow=>({audience:"everyone",route:"direct",confirmation:kind==="course"?"review":"automatic",terms:"",payment:kind==="course"?"recurring":"free"});
export default function ClassServiceIntakeDesignPanel({schoolId,kind,serviceId,title,membership}:{schoolId:string;kind:ServiceKind;serviceId:string;title:string;membership:boolean}){
 const key="class-intake-design:"+schoolId+":"+kind+":"+serviceId;
 const [draft,setDraft]=useState<Flow>(()=>initial(kind)),[message,setMessage]=useState("");
 useEffect(()=>{
  try{const v=JSON.parse(sessionStorage.getItem(key)??"null") as Flow|null;if(v&&["everyone","members_only"].includes(v.audience)&&["direct","briefing"].includes(v.route)&&["automatic","review"].includes(v.confirmation)&&typeof v.terms==="string"&&v.terms.length<=8000&&["free","before","onsite",...(kind==="course"?["recurring"]:[])].includes(v.payment))setDraft(v);else setDraft(initial(kind));}catch{setDraft(initial(kind));}
  setMessage("");
 },[key,kind]);
 const select="min-h-11 w-full rounded-lg border border-neutral-300 bg-white p-2 text-base";
 const invalid=draft.audience==="members_only"&&!membership;
 function save(){
  if(invalid)return;
  try{sessionStorage.setItem(key,JSON.stringify(draft));setMessage("このサービスの設計案を、このブラウザ内に保存しました。");}catch{setMessage("ブラウザ内への保存に失敗しました。");}
 }
 return <section className="grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
  <h3 className="text-xl font-bold">{title} の申込導線（設計案）</h3>
  <p className="text-base text-neutral-700">本番の申込設定は変更しません。このサービスだけの導線を組み立てて確認できます。</p>
  <label className="grid gap-1 text-base font-medium">参加対象<select className={select} value={draft.audience} onChange={e=>setDraft(old=>({...old,audience:e.target.value as Flow["audience"]}))}><option value="everyone">一般の方も申込可能</option><option value="members_only" disabled={!membership}>事業への入会者限定</option></select></label>
  {invalid&&<p className="text-base text-red-800">入会制度を設けない事業では、会員限定を選択できません。</p>}
  <label className="grid gap-1 text-base font-medium">申込方法<select className={select} value={draft.route} onChange={e=>setDraft(old=>({...old,route:e.target.value as Flow["route"]}))}><option value="direct">直接申し込む</option><option value="briefing">説明会・体験を経て申し込む</option></select></label>
  <label className="grid gap-1 text-base font-medium">規約・同意（任意）<textarea className={select} rows={3} maxLength={8000} value={draft.terms} onChange={e=>setDraft(old=>({...old,terms:e.target.value}))}/></label>
  <label className="grid gap-1 text-base font-medium">支払い<select className={select} value={draft.payment} onChange={e=>setDraft(old=>({...old,payment:e.target.value as Flow["payment"]}))}><option value="free">無料</option><option value="before">事前払い</option><option value="onsite">当日払い</option>{kind==="course"&&<option value="recurring">月謝・継続払い</option>}</select></label>
  <label className="grid gap-1 text-base font-medium">参加の確定<select className={select} value={draft.confirmation} onChange={e=>setDraft(old=>({...old,confirmation:e.target.value as Flow["confirmation"]}))}><option value="review">運営者が確認して確定</option><option value="automatic">必要な手続きの完了後に自動確定</option></select></label>
  <div className="grid gap-2 rounded-xl bg-white p-3">
   <p className="font-bold">参加者から見た流れ</p>
   {[...(draft.audience==="members_only"?["事業の会員資格を確認"]:[]),...(draft.route==="briefing"?["説明会・体験"]:[]),"このサービスに申し込む",...(draft.terms.trim()?["規約への同意"]:[]),...(draft.confirmation==="review"?["運営者の確認"]:[]),...(draft.payment==="before"||draft.payment==="recurring"?["決済手続き"]:[]),"参加確定・案内",...(draft.payment==="onsite"?["当日払い"]:[])].map((step,i)=><div key={step} className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-base"><span className="font-bold text-emerald-800">{i+1}</span>{step}</div>)}
  </div>
  <button type="button" disabled={invalid} onClick={save} className="min-h-12 rounded-xl bg-emerald-800 px-4 text-base font-semibold text-white disabled:opacity-50">このサービスの設計案を保存</button>
  {message&&<p role="status" className="text-base text-emerald-900">{message}</p>}
 </section>;
}
