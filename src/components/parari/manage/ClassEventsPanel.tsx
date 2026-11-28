"use client";

import { useEffect, useState, type FormEvent } from "react";
import { classRequest } from "@/lib/classRequests";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { starterClassEventPageSsot } from "@/lib/classEventPage";
import ClassEventSchedule from "./ClassEventSchedule";
import ClassEventEntrance from "./ClassEventEntrance";
import { classEventDate, classEventLabels, classEventEntryAttendance, classEventEntryReady, classEventEntryMatches, type ClassEventEntryFilter, maxWorkshopSessions, type ClassEventKind, type ClassEvent, type ClassEventEntry } from "@/lib/classEvents";
import type { ClassRosterMember, SchoolClass } from "@/lib/classes";

const input = "min-h-11 w-full rounded-lg border border-neutral-300 px-3 py-2 text-base";
const button = "w-fit min-h-11 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base disabled:opacity-50";
const primary = "w-fit min-h-11 rounded-lg bg-neutral-900 px-4 py-2 text-base font-bold text-white disabled:opacity-50";
const localDate = (value: string) => new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 16);
const eventPath = (id: string) => "/events?event=" + encodeURIComponent(id);
const statuses = { draft: "下書き", open: "公開中", closed: "受付終了" };
const audiences = { members: "在籍者のみ", public: "一般のみ", mixed: "在籍者と一般" };
const paymentLabels = { none: "無料", on_site: "当日払い", payment_link: "外部決済リンク", parari: "PARARI内Square決済（販売手数料5％）" };

type Detail = { event: ClassEvent; entries: ClassEventEntry[]; eventPageId?: string | null };

