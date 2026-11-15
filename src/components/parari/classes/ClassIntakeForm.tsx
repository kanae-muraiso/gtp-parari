import { useState, type FormEvent } from "react";

import ClassBookingCalendar, { bookingDate, bookingTime, type BookingSlot } from "./ClassBookingCalendar";

export type Intake = { school: string; information: string; kind: string; direct?: boolean; applicationText?: string; terms?: string; bookingWeeks?: number; sharedDisclosure?: { url: string; version?: string } | null; audience?: "adult" | "minor"; slots: BookingSlot[] };

const field = "block w-full rounded-lg border p-2";

export default function ClassIntakeForm({ data, busy = false, done = "", submit }: {
  data: Intake; busy?: boolean; done?: string; submit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [selected, setSelected] = useState("");
  const slot = data.slots.find(entry => entry.id === selected);
  const start = slot ? Date.parse(slot.starts_at) : 0;
  const end = slot ? start + slot.duration_minutes * 60000 : 0;
  return <><h1 className="text-xl font-bold">{data.school}の{data.direct ? "入会申込" : data.kind + "予約"}</h1>
      {data.applicationText && <p className="whitespace-pre-wrap">{data.applicationText}</p>}
      {data.information && <p className="whitespace-pre-wrap rounded-xl bg-emerald-50 p-4">{data.information}</p>}
      {data.sharedDisclosure && <p><a href={data.sharedDisclosure.url} target="_blank" rel="noreferrer" className="text-sm underline">
        特定商取引法に基づく表記・個人情報の取扱い
      </a></p>}
      {data.direct && data.terms && <p className="whitespace-pre-wrap rounded-xl border p-4">{data.terms}</p>}
      {done ? <p role="status">{done}</p> : <form className="grid gap-3" onSubmit={event => {
        if (busy || (!data.direct && !slot)) { event.preventDefault(); return; }
        submit(event);
      }}>
        {!data.direct && <ClassBookingCalendar slots={data.slots} bookingWeeks={data.bookingWeeks ?? 4} selected={selected} onSelect={setSelected} />}
        {!data.direct && slot && <div className="rounded-lg border bg-blue-50 p-3 text-sm" aria-live="polite">
          <p className="font-semibold">{bookingDate(slot.starts_at)} {bookingTime(start)}〜{bookingTime(end) <= bookingTime(start) ? "翌日 " : ""}{bookingTime(end)}</p>
          {slot.location && <p className="whitespace-pre-wrap">集合場所 {slot.location}</p>}
        </div>}
        <fieldset disabled={busy || (!data.direct && !slot)} className={data.direct || slot ? "grid min-w-0 gap-3" : "hidden"}>
        <label>受講する方のお名前<input name="name" className={field} maxLength={120} required /></label>
        <label>{data.audience === "minor" ? "保護者のお名前" : "申し込む方のお名前"}<input name="applicant" className={field} maxLength={120} required /></label>
        {!data.direct && slot?.channel === "phone" && <label>連絡先電話番号<input name="phone" className={field} type="tel" required maxLength={30} /></label>}
        <label>{data.audience === "minor" ? "保護者のメールアドレス" : "連絡先メール"}<input name="email" className={field} type="email" maxLength={254} required /></label>
        {data.audience === "minor" && <label>受講者のメールアドレス（任意）<input name="learnerEmail" className={field} type="email" maxLength={254} /></label>}
        <label><input type="checkbox" required /> {data.sharedDisclosure && !data.information ? "個人情報の取扱いを確認し、同意します" : "案内と個人情報の取り扱いを確認し、同意します"}{data.direct && data.terms ? "。教室規約にも同意します" : ""}</label>
        <button className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-white" disabled={busy}>{data.direct ? "申し込む" : "この日時で予約する"}</button>
        </fieldset>
      </form>}</>;
}
