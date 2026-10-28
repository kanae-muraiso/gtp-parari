"use client";

import type { PanelEditorProps } from "../panelDefinitionTypes";
import type {
  InstagramDisplayMode,
  InstagramPanelData,
} from "./parseInstagramPanel";
import { serializeInstagramPanel } from "./serializeInstagramPanel";
import { InstagramEmbed } from "./InstagramEmbed";

export function InstagramPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<InstagramPanelData>) {
  const updateData = (partial: Partial<InstagramPanelData>) => {
    onChangeRaw?.(
      serializeInstagramPanel({
        ...data,
        ...partial,
      }),
    );
  };

  const setDisplayMode = (displayMode: InstagramDisplayMode) => {
    updateData({ displayMode });
  };

  return (
    <div>
      <input
        value={data.title}
        onChange={(event) => updateData({ title: event.target.value })}
        className="mb-2 w-full border-0 bg-transparent p-0 text-sm font-bold text-neutral-800 outline-none placeholder:text-neutral-300"
        placeholder="Instagramタイトル"
      />

      {data.url.trim() ? (
        <InstagramEmbed data={data} />
      ) : (
        <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-sm font-bold text-neutral-400">
          Instagram URLを設定
        </div>
      )}

      <textarea
        value={data.caption}
        onChange={(event) => updateData({ caption: event.target.value })}
        rows={2}
        className="mt-2 min-h-[44px] w-full resize-y border-0 bg-transparent px-1 py-1 text-sm leading-6 text-neutral-600 outline-none placeholder:text-neutral-300"
        placeholder="キャプション"
      />

      <details className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
        <summary className="cursor-pointer select-none font-bold">設定</summary>

        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold">Instagram URL</span>
            <input
              value={data.url}
              onChange={(event) => updateData({ url: event.target.value })}
              placeholder="https://www.instagram.com/reel/xxxx/"
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-bold">幅 %</span>
            <input
              value={data.instagramWidth}
              onChange={(event) => updateData({ instagramWidth: event.target.value })}
              placeholder="100"
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none"
            />
          </label>

          <div>
            <div className="mb-1 text-[11px] font-bold">表示方法</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDisplayMode("embed")}
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition",
                  data.displayMode === "embed"
                    ? "bg-blue-50 text-blue-700 ring-blue-200"
                    : "bg-white text-neutral-500 ring-neutral-200",
                ].join(" ")}
              >
                Instagram埋め込み
              </button>

              <button
                type="button"
                onClick={() => setDisplayMode("thumbnail")}
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition",
                  data.displayMode === "thumbnail"
                    ? "bg-blue-50 text-blue-700 ring-blue-200"
                    : "bg-white text-neutral-500 ring-neutral-200",
                ].join(" ")}
              >
                サムネイル
              </button>
            </div>
          </div>

          {data.displayMode === "thumbnail" ? (
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold">サムネイル画像URL</span>
              <input
                value={data.thumbnail}
                onChange={(event) => updateData({ thumbnail: event.target.value })}
                placeholder="https://example.com/thumbnail.jpg"
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none"
              />
            </label>
          ) : null}
        </div>
      </details>
    </div>
  );
}
