"use client";

import { useEffect, useState, type FormEvent } from "react";
import { classRequest } from "@/lib/classRequests";
import { nextLessonDate, type ClassDailyData, type ClassRosterMember, type SchoolClass } from "@/lib/classes";

const field = "rounded-lg border border-neutral-300 bg-white px-3 py-2";
const button = "rounded-lg border border-blue-300 px-3 py-2 text-sm font-medium text-blue-900 disabled:opacity-50";

export default function ClassDailyPanel({ schoolId, item, userId, roster }: {
  schoolId: string; item: SchoolClass; userId: string; roster?: ClassRosterMember[];
}) {
  const next = nextLessonDate(item);
  const [selectedDate, setSelectedDate] = useState("");
  const date = selectedDate || next;
  const path = "/daily?" + new URLSearchParams({ school: schoolId, class: item.id, date });
  const [result, setResult] = useState<{ path: string; data: ClassDailyData } | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const data = result?.path === path && result.data.userId === userId ? result.data : null;

  useEffect(() => {
    const controller = new AbortController();
    void classRequest<ClassDailyData>(path, undefined, controller.signal)
      .then(response => { if (!controller.signal.aborted) setResult({ path, data: response }); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [path, userId, revision]);

  async function save(input: object) {
    setBusy(true);
    setError("");
    try {
      await classRequest(path, input);
      setRevision(value => value + 1);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できませんでした。");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>, action: "notice" | "charge") {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const id = form.dataset.requestId || crypto.randomUUID();
    form.dataset.requestId = id;
    if (await save({ ...values, id, action, amount: Number(values.amount) })) {
      delete form.dataset.requestId;
      form.reset();
    }
  }

  return <section className="grid gap-5 rounded-2xl border border-neutral-200 bg-white p-5">
    <div>
      <h3 className="font-bold">次回のレッスン</h3>
      <p className="mt-1 text-sm">{next} {item.starts_at.slice(0, 5)}（日本時間）</p>
    </div>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {!data && !error && <p role="status" className="text-sm">読み込み中…</p>}
    {data && <fieldset disabled={busy} className="grid min-w-0 gap-5">
      <div className="grid gap-2">
        <h4 className="font-bold">出欠</h4>
        {roster ? <>
          <label className="text-sm">確認する日 <input className={field} type="date" value={date} onChange={event => { setError(""); setSelectedDate(event.target.value); }} /></label>
          {roster.filter(member => member.status === "active" || data.attendance.some(row => row.enrollment_id === member.id)).map(member => {
            const row = data.attendance.find(entry => entry.enrollment_id === member.id);
            return <label key={member.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span>{member.name}（{row?.absence_reported ? "欠席連絡あり" : "欠席連絡なし"}）</span>
              <select className={field} aria-label={member.name + "の実出席"} value={row?.actual ?? ""}
                onChange={event => void save({ action: "actual", memberId: member.id, actual: event.target.value || null })}>
                <option value="">未記録</option><option value="present">出席</option><option value="absent">欠席</option>
              </select>
            </label>;
          })}
        </> : <button className={button} type="button" onClick={() => void save({ action: "absence", absent: !data.attendance[0]?.absence_reported })}>
          {data.attendance[0]?.absence_reported ? "欠席連絡済み · 取り消す" : "次回の欠席を連絡"}
        </button>}
      </div>
      <div className="grid gap-2">
        <h4 className="font-bold">お知らせ・復習</h4>
        {roster && <form className="grid gap-2" onSubmit={event => void create(event, "notice")}>
          <textarea className={field} name="body" aria-label="お知らせの本文" rows={3} maxLength={2000} required />
          <button className={button}>教室に掲載</button>
        </form>}
        {data.notices.length === 0 && <p className="text-sm text-neutral-600">お知らせはありません。</p>}
        {data.notices.map(notice => <article className="rounded-lg bg-neutral-50 p-3 text-sm" key={notice.id}>
          <time dateTime={notice.created_at} className="text-xs text-neutral-600">{new Date(notice.created_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}</time>
          <p className="mt-1 whitespace-pre-wrap break-words">{notice.body}</p>
          {roster && <button type="button" className="mt-2 underline" onClick={() => {
            if (window.confirm("このお知らせを削除しますか？")) void save({ action: "deleteNotice", id: notice.id });
          }}>削除</button>}
        </article>)}
      </div>
      <div className="grid gap-2">
        <h4 className="font-bold">支払い</h4>
        {roster && roster.some(member => member.status === "active") && <form className="grid gap-2" onSubmit={event => void create(event, "charge")}>
          <label className="grid gap-1 text-sm">受講者<select name="memberId" className={field} required>
            {roster.filter(member => member.status === "active").map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select></label>
          <label className="grid gap-1 text-sm">請求名<input className={field} name="title" placeholder="12月分月謝" required maxLength={120} /></label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">金額（円）<input className={field} name="amount" type="number" min="1" max="10000000" required /></label>
            <label className="grid gap-1 text-sm">支払期限<input className={field} name="due" type="date" required /></label>
          </div>
          <button className={button}>請求を記録</button>
        </form>}
        {data.charges.length === 0 && <p className="text-sm text-neutral-600">請求はありません。</p>}
        {data.charges.map(charge => <article className="rounded-lg bg-neutral-50 p-3 text-sm" key={charge.id}>
          <p className="font-medium">{roster?.find(member => member.id === charge.enrollment_id)?.name} {charge.title} · ¥{charge.amount_yen.toLocaleString("ja-JP")}</p>
          <p>{charge.received_at ? "受領済み" : "未受領"} · 期限 {charge.due_on}</p>
          {roster && !charge.received_at && <form className="mt-2 flex flex-wrap gap-2" onSubmit={event => {
            event.preventDefault();
            void save({ action: "receipt", id: charge.id, method: new FormData(event.currentTarget).get("method") });
          }}>
            <select className={field} aria-label="受領方法" name="method"><option value="cash">現金</option><option value="transfer">振込</option><option value="other">その他</option></select>
            <button className={button}>受領を記録</button>
          </form>}
        </article>)}
      </div>
    </fieldset>}
  </section>;
}
