"use client";

import { useRef, useState, type PointerEvent } from "react";
import type { SchoolClass } from "@/lib/classes";
import type { OfficeHour } from "./ClassAvailabilityPanel";

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
const channels = ["onsite", "phone"] as const;
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
const time = (value: number) => [Math.floor(value / 60), value % 60].map(x => String(x).padStart(2, "0")).join(":");
const position = (from: number, to: number) => ({ left: from / 14.4 + "%", width: (to - from) / 14.4 + "%" });
type Drag = { weekday: number; channel: OfficeHour["channel"]; index: number | null; edge: "new" | "start" | "end" | "move"; anchor: number; from: number; to: number; width: number; x: number; moved: boolean };

export default function ClassWeekTimeline({ hours, classes, disabled, onChange }: {
  hours: OfficeHour[]; classes: SchoolClass[]; disabled: boolean; onChange: (hours: OfficeHour[]) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<Drag | null>(null);
  const drag = useRef<Drag | null>(null);
  const latest = useRef<Drag | null>(null);
  const current = selected === null ? null : hours[selected];
  const lessons = classes.flatMap(item => {
    const weekday = new Date(item.starts_on + "T00:00:00Z").getUTCDay();
    const from = minutes(item.starts_at);
    const end = from + (item.duration_minutes ?? 60);
    const first = [{ key: item.id, weekday, from, to: Math.min(1440, end), item }];
    return end <= 1440 ? first : [...first, { key: item.id + "-continued", weekday: (weekday + 1) % 7, from: 0, to: end - 1440, item }];
  });

  function begin(event: PointerEvent<HTMLDivElement>, weekday: number, channel: OfficeHour["channel"]) {
    if (disabled || event.button !== 0) return;
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-index]");
    const index = target ? Number(target.dataset.index) : null;
    const edge = (event.target as HTMLElement).dataset.edge === "start" ? "start" :
      (event.target as HTMLElement).dataset.edge === "end" ? "end" : index === null ? "new" : "move";
    if (index === null && hours.length >= 42) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    const anchor = Math.max(0, Math.min(1425, Math.round((event.clientX - bounds.left) / bounds.width * 96) * 15));
    const from = index === null ? anchor : minutes(hours[index].starts);
    const to = index === null ? anchor + 14 : minutes(hours[index].ends);
    drag.current = { weekday, channel, index, edge, anchor, from, to, width: bounds.width, x: event.clientX, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || (Math.abs(event.clientX - state.x) < 4 && !state.moved)) return;
    const delta = Math.round((event.clientX - state.x) / state.width * 96) * 15;
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    let { from, to } = state;
    if (state.edge === "new") {
      from = clamp(state.anchor + Math.min(0, delta), 0, 1425);
      to = clamp(state.anchor + Math.max(15, delta), from + 5, 1439);
    } else if (state.edge === "start") from = clamp(from + delta, 0, to - 5);
    else if (state.edge === "end") to = clamp(to + delta, from + 5, 1439);
    else {
      const start = clamp(from + delta, 0, 1439 - (to - from));
      to += start - from;
      from = start;
    }
    state.moved = true;
    latest.current = { ...state, from, to };
    setDraft(latest.current);
  }

  function end() {
    const state = drag.current;
    const final = latest.current;
    if (state?.moved && final) {
      const row = { weekday: final.weekday, channel: final.channel, starts: time(final.from), ends: time(final.to) };
      onChange(state.index === null ? [...hours, row] : hours.map((value, index) => index === state.index ? row : value));
      setSelected(state.index ?? hours.length);
    } else if (state?.index != null) setSelected(state.index);
    drag.current = null;
    latest.current = null;
    setDraft(null);
  }

  function changeSelected(change: Partial<OfficeHour>) {
    onChange(hours.map((row, index) => index === selected ? { ...row, ...change } : row));
  }

  return <div className="grid gap-3">
    <p className="text-sm text-neutral-600">受付帯は空いている場所をドラッグして追加します。帯の中央で移動、両端で伸縮、クリックで時刻を調整できます。橙色は授業で、受付枠から自動で差し引かれます。</p>
    <div className="overflow-x-auto rounded-lg border">
      <div className="min-w-[900px]">
        <div className="grid grid-cols-[5rem_1fr] border-b bg-neutral-50">
          <span className="p-2 text-xs">日本時間</span>
          <div className="relative h-8 text-xs">
            {Array.from({ length: 24 }, (_, hour) => <span className="absolute top-2" style={{ left: hour / 24 * 100 + "%" }} key={hour}>{hour}</span>)}
            <span className="absolute right-1 top-2">24</span>
          </div>
        </div>
        {[1, 2, 3, 4, 5, 6, 0].map(weekday => <div key={weekday} className="grid grid-cols-[5rem_1fr] border-b last:border-0">
          <div className="grid bg-neutral-50 p-1 text-xs"><strong>{weekdays[weekday]}曜</strong><span>対面 / 電話</span></div>
          <div className="relative">
            {lessons.filter(item => item.weekday === weekday).map(lesson =>
              <div key={lesson.key} className="relative z-10 h-6 bg-orange-500 px-1 text-xs text-black"
                style={position(lesson.from, lesson.to)} title={lesson.item.name + " " + time(lesson.from) + "〜" + time(lesson.to)}>
                <span className="block truncate">{lesson.item.cadence === "monthly" ? "毎月 · " : ""}{lesson.item.name}</span>
              </div>)}
            {channels.map(channel => <div key={channel} aria-label={weekdays[weekday] + "曜 " + (channel === "onsite" ? "対面" : "電話")}
              className="relative h-7 touch-none border-t bg-neutral-100"
              style={{ backgroundImage: "linear-gradient(to right,#d4d4d4 1px,transparent 1px)", backgroundSize: "calc(100% / 24) 100%" }}
              onPointerDown={event => begin(event, weekday, channel)} onPointerMove={move} onPointerUp={end}
              onPointerCancel={() => { drag.current = null; latest.current = null; setDraft(null); }}>
              {hours.map((row, index) => row.weekday === weekday && row.channel === channel &&
                <button type="button" key={index} data-index={index} disabled={disabled} aria-pressed={selected === index}
                  aria-label={weekdays[weekday] + "曜 " + row.starts + "〜" + row.ends}
                  onClick={event => { if (event.detail === 0) setSelected(index); }}
                  className={`absolute inset-y-0 flex min-w-0 items-center justify-center overflow-hidden rounded px-2 text-xs ${selected === index ? "ring-2 ring-inset ring-neutral-900" : ""} ${channel === "onsite" ? "bg-emerald-200" : "bg-sky-200"}`}
                  style={position(minutes(row.starts), minutes(row.ends))}>
                  <span data-edge="start" className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-black/15" />
                  <span className="truncate">{row.starts}〜{row.ends}</span>
                  <span data-edge="end" className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-black/15" />
                </button>)}
              {lessons.filter(lesson => lesson.weekday === weekday && lesson.item.cadence === "weekly").map(lesson =>
                <span key={lesson.key} aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-10 border-x border-orange-600/50 bg-orange-400/35"
                  style={position(lesson.from, lesson.to)} />)}
              {draft?.weekday === weekday && draft.channel === channel && <span className="pointer-events-none absolute inset-y-0 z-20 rounded bg-teal-700/70" style={position(draft.from, draft.to)} />}
            </div>)}
          </div>
        </div>)}
      </div>
    </div>
    <div className="flex flex-wrap gap-2 text-sm">
      {[1, 2, 3, 4, 5, 6, 0].map(weekday => <button type="button" disabled={disabled || hours.length >= 42} key={weekday}
        className="rounded border px-2 py-1" onClick={() => {
          onChange([...hours, { weekday, channel: "onsite", starts: "10:00", ends: "12:00" }]);
          setSelected(hours.length);
        }}>{weekdays[weekday]}曜に追加</button>)}
    </div>
    {current && <fieldset className="grid gap-2 rounded border p-3" disabled={disabled}>
      <legend className="px-1 text-sm font-semibold">{weekdays[current.weekday]}曜の受付帯を調整</legend>
      <div className="flex flex-wrap gap-2 text-sm">
        <label>方法 <select className="rounded border p-2" value={current.channel}
          onChange={event => changeSelected({ channel: event.target.value === "phone" ? "phone" : "onsite" })}>
          <option value="onsite">対面</option><option value="phone">電話</option>
        </select></label>
        <label>開始 <input className="rounded border p-2" type="time" required value={current.starts} onChange={event => changeSelected({ starts: event.target.value })} /></label>
        <label>終了 <input className="rounded border p-2" type="time" required value={current.ends} onChange={event => changeSelected({ ends: event.target.value })} /></label>
        <button type="button" className="underline" onClick={() => { onChange(hours.filter((_, i) => i !== selected)); setSelected(null); }}>この受付帯を削除</button>
      </div>
    </fieldset>}
  </div>;
}
