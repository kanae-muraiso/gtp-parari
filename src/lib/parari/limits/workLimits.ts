// src/lib/parari/limits/workLimits.ts
// 2026-10-31 JST — PART: BOOK quotas and lossless PAGE length checks.
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";
import { parseBookPageRefs } from "@/lib/parari/book/pageRefs";
import type { PlanEntitlements } from "@/lib/billing/plan";

export type LimitWork = { id: string; content: string | null; is_deleted?: boolean | null; visibility?: string | null; is_public?: boolean | null };
export const workKind = (source: string | null) => /^\s*\[(BOOK|BOOKINFO)\b/i.test(source ?? "") ? "book" : /^\s*\[(WEB|WEBINFO)\b/i.test(source ?? "") ? "web" : "page";
export function workUsage(works: LimitWork[]) {
  const active = works.filter(w => !w.is_deleted);
  const books = active.filter(w => workKind(w.content) === "book");
  const members = new Set(books.flatMap(w => parseBookPageRefs(w.content ?? "").map(p => p.id)));
  const standalone = active.filter(w => workKind(w.content) !== "book" && (workKind(w.content) !== "page" || !members.has(w.id)));
  return { bookCount: books.length, standaloneCount: standalone.length, pageCount: active.filter(w => workKind(w.content) === "page").length,
    publishedCount: [...books, ...standalone].filter(w => w.visibility === "public" || w.is_public === true).length };
}

// Count Unicode code points of authored text, excluding whitespace and structure/media metadata.
export function pageLengths(source: string): number[] {
  const pages: string[] = [""];
  let hasPage = false;
  for (const block of parseBlocks(source)) {
    if (block.kind === "panel" && /^(PAGE|PAGEINFO)$/.test(block.tag)) {
      if (hasPage || pages[pages.length - 1].trim()) pages.push("");
      hasPage = true;
      continue;
    }
    if (block.kind === "panel" && /^(BOOK|BOOKINFO|CHAPTER|CHAPTERINFO|WEB|WEBINFO|PAGE_REF|BOOK_CHAPTER|IMAGE|VIDEO|AUDIO|YOUTUBE|INSTAGRAM)$/.test(block.tag)) continue;
    pages[pages.length - 1] += block.raw.replace(/^\s*\[[A-Z_]+[^\]\n]*\][^\n]*$/gm, "").replace(/^\s*(?:url|src|href|id|width|height|align|authoringSet):[^\n]*$/gmi, "");
  }
  return pages.map(text => Array.from(text.replace(/\s|\u200B/g, "")).length);
}
export function pageCount(source: string): number {
  const refs = parseBookPageRefs(source);
  if (refs.length) return refs.length;
  const count = parseBlocks(source).filter(b => b.kind === "panel" && /^(PAGE|PAGEINFO)$/.test(b.tag)).length;
  return Math.max(1, count);
}
export function contentIssues(source: string, limits: PlanEntitlements): string[] {
  const issues: string[] = [];
  if (limits.pageLimitPerWork !== null && pageCount(source) > limits.pageLimitPerWork)
    issues.push(`1 BOOKは${limits.pageLimitPerWork} PAGEまでです。現在${pageCount(source)} PAGEあります。`);
  if (limits.charactersPerPage !== null) pageLengths(source).forEach((count, i) => {
    if (count > limits.charactersPerPage!) issues.push(`PAGE ${i + 1}は${count.toLocaleString()}字です。1 PAGE ${limits.charactersPerPage!.toLocaleString()}字までに分割してください。`);
  });
  return issues;
}
export function characterGrowthIssue(before: string, after: string, limits: PlanEntitlements): string | null {
  const cap = limits.charactersPerPage;
  if (cap === null) return null;
  const a = pageLengths(before), b = pageLengths(after);
  const overflow = (xs: number[]) => xs.reduce((n, x) => n + Math.max(0, x - cap), 0);
  if (Math.max(...b) > cap && (overflow(b) > overflow(a) || Math.max(...b) > Math.max(...a)))
    return contentIssues(after, limits).filter(s => s.includes("字"))[0] ?? null;
  return null;
}
