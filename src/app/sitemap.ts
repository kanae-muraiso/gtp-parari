// src/app/sitemap.ts
// 2026-11-24 11:15 JST
// PART: Public canonical URLs only (static + free published works)
// コメント:
// - visibility=public を唯一の作品検索公開条件とする。
// - 限定公開/非公開・期限切れ・削除済・販売中の作品は掲載しない。
// - SSOT・本文は取得しない。DBエラー時は固定4ページだけを返す。
// - URLはwww正規表記とする。読者Viewer/保存/RLSは変更しない。

import type { MetadataRoute } from "next";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const revalidate = 3600;

const SITE_ORIGIN = "https://www.parari.app";
const BATCH_SIZE = 500;
const MAX_WORKS = 10000;

type SitemapWork = {
  id: string;
  owner: string;
  stable_slug: string | null;
  custom_slug: string | null;
  slug: string | null;
  updated_at: string | null;
};
type Profile = { user_id: string; username: string | null };
type Sale = { work_id: string | null };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed = ["/", "/packages", "/privacy", "/tokusho"].map(path => ({
    url: new URL(path, SITE_ORIGIN).toString(),
  }));
  try {
    const works: SitemapWork[] = [];
    const now = new Date().toISOString();

    for (let offset = 0; offset < MAX_WORKS; offset += BATCH_SIZE) {
      const { data, error } = await supabaseAdmin
        .from("parari_books")
        .select("id,owner,stable_slug,custom_slug,slug,updated_at")
        .eq("visibility", "public")
        .or("is_deleted.is.null,is_deleted.eq.false")
        .or('expires_at.is.null,expires_at.gt.' + now)
        .order("id")
        .range(offset, offset + BATCH_SIZE - 1);
      if (error) throw error;
      const rows = (data ?? []) as SitemapWork[];
      works.push(...rows);
      if (rows.length < BATCH_SIZE) break;
    }

    if (works.length === 0) return fixed;

    const usernames = new Map<string, string>();
    const sold = new Set<string>();
    const ownerIds = Array.from(new Set(works.map(work => work.owner)));

    for (let i = 0; i < ownerIds.length; i += BATCH_SIZE) {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("user_id,username")
        .in("user_id", ownerIds.slice(i, i + BATCH_SIZE));
      if (error) throw error;
      for (const row of (data ?? []) as Profile[]) {
        if (row.username?.trim()) usernames.set(row.user_id, row.username.trim());
      }
    }

    // Never publish paid full-text URLs as indexable free works.
    for (let i = 0; i < works.length; i += BATCH_SIZE) {
      const { data, error } = await supabaseAdmin
        .from("commerce_products")
        .select("work_id")
        .eq("product_type", "work")
        .eq("active", true)
        .in("work_id", works.slice(i, i + BATCH_SIZE).map(work => work.id));
      if (error) throw error;
      for (const row of (data ?? []) as Sale[]) {
        if (row.work_id) sold.add(row.work_id);
      }
    }

    const seen = new Set(fixed.map(entry => entry.url));
    const entries: MetadataRoute.Sitemap = [...fixed];

    for (const work of works) {
      if (sold.has(work.id)) continue;
      const username = usernames.get(work.owner);
      const slug = work.stable_slug?.trim() || work.custom_slug?.trim() || work.slug?.trim();
      if (!username || !slug) continue;

      const url = SITE_ORIGIN + "/" + encodeURIComponent(username) + "/" + encodeURIComponent(slug);
      if (seen.has(url)) continue;
      seen.add(url);

      const date = work.updated_at ? new Date(work.updated_at) : null;
      entries.push({
        url,
        ...(date && !Number.isNaN(date.valueOf()) ? { lastModified: date } : {}),
      });
    }

    return entries;
  } catch {
    // Search discovery is optional; never allow database errors to expose
    // non-public rows or break the existing sitemap.
    return fixed;
  }
}
