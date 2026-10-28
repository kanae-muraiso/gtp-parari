"use client";

import { useEffect, useState } from "react";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import type { NoticePanelData } from "./parseNoticePanel";
import { serializeNoticePanel } from "./serializeNoticePanel";

const NOTICE_VARIANTS = [
  { value: "", label: "標準" },
  { value: "warning", label: "warning" },
  { value: "info", label: "info" },
  { value: "success", label: "success" },
  { value: "danger", label: "danger" },
  { value: "primary", label: "primary" },
  { value: "secondary", label: "secondary" },
  { value: "light", label: "light" },
  { value: "dark", label: "dark" },
];

export function NoticePanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<NoticePanelData>) {
  const [draftData, setDraftData] = useState<NoticePanelData>(data);

  useEffect(() => {
    setDraftData(data);
  }, [data.raw]);

  const commitData = (nextData: NoticePanelData = draftData) => {
    onChangeRaw?.(serializeNoticePanel(nextData));
  };

  const updateDraftData = (partial: Partial<NoticePanelData>) => {
    setDraftData((current) => ({
      ...current,
      ...partial,
    }));
  };

  const updateAndCommitData = (partial: Partial<NoticePanelData>) => {
    const nextData: NoticePanelData = {
      ...draftData,
      ...partial,
    };
    setDraftData(nextData);
    commitData(nextData);
  };

  const classes = noticeDirectEditClasses(draftData.variant);

  return (
    <div className={["rounded-2xl border p-4 shadow-sm", classes.border, classes.bg].join(" ")}>
      <input
        value={draftData.title}
        onChange={(event) => updateDraftData({ title: event.target.value })}
        onBlur={() => commitData()}
        className={["w-full border-0 bg-transparent p-0 text-base font-semibold outline-none placeholder:opacity-50", classes.text].join(" ")}
        placeholder="タイトル"
      />

      <textarea
        value={draftData.body}
        onChange={(event) => updateDraftData({ body: event.target.value })}
        onBlur={() => commitData()}
        spellCheck={false}
        rows={3}
        className="mt-2 min-h-[84px] w-full resize-y border-0 bg-transparent p-0 text-sm leading-7 text-neutral-700 outline-none placeholder:text-neutral-400"
        placeholder="本文を入力"
      />

      <details className="mt-3 text-xs text-neutral-500">
        <summary className="cursor-pointer select-none font-bold">設定</summary>
        <div className="mt-2 flex items-center gap-2">
          <span>色</span>
          <select
            value={draftData.variant ?? ""}
            onChange={(event) =>
              updateAndCommitData({
                variant: event.target.value || undefined,
              })
            }
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none"
          >
            {NOTICE_VARIANTS.map((variant) => (
              <option key={variant.value} value={variant.value}>
                {variant.label}
              </option>
            ))}
          </select>
        </div>
      </details>
    </div>
  );
}

function noticeDirectEditClasses(variant?: string) {
  switch (variant) {
    case "primary":
      return { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-800" };
    case "success":
      return { border: "border-green-200", bg: "bg-green-50", text: "text-green-800" };
    case "danger":
      return { border: "border-red-200", bg: "bg-red-50", text: "text-red-800" };
    case "info":
      return { border: "border-cyan-200", bg: "bg-cyan-50", text: "text-cyan-800" };
    case "secondary":
      return { border: "border-neutral-200", bg: "bg-neutral-50", text: "text-neutral-700" };
    case "dark":
      return { border: "border-neutral-300", bg: "bg-neutral-100", text: "text-neutral-900" };
    case "light":
      return { border: "border-neutral-200", bg: "bg-white", text: "text-neutral-700" };
    case "warning":
    default:
      return { border: "border-yellow-200", bg: "bg-yellow-50", text: "text-yellow-900" };
  }
}
