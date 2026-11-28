"use client";
import {useEffect,useState} from "react";
import {classRequest} from "@/lib/classRequests";
import {nextOperationSession,type OperationSession,type OperationPerson} from "@/lib/classOperationSchedule";
import {classEventEntryAttendance,classEventEntryReady,type ClassEvent,type ClassEventEntry} from "@/lib/classEvents";
import type {ClassRosterMember,SchoolClass} from "@/lib/classes";
import type {ServiceLabels} from "@/lib/classServiceLabels";
import ClassCalendarPanel from "@/components/parari/manage/ClassCalendarPanel";
import ClassAdmissionsPanel from "@/components/parari/manage/ClassAdmissionsPanel";
import ClassEventsPanel from "@/components/parari/manage/ClassEventsPanel";
const btn="min-h-11 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base font-medium";
const primary="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 text-base font-semibold text-white";
const panel="grid min-w-0 gap-3 rounded-xl border border-neutral-200 bg-white p-4";
const format=(at:string)=>new Intl.DateTimeFormat("ja-JP",{month:"long",day:"numeric",weekday:"short",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"}).format(new Date(at));
type View="home"|"schedule"|"session"|"admissions"|"roster"|"contact"|"events"|"workshops";
type Phase="before"|"during"|"after";
type Props={schoolId:string;classes:SchoolClass[];roster:ClassRosterMember[];labels:ServiceLabels;preview:boolean;onAccounting:()=>void;onRefresh:()=>void};
const phaseOf=(s:OperationSession):Phase=>Date.parse(s.startsAt)>Date.now()?"before":s.endsAt&&Date.parse(s.endsAt)<Date.now()||!s.endsAt&&s.day<new Date(Date.now()+9*3600000).toISOString().slice(0,10)?"after":"during";
async function loadPeople(s:OperationSession,signal:AbortSignal){
 if(s.kind==="class")return classRequest<{people:OperationPerson[];historical:boolean}>("/operations?class="+encodeURIComponent(s.serviceId)+"&day="+s.day,undefined,signal);
 const d=await classRequest<{event:ClassEvent;entries:ClassEventEntry[]}>("/events?event="+encodeURIComponent(s.serviceId),undefined,signal);
 return {historical:false,people:d.entries.map((e):OperationPerson=>({id:e.id,name:e.name,source:"event",absenceReported:false,actual:classEventEntryAttendance(e,s.kind==="workshop"?s.sessionAt:undefined),payment:e.payment_status,ready:classEventEntryReady(e,d.event.payment_method)||e.status==="confirmed"&&d.event.payment_method==="on_site"}))};
}
export default function ClassOperationWorkspace({schoolId,classes,roster,labels,preview,onAccounting,onRefresh}:Props){
 const [view,setView]=useState<View>("home"),[sessions,setSessions]=useState<OperationSession[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[refresh,setRefresh]=useState(0);
 const [nextPeople,setNextPeople]=useState<{id:string;people:OperationPerson[]}|null>(null),[nextPeopleError,setNextPeopleError]=useState("");
 const [selected,setSelected]=useState<OperationSession|null>(null),[phase,setPhase]=useState<Phase>("before"),[people,setPeople]=useState<OperationPerson[]|null>(null),[peopleError,setPeopleError]=useState(""),[historic,setHistoric]=useState(false);
 const [draftAttendance,setDraftAttendance]=useState<Record<string,"present"|"absent"|"clear">>({}),[savingAttendance,setSavingAttendance]=useState(false),[memo,setMemo]=useState(""),[message,setMessage]=useState(""),[search,setSearch]=useState(""),[contactIds,setContactIds]=useState<string[]>([]),[contactSubject,setContactSubject]=useState(""),[contactBody,setContactBody]=useState(""),[admissionMode,setAdmissionMode]=useState<"join"|"leave">("join"),[scheduleMode,setScheduleMode]=useState<"list"|"calendar">("list");
 useEffect(()=>{const c=new AbortController();setLoading(true);setError("");void classRequest<{sessions:OperationSession[]}>("/operations",undefined,c.signal).then(d=>{if(!c.signal.aborted){setSessions(d.sessions);setLoading(false);}}).catch(e=>{if(!c.signal.aborted){setError(e.message);setLoading(false);}});return()=>c.abort();},[schoolId,refresh]);
 useEffect(()=>{
  if(!selected)return;
  const c=new AbortController();setPeople(null);setPeopleError("");setHistoric(false);
  void loadPeople(selected,c.signal).then(d=>{if(!c.signal.aborted){setPeople(d.people);setHistoric(d.historical);}}).catch(e=>{if(!c.signal.aborted)setPeopleError(e.message);});
  return()=>c.abort();
 },[schoolId,selected,refresh]);
 const next=nextOperationSession(sessions,Date.now());
 useEffect(()=>{if(view!=="home"||!next)return;const c=new AbortController();setNextPeople(null);setNextPeopleError("");void loadPeople(next,c.signal).then(d=>{if(!c.signal.aborted)setNextPeople({id:next.id,people:d.people});}).catch(e=>{if(!c.signal.aborted)setNextPeopleError(e.message);});return()=>c.abort();},[schoolId,view,next?.id,refresh]);
 const nextRoster=nextPeople?.id===next?.id?nextPeople?.people:null;
 function open(s:OperationSession){setSelected(s);setPhase(phaseOf(s));setDraftAttendance({});setMemo("");setMessage("");setView("session");}
 function home(){setView("home");setSelected(null);setMessage("");setSearch("");}
 function contact(ids:string[]){setContactIds(ids);setContactSubject("");setContactBody("");setMessage("");setView("contact");}
 async function saveAttendance(){
  if(!selected||selected.kind!=="class"||!people)return;
  const records=Object.entries(draftAttendance).map(([enrollmentId,status])=>({enrollmentId,actual:status==="clear"?null:status}));
  if(!records.length){setMessage("保存する出欠を選択してください。");return;}
  setSavingAttendance(true);setMessage("");
  try{
   await classRequest("/operations",{classId:selected.serviceId,day:selected.day,records});
   setDraftAttendance({});setMessage("出欠を保存しました。");setRefresh(v=>v+1);onRefresh();
  }catch(e){setMessage(e instanceof Error?e.message:"出欠を保存できませんでした。");}
  finally{setSavingAttendance(false);}
 }
 const actual=(p:OperationPerson)=>draftAttendance[p.id]===undefined?p.actual:draftAttendance[p.id]==="clear"?null:draftAttendance[p.id];
 const absent=(people??[]).filter(p=>p.absenceReported||actual(p)==="absent");
 const notArrived=(people??[]).filter(p=>!p.absenceReported&&!actual(p)&&p.ready!==false);
 const eligible=(people??[]).filter(p=>p.ready!==false&&!p.absenceReported&&actual(p)!=="absent");
 const counts=people?{planned:eligible.length,absent:absent.length,unmarked:people.filter(p=>p.ready!==false&&!p.absenceReported&&!actual(p)).length}:null;
 const title=view==="admissions"?"入退会受付":view==="roster"?"名簿一覧":view==="contact"?"参加者への連絡":view==="schedule"?"開催予定":view==="events"?labels.event+"の受付":view==="workshops"?labels.workshop+"の受付":selected?.title;
 const menu=[["admissions","入退会受付","申込・退会の確認"],["roster","名簿一覧","在籍・参加者"],["accounting","会計記録","入金・売上"],["contact","参加者への連絡","個別・一斉連絡"]] as const;
 const recipientList=selected&&people?people:roster.filter(r=>r.status==="active");
 return <div className="grid min-w-0 gap-4">
  {view==="home"?<>
   <section className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
    <h2 className="text-lg font-bold text-emerald-950">次の開催</h2>
    {loading?<p role="status">開催予定を確認しています…</p>:error?<p role="alert" className="text-red-800">{error}</p>:next?<><p className="text-xl font-bold">{next.title}</p><p className="text-base">{format(next.startsAt)}{next.endsAt?" 〜 "+new Date(next.endsAt).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"}):""}</p>{next.location&&<p>{next.location}</p>}{!next.confirmed&&<p className="text-sm text-neutral-600">定期開催の設定に基づく予定（未確定）</p>}{nextRoster?<div className="grid grid-cols-3 gap-2 text-center">{[["出席予定",nextRoster.filter(p=>p.ready!==false&&!p.absenceReported&&p.actual!=="absent").length],["欠席連絡・欠席",nextRoster.filter(p=>p.absenceReported||p.actual==="absent").length],["出欠未記録",nextRoster.filter(p=>p.ready!==false&&!p.absenceReported&&!p.actual).length]].map(([label,n])=><div key={label} className="rounded-lg bg-white p-2"><strong className="block text-2xl">{n}</strong><span className="text-sm">{label}</span></div>)}</div>:<p className="text-sm text-neutral-600">{nextPeopleError?"参加予定者を取得できませんでした。":"参加予定者を確認しています…"}</p>}<button type="button" className={primary} onClick={()=>open(next)}>この開催の運営画面を開く　›</button></>:<p>今後90日以内の開催予定はありません。</p>}
    <div className="flex flex-wrap justify-between gap-2"><button type="button" className={btn} onClick={()=>{setView("schedule");setScheduleMode("list");}}>開催予定を見る</button><button type="button" className={btn} onClick={()=>setRefresh(v=>v+1)}>更新</button></div>
   </section>
   <div className="grid grid-cols-2 gap-2">{menu.map(([id,label,desc])=><button key={id} className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border bg-white p-3 text-center" type="button" onClick={()=>{if(id==="accounting")onAccounting();else if(id==="contact")contact([]);else setView(id);}}><strong className="text-lg">{label}</strong><span className="text-sm text-neutral-600">{desc}</span></button>)}</div>
  </>:<>
   <div className="flex flex-wrap items-center gap-3"><button type="button" className={btn} onClick={(view==="contact"||view==="events"||view==="workshops")&&selected?()=>{setView("session");setMessage("");}:home}>{(view==="contact"||view==="events"||view==="workshops")&&selected?"‹ 開催の運営に戻る":"‹ 運営に戻る"}</button><h2 className="flex-1 text-xl font-bold">{title}</h2></div>
   {view==="schedule"&&<section className={panel}>
    <div className="flex flex-wrap gap-2"><button type="button" className={btn} aria-pressed={scheduleMode==="list"} onClick={()=>setScheduleMode("list")}>開催一覧</button><button type="button" className={btn} aria-pressed={scheduleMode==="calendar"} onClick={()=>setScheduleMode("calendar")}>カレンダー設定</button></div>
    {scheduleMode==="calendar"?<ClassCalendarPanel classes={classes} onSaved={()=>{setRefresh(v=>v+1);onRefresh();}}/>:<>{loading?<p>読み込み中…</p>:error?<p role="alert">{error}</p>:<>
    <h3 className="font-bold">今後の開催</h3>{sessions.filter(s=>Date.parse(s.startsAt)>=Date.now()||s.endsAt&&Date.parse(s.endsAt)>Date.now()).slice(0,30).map(s=><button key={s.id} type="button" className={btn+" text-left"} onClick={()=>open(s)}>{format(s.startsAt)}　{s.title}{!s.confirmed?"（予定）":""}</button>)}
    <details><summary className="min-h-11 cursor-pointer py-2 font-medium">過去30日の開催を見る</summary>{sessions.filter(s=>Date.parse(s.startsAt)<Date.now()&&(!s.endsAt||Date.parse(s.endsAt)<=Date.now())).reverse().map(s=><button key={s.id} type="button" className={btn+" mb-1 block w-full text-left"} onClick={()=>open(s)}>{format(s.startsAt)}　{s.title}</button>)}</details></>}</>}
   </section>}
   {view==="session"&&selected&&<section className={panel}>
    <p>{format(selected.startsAt)}{selected.location?" ・ "+selected.location:""}</p>
    <div className="grid grid-cols-3 gap-1 rounded-lg bg-neutral-100 p-1">{([["before","開催前"],["during","開催中"],["after","開催後"]] as const).map(([id,label])=><button key={id} type="button" aria-pressed={phase===id} className={"min-h-11 rounded-md px-1 text-base font-semibold "+(phase===id?"bg-emerald-800 text-white":"")} onClick={()=>{setPhase(id);setMessage("");}}>{label}</button>)}</div>
    {peopleError?<p role="alert" className="text-red-800">{peopleError}</p>:!people?<p role="status">参加者を確認しています…</p>:<>
     {historic&&<p className="text-sm text-neutral-600">過去の開催は保存済みの予約・出欠記録を表示します。当時の全名簿は復元していません。</p>}
     <div className="grid grid-cols-3 gap-2 text-center">{[["出席予定",counts?.planned],["欠席連絡・欠席",counts?.absent],["出欠未記録",counts?.unmarked]].map(([label,n])=><div key={label} className="rounded-lg bg-neutral-50 p-2"><strong className="block text-2xl">{n}</strong><span className="text-sm">{label}</span></div>)}</div>
     <h3 className="font-bold">{phase==="before"?"参加予定・欠席連絡":phase==="during"?"出欠確認":"出欠記録の確認"}</h3>
     {phase==="during"&&selected.kind==="class"&&(preview?<p role="status" className="text-sm text-amber-800">開発プレビューでは出欠を保存できません。隔離されたテスト環境でお試しください。</p>:<p className="text-sm text-neutral-600">出欠を変更したら、保存ボタンを押してください。</p>)}
     {!people.length&&<p>該当する参加者・記録はありません。</p>}
     {people.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2"><div><strong>{p.name}</strong><p className="text-sm text-neutral-600">{p.source==="reserved"?"予約済み":p.source==="fixed"?"固定受講":p.ready===false?"参加未確定":p.source==="event"?"申込者":"記録あり"}{p.absenceReported?" ・ 欠席連絡済み":""}{p.payment==="unpaid"?" ・ 未入金":""}</p></div>{phase==="during"&&selected.kind==="class"?<select aria-label={p.name+"の出欠"} className={btn} value={actual(p)??"clear"} onChange={e=>setDraftAttendance(old=>({...old,[p.id]:e.target.value as "present"|"absent"|"clear"}))}><option value="clear">未記録</option><option value="present">出席</option><option value="absent">欠席</option></select>:<span>{actual(p)==="present"?"出席":actual(p)==="absent"?"欠席":"未記録"}</span>}</div>)}
     {phase==="before"&&<div className="flex flex-wrap gap-2"><button type="button" className={btn} disabled={!eligible.length} onClick={()=>contact(eligible.map(p=>p.id))}>参加予定者に連絡</button><button type="button" className={btn} disabled={!absent.length} onClick={()=>contact(absent.map(p=>p.id))}>欠席者に連絡</button></div>}
     {phase==="during"&&<div className="flex flex-wrap gap-2">{selected.kind==="class"&&<button type="button" className={primary} disabled={preview||!Object.keys(draftAttendance).length||savingAttendance} onClick={()=>void saveAttendance()}>{preview?"プレビューでは保存できません":savingAttendance?"保存中…":"出欠を保存"}</button>}<button type="button" className={btn} disabled={!notArrived.length} onClick={()=>contact(notArrived.map(p=>p.id))}>未到着者に連絡</button>{selected.kind!=="class"&&<button type="button" className={btn} onClick={()=>setView(selected.kind==="event"?"events":"workshops")}>既存のQR受付・出欠を開く</button>}</div>}
     {phase==="after"&&<><label className="grid gap-1">運営メモ（確認用）<textarea rows={3} className={btn} value={memo} onChange={e=>setMemo(e.target.value)} placeholder="実施内容・次回への引き継ぎ"/></label><div className="flex flex-wrap gap-2"><button type="button" className={btn} onClick={onAccounting}>会計記録を開く</button><button type="button" className={btn} disabled={!people.length} onClick={()=>contact(people.filter(p=>p.ready!==false).map(p=>p.id))}>参加者へフォロー連絡</button></div><p className="text-sm text-neutral-600">出欠の確定・運営メモの永続保存は未接続です。</p></>}
    </>}
   </section>}
   {(view==="events"||view==="workshops")&&selected&&<ClassEventsPanel key={selected.id} classes={classes} roster={roster} labels={labels} kind={selected.kind==="workshop"?"workshop":"event"} mode="operation" initialEventId={selected.serviceId} initialSessionAt={selected.sessionAt} onBack={()=>setView("session")} onChanged={()=>setRefresh(v=>v+1)} readOnly={preview}/>}
   {view==="admissions"&&<section className={panel}><div className="grid grid-cols-2 gap-2"><button type="button" className={btn} aria-pressed={admissionMode==="join"} onClick={()=>setAdmissionMode("join")}>入会受付</button><button type="button" className={btn} aria-pressed={admissionMode==="leave"} onClick={()=>setAdmissionMode("leave")}>退会受付</button></div>{admissionMode==="join"?<ClassAdmissionsPanel key={schoolId+":admissions"} mode="admissions" onRosterChanged={onRefresh}/>:<p>退会申請・退会日の計算・運営者確認・請求停止を連動させる設計です。退会受付はまだ接続していません。</p>}</section>}
   {view==="roster"&&<section className={panel}><label className="grid gap-1">氏名で検索<input className={btn} value={search} onChange={e=>setSearch(e.target.value)}/></label>{roster.filter(r=>r.name.includes(search)).map(r=><div key={r.id} className="flex flex-wrap justify-between gap-2 border-b py-2"><div><strong>{r.name}</strong><p className="text-sm">{r.status==="active"?"在籍中":"終了"} ・ {(r.assignments??[]).map(a=>classes.find(c=>c.id===a.class_id)?.name).filter(Boolean).join("、")||"開催枠なし"}</p></div>{r.status==="active"&&<button type="button" className={btn} onClick={()=>contact([r.id])}>連絡</button>}</div>)}<p className="text-sm text-neutral-600">継続サービスの名簿です。イベントの参加者は開催画面で確認できます。</p></section>}
   {view==="contact"&&<section className={panel}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">宛先（{contactIds.length}人）</h3><button type="button" className={btn} onClick={()=>setContactIds(contactIds.length?[]:recipientList.map(p=>p.id))}>{contactIds.length?"選択解除":"全員選択"}</button></div><div className="max-h-56 overflow-y-auto">{recipientList.map(p=><label key={p.id} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={contactIds.includes(p.id)} onChange={e=>setContactIds(old=>e.target.checked?[...old,p.id]:old.filter(id=>id!==p.id))}/>{p.name}</label>)}</div><label className="grid gap-1">件名<input className={btn} value={contactSubject} onChange={e=>setContactSubject(e.target.value)}/></label><label className="grid gap-1">本文<textarea className={btn} rows={5} value={contactBody} onChange={e=>setContactBody(e.target.value)}/></label><button type="button" className={btn} disabled={!contactIds.length||!contactBody.trim()} onClick={()=>setMessage("宛先と本文を確認しました。送信機能は未接続です。")}>内容を確認</button><p className="text-sm text-neutral-600">実際の連絡は送信しません。送信前の確認画面です。</p></section>}
   {message&&<p role="status">{message}</p>}
  </>}
 </div>;
}
