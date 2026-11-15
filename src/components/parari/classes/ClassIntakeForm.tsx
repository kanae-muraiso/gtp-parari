import type { FormEvent } from "react";

export type Intake = { school: string; information: string; kind: string; slots: { id: string; starts_at: string }[] };
const field = "block w-full rounded-lg border p-2";

export default function ClassIntakeForm({ data, busy = false, done = "", submit }: {
  data: Intake; busy?: boolean; done?: string; submit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <><h1 className="text-xl font-bold">{data.school}の{data.kind}予約</h1>
      <p className="whitespace-pre-wrap rounded-xl bg-emerald-50 p-4">{data.information}</p>
      {done ? <p role="status">{done}</p> : data.slots.length ? <form className="grid gap-3" onSubmit={submit}>
        <label>日時<select name="slot" className={field} required>{data.slots.map(slot => <option key={slot.id} value={slot.id}>{new Date(slot.starts_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}（日本時間）</option>)}</select></label>
        <label>受講する方のお名前<input name="name" className={field} maxLength={120} required /></label>
        <label>申し込む方のお名前<input name="applicant" className={field} maxLength={120} required /></label>
        <label>連絡先メール<input name="email" className={field} type="email" maxLength={254} required /></label>
        <label><input type="checkbox" required /> 案内と個人情報の取り扱いを確認し、同意します</label>
        <button className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-white" disabled={busy}>予約する</button>
      </form> : <p>現在予約できる日時はありません。</p>}</>;
}
