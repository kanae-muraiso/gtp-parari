"use client";

import { useEffect, useState } from "react";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import type { AccordionPanelData } from "./parseAccordionPanel";
import { serializeAccordionPanel } from "./serializeAccordionPanel";

const HEADER_VARIANTS = [
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

const BODY_VARIANTS = HEADER_VARIANTS;

export function AccordionPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<AccordionPanelData>) {
  const [draftData, setDraftData] = useState<AccordionPanelData>(data);

  useEffect(() => {
    setDraftData(data);
  }, [data.raw]);

  const commitData = (nextData: AccordionPanelData = draftData) => {
    onChangeRaw?.(serializeAccordionPanel(nextData));
  };

  const updateDraftData = (partial: Partial<AccordionPanelData>) => {
    setDraftData((current) => ({
      ...current,
      ...partial,
    }));
  };

  const updateAndCommitData = (partial: Partial<AccordionPanelData>) => {
    const nextData: AccordionPanelData = {
      ...draftData,
      ...partial,
    };
    setDraftData(nextData);
    commitData(nextData);
  };

  const headerClasses = accordionDirectEditClasses(draftData.headerVariant);
  const bodyClasses = accordionDirectEditClasses(draftData.bodyVariant);

  return (
    <div className={["overflow-hidden rounded-2xl border shadow-sm", headerClasses.border].join(" ")}>
      <div className={["px-4 py-3", headerClasses.bg].join(" ")}>
        <input
          value={draftData.title}
          onChange={(event) => updateDraftData({ title: event.target.value })}
          onBlur={() => commitData()}
          className={["w-full border-0 bg-transparent p-0 text-sm font-semibold outline-none placeholder:opacity-50", headerClasses.text].join(" ")}
          placeholder="見出し"
        />
      </div>

      <div className={["border-t px-4 py-3", bodyClasses.border, bodyClasses.bg].join(" ")}>
        <textarea
          value={draftData.body}
          onChange={(event) => updateDraftData({ body: event.target.value })}
          onBlur={() => commitData()}
          spellCheck={false}
          rows={4}
          className="min-h-[96px] w-full resize-y border-0 bg-transparent p-0 text-sm leading-7 text-neutral-700 outline-none placeholder:text-neutral-400"
          placeholder="本文を入力"
        />
      </div>

      <details className="border-t border-neutral-200 bg-white px-4 py-2 text-xs text-neutral-500">
        <summary className="cursor-pointer select-none font-bold">設定</summary>
        <div className="mt-2 flex flex-wrap gap-3 pb-1">
          <label className="flex items-center gap-2">
            見出し色
            <select
              value={draftData.headerVariant ?? ""}
              onChange={(event) =>
                updateAndCommitData({
                  headerVariant: event.target.value || undefined,
                })
              }
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none"
            >
              {HEADER_VARIANTS.map((variant) => (
                <option key={variant.value} value={variant.value}>
                  {variant.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            本文色
            <select
              value={draftData.bodyVariant ?? ""}
              onChange={(event) =>
                updateAndCommitData({
                  bodyVariant: event.target.value || undefined,
                })
              }
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none"
            >
              {BODY_VARIANTS.map((variant) => (
                <option key={variant.value} value={variant.value}>
                  {variant.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
    </div>
  );
}

function accordionDirectEditClasses(variant?: string) {
  switch (variant) {
    case "primary":
      return { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-800" };
    case "success":
      return { border: "border-green-200", bg: "bg-green-50", text: "text-green-800" };
    case "danger":
      return { border: "border-red-200", bg: "bg-red-50", text: "text-red-800" };
    case "warning":
      return { border: "border-yellow-200", bg: "bg-yellow-50", text: "text-yellow-900" };
    case "info":
      return { border: "border-cyan-200", bg: "bg-cyan-50", text: "text-cyan-800" };
    case "secondary":
      return { border: "border-neutral-200", bg: "bg-neutral-50", text: "text-neutral-700" };
    case "dark":
      return { border: "border-neutral-300", bg: "bg-neutral-100", text: "text-neutral-900" };
    case "light":
    default:
      return { border: "border-neutral-200", bg: "bg-white", text: "text-neutral-700" };
  }
}
