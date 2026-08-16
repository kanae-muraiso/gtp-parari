// apps/tools/parari/src/components/parari/panels/links/LinksPanelEditor.tsx
// apps/tools/parari/src/components/parari/panels/links/LinksPanelEditor.tsx
// 2026-06-27 19:10 JST
// PART: LINKS editor with local draft state
// コメント:
// - 1文字入力ごとに親SSOTを更新しない
// - 表示名/URLの入力中はローカルdraftだけ更新する
// - blur時にSSOTへ反映する
// - リンク追加/削除/並び替え/色変更は構造変更なので即commitする
// - inputのkeyは入力値を含めず、入力中のremountを避ける

"use client";

import { useEffect, useState } from "react";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import { SsotUiPanelPreview } from "../shared/SsotUiPanelRenderer";
import type {
  LinksPanelData,
  LinksPanelItem,
} from "./parseLinksPanel";
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

  const updateDraftData = (partial: Partial<LinksPanelData>) => {
    setDraftData((current) => ({
      ...current,
      ...partial,
    }));
  };

  const updateAndCommitData = (partial: Partial<LinksPanelData>) => {
    const nextData: LinksPanelData = {
      ...draftData,
      ...partial,
    };

    setDraftData(nextData);
    commitData(nextData);
  };

  const updateDraftItem = (
    index: number,
    partial: Partial<LinksPanelItem>,
  ) => {
    setDraftData((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        return {
          ...item,
          ...partial,
        };
      }),
    }));
  };

  const addItem = () => {
    updateAndCommitData({
      items: [
        ...draftData.items,
        {
          label: "リンク",
          url: "https://example.com",
        },
      ],
    });
  };

  const removeItem = (index: number) => {
    updateAndCommitData({
      items: draftData.items.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= draftData.items.length) {
      return;
    }

    const nextItems = [...draftData.items];
    const current = nextItems[index];
    const target = nextItems[nextIndex];

    if (!current || !target) {
      return;
    }

    nextItems[index] = target;
    nextItems[nextIndex] = current;

    updateAndCommitData({
      items: nextItems,
    });
  };

  const raw = serializeLinksPanel(draftData);

  return (
    <div className="rounded-xl border border-yellow-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-yellow-100 px-2 py-1 text-[11px] font-bold text-yellow-900">
            LINKS 専用エディタ
          </span>
          <p className="mt-2 text-xs leading-5 text-neutral-600">
            公式サイト・LINE・Instagram・申込ページなど、複数リンクをまとめるパネルです。
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
            {LINKS_VARIANTS.map((variant) => (
              <option key={variant.value} value={variant.value}>
                {variant.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-neutral-700">
            リンク
          </span>

          <button
            type="button"
            onClick={addItem}
            className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] font-bold text-neutral-600 hover:bg-neutral-50"
          >
            リンクを追加
          </button>
        </div>

        {draftData.items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-500">
            リンクがありません。「リンクを追加」を押してください。
          </p>
        ) : (
          draftData.items.map((item, index) => (
            <div
              key={`link-${index}`}
              className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-neutral-600">
                  リンク {index + 1}
                </span>

                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-500 hover:bg-neutral-50 disabled:opacity-30"
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    onClick={() => moveItem(index, 1)}
                    disabled={index === draftData.items.length - 1}
                    className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-500 hover:bg-neutral-50 disabled:opacity-30"
                  >
                    ↓
                  </button>

                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="rounded-md border border-red-100 bg-red-50 px-2 py-1 text-[11px] text-red-600 hover:bg-red-100"
                  >
                    削除
                  </button>
                </div>
              </div>

              <label className="mb-2 block">
                <span className="mb-1 block text-xs font-bold text-neutral-700">
                  表示名
                </span>
                <input
                  value={item.label}
                  onChange={(event) =>
                    updateDraftItem(index, {
                      label: event.target.value,
                    })
                  }
                  onBlur={() => commitData()}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="公式サイト"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-neutral-700">
                  URL
                </span>
                <input
                  value={item.url}
                  onChange={(event) =>
                    updateDraftItem(index, {
                      url: event.target.value,
                    })
                  }
                  onBlur={() => commitData()}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="https://example.com"
                />
              </label>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <p className="mb-2 text-[11px] font-bold text-neutral-500">
          公開表示プレビュー
        </p>

        <SsotUiPanelPreview raw={raw} />
      </div>

    </div>
  );
}
