"use client";
// 2026-10-13 JST / PART: User-bound requests; credentials never enter URLs or storage.
import { supabase } from "@/lib/supabaseClient";
export async function stageRequest(userId: string, body: Record<string, unknown>, signal?: AbortSignal) {
  const session = (await supabase?.auth.getSession())?.data.session;
  if (!session || session.user.id !== userId) throw new Error("ログイン状態が変わりました。会場を開き直してください。");
  const response = await fetch("/api/parari/live/cpp/stage", { method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body), signal: signal ?? AbortSignal.timeout(50000) });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error ?? "接続できませんでした。"), { code: result.code });
  return result;
}
