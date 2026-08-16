// apps/tools/parari/src/components/parari/panels/notice/serializeNoticePanel.ts
// 2026-06-22 15:25 JST - NOTICEパネル serialize

import type { NoticePanelData } from "./parseNoticePanel";

export function serializeNoticePanel(data: NoticePanelData): string {
  const tag = data.variant ? `[NOTICE:${data.variant}]` : "[NOTICE]";
  const title = data.title.trim();

  const firstLine = `${tag}${title}`;

  if (data.body.length === 0) {
    return firstLine;
  }

  return `${firstLine}\n${data.body}`;
}
