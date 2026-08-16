// apps/tools/parari/src/components/parari/panels/pageinfo/pageInfoDefinition.ts
// 2026-06-28 23:40 JST
// PART: PAGEINFO definition
// コメント:
// - SSOTタグ [PAGE] をPAGEINFOパネルとして扱う
// - MVPではrawを安全に保持する
// - serialize時に [PAGE] が欠けないようにする

import type { PanelDefinition } from "../panelDefinitionTypes";
import {
  PageInfoPanelEditor,
  type PageInfoPanelData,
} from "./PageInfoPanelEditor";
import { PageInfoPanelRenderer } from "./PageInfoPanelRenderer";

export const pageInfoDefinition: PanelDefinition<PageInfoPanelData> = {
  tag: "PAGE",
  label: "PAGEINFO Panel",
  description: "PAGEの情報を持つしきりパネルです。",

    parse(raw) {
      return {
        raw: normalizeLegacyPageInfoRaw(raw),
      };
    },

  serialize(data) {
    return normalizePageInfoRaw(data.raw);
  },

  Editor: PageInfoPanelEditor,
  Renderer: PageInfoPanelRenderer,
};

function normalizePageInfoRaw(value: string): string {
  const raw = value.replace(/\r\n/g, "\n").trim();

  if (raw.length === 0) {
    return [
      "[PAGE] 新しいページ",
      "title: 新しいページ",
      "subtitle:",
      "mainImage:",
      "showTitle: true",
      "titleAlign: left",
    ].join("\n");
  }

  const lines = raw.split("\n");
  let pageLineIndex = lines.findIndex((line) =>
    /^\s*\[PAGE(?::[^\]]+)?\]/i.test(line.trim()),
  );

  if (pageLineIndex < 0) {
    lines.unshift("[PAGE]");
    pageLineIndex = 0;
  }

  const pageLine = lines[pageLineIndex] ?? "[PAGE]";
  const headerTitle =
    pageLine.match(/^\s*\[PAGE(?::[^\]]+)?\]\s*(.*)$/i)?.[1] ?? "";

  const titleLineIndex = lines.findIndex((line) =>
    /^\s*title\s*:/i.test(line.trim()),
  );

  const titleFromMeta =
    titleLineIndex >= 0
      ? lines[titleLineIndex].replace(/^\s*title\s*:\s*/i, "")
      : "";

  const title =
    titleFromMeta.trim().length > 0
      ? titleFromMeta
      : headerTitle.trim().length > 0
        ? headerTitle
        : "新しいページ";

  lines[pageLineIndex] = `[PAGE] ${title}`;

  if (titleLineIndex >= 0) {
    lines[titleLineIndex] = `title: ${title}`;
  } else {
    lines.splice(pageLineIndex + 1, 0, `title: ${title}`);
  }

  return lines.join("\n").trim();
}


// apps/tools/parari/src/components/parari/panels/pageinfo/pageInfoDefinition.ts
// 2026-06-29 19:50 JST
// PART: Legacy [PAGE] title compatibility
// コメント:
// - 旧BOOK記法 [PAGE] はじめに を [PAGE]\ntitle: はじめに に寄せる
// - すでに title: がある場合は壊さない

function normalizeLegacyPageInfoRaw(value: string): string {
  const raw = value.replace(/\r\n/g, "\n").trim();

  const lines = raw.split("\n");
  const firstLine = lines[0] ?? "";
  const match = firstLine.match(/^\s*\[PAGE(?::([^\]\s]+))?\]\s*(.*)$/i);

  if (!match) {
    return raw;
  }

  const inlineTitle = match[2]?.trim() ?? "";

  if (!inlineTitle) {
    return raw;
  }

  const restLines = lines.slice(1);
  const alreadyHasTitle = restLines.some((line) =>
    /^title\s*:/i.test(line.trim()),
  );

  if (alreadyHasTitle) {
    return raw;
  }

  return ["[PAGE]", `title: ${inlineTitle}`, ...restLines].join("\n");
}
