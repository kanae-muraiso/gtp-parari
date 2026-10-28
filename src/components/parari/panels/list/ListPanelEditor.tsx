// apps/tools/parari/src/components/parari/panels/list/ListPanelEditor.tsx
// apps/tools/parari/src/components/parari/panels/list/ListPanelEditor.tsx
// 2026-06-27 19:25 JST
// PART: LIST editor with local draft state
// コメント:
// - 1文字入力ごとに親SSOTを更新しない
// - タイトル/項目入力中はローカルdraftだけ更新する
// - blur時にSSOTへ反映する
// - 色変更/項目追加/削除/並び替えは構造変更として即commitする

"use client";

import { useEffect, useState } from "react";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import { SsotUiPanelPreview } from "../shared/SsotUiPanelRenderer";
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

    const dataSignature = [
      data.title,
      data.variant ?? "",
      ...data.items,
    ].join("\n");

    useEffect(() => {
      setDraftData(data);
    }, [dataSignature]);

  const commitData = (nextData: ListPanelData = draftData) => {
    onChangeRaw?.(serializeListPanel(nextData));
  };

  const updateDraftData = (partial: Partial<ListPanelData>) => {
    setDraftData((current) => ({
      ...current,
      ...partial,
    }));
  };

  const updateAndCommitData = (partial: Partial<ListPanelData>) => {
    const nextData: ListPanelData = {
      ...draftData,
      ...partial,
    };

    setDraftData(nextData);
    commitData(nextData);
  };

  const updateDraftItem = (index: number, value: string) => {
    setDraftData((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    }));
  };

  const addItem = () => {
    updateAndCommitData({
      items: [...draftData.items, ""],
    });
  };

  const removeItem = (index: number) => {
    updateAndCommitData({
      items: draftData.items.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;

    if (nextIndex < 0 || nextIndex >= draftData.items.length) {
      return;
    }

    const nextItems = [...draftData.items];
    const current = nextItems[index] ?? "";
    const target = nextItems[nextIndex] ?? "";

    nextItems[index] = target;
    nextItems[nextIndex] = current;

    updateAndCommitData({
      items: nextItems,
    });
  };

  const raw = serializeListPanel(draftData);

  return (
    <div className="rounded-xl border border-yellow-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-yellow-100 px-2 py-1 text-[11px] font-bold text-yellow-900">
            LIST 専用エディタ
          </span>
          <p className="mt-2 text-xs leading-5 text-neutral-600">
            持ち物・手順・注意点などをリストで表示するパネルです。
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
            {LIST_VARIANTS.map((variant) => (
              <option key={variant.value} value={variant.value}>
                {variant.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold text-neutral-700">
          タイトル 任意
        </span>
        <input
          value={draftData.title}
          onChange={(event) =>
            updateDraftData({
              title: event.target.value,
            })
          }
          onBlur={() => commitData()}
          placeholder="空欄なら表示しません"
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-neutral-700">
            項目
          </span>

          <button
            type="button"
            onClick={addItem}
            className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] font-bold text-neutral-600 hover:bg-neutral-50"
          >
            項目を追加
          </button>
        </div>

        {draftData.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-400">
            項目がありません。
          </div>
        ) : (
          draftData.items.map((item, index) => (
            <div
              key={`list-item-${index}`}
              className="grid gap-2 md:grid-cols-[1fr_auto]"
            >
              <input
                value={item}
                onChange={(event) => updateDraftItem(index, event.target.value)}
                onBlur={() => commitData()}
                placeholder={`項目${index + 1}`}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveItem(index, "up")}
                  disabled={index === 0}
                  className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-500 hover:bg-neutral-50 disabled:opacity-30"
                >
                  ↑
                </button>

                <button
                  type="button"
                  onClick={() => moveItem(index, "down")}
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
