// src/lib/parari/reader/compileAuthorizedWork.ts
// 2026-11-24 JST
// PART: Authorization-aware BOOK/PAGE_REF reader compilation
// Saved SSOT remains untouched, and source content never leaves the server.
import "server-only";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { protectedSaleWorkIds } from "@/lib/parari/sales/server";
import { parseBookPageRefs, resolveBookPageRefs } from "@/lib/parari/book/pageRefs";
import { compileReaderView, type CompiledReaderView } from "./compileReaderView";

type ReaderOptions = {
  pageSlug?: string | null;
  publicBasePath?: string;
  headerLogoUrl?: string | null;
};
type SourceWork = { id: string; owner: string; content: string | null };
export type AuthorizedReaderResult = {
  reader: CompiledReaderView | null;
  missingPageIds: string[];
  error: boolean;
};

function ensurePageSsot(content: string, title: string): string {
  const normalized = String(content ?? "").trim();
  if (normalized.split(/\r?\n/).some(line =>
    /^\s*\[(PAGE|PAGEINFO)(?::[^\]]+)?\](?:\s|$)/i.test(line))) return normalized;
  return ["[PAGE]", "title: " + (title.replace(/\r?\n/g, " ").trim() || "無題のPAGE"), "", normalized].join("\n");
}

export async function compileAuthorizedWork(
  work: SourceWork,
  userId: string | null,
  options: ReaderOptions = {},
): Promise<AuthorizedReaderResult> {
  const source = String(work.content ?? "");
  const refs = parseBookPageRefs(source);
  if (!refs.length) {
    return { reader: compileReaderView(source, work.id, options), missingPageIds: [], error: false };
  }
  const uniqueIds = [...new Set(refs.map(ref => ref.id))];
  if (uniqueIds.length > 300) return { reader: null, missingPageIds: uniqueIds, error: true };

  const {data: pages, error} = await supabaseAdmin
    .from("parari_books")
    .select("id,owner,title,content,visibility,is_public,is_deleted,expires_at")
    .in("id", uniqueIds).eq("owner", work.owner);
  if (error) return { reader: null, missingPageIds: [], error: true };

  // A paid PAGE remains protected even if its parent BOOK is available.
  let protectedIds: Set<string>;
  try {
    protectedIds = userId === work.owner ? new Set<string>() : await protectedSaleWorkIds(uniqueIds);
  } catch {
    return { reader: null, missingPageIds: [], error: true };
  }
  const pageContentById = new Map<string, string>();
  for (const page of pages ?? []) {
    if (page.is_deleted === true || protectedIds.has(page.id) ||
        (page.expires_at && Date.parse(page.expires_at) <= Date.now())) continue;
    pageContentById.set(page.id, ensurePageSsot(String(page.content ?? ""), String(page.title ?? "")));
  }
  const missingPageIds = uniqueIds.filter(id => !pageContentById.has(id));
  const merged = resolveBookPageRefs(source, pageContentById);
  return { reader: compileReaderView(merged, work.id, options), missingPageIds, error: false };
}

