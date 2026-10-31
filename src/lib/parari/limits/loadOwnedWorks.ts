// src/lib/parari/limits/loadOwnedWorks.ts
// 2026-10-31 JST — PART: Complete owner-scoped quota reads (no 1000-row truncation).
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import type { LimitWork } from "./workLimits";
export async function loadOwnedWorks(owner: string): Promise<LimitWork[]> {
  const rows: LimitWork[] = [];
  for (let start = 0; ; start += 100) {
    const { data, error } = await supabaseAdmin.from("parari_books").select("id,content,is_deleted,visibility,is_public")
      .eq("owner", owner).or("is_deleted.is.null,is_deleted.eq.false").order("id").range(start, start + 99);
    if (error) throw new Error("作品数を確認できませんでした。");
    rows.push(...(data ?? []));
    if (!data || data.length < 100) return rows;
  }
}
