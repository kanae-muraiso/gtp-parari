// src/lib/parari/authoring/panelSets.ts
// 2026-10-30 JST
// PART: Authoring preferences and export capabilities, independent of billing.
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";

export type PanelSet = "standard" | "kindle";
export type EpubPanelPolicy = "native" | "simplify" | "link" | "unsupported";
export const PANEL_SETS: Record<PanelSet, { label: string; tags: readonly string[] | null }> = {
  standard: { label: "標準", tags: null },
  kindle: { label: "Kindle出版用", tags: ["TEXT", "T", "BOOK", "CHAPTER", "PAGE", "BLANK_PAGE", "IMAGE", "TABLE", "NOTICE", "LIST", "ACCORDION", "BUTTON", "LINKS"] },
};
const POLICIES: Record<string, EpubPanelPolicy> = {
  TEXT: "native", T: "native", BOOK: "native", CHAPTER: "native", PAGE: "native", IMAGE: "native", TABLE: "native",
  NOTICE: "simplify", LIST: "simplify", ACCORDION: "simplify", BUTTON: "simplify", LINKS: "simplify",
  VIDEO: "link", AUDIO: "link", YOUTUBE: "link", INSTAGRAM: "link",
};
export function epubPanelPolicy(tag: string): EpubPanelPolicy { return POLICIES[tag.toUpperCase()] ?? "unsupported"; }
export function panelInSet(tag: string, set: PanelSet): boolean { return PANEL_SETS[set].tags?.includes(tag.toUpperCase()) ?? true; }

function workHeader(ssot: string) {
  return parseBlocks(ssot).find(block => block.kind === "panel" && /^(BOOK|PAGE|WEB)$/.test(block.tag));
}
export function readPanelSet(ssot: string): PanelSet {
  return /^authoringSet:\s*kindle\s*$/im.test(workHeader(ssot)?.raw ?? "") ? "kindle" : "standard";
}
export function writePanelSet(ssot: string, set: PanelSet): string {
  const block = workHeader(ssot);
  if (!block) return `[PAGE]\nauthoringSet: ${set}\n\n${ssot}`;
  const lines = block.raw.split("\n");
  const index = lines.findIndex(line => /^authoringSet:/i.test(line));
  if (index >= 0) lines[index] = `authoringSet: ${set}`;
  else lines.splice(1, 0, `authoringSet: ${set}`);
  return ssot.slice(0, block.start) + lines.join("\n") + ssot.slice(block.end);
}

export type EpubPanelIssue = { location: string; tag: string; blocking: boolean; message: string };
export function describePanelIssue(tag: string, location: string): EpubPanelIssue | null {
  const policy = epubPanelPolicy(tag);
  if (policy === "native") return null;
  return { tag, location, blocking: policy === "unsupported", message: policy === "unsupported"
    ? tag === "TOC" ? "この目次パネルはEPUBに対応していません。BOOK設定の目次を使用してください。" : "EPUBへ変換できません。本文・画像・表などへ置き換えてください。"
    : policy === "link" ? "再生・埋め込み表示の代わりに外部リンクとして出力します。"
    : tag === "ACCORDION" ? "開閉せず、内容をすべて展開して出力します。"
    : "紙面向けの簡素な表現で出力します。" };
}
export function inspectPanelIssues(ssot: string): EpubPanelIssue[] {
  let page = "この作品";
  return parseBlocks(ssot).flatMap((block, index) => {
    if (block.kind !== "panel") return [];
    if (block.tag === "PAGE" || block.tag === "CHAPTER") page = block.raw.match(/^title:\s*(.+)$/im)?.[1] ?? (block.raw.split("\n")[0].replace(/^\[[^\]]+\]\s*/, "") || "PAGE");
    if (["PAGE_REF", "BOOK_CHAPTER"].includes(block.tag)) return [];
    const issue = describePanelIssue(block.tag, `${page}・パネル${index + 1}`);
    return issue ? [issue] : [];
  });
}
