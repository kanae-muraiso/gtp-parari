"use client";

import { useState } from "react";
import { classCalendarToday } from "@/lib/classCalendar";
import { classDateRuleKey, hasDuplicateClassDateRules, type ClassDateRule, type ClassScheduleRules } from "@/lib/classRecurrence";
import type { SchoolClass } from "@/lib/classes";
import { ClassDateRuleFields } from "./ClassDateRuleFields";

type SlotRow = {
  id: string;
  new: boolean;
  productId?: string;
  name: string;
  date: string;
  time: string;
  duration: string;
  delivery: SchoolClass["delivery"];
  location: string;
  meetingUrl: string;
  feeOverride: string;
  useLegacy: boolean;
  rules: ClassScheduleRules;
};

const field = "block w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-2 py-2";
const secondary = "w-fit rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm";
const newOverride = { rule: { kind: "nth", weekday: 5, ordinal: 3 } as ClassDateRule, location: "", fee: 0 };

function originalRule(cadence: SchoolClass["cadence"], day: string): ClassDateRule {
  const date = new Date(day + "T00:00:00Z");
  return cadence === "monthly" ? { kind: "date", date: date.getUTCDate() } : { kind: "weekly", weekday: date.getUTCDay() };
}

function newRow(id: string, productId?: string): SlotRow {
  return { id, productId, new: true, name: "", date: "", time: "", duration: "60", delivery: "onsite",
    location: "", meetingUrl: "", feeOverride: "", useLegacy: false,
    rules: { rules: [originalRule("weekly", classCalendarToday())], overrides: [] } };
}

