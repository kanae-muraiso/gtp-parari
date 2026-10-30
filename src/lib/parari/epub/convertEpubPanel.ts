// src/lib/parari/epub/convertEpubPanel.ts
// 2026-10-30 JST
// PART: Explicit static alternatives for web panels; unknown content blocks export.
import type { PanelBlock } from "@/lib/parari/ssot-v2/panelTypes";
import type { EpubContentBlock } from "./buildEpubModel";
import { describePanelIssue, type EpubPanelIssue } from "@/lib/parari/authoring/panelSets";
import { stripPanelVisualStyleFromRaw } from "@/lib/parari/ssot-v2/panelStyle";
import { parseNoticePanel } from "@/components/parari/panels/notice/parseNoticePanel";
import { parseAccordionPanel } from "@/components/parari/panels/accordion/parseAccordionPanel";
import { parseListPanel } from "@/components/parari/panels/list/parseListPanel";
import { parseButtonPanel } from "@/components/parari/panels/button/parseButtonPanel";
import { parseLinksPanel } from "@/components/parari/panels/links/parseLinksPanel";
import { parseVideoPanel } from "@/components/parari/panels/video/parseVideoPanel";
import { parseAudioPanel } from "@/components/parari/panels/audio/parseAudioPanel";
import { parseYoutubePanel } from "@/components/parari/panels/youtube/parseYoutubePanel";
import { parseInstagramPanel } from "@/components/parari/panels/instagram/parseInstagramPanel";
import { safeEpubLink } from "./renderEpubText";

export function convertEpubPanel(block: PanelBlock, location: string, issues: EpubPanelIssue[]): EpubContentBlock[] {
  const raw = stripPanelVisualStyleFromRaw(block.raw).split("\n").filter(line => !/^\s*\[(PANEL_GAP|FIGURE_GAP)\]/i.test(line)).join("\n");
  const issue = describePanelIssue(block.tag, location);
  if (issue) issues.push(issue);
  if (issue?.blocking) return [];
  const link = (label: string, url: string): EpubContentBlock => {
    const safe = safeEpubLink(url);
    if (!safe) issues.push({ tag: block.tag, location, blocking: true, message: "有効なリンク先がありません。リンク先を修正するか本文・画像へ置き換えてください。" });
    return { type: "link", label: label || url || block.tag, url: safe ?? "" };
  };
  switch (block.tag) {
    case "NOTICE": case "ACCORDION": {
      const data = block.tag === "NOTICE" ? parseNoticePanel(raw, block) : parseAccordionPanel(raw, block);
      return [{ type: "aside", title: data.title, text: data.body }];
    }
    case "LIST": {
      const data = parseListPanel(raw);
      return [{ type: "list", title: data.title, items: data.items }];
    }
    case "BUTTON": { const data = parseButtonPanel(raw, block); return [link(data.label, data.url)]; }
    case "LINKS": return parseLinksPanel(raw, block).items.map(item => link(item.label, item.url));
    case "VIDEO": case "AUDIO": case "YOUTUBE": case "INSTAGRAM": {
      const data = block.tag === "VIDEO" ? parseVideoPanel(raw, block) : block.tag === "AUDIO" ? parseAudioPanel(raw, block) : block.tag === "YOUTUBE" ? parseYoutubePanel(raw, block) : parseInstagramPanel(raw);
      const result: EpubContentBlock[] = [link(data.title || `${block.tag}を開く`, data.url)];
      if (data.caption) result.push({ type: "text", text: data.caption });
      if ("transcript" in data && data.transcript) result.push({ type: "text", text: data.transcript });
      return result;
    }
    default: return [];
  }
}
