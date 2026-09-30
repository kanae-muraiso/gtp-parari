import { createClient } from "@supabase/supabase-js";

export const CPP_TEST_MARKER = "cpp-test-session-v1";
export const CPP_TEST_STORAGE = "cpp-test-auth-v1";
export type CppTestScenario = "alumni" | "researcher_pending" | "researcher_approved";
export const cppTestLabels: Record<CppTestScenario, string> = {
  alumni: "同窓会のみ",
  researcher_pending: "同窓会＋研究者（必須事項の入力前）",
  researcher_approved: "同窓会＋研究者（必須事項の記入済み）",
};
export function isCppTestSession() {
  if (typeof window === "undefined") return false;
  try { return window.sessionStorage.getItem(CPP_TEST_MARKER) === "active"; }
  catch { return false; }
}
export function createCppTestClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || typeof window === "undefined") throw new Error("接続設定を確認できません。");
  return createClient(url, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000) }) },
    auth: {
      storage: window.sessionStorage,
      storageKey: CPP_TEST_STORAGE,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}
