// apps/tools/parari/src/components/parari/panels/notice/parseNoticePanel.ts
// 2026-06-22 15:25 JST - NOTICEパネル parse

import type { PanelBlock } from "@/lib/parari/ssot-v2/panelTypes";

export type NoticePanelData = {
  title: string;
  body: string;
  variant?: string;
  raw: string;
};

export function parseNoticePanel(
  raw: string,
  block: PanelBlock
): NoticePanelData {
  const normalizedRaw = raw.replace(/\r\n/g, "\n");
  const lines = normalizedRaw.split("\n");

  const firstLine = lines[0] ?? "";
  const bodyLines = lines.slice(1);

  const match = firstLine.match(/^\s*\[NOTICE(?::([^\]\s]+))?\](.*)$/);

  const variant = match?.[1] ?? block.variant;
  const title = match?.[2]?.trim() ?? "";

  return {
    title,
    body: bodyLines.join("\n"),
    variant,
    raw,
  };
}
