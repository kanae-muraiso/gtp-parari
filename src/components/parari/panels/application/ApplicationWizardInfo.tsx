"use client";

import type { ReactNode } from "react";

type WizardData = {
  version: number;
  kind: "event" | "booking" | "sale" | "class";
  date?: string | null;
  startTime?: string | null;
  durationMinutes?: number | null;
  cadence?: string;
  location?: string;
  attendance?: string;
  notes?: string;
  timezone?: string;
  panelOrder?: string[];
};
type Props = {
  definition: unknown;
  description?: string | null;
  paymentAmount?: number | null;
  capacity?: number | null;
};

function readWizard(definition: unknown): WizardData | null {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) return null;
  const data = (definition as { wizard?: unknown }).wizard;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const candidate = data as Partial<WizardData>;
  if (candidate.version !== 1) return null;
  if (!["event", "booking", "sale", "class"].includes(String(candidate.kind))) return null;
  return candidate as WizardData;
}

function ending(start: string, duration: number) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) ||
    !Number.isFinite(duration) || duration < 1 || duration > 1440) return "";
  const [hour, minute] = start.split(":").map(Number);
  const total = hour * 60 + minute + duration;
  const end = String(Math.floor(total / 60) % 24).padStart(2, "0") + ":" +
    String(total % 60).padStart(2, "0");
  return end + (total >= 1440 ? "（翌日）" : "");
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-4 py-3">
      <dt className="text-xs font-semibold text-neutral-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-800">{children}</dd>
    </div>
  );
}

/** Read-only guide for APPLICATION wizard metadata. Booking, payment and quotas
 * remain the responsibility of the existing APPLICATION/CALENDAR server APIs. */
export default function ApplicationWizardInfo({ definition, description, paymentAmount, capacity }: Props) {
  const wizard = readWizard(definition);
  if (!wizard) return null;
  const duration = Number(wizard.durationMinutes);
  const end = ending(String(wizard.startTime || ""), duration);
  const recurring = wizard.cadence === "weekly" || wizard.cadence === "daily";
  const labels = {
    once: "1回",
    weekly: "毎週",
    daily: "毎日",
    custom: "個別日程",
    none: "日時指定なし",
  } as Record<string, string>;
  const blocks: Record<string, ReactNode> = {
    intro: description ? <Item label="紹介">{description}</Item> : null,
    schedule: wizard.date && wizard.startTime ? (
      <Item label="日時・場所">
        {labels[wizard.cadence || "once"] || "指定日"} ／ {wizard.date} ／ {wizard.startTime}
        {end ? "〜" + end : ""}
        {wizard.location ? " ／ " + wizard.location : ""}
        {recurring ? "\n※繰り返しの目安です。個々の開催回・空き枠の確定表示ではありません。" : ""}
      </Item>
    ) : wizard.location ? <Item label="提供場所">{wizard.location}</Item> : null,
    capacity: (
      <Item label="受付の条件">
        {capacity === null || capacity === undefined ? "定員指定なし" : "定員 " + capacity + "名"}
        {wizard.kind === "class" && wizard.attendance === "fixed" ? " ／ 固定受講者" : ""}
        {wizard.kind === "class" && wizard.attendance === "mixed" ? " ／ 継続受講＋新規募集" : ""}
        {wizard.kind === "class" && wizard.attendance === "per_event" ? " ／ 都度参加" : ""}
      </Item>
    ),
    payment: <Item label="料金">{paymentAmount && paymentAmount > 0 ? paymentAmount.toLocaleString("ja-JP") + "円" : "無料"}</Item>,
    form: <Item label="申込について">受付はこのページの申込ボタンから行います。正式な受付可否・料金は申込画面に表示される条件に従います。</Item>,
  };
  const requested = Array.isArray(wizard.panelOrder) ? wizard.panelOrder : [];
  const order = [...new Set([...requested, "intro", "schedule", "capacity", "payment", "form"])]
    .filter(key => Object.prototype.hasOwnProperty.call(blocks, key));
  return (
    <div className="mt-4 space-y-3">
      {order.map(key => <div key={key}>{blocks[key]}</div>)}
      {wizard.notes ? <Item label="主催者からの案内">{wizard.notes}</Item> : null}
      {wizard.kind === "booking" ? (
        <p className="text-xs leading-5 text-neutral-600">
          現在は予約希望の受付です。空き時間の自動確保や重複予約の防止には対応していません。日時の確定は主催者からの連絡を確認してください。
        </p>
      ) : null}
      {wizard.kind === "class" ? (
        <p className="text-xs leading-5 text-neutral-600">
          継続クラスは初回の参加登録を利用します。開催回ごとの出欠、月謝、振替は主催者が管理します。
        </p>
      ) : null}
    </div>
  );
}
