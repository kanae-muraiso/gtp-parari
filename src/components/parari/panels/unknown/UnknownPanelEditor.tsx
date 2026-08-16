// apps/tools/parari/src/components/parari/panels/unknown/UnknownPanelEditor.tsx
// 2026-06-22 14:55 JST - 未実装PanelBlock表示

"use client";

import type { PanelEditorProps } from "../panelDefinitionTypes";

export type UnknownPanelData = {
  raw: string;
};

export function UnknownPanelEditor({
  block,
}: PanelEditorProps<UnknownPanelData>) {
  return (
          <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-700">
          未実装パネル
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-1 font-mono text-[11px] text-neutral-600">
          {block.tag}
        </span>
      </div>

          <p className="text-xs leading-5 text-neutral-600">
            このタグはPanelDefinitionにまだ登録されていません。
          </p>
    </div>
  );
}
