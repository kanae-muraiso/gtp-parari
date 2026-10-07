// 2026-10-07 JST — Account opt-in and server-verified entitlement for editor tools.
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ENGLISH_AUTHORING_PREFERENCE, type DictionaryLookup, type DictionaryResults } from "@/lib/parari/english/dictionary";

type Access = { allowed: boolean; enabled: boolean };
type EnglishAuthoring = Access & {
  loading: boolean;
  saving: boolean;
  error: string;
  setEnabled: (enabled: boolean) => Promise<void>;
  lookupWords: DictionaryLookup;
};

const OFF: Access = { allowed: false, enabled: false };
const EnglishAuthoringContext = createContext<EnglishAuthoring | null>(null);
export const useEnglishAuthoring = () => useContext(EnglishAuthoringContext);

async function request(init: RequestInit = {}) {
  if (!supabase) throw new Error("ログイン情報を確認できませんでした。");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error("ログインしてください。");
  const response = await fetch("/api/english/authoring", {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "英語教材支援を利用できませんでした。");
  return body;
}

export function EnglishAuthoringProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<Access>(OFF);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    try {
      const next = await request();
      if (current === generation.current) {
        setAccess({ allowed: next.allowed === true, enabled: next.allowed === true && next.enabled === true });
        setError("");
      }
    } catch (cause) {
      if (current === generation.current) {
        setAccess(OFF);
        setError(cause instanceof Error ? cause.message : "設定を確認できませんでした。");
      }
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // Defer Supabase work outside its auth callback to avoid the session lock.
    let authTimer: ReturnType<typeof setTimeout>;
    const subscription = supabase?.auth.onAuthStateChange(() => {
      ++generation.current;
      setAccess(OFF);
      clearTimeout(authTimer);
      authTimer = setTimeout(() => void reload(), 0);
    }).data.subscription;
    const refresh = () => void reload();
    window.addEventListener("focus", refresh);
    return () => {
      ++generation.current;
      clearTimeout(authTimer);
      subscription?.unsubscribe();
      window.removeEventListener("focus", refresh);
    };
  }, [reload]);

  const setEnabled = useCallback(async (enabled: boolean) => {
    if (!supabase || saving || (enabled && !access.allowed)) return;
    setSaving(true);
    setError("");
    try {
      const { error: saveError } = await supabase.auth.updateUser({ data: { [ENGLISH_AUTHORING_PREFERENCE]: enabled } });
      if (saveError) throw saveError;
      await reload();
    } catch {
      setError("設定を保存できませんでした。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }, [access.allowed, reload, saving]);

  const lookupWords = useCallback<DictionaryLookup>(async (words, signal) => {
    const body = await request({ method: "POST", body: JSON.stringify({ words }), signal });
    return (body.results ?? {}) as DictionaryResults;
  }, []);

  const value = useMemo(() => ({ ...access, loading, saving, error, setEnabled, lookupWords }), [access, loading, saving, error, setEnabled, lookupWords]);
  return <EnglishAuthoringContext.Provider value={value}>{children}</EnglishAuthoringContext.Provider>;
}
