// src/components/parari/panels/webinfo/webInfoDefinition.ts
// PART: WEBINFO definition
// - SSOTタグ [WEB] をWEBINFOパネルとして扱う
// - WEB全体のタイトル、ホームPAGE、ヘッダー、フッター設定を保持する
// - WEBINFO自体は読者向け本文には直接表示しない

import type { PanelDefinition } from "../panelDefinitionTypes";
import {
  WebInfoPanelEditor,
  type WebInfoPanelData,
} from "./WebInfoPanelEditor";
import { WebInfoPanelRenderer } from "./WebInfoPanelRenderer";

export const webInfoDefinition: PanelDefinition<WebInfoPanelData> = {
  tag: "WEB",
  label: "WEBINFO Panel",
  description: "WEB作品全体の情報と共通表示設定を管理します。",

  parse(raw) {
    return {
      raw: normalizeWebInfoRaw(raw),
    };
  },

  serialize(data) {
    return normalizeWebInfoRaw(data.raw);
  },

  Editor: WebInfoPanelEditor,
  Renderer: WebInfoPanelRenderer,
};

function normalizeWebInfoRaw(value: string): string {
  const raw = String(value ?? "").replace(/\r\n/g, "\n").trim();

  if (!raw) {
      return [
        "[WEB] 新しいWEB",
        "title: 新しいWEB",
        "workType: web",
        "visibility: unlisted",
        "homePageSlug: home",

        "headerTopLayout: one-line",
        "headerTagline:",
        "headerAuxLinks:",
        "headerCtaLabel:",
        "headerCtaHref:",

        "headerImageLayout: none",
        "headerImageUrl:",
        "headerImageTitleMode: page",

        "headerMenu: main",

        "brandMode: logo",
        "brandSize: medium",
        "brandAlign: center",

        "footer: 1",
      ].join("\n");
  }

  const lines = raw.split("\n");

  let webLineIndex = lines.findIndex((line) =>
    /^\s*\[WEB(?::[^\]]+)?\]/i.test(line.trim()),
  );

  if (webLineIndex < 0) {
    lines.unshift("[WEB]");
    webLineIndex = 0;
  }

  const webLine = lines[webLineIndex] ?? "[WEB]";
  const inlineTitle =
    webLine.match(/^\s*\[WEB(?::[^\]]+)?\]\s*(.*)$/i)?.[1]?.trim() ?? "";

  const titleLineIndex = lines.findIndex((line) =>
    /^\s*title\s*:/i.test(line.trim()),
  );

  const metaTitle =
    titleLineIndex >= 0
      ? lines[titleLineIndex].replace(/^\s*title\s*:\s*/i, "").trim()
      : "";

  const title = metaTitle || inlineTitle || "新しいWEB";

  lines[webLineIndex] = `[WEB] ${title}`;

  if (titleLineIndex >= 0) {
    lines[titleLineIndex] = `title: ${title}`;
  } else {
    lines.splice(webLineIndex + 1, 0, `title: ${title}`);
  }

  ensureMeta(lines, webLineIndex, "workType", "web");
  ensureMeta(lines, webLineIndex, "visibility", "unlisted");
    ensureMeta(lines, webLineIndex, "homePageSlug", "home");

    ensureMeta(lines, webLineIndex, "headerTopLayout", "one-line");
    ensureMeta(lines, webLineIndex, "headerTagline", "");
    ensureMeta(lines, webLineIndex, "headerAuxLinks", "");
    ensureMeta(lines, webLineIndex, "headerCtaLabel", "");
    ensureMeta(lines, webLineIndex, "headerCtaHref", "");

    ensureMeta(lines, webLineIndex, "headerImageLayout", "none");
    ensureMeta(lines, webLineIndex, "headerImageUrl", "");
    ensureMeta(lines, webLineIndex, "headerImageTitleMode", "page");

    ensureMeta(lines, webLineIndex, "headerMenu", "main");

    ensureMeta(lines, webLineIndex, "brandMode", "logo");
    ensureMeta(lines, webLineIndex, "brandSize", "medium");
    ensureMeta(lines, webLineIndex, "brandAlign", "center");

    ensureMeta(lines, webLineIndex, "footer", "1");

  return lines.join("\n").trim();
}

function ensureMeta(
  lines: string[],
  markerIndex: number,
  key: string,
  defaultValue: string,
): void {
  const pattern = new RegExp(`^\\s*${key}\\s*:`, "i");
  const exists = lines.some((line) => pattern.test(line.trim()));

  if (!exists) {
    lines.splice(markerIndex + 1, 0, `${key}: ${defaultValue}`);
  }
}
