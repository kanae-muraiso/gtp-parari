"use client";

import * as React from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { ApplicationManagerCreatedApplication } from "./applicationManagerSupport";

export type Purpose = "event" | "booking" | "class";
type Props = {
  purpose: Purpose;
  mode: "lite" | "builder";
  onCreated: (item: ApplicationManagerCreatedApplication) => void;
  onCancel: () => void;
};

const purposeCopy: Record<Purpose, { heading: string; name: string; action: string; description: string }> = {
  event: {
    heading: "イベントを開催する",
    name: "イベント名",
    action: "参加を申し込む",
    description: "開催日・会場・定員を案内し、参加申込を受け付けます。Liteでは毎回の予約枠は作りません。",
  },
  booking: {
    heading: "予約を受け付ける",
    name: "相談・サービス名",
    action: "予約を問い合わせる",
    description: "氏名とメールアドレスを受け取り、主催者が後から日時を調整します。Liteでは空き時間の予約・確保をしません。",
  },
  class: {
    heading: "クラスを運営する",
    name: "クラス名",
    action: "クラスに申し込む",
    description: "同じ受講者10名までの継続申込です。毎回の申込や月謝の自動徴収はありません。",
  },
};

const fieldClass = "mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-neutral-600 focus:outline-none";
const stepNames = ["内容", "開催・定員", "料金・確認"] as const;

