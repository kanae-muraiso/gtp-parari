"use client";

import { useEffect, useState } from "react";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import {
  normalizeMenuVariant,
  normalizeMenuWidth,
  type MenuPanelData,
  type MenuPanelItem,
  type MenuPanelVariant,
  type MenuPanelWidth,
} from "./parseMenuPanel";
import { serializeMenuPanel } from "./serializeMenuPanel";
import { MenuPanelRenderer } from "./MenuPanelRenderer";

const MENU_VARIANTS: Array<{ value: MenuPanelVariant; label: string }> = [
  { value: "black", label: "黒" },
  { value: "white", label: "白" },
  { value: "gray", label: "グレー" },
  { value: "primary", label: "青" },
];

const MENU_WIDTHS: Array<{ value: MenuPanelWidth; label: string }> = [
  { value: "normal", label: "通常幅" },
  { value: "full", label: "幅いっぱい" },
];

export function MenuPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<MenuPanelData>) {
  const [draft, setDraft] = useState<MenuPanelData>(data);

  useEffect(() => {
    setDraft(data);
  }, [data]);

  const commit = (next: MenuPanelData) => {
    setDraft(next);
    onChangeRaw(serializeMenuPanel(next));
  };

  const updateItem = (
    index: number,
    patch: Partial<MenuPanelItem>,
  ) => {
    const nextItems = draft.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    );

    commit({
      ...draft,
      items: nextItems,
    });
  };

  const addItem = () => {
    commit({
      ...draft,
      items: [...draft.items, { label: "リンク", url: "https://example.com" }],
    });
  };

  const removeItem = (index: number) => {
    commit({
      ...draft,
      items: draft.items.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const updateVariant = (value: string) => {
    commit({
      ...draft,
      variant: normalizeMenuVariant(value),
    });
  };

  const updateWidth = (value: string) => {
    commit({
      ...draft,
      width: normalizeMenuWidth(value),
    });
  };

  return (
    <div className="rounded-xl border border-yellow-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-yellow-100 px-2 py-1 text-[11px] font-bold text-yellow-900">
            MENU 専用エディタ
          </span>
          <p className="mt-2 text-xs leading-5 text-neutral-600">
            ページ内外へのリンクを、帯バー型のメニューとして表示します。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="text-xs font-bold text-neutral-500">
            色{" "}
            <select
              value={draft.variant}
              onChange={(event) => updateVariant(event.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {MENU_VARIANTS.map((variant) => (
                <option key={variant.value} value={variant.value}>
                  {variant.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-bold text-neutral-500">
            幅{" "}
            <select
              value={draft.width || "normal"}
              onChange={(event) => updateWidth(event.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {MENU_WIDTHS.map((width) => (
                <option key={width.value} value={width.value}>
                  {width.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-2">
        {draft.items.map((item, index) => (
          <div
            key={`menu-item-${index}`}
            className="grid gap-2 md:grid-cols-[1fr_1.4fr_auto]"
          >
            <input
              value={item.label}
              onChange={(event) =>
                updateItem(index, { label: event.currentTarget.value })
              }
              placeholder="表示名"
              className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />

            <input
              value={item.url}
              onChange={(event) =>
                updateItem(index, { url: event.currentTarget.value })
              }
              placeholder="URL"
              className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />

            <button
              type="button"
              onClick={() => removeItem(index)}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-500 transition hover:bg-neutral-100"
            >
              削除
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addItem}
        className="mt-3 rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-700"
      >
        ＋ 項目を追加
      </button>

      <div className="mt-4 rounded-2xl bg-neutral-50 p-3">
        <div className="mb-2 text-[11px] font-bold text-neutral-400">
          プレビュー
        </div>
        <MenuPanelRenderer
          block={{
            id: "menu-preview",
            kind: "panel",
            tag: "MENU",
            variant: draft.variant,
            raw: serializeMenuPanel(draft),
            start: 0,
            end: 0,
            implemented: true,
          }}
          data={draft}
        />
      </div>
    </div>
  );
}
