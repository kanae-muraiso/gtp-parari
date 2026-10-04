// 2026-10-04 JST
// PART: Per-user participation navigation and safe editor departure.
"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { participationAtLocation, parseParticipationKey, type Participation } from "@/lib/participation";

type LeaveGuard = () => Promise<boolean>;
type State = { userId: string | null; items: Participation[]; loading: boolean; error: string };
type Value = State & {
  origin: Participation | null; leaving: boolean; leaveError: string;
  refresh: () => void; remember: (key: string | null) => void;
  navigate: (key: string) => Promise<void>;
  registerGuard: (guard: LeaveGuard) => () => void;
};
const Context = createContext<Value | null>(null);
const storageKey = (id: string) => `parari-participation:${id}`;
const empty: State = { userId: null, items: [], loading: true, error: "" };

export function ParticipationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<State>(empty);
  const [originKey, setOriginKey] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const identity = useRef<{ id: string; token: string } | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const lastLoaded = useRef(0);
  const guard = useRef<LeaveGuard | null>(null);
  const leaveLock = useRef(false);

  const reload = useCallback(async (force = false) => {
    const current = identity.current;
    if (!current || (!force && Date.now() - lastLoaded.current < 30_000)) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const version = ++generation.current;
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    setState(previous => ({ ...previous, loading: true, error: "" }));
    try {
      const response = await fetch("/api/my-participations", { headers: { Authorization: `Bearer ${current.token}` }, cache: "no-store", signal: controller.signal });
      const result = await response.json();
      if (!response.ok || !result.ok || result.userId !== current.id) throw new Error(result.message || "参加先を取得できませんでした。");
      if (version !== generation.current) return;
      lastLoaded.current = Date.now();
      setState({ userId: current.id, items: result.participations, loading: false, error: "" });
    } catch (error) {
      if (version !== generation.current) return;
      setState({ userId: current.id, items: [], loading: false, error: error instanceof Error && error.name !== "AbortError" ? error.message : "参加先を取得できませんでした。もう一度お試しください。" });
    } finally { window.clearTimeout(timer); }
  }, []);

  useEffect(() => {
    if (!supabase) { setState({ ...empty, loading: false }); return; }
    let active = true;
    let receivedAuthEvent = false;
    const accept = (session: Session | null) => {
      if (!active) return;
      const next = session?.user.id ?? null;
      const previous = identity.current?.id ?? null;
      identity.current = session ? { id: session.user.id, token: session.access_token } : null;
      if (next !== previous || !next) {
        ++generation.current;
        request.current?.abort();
        lastLoaded.current = 0;
        setState({ ...empty, userId: next, loading: !!next });
        setOriginKey(null);
        setLeaveError("");
        try {
          if (previous) sessionStorage.removeItem(storageKey(previous));
          if (next) setOriginKey(parseParticipationKey(sessionStorage.getItem(storageKey(next))));
        } catch { /* Navigation also works without browser storage. */ }
      }
      if (next) void reload();
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedAuthEvent = true;
      accept(session);
    });
    void supabase.auth.getSession().then(({ data }) => { if (!receivedAuthEvent) accept(data.session); });
    const focus = () => { if (document.visibilityState === "visible") void reload(); };
    const changed = () => void reload(true);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    for (const event of ["cpp-mode-changed", "cpp-participation-changed", "cpp-profile-saved"]) window.addEventListener(event, changed);
    return () => {
      active = false; ++generation.current; request.current?.abort(); subscription.unsubscribe();
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
      for (const event of ["cpp-mode-changed", "cpp-participation-changed", "cpp-profile-saved"]) window.removeEventListener(event, changed);
    };
  }, [reload]);

  useEffect(() => { void reload(); setLeaveError(""); }, [pathname, reload]);
  const remember = useCallback((key: string | null) => {
    setOriginKey(key);
    const id = identity.current?.id;
    if (!id) return;
    try { if (key) sessionStorage.setItem(storageKey(id), key); else sessionStorage.removeItem(storageKey(id)); } catch { /* Optional hint only. */ }
  }, []);
  const registerGuard = useCallback((callback: LeaveGuard) => {
    guard.current = callback;
    return () => { if (guard.current === callback) guard.current = null; };
  }, []);
  const navigate = useCallback(async (key: string) => {
    const target = state.items.find(item => item.key === key);
    const departingUser = identity.current?.id;
    if (!target || leaveLock.current) return;
    leaveLock.current = true; setLeaving(true); setLeaveError("");
    try {
      if (guard.current && !(await guard.current())) {
        setLeaveError("保存できなかったため、この画面にとどまっています。保存状態をご確認ください。");
        return;
      }
      if (identity.current?.id !== departingUser) return;
      remember(key);
      router.push(target.href);
    } catch {
      setLeaveError("保存を完了できませんでした。入力内容はこの画面に残っています。");
    } finally { leaveLock.current = false; setLeaving(false); }
  }, [remember, router, state.items]);

  return <Context.Provider value={{ ...state, origin: state.items.find(item => item.key === originKey) ?? null, leaving, leaveError, refresh: () => void reload(true), remember, navigate, registerGuard }}>
    <Suspense fallback={null}><ParticipationLocation /></Suspense>
    {children}
  </Context.Provider>;
}

function ParticipationLocation() {
  const pathname = usePathname();
  const search = useSearchParams();
  const { items, loading, error, remember } = useParticipations();
  useEffect(() => {
    if (loading || error) return;
    const key = participationAtLocation(pathname, new URLSearchParams(search.toString()));
    if (key) remember(items.some(item => item.key === key) ? key : null);
  }, [pathname, search, items, loading, error, remember]);
  return null;
}

export function useParticipations() {
  const value = useContext(Context);
  if (!value) throw new Error("ParticipationProvider is required");
  return value;
}

export function useParticipationLeaveGuard(callback: LeaveGuard) {
  const { registerGuard } = useParticipations();
  useEffect(() => registerGuard(callback), [callback, registerGuard]);
}
