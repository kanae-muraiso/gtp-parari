"use client";

import type { PanelEditorProps } from "../panelDefinitionTypes";
import type { VideoPanelData } from "./parseVideoPanel";
import { serializeVideoPanel } from "./serializeVideoPanel";

export function VideoPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<VideoPanelData>) {
  const updateData = (partial: Partial<VideoPanelData>) => {
    const nextData = { ...data, ...partial };
    onChangeRaw?.(serializeVideoPanel(nextData));
  };

  return (
    <div>
      <input
        value={data.title}
        onChange={(event) => updateData({ title: event.target.value })}
        className="mb-2 w-full border-0 bg-transparent p-0 text-sm font-bold text-neutral-800 outline-none placeholder:text-neutral-300"
        placeholder="動画タイトル"
      />

      {data.url.trim().length > 0 ? (
        <video
          controls
          playsInline
          loop={data.loop}
          muted={data.muted}
          poster={data.poster.trim() || undefined}
          src={data.url.trim()}
          className="mx-auto max-h-[360px] max-w-full rounded-xl bg-black"
          style={{
            width: toCssSize(data.videoWidth) ?? "100%",
            aspectRatio: toCssAspectRatio(data.aspect),
          }}
        />
      ) : (
        <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-sm font-bold text-neutral-400">
          動画URLを設定
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
            <span className="mb-1 block text-[11px] font-bold">動画URL</span>
            <input
              value={data.url}
              onChange={(event) => updateData({ url: event.target.value })}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none"
              placeholder="https://example.com/movie.mp4"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-bold">ポスター画像URL</span>
            <input
              value={data.poster}
              onChange={(event) => updateData({ poster: event.target.value })}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none"
              placeholder="https://example.com/poster.jpg"
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
              <span className="mb-1 block text-[11px] font-bold">動画幅</span>
              <input
                value={data.videoWidth}
                onChange={(event) => updateData({ videoWidth: event.target.value })}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none"
                placeholder="100"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={data.loop}
                onChange={(event) => updateData({ loop: event.target.checked })}
              />
              ループ
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={data.muted}
                onChange={(event) => updateData({ muted: event.target.checked })}
              />
              ミュート
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
