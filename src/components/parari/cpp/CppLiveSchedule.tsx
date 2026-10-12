"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
type EventRow = {
  id: string; title: string; starts_at: string; ends_at: string;
  source_timezone: string; audience: string[]; can_enter: boolean;
};
const labels: Record<string,string> = { alumni:"同窓会", researcher:"研究者",company:"企業" };
const timezones = ["Asia/Tokyo","Asia/Bangkok","Europe/London","America/New_York","America/Los_Angeles","Pacific/Honolulu"];
function displayTime(date: string, tz: string) {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: tz, year:"numeric",month:"numeric",day:"numeric",
      weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false,
    }).format(new Date(date));
  } catch { return "日時を表示できません"; }
}
export default function CppLiveSchedule() {
  const [events,setEvents]=useState<EventRow[]>([]);
  const [timezone,setTimezone]=useState("Asia/Tokyo");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const load=useCallback(async ()=>{
    if(!supabase){setError("接続設定を確認してください。");setLoading(false);return;}
    const {data,error}=await supabase.rpc("cpp_live_upcoming_events");
    if(error){setError("開催予定を読み込めませんでした。");setLoading(false);return;}
    setEvents((data??[]) as EventRow[]);
    setError("");setLoading(false);
  },[]);
  useEffect(()=>{
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo");
    void load();
    const interval=window.setInterval(()=>void load(),30000);
    return ()=>window.clearInterval(interval);
  },[load]);
  return <section className="mx-auto max-w-6xl space-y-4 px-4 py-6" aria-label="CPP LIVE開催予定">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold">次のLIVE開催予定</h2>
      <p className="text-xs text-neutral-500">予定はあなたの現地時間で表示されます。</p></div>
      <label className="text-xs font-semibold">表示する時間帯
        <select className="ml-2 rounded-lg border bg-white px-2 py-2" value={timezone}
         onChange={e=>setTimezone(e.target.value)}>
          {[...new Set([timezone,...timezones])].map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </label>
    </div>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> :
      loading ? <p className="text-sm text-neutral-500">開催予定を読み込んでいます…</p> :
      events.length === 0 ? <div className="rounded-2xl border bg-white p-5 text-sm text-neutral-600">現在、次回LIVEは未定です。</div> :
      <div className="grid gap-3 sm:grid-cols-2">{events.map(event=>
        <article key={event.id} className="rounded-2xl border bg-white p-5 shadow-sm">
          <h3 className="font-bold">{event.title}</h3>
          <p className="mt-2 text-sm">{displayTime(event.starts_at,timezone)} – {displayTime(event.ends_at,timezone)}</p>
          <p className="mt-1 text-xs text-neutral-500">参加対象：{event.audience.map(a=>labels[a]||a).join("・")}</p>
          <p className="mt-3 text-sm font-semibold">{event.can_enter?"開催中：参加資格あり":"開催時間と参加資格を確認してください"}</p>
        </article>
      )}</div>}
  </section>;
}
