// Instagram panel editor

"use client";

import type { PanelEditorProps } from "../panelDefinitionTypes";
import type { InstagramPanelData } from "./parseInstagramPanel";
import { serializeInstagramPanel } from "./serializeInstagramPanel";
import { InstagramEmbed } from "./InstagramEmbed";

export function InstagramPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<InstagramPanelData>) {
  const updateData = (
    nextData: InstagramPanelData,
  ) => {
    onChangeRaw?.(
      serializeInstagramPanel(nextData),
    );
  };

  const updateField = <
    K extends keyof InstagramPanelData
  >(
    key: K,
    value: InstagramPanelData[K],
  ) => {
    updateData({
      ...data,
      [key]: value,
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-[1fr_160px]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-neutral-500">
            Instagram URL
          </span>

          <input
            value={data.url}
            onChange={(event) =>
              updateField(
                "url",
                event.target.value,
              )
            }
            placeholder="https://www.instagram.com/reel/xxxx/"
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-neutral-500">
            幅 %
          </span>

          <input
            value={data.instagramWidth}
            onChange={(event) =>
              updateField(
                "instagramWidth",
                event.target.value,
              )
            }
            placeholder="100"
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_160px]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-neutral-500">
            タイトル 任意
          </span>

          <input
            value={data.title}
            onChange={(event) =>
              updateField(
                "title",
                event.target.value,
              )
            }
            placeholder="参考にしたいInstagram動画"
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-neutral-500">
            比率 任意
          </span>

          <input
            value={data.aspect}
            onChange={(event) =>
              updateField(
                "aspect",
                event.target.value,
              )
            }
            placeholder="9:16"
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] font-bold text-neutral-500">
          サムネイルURL 任意
        </span>

        <input
          value={data.thumbnail}
          onChange={(event) =>
            updateField(
              "thumbnail",
              event.target.value,
            )
          }
          placeholder="https://example.com/thumb.jpg"
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] font-bold text-neutral-500">
          キャプション 任意
        </span>

        <textarea
          value={data.caption}
          onChange={(event) =>
            updateField(
              "caption",
              event.target.value,
            )
          }
          placeholder="この動画についてのメモを書きます。"
          className="min-h-[80px] w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </label>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <div className="mb-2 text-[11px] font-bold text-neutral-400">
          表示プレビュー
        </div>

        <InstagramEmbed data={data} />
      </div>
    </div>
  );
}
