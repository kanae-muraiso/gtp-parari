"use client";

import { useState } from "react";
import { classCalendarToday } from "@/lib/classCalendar";
import { hasDuplicateClassDateRules, type ClassDateRule, type ClassScheduleRules } from "@/lib/classRecurrence";
import { defaultClassSlotSettings, type ClassSlotDefaults } from "@/lib/classProduct";
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

function standardFields(defaults: ClassSlotDefaults) {
  return { duration: String(defaults.duration), delivery: defaults.delivery,
    location: defaults.delivery === "online" ? "" : defaults.location, feeOverride: "" };
}

function newRow(id: string, productId: string | undefined, defaults: ClassSlotDefaults): SlotRow {
  return { id, productId, new: true, name: "", date: "", time: "", ...standardFields(defaults),
    meetingUrl: "", useLegacy: false,
    rules: { rules: [originalRule("weekly", classCalendarToday())], overrides: [] } };
}

export default function ClassSlotSettingsPanel({ item, additionalSlots, startId, productId, slotDefaults, basicFee, walkIn, busy, save }: {
  item?: SchoolClass;
  additionalSlots: SchoolClass[];
  startId: string;
  productId?: string;
  slotDefaults?: ClassSlotDefaults;
  basicFee?: number;
  walkIn: boolean;
  busy: boolean;
  save: (slots: Omit<SlotRow, "useLegacy">[], onError: (message: string) => void) => Promise<boolean>;
}) {
  const [rows, setRows] = useState<SlotRow[]>(() => item
    ? [item, ...additionalSlots].map(item => ({
      id: item.id, new: false, name: item.name, date: item.starts_on, time: item.starts_at.slice(0, 5),
      duration: String(item.duration_minutes ?? 60), delivery: item.delivery, location: item.location ?? "",
      meetingUrl: item.meeting_url ?? "", feeOverride: item.fee_override_yen?.toString() ?? "",
      useLegacy: !item.schedule_rules?.rules.length,
      rules: {
        parentSlotId: item.schedule_rules?.parentSlotId,
        rules: item.schedule_rules?.rules.length ? item.schedule_rules.rules : [originalRule(item.cadence, item.starts_on)],
        overrides: item.schedule_rules?.overrides ?? [],
      },
    }))
    : [newRow(startId, productId, slotDefaults ?? defaultClassSlotSettings)]);
  const [saveError, setSaveError] = useState("");
  function patch(id: string, values: Partial<SlotRow>) {
    setSaveError("");
    setRows(current => current.map(row => row.id === id ? { ...row, ...values } : row));
  }

  function addFrequency() {
    const first = rows[0];
    const id = crypto.randomUUID();
    setSaveError("");
    setRows(current => [...current, {
      ...first, ...(slotDefaults ? standardFields(slotDefaults) : {}), id, productId, new: true, useLegacy: false,
      meetingUrl: !slotDefaults || slotDefaults.delivery === first.delivery ? first.meetingUrl : "",
      rules: { parentSlotId: first.id, rules: [{ ...first.rules.rules[0] }], overrides: [] },
    }]);
  }

  return <form className="grid gap-4 text-sm" onSubmit={event => {
    event.preventDefault();
    if (busy) return;
    if (rows.some(row => hasDuplicateClassDateRules(row.rules.rules))) {
      setSaveError("同じ行に同じ頻度が複数あります。頻度を変更してください。");
      return;
    }
    setSaveError("");
    void save(rows.map(({ useLegacy, ...slot }, index) => ({
      ...slot, name: index ? slot.rules.rules[0].name?.trim() || rows[0].name : slot.name,
      rules: useLegacy ? { ...slot.rules, rules: [] } : slot.rules,
    })), setSaveError).then(ok => {
      if (ok) setRows(current => current.map(row => ({ ...row, new: false })));
    });
  }}>
    <fieldset disabled={busy} className="grid min-w-0 gap-4">
      <label className="grid w-full max-w-sm gap-1">開催枠の名前
        <input className={field} required maxLength={120} value={rows[0].name} onChange={e => patch(rows[0].id, { name: e.target.value })} />
      </label>
      {rows.map((row, index) => {
        function setFrequencies(rules: ClassScheduleRules["rules"]) {
          patch(row.id, { useLegacy: false, rules: { ...row.rules, rules } });
        }
        const standard = standardFields(slotDefaults ?? defaultClassSlotSettings);
        const customized = row.duration !== standard.duration || row.delivery !== standard.delivery ||
          (row.delivery !== "online" && row.location !== standard.location) ||
          row.feeOverride !== "" || row.rules.overrides.length > 0;
        return <div key={row.id} className="grid min-w-0 gap-3 border-t border-neutral-200 pt-3">
          {row.rules.rules.map((rule, ruleIndex) => <div key={ruleIndex} className="flex flex-wrap items-end gap-2">
            <ClassDateRuleFields rule={rule} change={next => setFrequencies(row.rules.rules.map((value, i) =>
              i === ruleIndex ? { ...next, name: value.name } : value))} />
            <label>頻度の名前（任意）
              <input className={field} maxLength={120} value={rule.name ?? ""} onChange={e => setFrequencies(
                row.rules.rules.map((value, i) => i === ruleIndex ? { ...value, name: e.target.value } : value))} />
            </label>
            {row.rules.rules.length > 1 && <button type="button" className={secondary}
              onClick={() => setFrequencies(row.rules.rules.filter((_, i) => i !== ruleIndex))}>頻度を外す</button>}
            {index > 0 && row.new && <button type="button" className={secondary} onClick={() => {
              setSaveError("");
              setRows(current => current.filter(value => value.id !== row.id));
            }}>追加を取り消す</button>}
          </div>)}
          <div className="grid items-end gap-3 sm:grid-cols-2">
            <label className="grid gap-1">初回日
              <input className={field} type="date" required value={row.date} onChange={e => {
                const date = e.target.value;
                patch(row.id, { date, ...(row.useLegacy && date ? {
                  rules: { ...row.rules, rules: [originalRule(row.rules.rules[0].kind === "weekly" ? "weekly" : "monthly", date)] },
                } : {}) });
              }} />
            </label>
            <label className="grid gap-1">開始時刻
              <input className={field} type="time" required value={row.time} onChange={e => patch(row.id, { time: e.target.value })} />
            </label>
          </div>
          {row.delivery !== "onsite" && <label className="grid gap-1">授業の参加リンク
            <input className={field} type="url" required maxLength={2000} value={row.meetingUrl} onChange={e => patch(row.id, { meetingUrl: e.target.value })} />
          </label>}
          <details onInvalidCapture={event => { event.currentTarget.open = true; }}>
            <summary className="w-fit cursor-pointer font-medium">
              オプション{customized && <span className="ml-2 text-xs font-normal text-neutral-600">個別設定あり</span>}
            </summary>
            <div className="mt-3 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1">所要時間（分）
                <input className={field} type="number" min={5} max={480} required value={row.duration} onChange={e => patch(row.id, { duration: e.target.value })} />
              </label>
              <label className="grid gap-1">方法
                <select className={field} value={row.delivery} onChange={e => patch(row.id, { delivery: e.target.value as SlotRow["delivery"] })}>
                  <option value="onsite">対面</option><option value="online">オンライン</option><option value="hybrid">対面とオンライン</option>
                </select>
              </label>
              <label className="grid gap-1">会場
                <input className={field} maxLength={200} required={row.delivery === "hybrid"} disabled={row.delivery === "online"}
                  value={row.location} onChange={e => patch(row.id, { location: e.target.value })} />
              </label>
              <label className="grid gap-1">{walkIn ? "参加費（円）" : "月謝（円）"}
                <input className={field} type="number" min={0} max={1000000} placeholder={basicFee === undefined ? "商品の基本料金" : String(basicFee)} value={row.feeOverride}
                  onChange={e => patch(row.id, { feeOverride: e.target.value })} />
              </label>
            </div>
            {slotDefaults && <button type="button" className="mt-2 text-sm underline"
              onClick={() => patch(row.id, standard)}>商品の標準設定を使う</button>}
            {walkIn && <details className="mt-3" onInvalidCapture={event => { event.currentTarget.open = true; }}>
              <summary className="cursor-pointer font-medium">特定の回だけ会場・費用を変更</summary>
              <div className="mt-2 grid gap-2">
                {row.rules.overrides.map((override, i) => {
                  function change(values: Partial<typeof override>) {
                    patch(row.id, { rules: { ...row.rules,
                      overrides: row.rules.overrides.map((value, index) => index === i ? { ...value, ...values } : value) } });
                  }
                  return <div className="flex flex-wrap items-end gap-2" key={i}>
                    <ClassDateRuleFields rule={override.rule} change={rule => change({ rule })} />
                    <label>会場<input className={field} required maxLength={200} value={override.location} onChange={e => change({ location: e.target.value })} /></label>
                    <label>費用（円）<input className={field} type="number" required min={0} max={1000000} value={override.fee} onChange={e => change({ fee: Number(e.target.value) })} /></label>
                    <button type="button" className={secondary} onClick={() => patch(row.id, { rules: { ...row.rules,
                      overrides: row.rules.overrides.filter((_, index) => index !== i) } })}>変更を削除</button>
                  </div>;
                })}
                {row.rules.overrides.length < 20 && <button type="button" className={secondary} onClick={() =>
                  patch(row.id, { rules: { ...row.rules, overrides: [...row.rules.overrides, newOverride] } })}>＋ 会場・費用の変更を追加</button>}
              </div>
            </details>}
          </details>
        </div>;
      })}
      {productId && rows.length < 12 && <button type="button" className={secondary} onClick={addFrequency}>＋ 頻度を追加</button>}
      {!productId && <p className="text-xs text-neutral-600">頻度ごとに日時や料金を設定するには、商品に登録した開催枠を開いてください。</p>}
      {saveError && <p role="alert" className="text-red-700">{saveError}</p>}
      <button className="w-fit rounded-lg bg-neutral-900 px-4 py-2 font-semibold text-white">開催枠を保存</button>
    </fieldset>
  </form>;
}
