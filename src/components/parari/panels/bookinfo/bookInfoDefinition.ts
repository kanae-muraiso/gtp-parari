// apps/tools/parari/src/components/parari/panels/bookinfo/bookInfoDefinition.ts
// PART: BOOKINFO definition
// コメント:
// - SSOTタグ [BOOK] をBOOKINFOパネルとして扱う
// - BOOKINFOは読者向けに「表紙 / 扉 / 目次」の最大3シートを生成する情報源
// - BOOK内部設定はrawに保持するが、読者向け表示には直接出さない
// - serialize時に [BOOK] が欠けないようにする

import type { PanelDefinition } from "../panelDefinitionTypes";
import {
  BookInfoPanelEditor,
  type BookInfoPanelData,
} from "./BookInfoPanelEditor";
import { BookInfoPanelRenderer } from "./BookInfoPanelRenderer";

export const bookInfoDefinition: PanelDefinition<BookInfoPanelData> = {
  tag: "BOOK",
  label: "BOOKINFO Panel",
  description: "BOOKの表紙・扉・目次を作るための情報パネルです。",

  parse(raw) {
    return {
      raw: normalizeLegacyBookInfoRaw(raw),
    };
  },

  serialize(data) {
    return normalizeBookInfoRaw(data.raw);
  },

  Editor: BookInfoPanelEditor,
  Renderer: BookInfoPanelRenderer,
};

function normalizeBookInfoRaw(value: string): string {
  const raw = value.replace(/\r\n/g, "\n").trim();

  if (raw.length === 0) {
    return [
      "[BOOK] 新しいBOOK",
      "title: 新しいBOOK",
      "subtitle:",
      "author:",
      "coverImage:",
      "defaultReadingMode: paged",
      "physicalPagination: true",
    ].join("\n");
  }

  const lines = raw.split("\n");

  let bookLineIndex = lines.findIndex((line) =>
    /^\s*\[BOOK(?::[^\]]+)?\]/i.test(line.trim()),
  );

  if (bookLineIndex < 0) {
    lines.unshift("[BOOK]");
    bookLineIndex = 0;
  }

  const bookLine = lines[bookLineIndex] ?? "[BOOK]";
  const headerTitle =
    bookLine.match(/^\s*\[BOOK(?::[^\]]+)?\]\s*(.*)$/i)?.[1] ?? "";

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
        : "新しいBOOK";

  lines[bookLineIndex] = `[BOOK] ${title}`;

  if (titleLineIndex >= 0) {
    lines[titleLineIndex] = `title: ${title}`;
  } else {
    lines.splice(bookLineIndex + 1, 0, `title: ${title}`);
  }

  return lines.join("\n").trim();
}

// PART: Legacy [BOOK] inline title compatibility
// コメント:
// - [BOOK] 本のタイトル / [BOOK]本のタイトル を title: へ展開する
// - すでに title: がある場合は既存値を優先して壊さない
function normalizeLegacyBookInfoRaw(value: string): string {
  const raw = value.replace(/\r\n/g, "\n").trim();

  const lines = raw.split("\n");
  const firstLine = lines[0] ?? "";
  const match = firstLine.match(/^\s*\[BOOK(?:INFO)?(?::([^\]\s]+))?\]\s*(.*)$/i);

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

  return ["[BOOK]", `title: ${inlineTitle}`, ...restLines].join("\n");
}

