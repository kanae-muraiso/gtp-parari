import { useRef, useState, type FormEvent } from "react";

import { classWeekdays } from "@/lib/classRecurrence";
import type { ClassIntakeTarget } from "@/lib/classIntakeTargets";

import ClassBookingCalendar, { bookingDate, bookingTime, type BookingSlot } from "./ClassBookingCalendar";

export type Intake = { offerName?: string; targetClasses?: ClassIntakeTarget[]; classSchedules?: ClassIntakeTarget[]; walkInSchedules?: { id: string; name: string }[]; school: string; information: string; kind: string; direct?: boolean; applicationText?: string; terms?: string; bookingWeeks?: number; sharedDisclosure?: { url: string; version?: string } | null; audience?: "adult" | "minor"; slots: BookingSlot[] };

const field = "block w-full rounded-lg border p-2";

export default function ClassIntakeForm({ data, busy = false, done = "", submit }: {
  data: Intake; busy?: boolean; done?: string; submit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const targets = data.targetClasses;
  const [targetId, setTargetId] = useState("");
  const target = targets?.length === 1 ? targets[0] : targets?.find(item => item.id === targetId);
  const audience = target?.audience ?? data.audience ?? "adult";
  const minor = audience === "minor";
  const targetReady = !targets || Boolean(target);
  const onlyWalkIn = targets?.length === 0 && Boolean(data.walkInSchedules?.length);
  const [selected, setSelected] = useState("");
  const [step, setStep] = useState<"contact" | "booking">("contact");
  const contactFields = useRef<HTMLFieldSetElement>(null);
  function goToBooking() {
    const fields = contactFields.current?.querySelectorAll<HTMLInputElement>("input");
    if (!fields) return;
    for (const input of fields) {
      if (!input.reportValidity()) return;
    }
    setStep("booking");
  }
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
      {!data.direct && !onlyWalkIn && !done ? <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="予約手続きの進捗">
        <span className={step === "contact" ? "rounded-lg bg-emerald-900 px-3 py-2 text-white" : "rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900"}>1. 連絡先・申込情報</span>
        <span className="text-neutral-400">→</span>
        <span className={step === "booking" ? "rounded-lg bg-emerald-900 px-3 py-2 text-white" : "rounded-lg bg-neutral-100 px-3 py-2 text-neutral-600"}>2. {data.kind}の日時予約</span>
      </div> : null}
      {done ? <div role="status" className="grid gap-2 rounded-xl bg-emerald-50 p-4">
        <p className="font-semibold">{done}</p>
        {target && <p>{target.name}</p>}
        {slot && <p>{timeLabel}{slot.location ? " · " + slot.location : ""}</p>}
      </div> : onlyWalkIn ? null : <form className="grid gap-5" onSubmit={event => {
        if (busy || !ready || (!data.direct && step !== "booking")) { event.preventDefault(); return; }
        submit(event);
      }}>
        {minor && <p className="rounded-lg bg-blue-50 p-3 text-sm">このクラスは未成年向けです。保護者の方がお申し込みください。本人と保護者の両方に予約・入会・日程の案内が届きます。正式入会には保護者のPARARI登録・ログインが必要です。</p>}
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
        <fieldset ref={contactFields} key={audience} disabled={busy} className={targetReady && (data.direct || step === "contact") ? "grid min-w-0 gap-3" : "hidden"}>
          {!data.direct && <p className="rounded-lg bg-neutral-50 p-3 text-sm">最初に連絡先を入力してください。次の画面で説明会・体験の日程を選べます。</p>}
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
        {data.direct ? <button className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-50" disabled={busy || !ready}>申し込む</button> :
          <button type="button" className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-50" disabled={busy || !targetReady} onClick={goToBooking}>連絡先を確認して日時選択へ</button>}
        </fieldset>
        {targetReady && !data.direct && step === "booking" && <section className="grid gap-3">
          <h2 className="font-semibold">{data.kind}の日時</h2>
          {data.slots.length ? <ClassBookingCalendar slots={data.slots} bookingWeeks={data.bookingWeeks ?? 4} selected={selected} onSelect={setSelected} />
            : <p className="rounded-xl bg-neutral-50 p-4">現在、選べる日時はありません。</p>}
          {slot && <div className="rounded-lg border bg-blue-50 p-3 text-sm" aria-live="polite">
            <p className="font-semibold">{timeLabel}</p>
            {slot.location && <p className="whitespace-pre-wrap">集合場所 {slot.location}</p>}
          </div>}
        </section>}
        {!data.direct && step === "booking" && <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="rounded-lg border px-4 py-2 text-sm" disabled={busy} onClick={() => setStep("contact")}>連絡先を修正する</button>
          <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            disabled={busy || !ready}>{busy ? "予約中…" : slot ? "この日時で予約する" : "日時を選択してください"}</button>
        </div>}
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
