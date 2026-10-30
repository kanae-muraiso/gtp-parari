// src/lib/parari/epub/loadEpubSource.ts
// 2026-10-30 JST
// PART: Resolve saved reference BOOK contents for an owner-authorized EPUB export
// SSOT is read only. Keep the outline order and fail before exporting missing PAGEs.

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  isBookSsot,
  parseBookOutline,
  parseBookPageRefs,
  resolveBookPageRefs,
} from "@/lib/parari/book/pageRefs";

type PageRow = {
  id: string;
  owner: string;
  title: string | null;
  content: string | null;
  is_deleted: boolean | null;
};

export class EpubSourceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "EpubSourceError";
  }
}

export async function loadEpubSource(
  source: string,
  ownerId: string,
): Promise<string> {
  if (!isBookSsot(source) || parseBookOutline(source).length === 0) return source;

  const pageIds = [...new Set(parseBookPageRefs(source).map((ref) => ref.id))];
  const pageContentById = new Map<string, string>();

  // Bound the IN query and stay below the Data API's normal row limit.
  for (let offset = 0; offset < pageIds.length; offset += 100) {
    const ids = pageIds.slice(offset, offset + 100);
    const { data, error } = await supabaseAdmin
      .from("parari_books")
      .select("id,owner,title,content,is_deleted")
      .in("id", ids)
      .eq("owner", ownerId);

    if (error) {
      throw new EpubSourceError(
        "BOOKのPAGEを読み込めませんでした。時間をおいて再度出力してください。",
        500,
        "EPUB_PAGE_LOAD_FAILED",
      );
    }

    for (const page of (data ?? []) as PageRow[]) {
      if (page.owner !== ownerId || page.is_deleted === true || !ids.includes(page.id)) continue;
      const content = String(page.content ?? "").trim();
      // A reference must resolve to a PAGE, never another BOOK/WEB or a nested reference.
      if (!content || /^\s*\[(BOOK|BOOKINFO|WEB|WEBINFO)\b/i.test(content) || parseBookPageRefs(content).length > 0) continue;

      const hasPageHeader = /^\s*\[(PAGE|PAGEINFO)(?::[^\]]+)?\](?:\s|$)/im.test(content);
      const title = String(page.title ?? "").replace(/\r?\n/g, " ").trim() || "無題のPAGE";
      pageContentById.set(page.id, hasPageHeader ? content : `[PAGE]\ntitle: ${title}\n\n${content}`);
    }
  }

  const missingCount = pageIds.filter((id) => !pageContentById.has(id)).length;
  if (missingCount > 0) {
    throw new EpubSourceError(
      `BOOK内のPAGEを${missingCount}件読み込めないため、EPUB3の出力を中止しました。BOOKの構成とPAGEの保存・削除状態を確認してください。`,
      409,
      "EPUB_SOURCE_INCOMPLETE",
    );
  }

  // Also expands BOOK_CHAPTER in an outline containing only chapter dividers.
  // Embedded legacy BOOKs are already self-contained and remain untouched.
  return resolveBookPageRefs(source, pageContentById);
}
