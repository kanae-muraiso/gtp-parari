"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export type ApplicationWizardDraft = {
  kind: "event" | "booking" | "sale" | "class";
  title: string;
  description: string;
  date: string;
  startTime: string;
  durationMinutes: string;
  place: string;
  cadence: string;
  attendance: string;
  capacity: string;
  price: string;
  payment: string;
  access: string;
  extraQuestion: string;
  notes: string;
};

type Props = {
  data: ApplicationWizardDraft;
  panelOrder: string[];
};

const applicationType = { event: "EVENT", booking: "OTHER", sale: "OTHER", class: "SCHOOL" } as const;
const actionLabel = { event: "参加を申し込む", booking: "予約を問い合わせる", sale: "購入を申し込む", class: "クラスに申し込む" } as const;

export default function SaveApplicationWizardDraft({ data, panelOrder }: Props) {
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function save() {
    setError("");
    setSuccess(false);
    const price = Number(data.price);
    const capacity = data.capacity.trim() ? Number(data.capacity) : (data.kind === "class" ? 10 : null);
    const scheduleNeeded = data.kind !== "sale" || data.cadence !== "none";

    if (!data.title.trim() || data.title.trim().length > 120) {
      setError("名称は1〜120文字で入力してください。");
      return;
    }
    if (data.description.length > 5000 || data.notes.length > 5000) {
      setError("案内文は5000文字以内にしてください。");
      return;
    }
    if (!Number.isSafeInteger(price) || price < 0) {
      setError("料金は0以上の整数で設定してください。");
      return;
    }
    if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < 1)) {
      setError("定員は1以上の整数で設定してください。");
      return;
    }
    if (scheduleNeeded && (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.startTime))) {
      setError("日付と開始時刻を指定してください。");
      return;
    }
    if (data.extraQuestion.trim()) {
      setError("追加質問の回答収集は、まだ実装されていません。質問欄を空にすると下書きを保存できます。");
      return;
    }
    if (data.access === "restricted") {
      setError("登録者限定の閲覧制御はこの作成画面では未対応です。一般公開かURL限定を選んでください。");
      return;
    }
    if (!supabase) {
      setError("PARARIの接続設定がありません。");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("ログインしてから保存してください。");
      const headers = {
        "Content-Type": "application/json",
        Authorization: "Bearer " + session.access_token,
      };
      const accessResponse = await fetch("/api/application/manage", { headers });
      const accessResult = await accessResponse.json();
      if (!accessResponse.ok || !accessResult.ok) {
        throw new Error(accessResult.message || "プラン情報を取得できませんでした。");
      }

      const plan = accessResult.access;
      if (!savedId && !plan.canCreateApplication) {
        throw new Error("APPLICATIONの作成可能数に達しています。");
      }
      if (plan.applicationMode === "lite" && capacity !== null && capacity > 10 && price === 0) {
        throw new Error("Liteの無料受付は10名までです。定員を10名以下に変更してください。");
      }
      if (price > 0 && data.payment === "onsite" && plan.effectivePlan === "free") {
        throw new Error("Free Liteでは有料の現地支払いを管理できません。Square決済を選ぶか、無料の受付として現地徴収をご案内ください。");
      }

      // Lite retains one class enrollment entry per person rather than creating a new entry each lesson.
      // No calendar occurrences, reservations or recurring charges are generated here.
      const wizard = {
        version: 1,
        kind: data.kind,
        date: scheduleNeeded ? data.date : null,
        startTime: scheduleNeeded ? data.startTime : null,
        durationMinutes: scheduleNeeded ? Number(data.durationMinutes) : null,
        cadence: data.cadence,
        location: data.place,
        attendance: data.attendance,
        visibilityHint: data.access,
        notes: data.notes,
        panelOrder,
        timezone: "Asia/Tokyo",
        recurringClassIsInformational: data.kind === "class",
      };
      const paymentMethod = price === 0 ? "none" : (data.payment === "online" ? "parari" : "on_site");
      const body = {
        ...(savedId ? { applicationId: savedId } : {}),
        applicationType: applicationType[data.kind],
        title: data.title.trim(),
        description: data.description.trim(),
        definition: {
          mode: plan.applicationMode,
          blocks: [],
          fields: [],
          inputFields: [],
          capacity,
          agreement: "",
          actionLabel: actionLabel[data.kind],
          passEnabled: false,
          display: { applicationLabel: false, typeLabel: false, title: true, status: true, remainingSlots: true },
          wizard,
        },
        formId: null,
        acceptanceMode: "instant",
        paymentMethod,
        paymentAmount: price > 0 ? price : null,
        paymentUrl: "",
        paymentInstructions: "",
        paymentConfirmationRequired: false,
        cancellationMode: "not_allowed",
      };
      const response = await fetch("/api/application/manage", {
        method: savedId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok || !json.application?.id) {
        throw new Error(json?.message || "下書きを保存できませんでした。");
      }
      setSavedId(json.application.id);
      setSuccess(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <h3 className="font-semibold">APPLICATIONの下書き保存</h3>
      <p className="text-sm text-slate-600">
        既存の受付機能へ設定を保存します。保存時点では公開されません。
        Liteの継続クラスは同じ受講者10名までを一度登録する方式です。
        毎回の予約、CALENDAR作成、FORMの追加質問、PAGEの自動生成はまだ接続していません。
      </p>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {success && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          下書きを保存しました。STUDIOの運営画面で受付を開き、作品に設置してください。
          <div><Link className="underline" href="/my/works">STUDIOへ戻る</Link></div>
        </div>
      )}
      <button onClick={() => void save()} disabled={saving} className="rounded-lg bg-amber-700 px-5 py-2.5 font-medium text-white disabled:opacity-50">
        {saving ? "保存中…" : savedId ? "下書きを更新" : "下書きを保存"}
      </button>
    </section>
  );
}
