"use client";

import { useEffect, useState, type FormEvent } from "react";
import { classRequest } from "@/lib/classRequests";
import { classEventDate, type ClassEvent, type ClassEventEntry } from "@/lib/classEvents";
import type { ClassRosterMember, SchoolClass } from "@/lib/classes";

const input = "w-full rounded-lg border border-neutral-300 px-3 py-2";
const button = "w-fit rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-50";
const primary = "w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
const localDate = (value: string) => new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 16);
const eventPath = (id: string) => "/events?event=" + encodeURIComponent(id);
const statuses = { draft: "下書き", open: "公開中", closed: "受付終了" };
const audiences = { members: "在籍者のみ", public: "一般のみ", mixed: "在籍者と一般" };
const paymentLabels = { none: "無料", on_site: "当日払い", payment_link: "外部決済リンク" };

type Detail = { event: ClassEvent; entries: ClassEventEntry[] };

export default function ClassEventsPanel({ classes, roster }: { classes: SchoolClass[]; roster: ClassRosterMember[] }) {
  const [events, setEvents] = useState<ClassEvent[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void classRequest<{ events: ClassEvent[] }>("/events", undefined, controller.signal)
      .then(data => setEvents(data.events)).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [refresh]);

  async function open(id: string) {
    setError("");
    setNotice("");
    setBusy(true);
    try { setDetail(await classRequest<Detail>(eventPath(id))); setEditing(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "イベントを開けませんでした。"); }
    finally { setBusy(false); }
  }

  async function change(body: object, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { id, notice } = await classRequest<{ id: string; notice?: string }>("/events", body);
      setDetail(await classRequest<Detail>(eventPath(id)));
      setEditing(false);
      setRefresh(value => value + 1);
      setNotice(notice ?? message);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "イベントを更新できませんでした。"); }
    finally { setBusy(false); }
  }

  const event = detail?.event;
  return <section className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">イベント</h2>
      {event || editing
        ? <button className={button} disabled={busy} onClick={() => { setDetail(null); setEditing(false); setNotice(""); setError(""); }}>イベント一覧に戻る</button>
        : <button className={primary} disabled={busy} onClick={() => { setEditing(true); setError(""); setNotice(""); }}>新規作成</button>}
    </header>
    {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    {notice && <p className="text-sm text-green-800" role="status">{notice}</p>}
    {editing ? <EventForm key={event?.id ?? "new"} event={event} classes={classes} busy={busy} onSave={values =>
      void change({ ...values, id: event?.id, action: "save" }, "下書きを保存しました。")} /> : event && detail ? <>
      <article className="grid gap-2 rounded-xl border p-4" aria-label="参加者向けプレビュー">
        <p className="text-sm text-neutral-600">{statuses[event.status]} · {audiences[event.class_event.audience]}</p>
        <h3 className="text-lg font-semibold">{event.title}</h3>
        <p>{classEventDate(event.class_event.startsAt)} · {event.class_event.location}</p>
        {event.description && <p className="whitespace-pre-wrap text-sm">{event.description}</p>}
        <p className="text-sm">{paymentLabels[event.payment_method]}{event.payment_amount && ` · ${event.payment_amount.toLocaleString("ja-JP")}円`}</p>
        {event.class_event.registration ? <p className="text-sm">申込締切 {classEventDate(event.class_event.deadline)}{event.definition.capacity && ` · 定員 ${event.definition.capacity}人`}</p> : <p className="text-sm">申込不要</p>}
      </article>
      <div className="flex flex-wrap gap-2">
        {event.status === "draft" && <button className={button} disabled={busy} onClick={() => setEditing(true)}>下書きを編集</button>}
        {event.status === "open"
          ? <button className={button} disabled={busy} onClick={() => void change({ id: event.id, action: "close" }, "受付を終了しました。")}>受付を終了</button>
          : <button className={primary} disabled={busy} onClick={() => void change({ id: event.id, action: "publish" }, "イベントを公開しました。")}>{event.status === "draft" ? "公開する" : "受付を再開"}</button>}
        {event.status !== "draft" && <a className={button} href={`/class-event/${event.id}`} target="_blank" rel="noreferrer">案内ページを開く</a>}
        {event.status === "open" && event.class_event.audience !== "public" && Date.parse(event.class_event.startsAt) > Date.now() &&
          <button className={button} disabled={busy} onClick={() => {
            if (window.confirm("対象の保護者にイベント案内をメールで送りますか？"))
              void change({ id: event.id, action: "notifyGuardians" }, "保護者に案内を送りました。");
          }}>保護者に案内を送る</button>}
        {event.status === "open" && event.class_event.audience !== "members" && <button className={button} disabled={busy} onClick={() =>
          void navigator.clipboard.writeText(new URL(`/class-event/${event.id}`, window.location.origin).href)
            .then(() => setNotice("案内URLをコピーしました。")).catch(() => setError("案内ページを開き、アドレスをコピーしてください。"))}>案内URLをコピー</button>}
      </div>
      {event.status !== "draft" && <section className="grid gap-3 border-t pt-4">
        <h3 className="font-semibold">参加者 · {detail.entries.length}人</h3>
        <form className="flex flex-wrap items-end gap-2" onSubmit={e => {
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
        </form>
        {!detail.entries.length && <p className="text-sm text-neutral-600">参加者はまだいません。</p>}
        {detail.entries.map(entry => <div key={entry.id} className="flex flex-wrap items-center gap-3 border-t py-3 text-sm">
          <strong>{entry.name}</strong>
          <label className="flex items-center gap-2">出欠<select className={input} disabled={busy}
            value={entry.class_event_attendance ?? "clear"} onChange={e => void change({ id: event.id, action: "entry", entryId: entry.id, change: e.target.value }, "出欠を更新しました。")}>
            <option value="clear">未記録</option><option value="present">出席</option><option value="absent">欠席</option>
          </select></label>
          {entry.payment_status === "unpaid" && <button className={button} disabled={busy}
            onClick={() => void change({ id: event.id, action: "entry", entryId: entry.id, change: "paid" }, "入金を記録しました。")}>入金を記録</button>}
          {entry.payment_status === "paid" && <span>入金済み</span>}
        </div>)}
      </section>}
    </> : <>
      {!events.length && <p className="text-sm text-neutral-600">イベントはまだありません。</p>}
      {events.map(item => <button key={item.id} type="button" disabled={busy} className="grid gap-1 rounded-lg border p-3 text-left hover:border-neutral-500"
        onClick={() => void open(item.id)}><strong>{item.title}</strong><span className="text-sm text-neutral-600">{classEventDate(item.class_event.startsAt)} · {statuses[item.status]}</span></button>)}
    </>}
  </section>;
}

function EventForm({ event, classes, busy, onSave }: {
  event?: ClassEvent; classes: SchoolClass[]; busy: boolean; onSave: (values: object) => void;
}) {
  const defaults = event?.class_event;
  const [audience, setAudience] = useState(defaults?.audience ?? "members");
  const [registration, setRegistration] = useState(defaults?.registration ?? true);
  const [payment, setPayment] = useState(event?.payment_method ?? "none");

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    onSave({ ...Object.fromEntries(data), classIds: data.getAll("classId"), registration, audience, payment });
  }

  return <form className="grid gap-4 text-sm" onSubmit={submit}>
    <label className="grid gap-1">イベント名<input className={input} name="title" required maxLength={120} defaultValue={event?.title} /></label>
    <label className="grid gap-1">案内文<textarea className={input} rows={3} name="description" maxLength={4000} defaultValue={event?.description ?? ""} /></label>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1">開催日時（日本時間）<input className={input} type="datetime-local" name="startsAt" required defaultValue={defaults && localDate(defaults.startsAt)} /></label>
      <label className="grid gap-1">場所<input className={input} name="location" required maxLength={200} defaultValue={defaults?.location} /></label>
    </div>
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
    <label className="flex items-center gap-2"><input type="checkbox" checked={registration} onChange={e => {
      setRegistration(e.target.checked);
      if (!e.target.checked && payment === "payment_link") setPayment("none");
    }} />申込を受け付ける</label>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1">定員（任意）<input className={input} type="number" min={1} max={1000} name="capacity" defaultValue={event?.definition.capacity ?? ""} /></label>
      {registration && <label className="grid gap-1">申込締切（空欄なら開始時刻）<input className={input} type="datetime-local" name="deadline" defaultValue={defaults && defaults.startsAt !== defaults.deadline ? localDate(defaults.deadline) : ""} /></label>}
    </div>
    <label className="grid gap-1">参加費<select className={input} value={payment} onChange={e => setPayment(e.target.value as typeof payment)}>
      {Object.entries(paymentLabels).filter(([key]) => registration || key !== "payment_link").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    {payment !== "none" && <label className="grid gap-1">金額（円）<input className={input} type="number" min={1} max={10000000} required name="amount" defaultValue={event?.payment_amount ?? ""} /></label>}
    {payment === "payment_link" && <label className="grid gap-1">外部決済URL<input className={input} type="url" required name="paymentUrl" defaultValue={event?.payment_url ?? ""} /></label>}
    <button className={primary} disabled={busy}>保存してプレビュー</button>
  </form>;
}
