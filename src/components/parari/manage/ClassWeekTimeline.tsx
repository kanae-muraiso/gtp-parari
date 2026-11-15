"use client";

import { useRef, useState, type PointerEvent } from "react";
import type { SchoolClass } from "@/lib/classes";
import type { OfficeHour } from "./ClassAvailabilityPanel";

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
const orderedDays = [1, 2, 3, 4, 5, 6, 0];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
const time = (value: number) => [Math.floor(value / 60), value % 60].map(x => String(x).padStart(2, "0")).join(":");
const position = (from: number, to: number) => ({ left: from / 14.4 + "%", width: (to - from) / 14.4 + "%" });
type Placement = { weekday: number; from: number; to: number };
type Drag = { weekday: number; index: number | null; edge: "new" | "start" | "end" | "move"; anchor: number; from: number; to: number; width: number; x: number; moved: boolean };

export default function ClassWeekTimeline({ hours, classes, disabled, onChange }: {
  hours: OfficeHour[]; classes: SchoolClass[]; disabled: boolean; onChange: (hours: OfficeHour[]) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<Drag | null>(null);
  const drag = useRef<Drag | null>(null);
  const latest = useRef<Drag | null>(null);
  const [placing, setPlacing] = useState(false);
  const [preview, setPreview] = useState<Placement | null>(null);
  const palette = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const skipPaletteClick = useRef(false);
  const timeline = useRef<HTMLDivElement>(null);
  const current = selected === null ? null : hours[selected];
  const lessons = classes.flatMap(item => {
    const weekday = new Date(item.starts_on + "T00:00:00Z").getUTCDay();
    const from = minutes(item.starts_at);
    const end = from + (item.duration_minutes ?? 60);
    const first = [{ key: item.id, weekday, from, to: Math.min(1440, end), item }];
    return end <= 1440 ? first : [...first, { key: item.id + "-continued", weekday: (weekday + 1) % 7, from: 0, to: end - 1440, item }];
  });

  function begin(event: PointerEvent<HTMLDivElement>, weekday: number) {
    if (disabled || event.button !== 0 || (event.target as HTMLElement).closest("[data-lesson]")) return;
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-index]");
    const index = target ? Number(target.dataset.index) : null;
    const edge = (event.target as HTMLElement).dataset.edge === "start" ? "start" :
      (event.target as HTMLElement).dataset.edge === "end" ? "end" : index === null ? "new" : "move";
    if (index === null && hours.length >= 42) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    const anchor = Math.max(0, Math.min(1425, Math.round((event.clientX - bounds.left) / bounds.width * 96) * 15));
    if (placing && index === null) {
      addBand(placement(weekday, anchor));
      return;
    }
    const from = index === null ? anchor : minutes(hours[index].starts);
    const to = index === null ? anchor + 14 : minutes(hours[index].ends);
    drag.current = { weekday, index, edge, anchor, from, to, width: bounds.width, x: event.clientX, moved: false };
    (target ?? event.currentTarget).setPointerCapture?.(event.pointerId);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || (Math.abs(event.clientX - state.x) < 4 && !state.moved)) return;
    const delta = Math.round((event.clientX - state.x) / state.width * 96) * 15;
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
      const row = { weekday: final.weekday, channel: "onsite" as const, starts: time(final.from), ends: time(final.to) };
      onChange(state.index === null ? [...hours, row] : hours.map((value, index) => index === state.index ? row : value));
      setSelected(state.index ?? hours.length);
    } else if (state?.index != null) setSelected(state.index);
    drag.current = null;
    latest.current = null;
    setDraft(null);
  }


  function placement(weekday: number, minute: number): Placement {
    const from = clamp(minute, 0, 1380);
    return { weekday, from, to: Math.min(1439, from + 60) };
  }

  function dropTarget(event: PointerEvent<HTMLButtonElement>) {
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-weekday]");
    if (!row || !timeline.current?.contains(row)) return null;
    const bounds = row.getBoundingClientRect();
    if (!bounds.width) return null;
    const minute = Math.round((event.clientX - bounds.left) / bounds.width * 96) * 15;
    return placement(Number(row.dataset.weekday), minute);
  }

  function addBand(band: Placement) {
    if (disabled || hours.length >= 42) return;
    onChange([...hours, { weekday: band.weekday, channel: "onsite", starts: time(band.from), ends: time(band.to) }]);
    setSelected(hours.length);
    setPlacing(false);
  }

  function changeSelected(change: Partial<OfficeHour>) {
    onChange(hours.map((row, index) => index === selected ? { ...row, ...change } : row));
  }

  const activePreview = preview ?? draft;

  return <div className="grid gap-3">
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="rounded bg-red-700 px-3 py-1.5 font-medium text-white">クラス</span>
      <button type="button" disabled={disabled || hours.length >= 42} aria-pressed={placing}
        className="touch-none select-none rounded bg-emerald-200 px-3 py-1.5 font-medium text-emerald-950 enabled:cursor-grab aria-pressed:ring-2 disabled:opacity-50"
        onPointerDown={event => {
          if (event.button !== 0) return;
          skipPaletteClick.current = false;
          palette.current = { x: event.clientX, y: event.clientY, moved: false };
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={event => {
          const state = palette.current;
          if (!state || (!state.moved && Math.hypot(event.clientX - state.x, event.clientY - state.y) < 4)) return;
          state.moved = true;
          setPreview(dropTarget(event));
        }}
        onPointerUp={event => {
          skipPaletteClick.current = palette.current?.moved ?? false;
          palette.current = null;
          if (skipPaletteClick.current) {
            const band = dropTarget(event);
            if (band) addBand(band);
          }
          setPreview(null);
        }}
        onLostPointerCapture={() => { palette.current = null; setPreview(null); }}
        onClick={event => {
          if (event.detail === 0 || !skipPaletteClick.current) setPlacing(value => !value);
          skipPaletteClick.current = false;
        }}>受付可能</button>
      <button type="button" disabled={disabled || !current} aria-label="リセット（選択した受付帯を消去）"
        className="rounded bg-neutral-200 px-3 py-1.5 font-medium text-neutral-900 disabled:opacity-50"
        onClick={() => { onChange(hours.filter((_, index) => index !== selected)); setSelected(null); }}>リセット</button>
    </div>
    <p className="text-sm text-neutral-600">{placing
      ? "追加する曜日と時刻を選んでください。曜日ボタンで10:00から追加できます。"
      : "「受付可能」をドラッグして追加。帯をクリックして調整、ダブルクリックで選択解除できます。"}
      {current && " リセットで選択中の帯を消去します。"}</p>
    <div ref={timeline} className="overflow-x-auto rounded-lg border">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[4rem_1fr] border-b bg-neutral-50">
          <span className="p-2 text-xs">日本時間</span>
          <div className="relative h-8 text-xs">
            {Array.from({ length: 24 }, (_, hour) => <span className="absolute top-2" style={{ left: hour / 24 * 100 + "%" }} key={hour}>{hour}</span>)}
            <span className="absolute right-1 top-2">24</span>
          </div>
        </div>
        {orderedDays.map(weekday => <div key={weekday} className="grid grid-cols-[4rem_1fr] border-b last:border-0">
          <div className="flex items-center bg-neutral-50 px-2 text-xs font-semibold">
            {placing ? <button type="button" className="underline" aria-label={weekdays[weekday] + "曜に受付帯を追加"}
              onClick={() => addBand(placement(weekday, 600))}>{weekdays[weekday]}曜</button> : weekdays[weekday] + "曜"}
          </div>
          <div data-weekday={weekday} aria-label={weekdays[weekday] + "曜の受付時間"}
            className="relative h-10 touch-none bg-neutral-100"
            style={{ backgroundImage: "linear-gradient(to right,#d4d4d4 1px,transparent 1px)", backgroundSize: "calc(100% / 24) 100%" }}
            onPointerDown={event => begin(event, weekday)} onPointerMove={move} onPointerUp={end}
            onLostPointerCapture={() => { drag.current = null; latest.current = null; setDraft(null); }}>
            {hours.map((row, index) => row.weekday === weekday && row.channel === "onsite" &&
              <button type="button" key={index} data-index={index} disabled={disabled} aria-pressed={selected === index}
                aria-label={weekdays[weekday] + "曜 " + row.starts + "〜" + row.ends}
                onClick={() => setSelected(index)}
                onDoubleClick={() => setSelected(null)}
                onKeyDown={event => { if (event.key === "Escape") setSelected(null); }}
                className={`absolute inset-y-1 flex min-w-0 cursor-grab items-center justify-center overflow-hidden rounded bg-emerald-200 px-2 text-xs text-emerald-950 ${selected === index ? "ring-2 ring-inset ring-emerald-950" : ""}`}
                style={position(minutes(row.starts), minutes(row.ends))}>
                <span data-edge="start" className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-black/15" />
                <span className="truncate">{row.starts}〜{row.ends}</span>
                <span data-edge="end" className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-black/15" />
              </button>)}
            {lessons.filter(lesson => lesson.weekday === weekday).map(lesson =>
              <div key={lesson.key} data-lesson className="absolute top-1 bottom-2 z-10 flex cursor-default items-center overflow-hidden rounded bg-red-700 px-1 text-xs text-white"
                style={position(lesson.from, lesson.to)}
                title={lesson.item.name + " " + time(lesson.from) + "〜" + time(lesson.to)}>
                <span className="truncate">{lesson.item.cadence === "monthly" ? "毎月 · " : ""}{lesson.item.name}</span>
              </div>)}
            {activePreview?.weekday === weekday && <span className="pointer-events-none absolute inset-y-1 z-20 rounded border-2 border-emerald-700 bg-emerald-400/60"
              style={position(activePreview.from, activePreview.to)} />}
          </div>
        </div>)}
      </div>
    </div>
    {hours.some(row => row.channel === "phone") && <button type="button" disabled={disabled}
      className="w-fit text-sm text-neutral-600 underline"
      onClick={() => { onChange(hours.filter(row => row.channel !== "phone")); setSelected(null); }}>以前の電話受付帯を消去</button>}
    {current && <fieldset className="grid gap-2 rounded border p-3" disabled={disabled}>
      <legend className="px-1 text-sm font-semibold">{weekdays[current.weekday]}曜の受付帯を調整</legend>
      <div className="flex flex-wrap gap-2 text-sm">
        <label>開始 <input className="rounded border p-2" type="time" required value={current.starts} onChange={event => changeSelected({ starts: event.target.value })} /></label>
        <label>終了 <input className="rounded border p-2" type="time" required value={current.ends} onChange={event => changeSelected({ ends: event.target.value })} /></label>
      </div>
    </fieldset>}
  </div>;
}
