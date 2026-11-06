// src/lib/cpp/ai/profile.ts
// 2026-10-09 JST — PART: Owner-scoped, read-only AI profile context
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";

export const CPP_AI_PROFILE_COLUMNS = "degree_level, degree_text, degree_status, degree_institution, affiliation, position_title, self_appeal";

const text = (value: unknown, max = 300) => typeof value === "string" ? value.trim().slice(0, max) : "";

// Derive only text blocks from existing SSOT. Never serialize, change or return its source.
export function profileText(value: unknown, max: number): string {
  return parseBlocks(text(value, 50000))
    .filter((block) => block.kind === "text")
    .map((block) => block.raw)
    .join("\n")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .trim().slice(0, max);
}

export async function loadCppAiProfile(caller: SupabaseClient, userId: string, profile: Record<string, unknown>) {
  const [keywords, history, summaries] = await Promise.all([
    caller.from("cpp_profile_keywords").select("keyword").eq("user_id", userId).order("sort_order").limit(20),
    caller.from("cpp_profile_history")
      .select("kind, event_date, event_text, start_year, start_month, organization, division, title, notes")
      .eq("user_id", userId).order("sort_order").order("id").limit(20),
    caller.from("cpp_research_summaries").select("title, body, is_in_progress")
      .eq("user_id", userId).order("slot").limit(3),
  ]);
  if (keywords.error || history.error || summaries.error) throw new Error("profile_unavailable");
  // Explicit output allowlist: contacts, photos, evidence URLs, PDFs, IDs, admin notes never enter context.
  return {
    学位: text(profile.degree_level), 学位名: text(profile.degree_text), 取得状況: text(profile.degree_status),
    学位授与機関: text(profile.degree_institution), 所属: text(profile.affiliation), 立場: text(profile.position_title),
    自己アピール: profileText(profile.self_appeal, 2500),
    研究キーワード: (keywords.data ?? []).map((row) => text(row.keyword, 80)),
    学歴職歴: (history.data ?? []).map((row) => ({
      種類: text(row.kind, 20), 年月日: text(row.event_date) || [row.start_year, row.start_month].filter(Boolean).join("/"),
      事柄: text(row.event_text, 300) || [row.organization, row.division, row.title, row.notes].map((v) => text(v, 100)).filter(Boolean).join(" / "),
    })),
    研究概要: (summaries.data ?? []).map((row) => ({
      題名: text(row.title, 200), 本文: profileText(row.body, 2500), 作成途中: Boolean(row.is_in_progress),
    })),
    注記: "保存済み情報の一部を文字数・件数上限付きで参照。空欄は未確認。連絡先欄・画像・添付PDF・論文リストは参照していません。",
  };
}
