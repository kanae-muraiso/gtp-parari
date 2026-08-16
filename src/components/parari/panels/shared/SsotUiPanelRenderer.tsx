// apps/tools/parari/src/components/parari/panels/shared/SsotUiPanelRenderer.tsx
// apps/tools/parari/src/components/parari/panels/shared/SsotUiPanelRenderer.tsx
// 2026-06-26 09:55 JST
// PART: Shared SSOT UI panel renderer / editor preview
// コメント:
// - 公開表示と編集画面内プレビューを同じ SsotBlockRenderer に寄せる
// - NOTICE / LIST / BUTTON / LINKS / ACCORDION のMVP共通プレビューに使う

"use client";

import { SsotBlockRenderer } from "@/components/parari/reader/SsotBlockRenderer";
import type { PanelRendererProps } from "../panelDefinitionTypes";

export function SsotUiPanelRenderer({ block }: PanelRendererProps<unknown>) {
  return <SsotBlockRenderer text={String(block.raw ?? "")} rich={true} />;
}

export function SsotUiPanelPreview({ raw }: { raw: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <SsotBlockRenderer text={raw} rich={true} />
    </div>
  );
}
