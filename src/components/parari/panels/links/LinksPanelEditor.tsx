"use client";

import { useEffect, useState } from "react";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import type { LinksPanelData, LinksPanelItem } from "./parseLinksPanel";
import { serializeLinksPanel } from "./serializeLinksPanel";

const LINKS_VARIANTS = [
  { value: "", label: "標準" },
  { value: "primary", label: "primary" },
  { value: "secondary", label: "secondary" },
  { value: "success", label: "success" },
  { value: "danger", label: "danger" },
  { value: "warning", label: "warning" },
  { value: "info", label: "info" },
  { value: "light", label: "light" },
  { value: "dark", label: "dark" },
];

export function LinksPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<LinksPanelData>) {
  const [draftData, setDraftData] = useState<LinksPanelData>(data);

  useEffect(() => {
    setDraftData(data);
  }, [data.raw]);

  const commitData = (nextData: LinksPanelData = draftData) => {
    onChangeRaw?.(serializeLinksPanel(nextData));
  };

  const updateAndCommitData = (partial: Partial<LinksPanelData>) => {
    const nextData = { ...draftData, ...partial };
    setDraftData(nextData);
    commitData(nextData);
  };

  const updateItem = (index: number, partial: Partial<LinksPanelItem>) => {
    setDraftData((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...partial } : item,
      ),
    }));
  };

  const addItem = () => {
    updateAndCommitData({
      items: [...draftData.items, { label: "リンク", url: "https://" }],
    });
  };

  const removeItem = (index: number) => {
    updateAndCommitData({
      items: draftData.items.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draftData.items.length) return;
    const nextItems = [...draftData.items];
    [nextItems[index], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[index]];
    updateAndCommitData({ items: nextItems });
  };

  const classes = linksDirectEditClasses(draftData.variant);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap gap-2">
        {draftData.items.map((item, index) => (
          <div key={`link-${index}`} className="group">
            <div className={["inline-flex items-center rounded-full px-3 py-1.5 ring-1", classes.bg, classes.text, classes.ring].join(" ")}>
              <input
                value={item.label}
                onChange={(event) => updateItem(index, { label: event.target.value })}
                onBlur={() => commitData()}
                className="min-w-[90px] max-w-[220px] border-0 bg-transparent p-0 text-xs font-semibold outline-none placeholder:opacity-50"
                placeholder="リンク"
              />
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="ml-1 hidden text-xs opacity-50 hover:opacity-100 group-hover:inline"
                aria-label="削除"
              >
                ×
              </button>
            </div>

            <div className="mt-1 hidden min-w-[220px] group-hover:block group-focus-within:block">
              <input
                value={item.url}
                onChange={(event) => updateItem(index, { url: event.target.value })}
                onBlur={() => commitData()}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-600 outline-none"
                placeholder="https://..."
              />
              <div className="mt-1 flex gap-1">
                <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} className="text-[10px] text-neutral-400 disabled:opacity-20">←</button>
                <button type="button" onClick={() => moveItem(index, 1)} disabled={index === draftData.items.length - 1} className="text-[10px] text-neutral-400 disabled:opacity-20">→</button>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addItem}
          className="rounded-full border border-dashed border-neutral-300 px-3 py-1.5 text-xs font-bold text-neutral-400 hover:border-neutral-400 hover:text-neutral-600"
        >
          ＋ リンク
        </button>
      </div>

      <details className="mt-3 text-xs text-neutral-500">
        <summary className="cursor-pointer select-none font-bold">設定</summary>
        <div className="mt-2 flex items-center gap-2">
          <span>色</span>
          <select
            value={draftData.variant ?? ""}
            onChange={(event) =>
              updateAndCommitData({ variant: event.target.value || undefined })
            }
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none"
          >
            {LINKS_VARIANTS.map((variant) => (
              <option key={variant.value} value={variant.value}>{variant.label}</option>
            ))}
          </select>
        </div>
      </details>
    </div>
  );
}

function linksDirectEditClasses(variant?: string) {
  switch (variant) {
    case "primary": return { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" };
    case "success": return { bg: "bg-green-50", text: "text-green-700", ring: "ring-green-200" };
    case "danger": return { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200" };
    case "warning": return { bg: "bg-yellow-50", text: "text-yellow-800", ring: "ring-yellow-200" };
    case "info": return { bg: "bg-cyan-50", text: "text-cyan-700", ring: "ring-cyan-200" };
    case "dark": return { bg: "bg-neutral-900", text: "text-white", ring: "ring-neutral-900" };
    case "light": return { bg: "bg-white", text: "text-neutral-700", ring: "ring-neutral-200" };
    default: return { bg: "bg-neutral-50", text: "text-neutral-700", ring: "ring-neutral-200" };
  }
}
