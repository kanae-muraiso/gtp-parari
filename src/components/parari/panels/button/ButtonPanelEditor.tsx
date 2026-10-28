// apps/tools/parari/src/components/parari/panels/button/ButtonPanelEditor.tsx
// 2026-07-05 JST - BUTTON editor / align対応

"use client";

import { useEffect, useState } from "react";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import { SsotUiPanelPreview } from "../shared/SsotUiPanelRenderer";
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

const BUTTON_ALIGN_OPTIONS: Array<{
  value: ButtonAlign;
  label: string;
}> = [
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
    setDraftData((current) => ({
      ...current,
      ...partial,
    }));
  };

  const updateAndCommitData = (partial: Partial<ButtonPanelData>) => {
    const nextData = {
      ...draftData,
      ...partial,
    };

    setDraftData(nextData);
    commitData(nextData);
  };

  const raw = serializeButtonPanel(draftData);

  return (
    <div className="rounded-xl border border-yellow-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-yellow-800">
            BUTTON
          </div>
          <div className="mt-1 text-[11px] leading-5 text-neutral-500">
            申込・登録・問い合わせなど、読者を次の行動に進めるボタンです。
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            色
            <select
              value={draftData.variant ?? ""}
              onChange={(event) =>
                updateAndCommitData({
                  variant: event.target.value || undefined,
                })
              }
              className="rounded-lg border border-yellow-200 bg-white px-2 py-1 text-xs outline-none focus:border-yellow-400"
            >
              {BUTTON_VARIANTS.map((variant) => (
                <option key={variant.value} value={variant.value}>
                  {variant.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-neutral-600">
            配置
            <select
              value={draftData.align ?? "left"}
              onChange={(event) =>
                updateAndCommitData({
                  align: event.target.value as ButtonAlign,
                })
              }
              className="rounded-lg border border-yellow-200 bg-white px-2 py-1 text-xs outline-none focus:border-yellow-400"
            >
              {BUTTON_ALIGN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <label className="mb-3 block">
        <span className="text-[11px] font-bold text-neutral-500">
          ボタン文字
        </span>
        <input
          value={draftData.label}
          onChange={(event) =>
            updateDraftData({
              label: event.target.value,
            })
          }
          onBlur={() => commitData()}
          className="mt-1 w-full rounded-xl border border-yellow-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-yellow-400"
          placeholder="登録する / 申し込む / 詳細を見る など"
        />
      </label>

      <label className="block">
        <span className="text-[11px] font-bold text-neutral-500">
          URL
        </span>
        <input
          value={draftData.url}
          onChange={(event) =>
            updateDraftData({
              url: event.target.value,
            })
          }
          onBlur={() => commitData()}
          className="mt-1 w-full rounded-xl border border-yellow-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-yellow-400"
          placeholder="https://..."
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
