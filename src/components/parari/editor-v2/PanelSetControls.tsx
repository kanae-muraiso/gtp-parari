// src/components/parari/editor-v2/PanelSetControls.tsx
// 2026-10-30 JST
// PART: Fixed authoring sets and export notices; never removes saved content.
"use client";
import { PANEL_SETS, inspectPanelIssues, type PanelSet } from "@/lib/parari/authoring/panelSets";

export function PanelSetControls({ value, source, onChange }: { value: PanelSet; source: string; onChange?: (value: PanelSet) => void }) {
  const issues = value === "kindle" ? inspectPanelIssues(source) : [];
  return <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-3 text-sm">
    {onChange ? <label className="flex flex-wrap items-center gap-3">パネルセット
      <select aria-label="パネルセット" value={value} onChange={event => onChange(event.target.value as PanelSet)} className="rounded border border-neutral-300 bg-white px-3 py-2">
        {Object.entries(PANEL_SETS).map(([key, set]) => <option key={key} value={key}>{set.label}</option>)}
      </select>
    </label> : <p>BOOKの設定：{PANEL_SETS[value].label}</p>}
    {value === "kindle" ? <p className="mt-2 text-xs leading-5 text-neutral-500">出版向けのパネルを表示しています。既存の内容はそのまま編集できます。強調・リスト・リンクは簡素化し、開閉パネルは展開します。参照PAGEを含む最終確認はEPUB出力時に行います。</p> : null}
    {issues.length ? <ul className="mt-3 space-y-2 text-xs">{issues.map((issue, index) => <li key={index} className={issue.blocking ? "text-red-700" : "text-amber-800"}>{issue.location}（{issue.tag}）：{issue.message}</li>)}</ul> : null}
  </div>;
}
