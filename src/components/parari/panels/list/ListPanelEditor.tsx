"use client";

import { useEffect, useState } from "react";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import type { ListPanelData } from "./parseListPanel";
import { serializeListPanel } from "./serializeListPanel";

const LIST_VARIANTS = [
  { value: "", label: "標準" },
  { value: "light", label: "light" },
  { value: "warning", label: "warning" },
  { value: "info", label: "info" },
  { value: "success", label: "success" },
  { value: "danger", label: "danger" },
  { value: "primary", label: "primary" },
  { value: "secondary", label: "secondary" },
  { value: "dark", label: "dark" },
];

export function ListPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<ListPanelData>) {
  const [draftData, setDraftData] = useState<ListPanelData>(data);

  useEffect(() => {
    setDraftData(data);
  }, [data.title, data.variant, ...data.items]);

  const commitData = (nextData: ListPanelData = draftData) => {
    onChangeRaw?.(serializeListPanel(nextData));
  };

  const updateDraftData = (partial: Partial<ListPanelData>) => {
    setDraftData((current) => ({ ...current, ...partial }));
  };

  const updateAndCommitData = (partial: Partial<ListPanelData>) => {
    const nextData = { ...draftData, ...partial };
    setDraftData(nextData);
    commitData(nextData);
  };

  const updateItem = (index: number, value: string) => {
    setDraftData((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    }));
  };

  const addItem = (afterIndex?: number) => {
    const nextItems = [...draftData.items];
    const insertAt =
      typeof afterIndex === "number"
        ? Math.min(afterIndex + 1, nextItems.length)
        : nextItems.length;
    nextItems.splice(insertAt, 0, "");
    updateAndCommitData({ items: nextItems });
  };

  const removeItem = (index: number) => {
    updateAndCommitData({
      items: draftData.items.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= draftData.items.length) return;
    const nextItems = [...draftData.items];
    [nextItems[index], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[index]];
    updateAndCommitData({ items: nextItems });
  };

  const classes = listDirectEditClasses(draftData.variant);

  return (
    <div className={["rounded-2xl border p-4 shadow-sm", classes.border, classes.bg].join(" ")}>
      <input
        value={draftData.title}
        onChange={(event) => updateDraftData({ title: event.target.value })}
        onBlur={() => commitData()}
        className={["mb-2 w-full border-0 bg-transparent p-0 text-base font-semibold outline-none placeholder:opacity-50", classes.text].join(" ")}
        placeholder="リストのタイトル（任意）"
      />

      <div className="space-y-1">
        {draftData.items.map((item, index) => (
          <div key={`list-item-${index}`} className="group flex items-start gap-2">
            <span className={["mt-2.5 text-sm", classes.text].join(" ")}>•</span>
            <textarea
              value={item}
              rows={1}
              onChange={(event) => updateItem(index, event.target.value)}
              onBlur={() => commitData()}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  commitData();
                  addItem(index);
                }
              }}
              className="min-h-[32px] flex-1 resize-none border-0 bg-transparent py-1.5 text-sm leading-6 text-neutral-700 outline-none placeholder:text-neutral-400"
              placeholder={`項目 ${index + 1}`}
            />
            <div className="mt-1 flex opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
              <button type="button" onClick={() => moveItem(index, "up")} disabled={index === 0} className="px-1 text-xs text-neutral-400 disabled:opacity-20">↑</button>
              <button type="button" onClick={() => moveItem(index, "down")} disabled={index === draftData.items.length - 1} className="px-1 text-xs text-neutral-400 disabled:opacity-20">↓</button>
              <button type="button" onClick={() => removeItem(index)} className="px-1 text-xs text-neutral-400 hover:text-rose-600">×</button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={() => addItem()} className="mt-2 text-xs font-bold text-neutral-400 hover:text-neutral-700">
        ＋ 項目
      </button>

      <details className="mt-3 text-xs text-neutral-500">
        <summary className="cursor-pointer select-none font-bold">設定</summary>
        <div className="mt-2 flex items-center gap-2">
          <span>色</span>
          <select
            value={draftData.variant ?? ""}
            onChange={(event) =>
              updateAndCommitData({ variant: event.target.value })
            }
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none"
          >
            {LIST_VARIANTS.map((variant) => (
              <option key={variant.value} value={variant.value}>{variant.label}</option>
            ))}
          </select>
        </div>
      </details>
    </div>
  );
}

function listDirectEditClasses(variant?: string) {
  switch (variant) {
    case "primary": return { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-800" };
    case "success": return { border: "border-green-200", bg: "bg-green-50", text: "text-green-800" };
    case "danger": return { border: "border-red-200", bg: "bg-red-50", text: "text-red-800" };
    case "warning": return { border: "border-yellow-200", bg: "bg-yellow-50", text: "text-yellow-900" };
    case "info": return { border: "border-cyan-200", bg: "bg-cyan-50", text: "text-cyan-800" };
    case "dark": return { border: "border-neutral-300", bg: "bg-neutral-100", text: "text-neutral-900" };
    case "light": return { border: "border-neutral-200", bg: "bg-white", text: "text-neutral-700" };
    default: return { border: "border-neutral-200", bg: "bg-neutral-50", text: "text-neutral-700" };
  }
}