export default function ClassSlotSettingsPanel({ item, startId, productId, walkIn, busy, save }: {
  item?: SchoolClass;
  startId: string;
  productId?: string;
  walkIn: boolean;
  busy: boolean;
  save: (slot: Omit<SlotRow, "useLegacy">) => Promise<boolean>;
}) {
  const [row, setRow] = useState<SlotRow>(() => item ? {
    id: item.id, new: false, name: item.name, date: item.starts_on, time: item.starts_at.slice(0, 5),
    duration: String(item.duration_minutes ?? 60), delivery: item.delivery, location: item.location ?? "",
    meetingUrl: item.meeting_url ?? "", feeOverride: item.fee_override_yen?.toString() ?? "",
    useLegacy: !item.schedule_rules?.rules.length,
    rules: {
      rules: item.schedule_rules?.rules.length ? item.schedule_rules.rules : [originalRule(item.cadence, item.starts_on)],
      overrides: item.schedule_rules?.overrides ?? [],
    },
  } : newRow(startId, productId));
  const [frequencyError, setFrequencyError] = useState("");
  function patch(values: Partial<SlotRow>) {
    setRow(current => ({ ...current, ...values }));
  }
  function setFrequencies(rules: ClassScheduleRules["rules"]) {
    setFrequencyError("");
    patch({ useLegacy: false, rules: { ...row.rules, rules } });
  }
  const frequencyKeys = row.rules.rules.map(classDateRuleKey);

  return <form className="grid gap-4 text-sm" onSubmit={event => {
    event.preventDefault();
    if (busy) return;
    if (hasDuplicateClassDateRules(row.rules.rules)) {
      setFrequencyError("同じ頻度が複数あります。追加した頻度を変更するか、重複した頻度を削除してください。");
      return;
    }
    const { useLegacy, ...slot } = row;
    void save({ ...slot, rules: useLegacy ? { ...slot.rules, rules: [] } : slot.rules });
  }}>
    <fieldset disabled={busy} className="grid min-w-0 gap-4">
      <label className="grid w-full max-w-sm gap-1">開催枠の名前
        <input className={field} required maxLength={120} value={row.name} onChange={e => patch({ name: e.target.value })} />
      </label>
      <div className="grid items-end gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <label className="grid gap-1">初回日
          <input className={field} type="date" required value={row.date} onChange={e => {
            const date = e.target.value;
            patch({ date, ...(row.useLegacy && date && item ? {
              rules: { ...row.rules, rules: [originalRule(item.cadence, date)] },
            } : {}) });
          }} />
        </label>
        <label className="grid gap-1">開始時刻
          <input className={field} type="time" required value={row.time} onChange={e => patch({ time: e.target.value })} />
        </label>
        <label className="grid gap-1">所要時間（分）
          <input className={field} type="number" min={5} max={480} required value={row.duration} onChange={e => patch({ duration: e.target.value })} />
        </label>
        <label className="grid gap-1">方法
          <select className={field} value={row.delivery} onChange={e => patch({ delivery: e.target.value as SlotRow["delivery"] })}>
            <option value="onsite">対面</option><option value="online">オンライン</option><option value="hybrid">対面とオンライン</option>
          </select>
        </label>
        <label className="grid gap-1">会場
          <input className={field} maxLength={200} required={row.delivery === "hybrid"} disabled={row.delivery === "online"}
            value={row.location} onChange={e => patch({ location: e.target.value })} />
        </label>
        <label className="grid gap-1">費用（円）
          <input className={field} type="number" min={0} max={1000000} placeholder="商品の基本料金" value={row.feeOverride}
            onChange={e => patch({ feeOverride: e.target.value })} />
        </label>
        {row.delivery !== "onsite" && <label className="grid gap-1 sm:col-span-full">授業の参加リンク
          <input className={field} type="url" required maxLength={2000} value={row.meetingUrl} onChange={e => patch({ meetingUrl: e.target.value })} />
        </label>}
      </div>
      <fieldset className="grid min-w-0 gap-3 rounded-xl border p-3">
        <legend className="px-1 font-semibold">頻度</legend>
        {row.rules.rules.map((rule, index) => <div key={index} className="flex flex-wrap items-end gap-2">
          <ClassDateRuleFields rule={rule} change={next => setFrequencies(
            row.rules.rules.map((value, i) => i === index ? { ...next, name: rule.name } : value))} />
          <label>名前（任意）
            <input className={field} maxLength={120} value={rule.name ?? ""} onChange={e => setFrequencies(
              row.rules.rules.map((value, i) => i === index ? { ...value, name: e.target.value } : value))} />
          </label>
          {row.rules.rules.length > 1 && <button type="button" className={secondary}
            onClick={() => setFrequencies(row.rules.rules.filter((_, i) => i !== index))}>頻度を外す</button>}
          {frequencyKeys.lastIndexOf(frequencyKeys[index]) !== frequencyKeys.indexOf(frequencyKeys[index]) &&
            <span className="text-xs text-amber-800">同じ頻度があります</span>}
        </div>)}
        {row.rules.rules.length < 20 && <button type="button" className={secondary} onClick={() => setFrequencies(
          [...row.rules.rules, { ...row.rules.rules[row.rules.rules.length - 1] }])}>＋ 頻度を追加</button>}
        {frequencyError && <p role="alert" className="text-red-700">{frequencyError}</p>}
      </fieldset>
      {walkIn && <details>
        <summary className="cursor-pointer font-medium">特定の回だけ会場・費用を変更</summary>
        <div className="mt-2 grid gap-2">
          {row.rules.overrides.map((override, i) => {
            function change(values: Partial<typeof override>) {
              patch({ rules: { ...row.rules,
                overrides: row.rules.overrides.map((value, index) => index === i ? { ...value, ...values } : value) } });
            }
            return <div className="flex flex-wrap items-end gap-2" key={i}>
              <ClassDateRuleFields rule={override.rule} change={rule => change({ rule })} />
              <label>会場<input className={field} required maxLength={200} value={override.location} onChange={e => change({ location: e.target.value })} /></label>
              <label>費用（円）<input className={field} type="number" required min={0} max={1000000} value={override.fee} onChange={e => change({ fee: Number(e.target.value) })} /></label>
              <button type="button" className={secondary} onClick={() => patch({ rules: { ...row.rules,
                overrides: row.rules.overrides.filter((_, index) => index !== i) } })}>変更を削除</button>
            </div>;
          })}
          {row.rules.overrides.length < 20 && <button type="button" className={secondary} onClick={() =>
            patch({ rules: { ...row.rules, overrides: [...row.rules.overrides, newOverride] } })}>＋ 会場・費用の変更を追加</button>}
        </div>
      </details>}
      <button className="w-fit rounded-lg bg-neutral-900 px-4 py-2 font-semibold text-white">開催枠を保存</button>
    </fieldset>
  </form>;
}
