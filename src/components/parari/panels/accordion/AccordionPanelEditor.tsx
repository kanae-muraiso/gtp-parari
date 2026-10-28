// apps/tools/parari/src/components/parari/panels/accordion/AccordionPanelEditor.tsx
// apps/tools/parari/src/components/parari/panels/accordion/AccordionPanelEditor.tsx
// 2026-06-27 18:55 JST
// PART: ACCORDION editor with local draft state
// コメント:
// - 1文字入力ごとに親SSOTを更新しない
// - 入力中はローカルdraftだけ更新する
// - blur時にSSOTへ反映する
// - 日本語入力/IME/長文入力中の再parseによる入力障害を避ける

"use client";

import { useEffect, useState } from "react";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import { SsotUiPanelPreview } from "../shared/SsotUiPanelRenderer";
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

const BODY_VARIANTS = [
  { value: "", label: "標準" },
  { value: "light", label: "light" },
  { value: "primary", label: "primary" },
  { value: "secondary", label: "secondary" },
  { value: "warning", label: "warning" },
  { value: "info", label: "info" },
  { value: "success", label: "success" },
  { value: "danger", label: "danger" },
  { value: "dark", label: "dark" },
];

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

  const raw = serializeAccordionPanel(draftData);

  return (
    <div className="rounded-xl border border-yellow-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-yellow-100 px-2 py-1 text-[11px] font-bold text-yellow-900">
            ACCORDION 専用エディタ
          </span>
          <p className="mt-2 text-xs leading-5 text-neutral-600">
            FAQ・補足説明・持ち物リストなどを折りたたみ表示するパネルです。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            見出し色
            <select
              value={draftData.headerVariant ?? ""}
              onChange={(event) =>
                updateAndCommitData({
                  headerVariant: event.target.value || undefined,
                })
              }
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {HEADER_VARIANTS.map((variant) => (
                <option key={variant.value} value={variant.value}>
                  {variant.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-neutral-600">
            本文色
            <select
              value={draftData.bodyVariant ?? ""}
              onChange={(event) =>
                updateAndCommitData({
                  bodyVariant: event.target.value || undefined,
                })
              }
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {BODY_VARIANTS.map((variant) => (
                <option key={variant.value} value={variant.value}>
                  {variant.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold text-neutral-700">
          タイトル
        </span>
        <input
          value={draftData.title}
          onChange={(event) =>
            updateDraftData({
              title: event.target.value,
            })
          }
          onBlur={() => commitData()}
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          placeholder="初めてでも参加できますか？"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-bold text-neutral-700">
          本文
        </span>
        <textarea
          value={draftData.body}
          onChange={(event) =>
            updateDraftData({
              body: event.target.value,
            })
          }
          onBlur={() => commitData()}
          spellCheck={false}
          className="min-h-[140px] w-full resize-y rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm leading-6 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          placeholder="はい、初心者の方も歓迎です。"
        />
      </label>

      <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <p className="mb-2 text-[11px] font-bold text-neutral-500">
          公開表示プレビュー
        </p>

        <SsotUiPanelPreview raw={raw} />
      </div>

    </div>
  );
}
