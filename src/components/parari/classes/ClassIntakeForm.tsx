import { useState, type FormEvent } from "react";

import { classWeekdays } from "@/lib/classRecurrence";
import type { ClassIntakeTarget } from "@/lib/classIntakeTargets";

import ClassBookingCalendar, { bookingDate, bookingTime, type BookingSlot } from "./ClassBookingCalendar";

export type Intake = { offerName?: string; targetClasses?: ClassIntakeTarget[]; classSchedules?: ClassIntakeTarget[]; walkInSchedules?: { id: string; name: string }[]; school: string; information: string; kind: string; direct?: boolean; applicationText?: string; terms?: string; bookingWeeks?: number; sharedDisclosure?: { url: string; version?: string } | null; audience?: "adult" | "minor"; slots: BookingSlot[] };

const field = "block w-full rounded-lg border p-2";

export default function ClassIntakeForm({ data, busy = false, done = "", submit }: {
  data: Intake; busy?: boolean; done?: string; submit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [audience, setAudience] = useState<"adult" | "minor" | "">("");
  const minor = audience === "minor";
  const targets = data.targetClasses;
  const [targetId, setTargetId] = useState("");
  const target = targets?.length === 1 ? targets[0] : targets?.find(item => item.id === targetId);
  const targetReady = !targets || Boolean(target);
  const onlyWalkIn = targets?.length === 0 && Boolean(data.walkInSchedules?.length);
  const [selected, setSelected] = useState("");
  const slot = data.slots.find(entry => entry.id === selected);
  const start = slot ? Date.parse(slot.starts_at) : 0;
  const end = slot ? start + slot.duration_minutes * 60000 : 0;
  const timeLabel = slot ? `${bookingDate(slot.starts_at)} ${bookingTime(start)}〜${bookingTime(end) <= bookingTime(start) ? "翌日 " : ""}${bookingTime(end)}` : "";
  const ready = Boolean(audience) && targetReady && (data.direct || Boolean(slot));
  return <><header className="grid gap-1">
      <p className="text-sm text-neutral-600">{data.school}</p>
      <h1 className="text-xl font-bold">{data.offerName ? data.offerName + " · " : ""}{onlyWalkIn ? "開催日程のご案内" : data.direct ? "入会申込" : data.kind + "予約"}</h1>
    </header>
      {data.applicationText && <p className="whitespace-pre-wrap">{data.applicationText}</p>}
      {data.information && <p className="whitespace-pre-wrap rounded-xl bg-emerald-50 p-4">{data.information}</p>}
      {data.sharedDisclosure && <p><a href={data.sharedDisclosure.url} target="_blank" rel="noreferrer" className="text-sm underline">
        特定商取引法に基づく表記・個人情報の取扱い
      </a></p>}
      {!!data.classSchedules?.length && <section className="grid gap-3 rounded-xl border p-4">
        <h2 className="font-semibold">入会後のクラスと開催予定</h2>
        {data.classSchedules.map(item => <div key={item.id} className="grid gap-1 border-b pb-3 last:border-b-0 last:pb-0">
          <TargetSummary item={item} />
          <UpcomingDates item={item} />
        </div>)}
      </section>}
      {data.direct && data.terms && <p className="whitespace-pre-wrap rounded-xl border p-4">{data.terms}</p>}
      {Boolean(data.walkInSchedules?.length) && <section className="grid gap-2 rounded-xl border p-4">
        <h2 className="font-semibold">予約なしで参加できるクラス</h2>
        {data.walkInSchedules?.map(schedule => <a className="underline" key={schedule.id} href={`/class-schedule/${schedule.id}`}>{schedule.name}の日程・参加費を見る</a>)}
      </section>}
      {done ? <div role="status" className="grid gap-2 rounded-xl bg-emerald-50 p-4">
        <p className="font-semibold">{done}</p>
        {target && <p>{target.name}</p>}
        {slot && <p>{timeLabel}{slot.location ? " · " + slot.location : ""}</p>}
      </div> : onlyWalkIn ? null : <form className="grid gap-5" onSubmit={event => {
        if (busy || !ready) { event.preventDefault(); return; }
        submit(event);
      }}>
        <fieldset className="grid gap-2" disabled={busy}>
          <legend className="mb-2 font-semibold">受講する方は成人ですか、未成年ですか？</legend>
          {([['adult', '成人'], ['minor', '未成年']] as const).map(([value, label]) =>
            <label key={value} className="flex items-center gap-2 rounded-lg border p-3">
              <input type="radio" name="audience" value={value} checked={audience === value} required onChange={() => setAudience(value)} />{label}
            </label>)}
          {minor && <p className="text-sm">保護者の情報が必要です。予約・入会・日程などの連絡は、受講者本人と保護者の両方に届きます。正式な入会手続きには保護者のPARARI登録・ログインが必要です。</p>}
        </fieldset>
        {audience && <>
        {targets?.length === 1 && <>
          <section className="grid gap-2 rounded-xl border p-4" aria-label="対象クラス">
            <h2 className="font-semibold">入会後のクラスと開催予定</h2>
            <TargetSummary item={targets[0]} />
            <UpcomingDates item={targets[0]} />
          </section>
          <input type="hidden" name="classId" value={targets[0].id} />
        </>}
        {targets && targets.length > 1 && <fieldset className="grid gap-2" disabled={busy}>
          <legend className="mb-2 font-semibold">希望するクラス</legend>
          {targets.map(item => <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${item.id === targetId ? "border-blue-800 bg-blue-50" : ""}`}>
            <input type="radio" className="mt-1" name="classId" value={item.id} checked={item.id === targetId} required
              onChange={() => setTargetId(item.id)} aria-label={item.name} />
            <span className="grid gap-1"><TargetSummary item={item} /></span>
          </label>)}
        </fieldset>}
        {targets && targets.length > 1 && target && <section className="grid gap-2 rounded-xl border p-4">
          <h2 className="font-semibold">選んだクラスの開催予定</h2>
          <UpcomingDates item={target} />
        </section>}
        {targetReady && !data.direct && <section className="grid gap-3">
          <h2 className="font-semibold">{data.kind}の日時</h2>
          {data.slots.length ? <ClassBookingCalendar slots={data.slots} bookingWeeks={data.bookingWeeks ?? 4} selected={selected} onSelect={setSelected} />
            : <p className="rounded-xl bg-neutral-50 p-4">現在、選べる日時はありません。</p>}
          {slot && <div className="rounded-lg border bg-blue-50 p-3 text-sm" aria-live="polite">
            <p className="font-semibold">{timeLabel}</p>
            {slot.location && <p className="whitespace-pre-wrap">集合場所 {slot.location}</p>}
          </div>}
        </section>}
        <fieldset disabled={busy || !ready} className={ready ? "grid min-w-0 gap-3" : "hidden"}>
        <legend className="mb-2 font-semibold">お名前と連絡先</legend>
        <label>受講する方のお名前<input name="name" className={field} maxLength={120} required /></label>
        <label>受講する方のメールアドレス（必須）<input name="email" className={field} type="email" maxLength={254} required /></label>
        <label>受講する方の電話番号{!minor && slot?.channel === "phone" ? "（必須）" : "（任意）"}<input name="phone" className={field} type="tel" required={!minor && slot?.channel === "phone"} maxLength={30} /></label>
        <label>受講する方の住所（任意）<input name="address" className={field} maxLength={300} /></label>
        <label>所属・学校名（任意）<input name="school" className={field} maxLength={300} /></label>
        {minor && <fieldset className="grid gap-3 rounded-xl border p-4">
          <legend className="px-1 font-semibold">保護者の情報（すべて必須）</legend>
          <label>保護者のお名前<input name="guardianName" className={field} maxLength={120} required /></label>
          <label>保護者のメールアドレス<input name="guardianEmail" className={field} type="email" maxLength={254} required /></label>
          <label>保護者の電話番号<input name="guardianPhone" className={field} type="tel" maxLength={30} required /></label>
          <label>保護者の住所<input name="guardianAddress" className={field} maxLength={300} required /></label>
        </fieldset>}
        <label><input type="checkbox" required /> {data.sharedDisclosure && !data.information ? "個人情報の取扱いを確認し、同意します" : "案内と個人情報の取り扱いを確認し、同意します"}{data.direct && data.terms ? "。教室規約にも同意します" : ""}</label>
        <button className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-white" disabled={busy}>{data.direct ? "申し込む" : "この日時で予約する"}</button>
        </fieldset>
        </>}
      </form>}</>;
}

function TargetSummary({ item }: { item: ClassIntakeTarget }) {
  return <>
    <strong>{item.name}</strong>
    <span className="text-sm">{item.schedule}{item.location ? " · " + item.location : ""}</span>
    {item.fee !== null && <span className="text-sm">月謝 {item.fee.toLocaleString("ja-JP")}円</span>}
    {item.booking === "flexible" && item.monthlyVisits !== undefined &&
      <span className="text-sm">入会後、対象クラスの空席を月{item.monthlyVisits}回まで予約できます。</span>}
  </>;
}

function UpcomingDates({ item }: { item: ClassIntakeTarget }) {
  if (!item.upcoming) return null;
  if (!item.upcoming.length) return <p className="text-sm text-neutral-600">今月・来月の開催予定はありません。</p>;
  return <ul className="grid gap-1 text-sm">
    {item.upcoming.map(({ day, time, location, confirmed }) => {
      const date = new Date(day + "T00:00:00Z");
      return <li key={day}>
        {date.getUTCMonth() + 1}/{date.getUTCDate()}（{classWeekdays[date.getUTCDay()]}）{time}
        {location !== item.location && location ? " · " + location : ""}
        {!confirmed && <span className="ml-2 text-xs text-neutral-600">予定</span>}
      </li>;
    })}
  </ul>;
}
