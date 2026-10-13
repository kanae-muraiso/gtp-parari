"use client";
// src/lib/parari/live/useCppLiveControl.ts / 2026-10-13 JST
// PART: Recover authoritative event state on polling, focus and reconnection.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { readControl, type LiveControl, type LiveEvent } from "./eventControl";

export function useCppLiveControl(eventId: string, userId: string) {
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [control, setControl] = useState<LiveControl | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [now, setNow] = useState(Date.now());
  const clock = useRef({ server: Date.now(), local: performance.now() });
  const latest = useRef<LiveControl | null>(null);
  const refreshRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const refresh = useCallback((force = true) => refreshRef.current(force), []);
  useEffect(() => {
    let disposed = false;
    let inFlight: Promise<void> | null = null;
    let controller: AbortController | null = null;
    latest.current = null; setControl(null); setEvent(null); setStatus("loading");
    async function read() {
      if (!supabase || !userId || disposed) return;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 12000);
      try {
        const [access, progress] = await Promise.all([
          supabase.rpc("cpp_live_event_access", { p_event_id: eventId }).abortSignal(controller.signal),
          supabase.rpc("cpp_live_event_control_state", { p_event_id: eventId }).abortSignal(controller.signal),
        ]);
        if (disposed) return;
        if (access.error) throw access.error;
        const row = ((access.data ?? []) as LiveEvent[]).find(e => e.id === eventId) ?? null;
        // Pre-migration compatibility only. Any other error fails closed, and a
        // previously managed event can never silently fall back to an open lounge.
        const missing = progress.error?.code === "PGRST202" && !latest.current?.managed
          && progress.error.message.includes("cpp_live_event_control_state");
        if (progress.error && !missing) {
          if (progress.error.code === "42501" && !row?.can_enter) {
            setEvent(row); setControl(null); setStatus("ready"); return;
          }
          throw progress.error;
        }
        const next = missing ? { managed: false as const } : readControl(progress.data, eventId);
        if (latest.current?.managed && (!next.managed || next.version < latest.current.version)) throw Error("Stale state");
        latest.current = next;
        clock.current = { server: next.managed ? Date.parse(next.server_now) : Date.now(), local: performance.now() };
        setNow(clock.current.server); setEvent(row); setControl(next); setStatus("ready");
      } catch {
        if (!disposed) setStatus("error");
      } finally { window.clearTimeout(timeout); }
    }
    async function update(force = false) {
      if (inFlight) { if (!force) return inFlight; await inFlight; }
      if (disposed) return;
      if (!inFlight) inFlight = read().finally(() => { inFlight = null; });
      return inFlight;
    }
    refreshRef.current = update;
    void update();
    const poll = window.setInterval(() => void update(), 5000);
    const tick = window.setInterval(() => setNow(clock.current.server + performance.now() - clock.current.local), 1000);
    const recover = () => { void update(true); };
    const visibility = () => { if (document.visibilityState === "visible") recover(); };
    window.addEventListener("focus", recover); window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true; controller?.abort(); window.clearInterval(poll); window.clearInterval(tick);
      window.removeEventListener("focus", recover); window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [eventId, userId]);
  return { event, control, status, now, refresh };
}