export default function ClassEventsPanel({ classes, roster, kind, mode="all", initialCreate=false, initialEventId, onChanged, onBack }: { classes: SchoolClass[]; roster: ClassRosterMember[]; kind: ClassEventKind; mode?:"all"|"design"|"recruit"|"operation"; initialCreate?:boolean; initialEventId?:string; onChanged?:()=>void; onBack?:()=>void }) {
  const label = classEventLabels[kind];
  const [sessionAt, setSessionAt] = useState("");
  const [events, setEvents] = useState<ClassEvent[]>([]);
  const [canCreateEvents, setCanCreateEvents] = useState(false);
  const [pageBusy,setPageBusy]=useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [editing, setEditing] = useState(initialCreate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [entryFilter, setEntryFilter] = useState<ClassEventEntryFilter>("all");
  const [entrySearch, setEntrySearch] = useState("");
  const [liveRefresh, setLiveRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number|null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void classRequest<{ events: ClassEvent[]; canCreateEvents: boolean }>("/events?kind=" + kind, undefined, controller.signal)
      .then(data => {setEvents(data.events);setCanCreateEvents(data.canCreateEvents===true);}).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [kind, refresh]);

  async function open(id: string) {
    setError("");
    setNotice("");
    setSessionAt("");
    setEntryFilter("all"); setEntrySearch(""); setLiveRefresh(false); setLastUpdated(null); setRefreshFailed(false);
    setBusy(true);
    try { setDetail(await classRequest<Detail>(eventPath(id))); setLastUpdated(Date.now()); setEditing(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : label + "を開けませんでした。"); }
    finally { setBusy(false); }
  }

  useEffect(()=>{if(initialEventId)void open(initialEventId);},[initialEventId]);

  async function change(body: object, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { id, notice } = await classRequest<{ id: string; notice?: string }>("/events", body);
      setDetail(await classRequest<Detail>(eventPath(id)));
      setLastUpdated(Date.now()); setRefreshFailed(false);
      setEditing(false);
      setRefresh(value => value + 1);
      setNotice(notice ?? message);
      onChanged?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : label + "を更新できませんでした。"); }
    finally { setBusy(false); }
  }

  async function createEventPage(){
    if(!event||pageBusy||!canCreateEvents)return;
    setPageBusy(true);setError("");setNotice("");
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw new Error("ログインしてください。");
      const result=await fetch("/api/works/create",{
        method:"POST",cache:"no-store",
        headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
        body:JSON.stringify({
          createRequestId:crypto.randomUUID(),
          stableSlug:"class-event-page-"+crypto.randomUUID().slice(0,12),
          template:{kind:"page",initialTitle:event.title,
            ssot:starterClassEventPageSsot(event.title,event.id,event.description??"")}
        })
      });
      const created=await result.json();
      if(!result.ok||!created.ok||!created.id)throw new Error(created.message||"PAGEを作成できませんでした。");
      try{
        await classRequest("/events",{action:"bindPage",id:event.id,workId:created.id});
        setDetail(await classRequest<Detail>(eventPath(event.id)));
        setNotice("専用PAGEを作成して関連付けました。文章・写真はPARARIエディタで編集できます。");
      }catch(cause){
        setError("PAGEは作成されましたが関連付けは未完了です。重複して作らず、作品リストからご確認ください。"+
          (cause instanceof Error?cause.message:""));
      }
    }catch(cause){setError(cause instanceof Error?cause.message:"PAGEを作成できませんでした。");}
    finally{setPageBusy(false);}
  }
  const event = detail?.event;
  const selectedSession = sessionAt || event?.class_event.sessions?.[0]?.startsAt;
  const eventId = event?.id;
  const eventStatus = event?.status;
  useEffect(() => {
    if (!liveRefresh || !eventId || eventStatus === "draft" || editing || busy || pageBusy) return;
    const controller = new AbortController();
    let running = false;
    async function refreshRoster() {
      if (running || document.hidden || controller.signal.aborted || !eventId) return;
      running = true;
      try {
        const next = await classRequest<Detail>(eventPath(eventId), undefined, controller.signal);
        if (!controller.signal.aborted) {
          setDetail(current => current?.event.id === eventId ? next : current);
          setLastUpdated(Date.now()); setRefreshFailed(false);
        }
      } catch { if (!controller.signal.aborted) setRefreshFailed(true); }
      finally { running = false; }
    }
    const timer = window.setInterval(() => void refreshRoster(), 5000);
    void refreshRoster();
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [eventId, eventStatus, liveRefresh, editing, busy, pageBusy]);
  async function refreshRosterNow(id: string) {
    try {
      const next = await classRequest<Detail>(eventPath(id));
      setDetail(current => current?.event.id === id ? next : current);
      setLastUpdated(Date.now()); setRefreshFailed(false);
    } catch { setRefreshFailed(true); }
  }
  const visibleEntries = event && detail
    ? detail.entries.filter(entry => classEventEntryMatches(entry,event.payment_method,selectedSession,entryFilter,entrySearch))
    : [];

  return <section className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">{kind==="workshop"?"短期講習会":label}{mode==="design"?"の設計":mode==="recruit"?"の募集":mode==="operation"?"の受付・運営":""}</h2>
      {event || editing
        ? <button className={button} disabled={busy} onClick={() => { setLiveRefresh(false); setDetail(null); setEditing(false); setNotice(""); setError(""); onBack?.(); }}>{onBack?"事業の構成図に戻る":label+"一覧に戻る"}</button>
        : mode==="all"||mode==="design"?<button className={primary} disabled={busy||!canCreateEvents} onClick={() => { setEditing(true); setError(""); setNotice(""); }}>新規作成</button>:null}
    </header>
    {!canCreateEvents&&<p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
      CLASS Aではイベント・講習会の新規作成・公開はできません。CLASS Bで利用できます。
      過去の開催記録は引き続き確認できます。
    </p>}
    {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    {notice && <p className="text-sm text-green-800" role="status">{notice}</p>}
    {editing && canCreateEvents && (mode==="all"||mode==="design") ? <EventForm key={event?.id ?? "new"} kind={kind} event={event} classes={classes} busy={busy} onSave={values =>
      void change({ ...values, id: event?.id, kind, action: "save" }, "下書きを保存しました。")} /> : event && detail ? <>
      <article className="grid gap-2 rounded-xl border p-4" aria-label="参加者向けプレビュー">
        <p className="text-sm text-neutral-600">{statuses[event.status]} · {audiences[event.class_event.audience]}</p>
        <h3 className="text-lg font-semibold">{event.title}</h3>
        <ClassEventSchedule settings={event.class_event} />
        {event.description && <p className="whitespace-pre-wrap text-sm">{event.description}</p>}
        <p className="text-sm">{paymentLabels[event.payment_method]}{event.payment_amount && ` · ${event.payment_amount.toLocaleString("ja-JP")}円`}</p>
        {event.class_event.registration ? <p className="text-sm">申込締切 {classEventDate(event.class_event.deadline)}{event.definition.capacity && ` · 定員 ${event.definition.capacity}人`}</p> : <p className="text-sm">申込不要</p>}
      </article>
      <div className="flex flex-wrap gap-2">
        {(mode==="all"||mode==="design")&&event.status === "draft" && <button className={button} disabled={busy||!canCreateEvents} onClick={() => setEditing(true)}>下書きを編集</button>}
        {(mode==="all"||mode==="recruit")&&(event.status === "open"
          ? <button className={button} disabled={busy} onClick={() => void change({ id: event.id, action: "close" }, "受付を終了しました。")}>受付を終了</button>
          : <button className={primary} disabled={busy||!canCreateEvents} onClick={() => void change({ id: event.id, action: "publish" }, label + "を公開しました。")}>{event.status === "draft" ? "公開する" : "受付を再開"}</button>)}
        {event.status !== "draft" && <a className={button} href={`/class-event/${event.id}`} target="_blank" rel="noreferrer">案内ページを開く</a>}
        {(mode==="all"||mode==="recruit")&&event.status === "open" && event.class_event.audience !== "public" && Date.parse(event.class_event.startsAt) > Date.now() &&
          <button className={button} disabled={busy} onClick={() => {
            if (window.confirm(`対象の保護者に${label}の案内をメールで送りますか？`))
              void change({ id: event.id, action: "notifyGuardians" }, "保護者に案内を送りました。");
          }}>保護者に案内を送る</button>}
        {(mode==="all"||mode==="recruit")&&event.status === "open" && event.class_event.audience !== "members" && <button className={button} disabled={busy} onClick={() =>
          void navigator.clipboard.writeText(new URL(`/class-event/${event.id}`, window.location.origin).href)
            .then(() => setNotice("案内URLをコピーしました。")).catch(() => setError("案内ページを開き、アドレスをコピーしてください。"))}>案内URLをコピー</button>}
      </div>
      {(mode==="all"||mode==="recruit")&&<section className="rounded-xl border border-neutral-200 p-4">
        <h4 className="font-semibold">PARARI作品で魅力を伝える（任意）</h4>
        <p className="mt-1 text-sm text-neutral-600">紹介文・写真を編集できるイベント専用PAGEです。日時・費用・定員・申込はCLASSの設定から自動表示されます。</p>
        {detail.eventPageId ? <Link href={"/editor-v2/"+detail.eventPageId} className={button+" mt-3 inline-block"}>紹介PAGEを編集する</Link>
          : <button className={button+" mt-3"} disabled={pageBusy||!canCreateEvents} onClick={()=>void createEventPage()}>
            {pageBusy?"作成中…":"このイベントの紹介PAGEを作る"}</button>}
        {detail.eventPageId&&<p className="mt-2 text-xs text-neutral-600">PAGEを一般公開にすると、イベントの申込ページに本文が表示されます。</p>}
      </section>}
      {(mode==="all"||mode==="operation")&&event.status !== "draft" && <section className="grid gap-3 border-t pt-4">
        <h3 className="text-lg font-semibold">参加者・受付状況</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-neutral-50 p-2"><p className="text-base">申込</p><strong className="text-2xl">{detail.entries.length}</strong></div>
          <div className="rounded-xl bg-neutral-50 p-2"><p className="text-base">参加確定</p><strong className="text-2xl">{detail.entries.filter(e=>classEventEntryReady(e,event.payment_method)).length}</strong></div>
          <div className="rounded-xl bg-emerald-50 p-2"><p className="text-base">出席</p><strong className="text-2xl">{detail.entries.filter(e=>classEventEntryAttendance(e,selectedSession)==="present").length}</strong></div>
        </div>
        {event.class_event.registration&&canCreateEvents&&<ClassEventEntrance key={event.id+":"+(selectedSession??event.class_event.startsAt)} eventId={event.id} sessionAt={selectedSession??event.class_event.startsAt} onRefresh={()=>void refreshRosterNow(event.id)}/>}
        {event.payment_method!=="parari"&&<form className="flex flex-wrap items-end gap-2" onSubmit={e => {
          e.preventDefault();
          const memberId = new FormData(e.currentTarget).get("memberId");
          void change({ id: event.id, action: "add", memberId }, "在籍者を追加しました。");
        }}>
          <label className="grid gap-1 text-sm">名簿から追加<select name="memberId" className={input} required defaultValue="">
            <option value="">在籍者を選択</option>
            {roster.filter(member => member.status === "active" && (!event.class_event.classIds.length ||
              member.assignments?.some(assignment => event.class_event.classIds.includes(assignment.class_id))))
              .map(member => <option value={member.id} key={member.id}>{member.name}</option>)}
          </select></label>
          <button className={button} disabled={busy}>追加</button>
        </form>}
        <div className="grid gap-2 rounded-xl bg-neutral-50 p-3">
          <label className="flex min-h-11 items-center gap-3 text-base"><input type="checkbox" className="h-5 w-5" checked={liveRefresh} onChange={e=>setLiveRefresh(e.target.checked)}/> 来場状況を自動更新（5秒間隔）</label>
          <p className="text-sm text-neutral-700" role="status">{refreshFailed?"更新に失敗しました。再読み込みしてください。":lastUpdated?"最終更新 "+new Date(lastUpdated).toLocaleTimeString("ja-JP"):"更新時刻を確認中"}</p>
          <label className="grid gap-1 text-base">参加者検索<input className={input+" min-h-11 text-base"} value={entrySearch} onChange={e=>setEntrySearch(e.target.value)} placeholder="氏名・申込番号"/></label>
          <label className="grid gap-1 text-base">表示する参加者<select className={input+" min-h-11 text-base"} value={entryFilter} onChange={e=>setEntryFilter(e.target.value as ClassEventEntryFilter)}>
            <option value="all">全員</option><option value="ready">参加確定</option><option value="unpaid">未入金</option><option value="present">出席済み</option><option value="notPresent">未出席</option>
          </select></label>
          <p className="text-base">{visibleEntries.length} / {detail.entries.length}人</p>
        </div>
        {!detail.entries.length && <p className="text-base text-neutral-600">参加者はまだいません。</p>}
        {detail.entries.length>0&&!visibleEntries.length&&<p className="text-base text-neutral-600">条件に合う参加者はいません。</p>}
        {event.class_event.sessions && <label className="grid max-w-sm gap-1 text-sm">
          出欠を記録する開催回
          <select className={input} value={selectedSession} onChange={e => setSessionAt(e.target.value)} disabled={busy}>
            {event.class_event.sessions.map((session, index) => <option key={session.startsAt} value={session.startsAt}>
              第{index + 1}回 · {classEventDate(session.startsAt)}
            </option>)}
          </select>
        </label>}
        {visibleEntries.map(entry => <div key={entry.id} className="flex flex-wrap items-center gap-3 border-t py-3 text-base">
          <strong>{entry.name}</strong>
          <label className="flex items-center gap-2">出欠<select className={input} disabled={busy}
            value={classEventEntryAttendance(entry,selectedSession) ?? "clear"}
            onChange={e => void change({ id: event.id, action: "entry", entryId: entry.id, sessionAt: selectedSession, change: e.target.value }, "出欠を更新しました。")}>
            <option value="clear">未記録</option><option value="present">出席</option><option value="absent">欠席</option>
          </select></label>
          {entry.payment_status === "unpaid" && event.payment_method !== "parari" && <button className={button} disabled={busy}
            onClick={() => void change({ id: event.id, action: "entry", entryId: entry.id, change: "paid" }, "入金を記録しました。")}>入金を記録</button>}
          {entry.payment_status === "paid" && <span className="text-green-800">入金済み</span>}
          {entry.payment_status === "not_required" && <span>無料</span>}
          {entry.payment_status === "unpaid" && <span className="text-amber-800">未入金</span>}
          {entry.status !== "confirmed" && <span className="text-neutral-600">参加未確定</span>}
        </div>)}
      </section>}
    </> : <>
      {!events.some(item=>mode!=="operation"||item.status!=="draft") && <p className="text-sm text-neutral-600">{label}はまだありません。</p>}
      {events.filter(item=>mode!=="operation"||item.status!=="draft").map(item => <button key={item.id} type="button" disabled={busy} className="grid gap-1 rounded-lg border p-3 text-left hover:border-neutral-500"
        onClick={() => void open(item.id)}><strong>{item.title}</strong><span className="text-sm text-neutral-600">{classEventDate(item.class_event.startsAt)} · {item.class_event.sessions && `全${item.class_event.sessions.length}回 · `}{statuses[item.status]}</span></button>)}
    </>}
  </section>;
}

function EventForm({ kind, event, classes, busy, onSave }: {
  kind: ClassEventKind; event?: ClassEvent; classes: SchoolClass[]; busy: boolean; onSave: (values: object) => void;
}) {
  const defaults = event?.class_event;
  const workshop = kind === "workshop";
  const [rows, setRows] = useState(() => (defaults?.sessions ?? [{ startsAt: "", location: "" }])
    .map((row, index) => ({ ...row, key: String(index) })));
  const [audience, setAudience] = useState(defaults?.audience ?? "members");
  const [registration, setRegistration] = useState(defaults?.registration ?? true);
  const [payment, setPayment] = useState(event?.payment_method ?? "none");

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    onSave({ ...Object.fromEntries(data), ...(workshop ? { sessions: rows.map(row => ({
      startsAt: data.get("start-" + row.key), location: data.get("location-" + row.key),
    })) } : {}), classIds: data.getAll("classId"), registration, audience, payment });
  }

  const steps=[
    ["○","案内・日時","event-content"],["◎","申込・定員","event-registration"],
    ["△","費用","event-payment"],["※","開催・出欠","event-operation"]
  ] as const;
  return <form className="grid gap-4 text-base" onSubmit={submit}>
    <nav className="flex flex-wrap items-center gap-2 rounded-xl bg-neutral-50 p-3" aria-label="イベント申込フロー">
      {steps.map(([symbol,label,id],i)=><div key={id} className="flex items-center gap-2">
        {i>0&&<span aria-hidden className="text-neutral-500">→</span>}
        <button type="button" className={button} onClick={()=>{
          document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"center"});
        }}>{symbol} {label}</button>
      </div>)}
    </nav>
    <p className="text-xs text-neutral-600">工程を押すと、その設定欄へ移動します。※開催・出欠は公開後に管理します。</p>
    <div id="event-content" className="grid gap-3 scroll-mt-24">
    <label className="grid gap-1">{classEventLabels[kind]}名<input className={input} name="title" required maxLength={120} defaultValue={event?.title} /></label>
    <label className="grid gap-1">案内文<textarea className={input} rows={3} name="description" maxLength={4000} defaultValue={event?.description ?? ""} /></label>
    {workshop ? <fieldset className="grid gap-3">
      <legend className="font-semibold">開催日程（日本時間）</legend>
      {rows.map((row, index) => <div key={row.key} className="grid gap-2 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2">
          <strong>第{index + 1}回</strong>
          {rows.length > 1 && <button type="button" className={button} aria-label={`第${index + 1}回を削除`}
            onClick={() => setRows(current => current.filter(item => item.key !== row.key))}>削除</button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">日時<input className={input} type="datetime-local" name={"start-" + row.key}
            required defaultValue={row.startsAt ? localDate(row.startsAt) : ""} /></label>
          <label className="grid gap-1">場所<input className={input} name={"location-" + row.key} required maxLength={200} defaultValue={row.location} /></label>
        </div>
      </div>)}
      {rows.length < maxWorkshopSessions && <button type="button" className={button}
        onClick={() => setRows(current => [...current, { key: crypto.randomUUID(), startsAt: "", location: "" }])}>開催回を追加</button>}
    </fieldset> : <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1">開催日時（日本時間）<input className={input} type="datetime-local" name="startsAt" required defaultValue={defaults && localDate(defaults.startsAt)} /></label>
      <label className="grid gap-1">場所<input className={input} name="location" required maxLength={200} defaultValue={defaults?.location} /></label>
    </div>}
    </div>
    <div id="event-registration" className="grid gap-3 scroll-mt-24">
    <label className="grid gap-1">対象<select className={input} value={audience} onChange={e => setAudience(e.target.value as typeof audience)}>
      {Object.entries(audiences).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    {audience !== "public" && classes.length > 0 && <fieldset className="grid gap-2 rounded-lg border p-3">
      <legend>対象クラス（指定しない場合は事業全体）</legend>
      {classes.map(item => <label className="flex items-center gap-2" key={item.id}>
        <input type="checkbox" name="classId" value={item.id} defaultChecked={defaults?.classIds.includes(item.id)} />
        {item.productName ? item.productName + " · " : ""}{item.name}
      </label>)}
    </fieldset>}
    {!workshop && <label className="flex items-center gap-2"><input type="checkbox" checked={registration} onChange={e => {
      setRegistration(e.target.checked);
      if (!e.target.checked && (payment === "payment_link" || payment === "parari")) setPayment("none");
    }} />申込を受け付ける</label>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1">{workshop ? "講習会全体の定員" : "定員"}{payment === "parari" ? "（空欄で制限なし）" : "（最大50人）"}<input className={input} type="number" min={1} max={payment === "parari" ? 2147483647 : 50} required={payment !== "parari"} name="capacity" defaultValue={event ? event.definition.capacity ?? "" : 50} /></label>
      {registration && <label className="grid gap-1">申込締切（空欄なら{workshop ? "初回" : ""}開始時刻）<input className={input} type="datetime-local" name="deadline" defaultValue={defaults && defaults.startsAt !== defaults.deadline ? localDate(defaults.deadline) : ""} /></label>}
    </div>
    </div>
    <div id="event-payment" className="grid gap-3 scroll-mt-24">
    <label className="grid gap-1">{workshop ? "講習会全体の受講料" : "参加費"}<select className={input} value={payment} onChange={e => setPayment(e.target.value as typeof payment)}>
      {Object.entries(paymentLabels).filter(([key]) => registration || (key !== "payment_link" && key !== "parari")).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    {payment !== "none" && <label className="grid gap-1">金額（円）<input className={input} type="number" min={1} max={10000000} required name="amount" defaultValue={event?.payment_amount ?? ""} /></label>}
    {payment === "payment_link" && <label className="grid gap-1">外部決済URL<input className={input} type="url" required name="paymentUrl" defaultValue={event?.payment_url ?? ""} /></label>}
    </div>
    <p id="event-operation" className="scroll-mt-24 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
      開催後の出欠・入金確認は、公開した企画を選ぶと同じ画面で記録できます。
    </p>
    <button className={primary} disabled={busy}>保存してプレビュー</button>
  </form>;
}
