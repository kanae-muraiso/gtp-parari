// apps/tools/parari/src/components/parari/panels/notice/NoticePanelEditor.tsx
// apps/tools/parari/src/components/parari/panels/notice/NoticePanelEditor.tsx
// 2026-06-27 19:25 JST
// PART: NOTICE editor with local draft state
// コメント:
// - 1文字入力ごとに親SSOTを更新しない
// - タイトル/本文入力中はローカルdraftだけ更新する
// - blur時にSSOTへ反映する
// - 色変更は即commitする

"use client";

import { useEffect, useState } from "react";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import { SsotUiPanelPreview } from "../shared/SsotUiPanelRenderer";
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

  const raw = serializeNoticePanel(draftData);

  return (
    <div className="rounded-xl border border-yellow-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-yellow-100 px-2 py-1 text-[11px] font-bold text-yellow-900">
            NOTICE 専用エディタ
          </span>
          <p className="mt-2 text-xs leading-5 text-neutral-600">
            注意事項・補足情報・お知らせを表示するパネルです。
          </p>
        </div>

        <label className="flex items-center gap-2 text-xs text-neutral-600">
          色
          <select
            value={draftData.variant ?? ""}
            onChange={(event) =>
              updateAndCommitData({
                variant: event.target.value || undefined,
              })
            }
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            {NOTICE_VARIANTS.map((variant) => (
              <option key={variant.value} value={variant.value}>
                {variant.label}
              </option>
            ))}
          </select>
        </label>
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
          placeholder="ご注意"
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
          className="min-h-[120px] w-full resize-y rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm leading-6 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          placeholder="室内履きをご持参ください。"
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
