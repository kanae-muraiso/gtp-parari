"use client";

import { useEffect, useState } from "react";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import {
  type ButtonAlign,
  type ButtonPanelData,
} from "./parseButtonPanel";
import { serializeButtonPanel } from "./serializeButtonPanel";

const BUTTON_VARIANTS = [
  { value: "", label: "標準" },
  { value: "dark", label: "黒" },
  { value: "primary", label: "青" },
  { value: "green", label: "緑" },
  { value: "red", label: "赤" },
  { value: "amber", label: "黄" },
  { value: "outline", label: "枠線" },
  { value: "light", label: "淡色" },
];

const BUTTON_ALIGN_OPTIONS: Array<{ value: ButtonAlign; label: string }> = [
  { value: "left", label: "左" },
  { value: "center", label: "中央" },
  { value: "right", label: "右" },
];

export function ButtonPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<ButtonPanelData>) {
  const [draftData, setDraftData] = useState<ButtonPanelData>({
    ...data,
    align: data.align ?? "left",
  });

  useEffect(() => {
    setDraftData({
      ...data,
      align: data.align ?? "left",
    });
  }, [data.raw]);

  const commitData = (nextData: ButtonPanelData = draftData) => {
    onChangeRaw?.(serializeButtonPanel(nextData));
  };

  const updateDraftData = (partial: Partial<ButtonPanelData>) => {
    setDraftData((current) => ({ ...current, ...partial }));
  };

  const updateAndCommitData = (partial: Partial<ButtonPanelData>) => {
    const nextData = { ...draftData, ...partial };
    setDraftData(nextData);
    commitData(nextData);
  };

  const buttonClass = directButtonClass(draftData.variant);
  const alignClass =
    draftData.align === "center"
      ? "justify-center"
      : draftData.align === "right"
        ? "justify-end"
        : "justify-start";

  return (
    <div>
      <div className={["flex", alignClass].join(" ")}>
        <div className={["inline-flex min-w-[160px] items-center rounded-full px-5 py-2 shadow-sm", buttonClass].join(" ")}>
          <input
            value={draftData.label}
            onChange={(event) => updateDraftData({ label: event.target.value })}
            onBlur={() => commitData()}
            className="w-full border-0 bg-transparent p-0 text-center text-sm font-semibold outline-none placeholder:opacity-60"
            placeholder="ボタン文字"
          />
        </div>
      </div>

      <details className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
        <summary className="cursor-pointer select-none font-bold">設定</summary>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold text-neutral-500">URL</span>
            <input
              value={draftData.url}
              onChange={(event) => updateDraftData({ url: event.target.value })}
              onBlur={() => commitData()}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none"
              placeholder="https://..."
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2">
              色
              <select
                value={draftData.variant ?? ""}
                onChange={(event) =>
                  updateAndCommitData({
                    variant: event.target.value || undefined,
                  })
                }
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none"
              >
                {BUTTON_VARIANTS.map((variant) => (
                  <option key={variant.value} value={variant.value}>{variant.label}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              配置
              <select
                value={draftData.align ?? "left"}
                onChange={(event) =>
                  updateAndCommitData({
                    align: event.target.value as ButtonAlign,
                  })
                }
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none"
              >
                {BUTTON_ALIGN_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </details>
    </div>
  );
}

function directButtonClass(variant?: string) {
  switch (variant) {
    case "dark":
      return "bg-neutral-900 text-white";
    case "primary":
      return "bg-blue-600 text-white";
    case "green":
      return "bg-green-600 text-white";
    case "red":
      return "bg-red-600 text-white";
    case "amber":
      return "bg-amber-400 text-amber-950";
    case "outline":
      return "border border-neutral-300 bg-white text-neutral-800";
    case "light":
      return "bg-neutral-100 text-neutral-800";
    default:
      return "bg-neutral-900 text-white";
  }
}