export default function ApplicationPurposeWizard({ purpose, mode, onCreated, onCancel }: Props) {
  const lite = mode === "lite";
  const copy = purposeCopy[purpose];
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [date, setDate] = React.useState("");
  const [startTime, setStartTime] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState("60");
  const [place, setPlace] = React.useState("");
  const [cadence, setCadence] = React.useState("weekly");
  const [capacity, setCapacity] = React.useState(lite ? "10" : "");
  const [fee, setFee] = React.useState("0");
  const [payment, setPayment] = React.useState<"none" | "parari" | "on_site">("none");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const isFee = Number(fee) > 0;
  const effectiveCapacity = capacity ? Number(capacity) : purpose === "class" ? 10 : null;
  const maxCapacity = lite ? 10 : null;
  const canGoNext = step === 0 ? Boolean(name.trim()) :
    step === 1 ? (purpose === "booking" || (Boolean(date) && Boolean(startTime))) : true;

  function next() {
    setError("");
    if (!canGoNext) {
      setError(step === 0 ? "名称を入力してください。" : "日付と開始時刻を入力してください。");
      return;
    }
    setStep(old => Math.min(2, old + 1));
  }

  async function submit() {
    setError("");
    const amount = Number(fee);
    if (!name.trim() || name.trim().length > 120) { setError("名称は120文字以内で入力してください。"); return; }
    if (description.length > 5000 || notes.length > 5000) { setError("案内文は5000文字以内にしてください。"); return; }
    if (!Number.isInteger(amount) || amount < 0) { setError("料金は0円以上の整数で入力してください。"); return; }
    if (effectiveCapacity !== null && (!Number.isInteger(effectiveCapacity) || effectiveCapacity < 1 ||
      (maxCapacity !== null && effectiveCapacity > maxCapacity))) {
      setError("定員は利用可能な範囲で指定してください。"); return;
    }
    if (purpose !== "booking" && (!date || !startTime || !Number.isInteger(Number(durationMinutes)))) {
      setError("開催日時と所要時間を入力してください。"); return;
    }
    if (!supabase) { setError("ログイン情報を確認できませんでした。"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("ログインしてから作成してください。");
      const headers = { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token };
      const accessResponse = await fetch("/api/application/manage", { headers, cache: "no-store" });
      const access = await accessResponse.json();
      if (!accessResponse.ok || !access.ok) throw new Error(access.message || "プランを確認できませんでした。");
      if (!access.access?.canCreateApplication) throw new Error("APPLICATIONの作成数が上限に達しています。");
      // Formal entitlement always comes from the server, not this display.
      const actualMode = access.access.applicationMode === "lite" ? "lite" : "builder";
      if (actualMode !== mode) throw new Error("プランの利用条件が変わりました。画面を再度開いてください。");
      const method = amount === 0 ? "none" : payment === "none" ? "none" : payment;
      if (amount > 0 && method === "none") throw new Error("有料受付ではSquare決済か現地払いを選んでください。");
      if (lite && method === "on_site" && access.access.effectivePlan === "free") {
        throw new Error("Freeの有料受付ではPARARI決済（Square）が必要です。");
      }
      const body = {
        applicationType: purpose === "event" ? "EVENT" : purpose === "class" ? "SCHOOL" : "OTHER",
        title: name.trim(),
        description: description.trim(),
        definition: {
          mode,
          fields: [], inputFields: [], blocks: [],
          capacity: effectiveCapacity,
          actionLabel: copy.action, passEnabled: false, agreement: "",
          display: { applicationLabel: false, typeLabel: false, title: true, status: true, remainingSlots: true },
          wizard: {
            version: 1, kind: purpose,
            date: purpose === "booking" ? null : date,
            startTime: purpose === "booking" ? null : startTime,
            durationMinutes: purpose === "booking" ? null : Number(durationMinutes),
            cadence: purpose === "class" ? cadence : "once",
            location: place, attendance: purpose === "class" ? "fixed" : "per_event",
            notes, panelOrder: ["intro", "schedule", "capacity", "payment", "form"],
            timezone: "Asia/Tokyo",
            recurringClassIsInformational: purpose === "class",
          },
        },
        formId: null,
        acceptanceMode: "instant",
        paymentMethod: method,
        paymentAmount: amount > 0 ? amount : null,
        paymentUrl: "", paymentInstructions: "", paymentConfirmationRequired: false,
        cancellationMode: "not_allowed",
      };
      const response = await fetch("/api/application/manage", { method: "POST", headers, body: JSON.stringify(body) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok || !result.application?.id) {
        if (result?.code === "SELLER_DISCLOSURE_REQUIRED") {
          throw new Error("販売者情報の登録が必要です。販売設定から特商法と個人情報の取扱いを公開してください。");
        }
        throw new Error(result?.message || "APPLICATIONを保存できませんでした。");
      }
      setSaved(true);
      onCreated({
        id: result.application.id,
        application_type: result.application.application_type,
        title: result.application.title,
        acceptance_mode: result.application.acceptance_mode,
        status: result.application.status,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-6 py-7 sm:px-10">
      <div className="mx-auto max-w-2xl">
        <div className="text-xs font-bold tracking-widest text-neutral-400">APPLICATION {lite ? "LITE" : "BUILDER"}</div>
        <h2 className="mt-2 text-xl font-bold text-neutral-950">{copy.heading}</h2>
        <p className="mt-2 text-sm leading-7 text-neutral-600">{copy.description}</p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {stepNames.map((text, i) => (
            <div key={text} className={"rounded-lg px-2 py-2 text-center text-xs " +
              (i === step ? "bg-amber-100 font-bold text-amber-900" : "bg-neutral-100 text-neutral-500")}>
              {i + 1}. {text}
            </div>
          ))}
        </div>

        {step === 0 && <div className="mt-6 space-y-5">
          <label className="block text-sm font-bold">{copy.name}
            <input className={fieldClass} value={name} onChange={e => setName(e.target.value)} placeholder={
              purpose === "event" ? "例：週末の交流会" : purpose === "class" ? "例：金曜日のZUMBA" : "例：英語教室の体験説明会"} />
          </label>
          <label className="block text-sm font-bold">参加者に伝える案内
            <textarea className={fieldClass} rows={5} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="どんな活動なのか、初めての方にもわかるように書いてください。" />
          </label>
        </div>}

        {step === 1 && <div className="mt-6 space-y-5">
          {purpose === "booking" ? (
            <div className="rounded-xl bg-neutral-50 p-4 text-sm leading-7 text-neutral-700">
              <strong>Liteは予約希望を受け付けます。</strong>
              <p>受付後に主催者が日時を調整します。予約枠や空き時間を自動で管理する機能はありません。</p>
            </div>
          ) : <>
            {purpose === "class" && (
              <label className="block text-sm font-bold">開催頻度
                <select className={fieldClass} value={cadence} onChange={e => setCadence(e.target.value)}>
                  <option value="weekly">毎週</option>
                  <option value="daily">毎日</option>
                  <option value="once">単発</option>
                </select>
              </label>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-bold">{purpose === "class" ? "開始日・例示日" : "開催日"}
                <input type="date" className={fieldClass} value={date} onChange={e => setDate(e.target.value)} />
              </label>
              <label className="block text-sm font-bold">開始時刻
                <input type="time" className={fieldClass} value={startTime} onChange={e => setStartTime(e.target.value)} />
              </label>
              <label className="block text-sm font-bold">所要時間
                <select className={fieldClass} value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)}>
                  {[30,45,60,75,90,120,150,180].map(n => <option key={n} value={n}>{n}分</option>)}
                </select>
              </label>
            </div>
            <label className="block text-sm font-bold">会場・開催場所
              <input className={fieldClass} value={place} onChange={e => setPlace(e.target.value)} placeholder="例：京都市内のスタジオ" />
            </label>
            {purpose === "class" && <p className="text-xs leading-6 text-neutral-600">繰り返しは案内として表示します。各開催回の予約枠や休講・振替の自動管理はありません。</p>}
          </>}
          <label className="block text-sm font-bold">
            {purpose === "class" ? "継続受講者の定員" : purpose === "booking" ? "受け付ける希望者数" : "参加定員"}
            <input type="number" min="1" max={maxCapacity || undefined} className={fieldClass} value={capacity}
              placeholder={lite ? "最大10名" : "定員を入力"}
              onChange={e => {
                const next = e.target.value;
                if (!next) { setCapacity(""); return; }
                const n = Number(next);
                if (!Number.isInteger(n) || n < 1) return;
                setCapacity(String(maxCapacity ? Math.min(n,maxCapacity) : n));
              }} />
          </label>
          {lite && <p className="text-xs text-amber-900">Liteでは1つの受付につき10名まで。クラスは同じ10名が継続利用できます。</p>}
        </div>}

        {step === 2 && <div className="mt-6 space-y-5">
          {purpose === "booking" ? (
            <div className="rounded-xl bg-neutral-50 p-4 text-sm leading-7 text-neutral-700">
              <strong>Liteの予約希望受付は無料です。</strong>
              <p>具体的な日時や料金は主催者が後から連絡し、別途合意します。ここでは予約料や前払いを請求しません。</p>
            </div>
          ) : (
            <label className="block text-sm font-bold">参加・受付料金（円、無料は0）
              <input type="number" min="0" step="1" className={fieldClass} value={fee}
                onChange={e => { setFee(e.target.value); setPayment(Number(e.target.value) > 0 ? "parari" : "none");
                  if (lite && Number(e.target.value) === 0 && capacity && Number(capacity) > 10) setCapacity("10"); }} />
            </label>
          )}
          {isFee && <label className="block text-sm font-bold">支払方法
            <select className={fieldClass} value={payment} onChange={e => setPayment(e.target.value as "none" | "parari" | "on_site")}>
              <option value="parari">PARARI決済（Square）</option>
              <option value="on_site" disabled={lite}>現地払い（Organizer以上）</option>
            </select>
          </label>}
          {isFee && <p className="text-xs leading-6 text-neutral-600">
            Square接続と販売者情報の登録・公開が必要です。
            <Link href="/my/settings/seller" className="ml-1 font-semibold text-sky-800 underline">販売者情報を設定</Link>
          </p>}
          <label className="block text-sm font-bold">補足・注意事項
            <textarea className={fieldClass} rows={4} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="持ち物・キャンセル時の連絡方法など" />
          </label>
          <div className="rounded-xl bg-neutral-50 p-4 text-sm leading-7">
            <strong>確認</strong>
            <p>{name || "名称未入力"} ／ {purpose !== "booking" ? (date + " " + startTime) : "日時は主催者と相談"} ／ {effectiveCapacity ?? (lite ? 10 : "指定なし")}名 ／ {isFee ? Number(fee).toLocaleString("ja-JP") + "円" : "無料"}</p>
            <p className="text-xs text-neutral-500">保存すると下書きのAPPLICATIONを作成します。公開・作品への配置は既存の作品編集画面で行います。</p>
          </div>
        </div>}

        {error && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
        {saved && <p className="mt-5 text-sm text-green-800" role="status">APPLICATIONを保存しました。</p>}
        <div className="mt-8 flex flex-wrap gap-2">
          {step > 0 && <button type="button" onClick={() => { setError(""); setStep(step-1); }} className="rounded-full border px-5 py-2.5 text-sm font-bold">前へ戻る</button>}
          {step < 2 ? (
            <button type="button" disabled={!canGoNext} onClick={next} className="rounded-full bg-neutral-950 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-40">次へ</button>
          ) : (
            <button type="button" disabled={saving || saved} onClick={() => void submit()}
              className="rounded-full bg-neutral-950 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-40">
              {saving ? "保存しています…" : "APPLICATIONを保存"}
            </button>
          )}
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-full px-5 py-2.5 text-sm font-bold text-neutral-500">作成をやめる</button>
        </div>
      </div>
    </div>
  );
}
