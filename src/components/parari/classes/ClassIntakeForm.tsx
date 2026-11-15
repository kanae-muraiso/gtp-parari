import { useState, type FormEvent } from "react";

export type Intake = { school: string; information: string; kind: string; direct?: boolean; applicationText?: string; terms?: string; slots: { id: string; starts_at: string; channel?: "onsite" | "phone" }[] };
import ClassBookingCalendar from "./ClassBookingCalendar";

const field = "block w-full rounded-lg border p-2";

export default function ClassIntakeForm({ data, busy = false, done = "", submit }: {
  data: Intake; busy?: boolean; done?: string; submit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [selected, setSelected] = useState("");
  const slot = data.slots.find(entry => entry.id === selected);
  return <><h1 className="text-xl font-bold">{data.school}の{data.direct ? "入会申込" : data.kind + "予約"}</h1>
      {data.applicationText && <p className="whitespace-pre-wrap">{data.applicationText}</p>}
      <p className="whitespace-pre-wrap rounded-xl bg-emerald-50 p-4">{data.information}</p>
      {data.direct && data.terms && <p className="whitespace-pre-wrap rounded-xl border p-4">{data.terms}</p>}
      {done ? <p role="status">{done}</p> : (data.direct || data.slots.length) ? <form className="grid gap-3" onSubmit={submit}>
        {!data.direct && <ClassBookingCalendar slots={data.slots} selected={selected} onSelect={setSelected} />}
        <label>受講する方のお名前<input name="name" className={field} maxLength={120} required /></label>
        <label>申し込む方のお名前<input name="applicant" className={field} maxLength={120} required /></label>
        {!data.direct && slot?.channel === "phone" && <label>連絡先電話番号<input name="phone" className={field} type="tel" required maxLength={30} /></label>}
        <label>連絡先メール<input name="email" className={field} type="email" maxLength={254} required /></label>
        <label><input type="checkbox" required /> 案内と個人情報の取り扱いを確認し、同意します{data.direct && data.terms ? "。教室規約にも同意します" : ""}</label>
        <button className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-white" disabled={busy}>{data.direct ? "申し込む" : "予約する"}</button>
      </form> : <p>現在予約できる日時はありません。</p>}</>;
}
