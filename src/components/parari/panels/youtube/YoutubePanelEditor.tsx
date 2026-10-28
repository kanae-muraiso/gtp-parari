"use client";

import type { PanelEditorProps } from "../panelDefinitionTypes";
import type { YoutubePanelData } from "./parseYoutubePanel";
import { serializeYoutubePanel } from "./serializeYoutubePanel";
import { extractYoutubeVideoId } from "@/lib/parari/youtubeUrl";

export function YoutubePanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<YoutubePanelData>) {
  const updateData = (partial: Partial<YoutubePanelData>) => {
    const nextData = { ...data, ...partial };
    onChangeRaw?.(serializeYoutubePanel(nextData));
  };

  const videoId = extractYoutubeVideoId(data.url);
  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}`
    : "";

  return (
    <div>
      <input
        value={data.title}
        onChange={(event) => updateData({ title: event.target.value })}
        className="mb-2 w-full border-0 bg-transparent p-0 text-sm font-bold text-neutral-800 outline-none placeholder:text-neutral-300"
        placeholder="動画タイトル"
      />

      {embedUrl ? (
        <iframe
          src={embedUrl}
          title={data.title.trim() || "YouTube video"}
          className="mx-auto w-full rounded-xl bg-black"
          style={{
            width: toCssSize(data.youtubeWidth) ?? "100%",
            aspectRatio: toCssAspectRatio(data.aspect) ?? "16 / 9",
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-sm font-bold text-neutral-400">
          YouTube URLを設定
        </div>
      )}

      <input
        value={data.caption}
        onChange={(event) => updateData({ caption: event.target.value })}
        className="mt-2 w-full border-0 bg-transparent px-1 py-1 text-center text-xs text-neutral-500 outline-none placeholder:text-neutral-300"
        placeholder="キャプション"
      />

      <details className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
        <summary className="cursor-pointer select-none font-bold">設定</summary>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold">YouTube URL</span>
            <input
              value={data.url}
              onChange={(event) => updateData({ url: event.target.value })}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none"
              placeholder="https://www.youtube.com/watch?v=xxxx"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold">アスペクト比</span>
              <input
                value={data.aspect}
                onChange={(event) => updateData({ aspect: event.target.value })}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none"
                placeholder="16:9"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-bold">表示幅</span>
              <input
                value={data.youtubeWidth}
                onChange={(event) => updateData({ youtubeWidth: event.target.value })}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none"
                placeholder="100"
              />
            </label>
          </div>
        </div>
      </details>
    </div>
  );
}

function toCssAspectRatio(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.includes(":") ? trimmed.replace(":", " / ") : trimmed;
}

function toCssSize(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return `${trimmed}%`;
  return trimmed;
}
