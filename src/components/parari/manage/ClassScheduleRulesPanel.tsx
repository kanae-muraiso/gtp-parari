"use client";

import { useState } from "react";
import type { SchoolClass } from "@/lib/classes";
import { classWeekdays, type ClassDateRule, type ClassScheduleRules } from "@/lib/classRecurrence";

const field = "rounded-lg border border-neutral-300 bg-white px-3 py-2";
const newRule: ClassDateRule = { kind: "weekly", weekday: 5 };
const newOverride = { rule: { kind: "nth", ordinal: 3, weekday: 5 } as ClassDateRule, location: "", fee: 0 };

export default function ClassScheduleRulesPanel({ item, walkIn, busy, save }: {
  item: SchoolClass; walkIn: boolean; busy: boolean; save: (value: ClassScheduleRules) => Promise<boolean>;
}) {
  const first = new Date(item.starts_on + "T00:00:00Z");
  const fallback: ClassDateRule = item.cadence === "weekly"
    ? { kind: "weekly", weekday: first.getUTCDay() } : { kind: "date", date: first.getUTCDate() };
  const [value, setValue] = useState<ClassScheduleRules>(() => ({
    rules: item.schedule_rules?.rules.length ? item.schedule_rules.rules : [fallback],
    overrides: item.schedule_rules?.overrides ?? [],
  }));
  function updateRule(index: number, rule: ClassDateRule) {
    setValue(current => ({ ...current, rules: current.rules.map((entry, i) => i === index ? rule : entry) }));
  }
  function updateOverride(index: number, change: Partial<ClassScheduleRules["overrides"][number]>) {
    setValue(current => ({ ...current, overrides: current.overrides.map((entry, i) => i === index ? { ...entry, ...change } : entry) }));
  }
  return <details className="rounded-lg border p-3">
    <summary className="cursor-pointer font-semibold">開催ルール</summary>
    <form className="mt-3 grid gap-3 text-sm" onSubmit={event => { event.preventDefault(); void save(value); }}>
      <p>この開催枠の開始時刻で日程を作ります。保存済みの月は、下のカレンダーで調整できます。</p>
      {value.rules.map((rule, i) => <div key={i} className="flex flex-wrap items-end gap-2">
        <RuleFields rule={rule} change={next => updateRule(i, next)} />
        {value.rules.length > 1 && <button type="button" className={field}
          onClick={() => setValue(current => ({ ...current, rules: current.rules.filter((_, index) => index !== i) }))}>削除</button>}
      </div>)}
      {value.rules.length < 20 && <button type="button" className={field + " w-fit"}
        onClick={() => setValue(current => ({ ...current, rules: [...current.rules, newRule] }))}>＋ 開催ルールを追加</button>}
      {walkIn && <fieldset className="grid gap-3 border-t pt-3">
        <legend className="font-semibold">特定の回だけ会場・参加費を変更</legend>
        {value.overrides.map((override, i) => <div key={i} className="grid gap-2 rounded-lg border p-3">
          <div className="flex flex-wrap gap-2"><RuleFields rule={override.rule} change={rule => updateOverride(i, { rule })} /></div>
          <label>会場 <input className={field} required maxLength={200} value={override.location}
            onChange={e => updateOverride(i, { location: e.target.value })} /></label>
          <label>参加費（円） <input className={field} type="number" required min={0} max={1000000} value={override.fee}
            onChange={e => updateOverride(i, { fee: Number(e.target.value) })} /></label>
          <button type="button" className={field + " w-fit"} onClick={() =>
            setValue(current => ({ ...current, overrides: current.overrides.filter((_, index) => index !== i) }))}>この変更を削除</button>
        </div>)}
        {value.overrides.length < 20 && <button type="button" className={field + " w-fit"} onClick={() =>
          setValue(current => ({ ...current, overrides: [...current.overrides, newOverride] }))}>＋ 会場・参加費の変更を追加</button>}
      </fieldset>}
      <button className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-50" disabled={busy}>開催ルールを保存</button>
    </form>
  </details>;
}

function RuleFields({ rule, change }: { rule: ClassDateRule; change: (rule: ClassDateRule) => void }) {
  const weekday = "weekday" in rule ? rule.weekday : 5;
  return <>
    <label>頻度 <select className={field} value={rule.kind} onChange={e => {
      const kind = e.target.value;
      if (kind === "date") change({ kind, date: 1 });
      else if (kind === "nth") change({ kind, weekday, ordinal: 1 });
      else change({ kind: "weekly", weekday });
    }}><option value="weekly">毎週</option><option value="nth">毎月・第何曜日</option><option value="date">毎月・日付指定</option></select></label>
    {rule.kind === "nth" && <label>第 <select className={field} value={rule.ordinal}
      onChange={e => change({ ...rule, ordinal: Number(e.target.value) })}>
      {[1, 2, 3, 4, 5].map(value => <option key={value}>{value}</option>)}
    </select></label>}
    {rule.kind === "date" ? <label>日付 <select className={field} value={rule.date}
      onChange={e => change({ ...rule, date: Number(e.target.value) })}>
      {Array.from({ length: 31 }, (_, index) => <option key={index} value={index + 1}>{index + 1}日</option>)}
    </select></label> : <label>曜日 <select className={field} value={rule.weekday}
      onChange={e => change({ ...rule, weekday: Number(e.target.value) })}>
      {classWeekdays.map((label, value) => <option key={label} value={value}>{label}曜日</option>)}
    </select></label>}
  </>;
}
