"use client";

import type { PanelEditorProps } from "../panelDefinitionTypes";
import type { AudioPanelData } from "./parseAudioPanel";
import { serializeAudioPanel } from "./serializeAudioPanel";

export function AudioPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<AudioPanelData>) {
  const updateData = (partial: Partial<AudioPanelData>) => {
    const nextData = { ...data, ...partial };
    onChangeRaw?.(serializeAudioPanel(nextData));
  };

  return (
    <div>
      <input
        value={data.title}
        onChange={(event) => updateData({ title: event.target.value })}
        className="mb-2 w-full border-0 bg-transparent p-0 text-sm font-bold text-neutral-800 outline-none placeholder:text-neutral-300"
        placeholder="音声タイトル"
      />

      {data.url.trim().length > 0 ? (
        <audio
          controls
          src={data.url.trim()}
          className="max-w-full"
          style={{ width: toCssSize(data.audioWidth) ?? "100%" }}
        />
      ) : (
        <div className="flex min-h-[72px] items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-sm font-bold text-neutral-400">
          音声URLを設定
        </div>
      )}

      <input
        value={data.caption}
        onChange={(event) => updateData({ caption: event.target.value })}
        className="mt-2 w-full border-0 bg-transparent px-1 py-1 text-xs text-neutral-500 outline-none placeholder:text-neutral-300"
        placeholder="キャプション"
      />

      <details className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
        <summary className="cursor-pointer select-none font-bold">設定</summary>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold">音声URL</span>
            <input
              value={data.url}
              onChange={(event) => updateData({ url: event.target.value })}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none"
              placeholder="https://example.com/audio.mp3"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-bold">プレイヤー幅</span>
            <input
              value={data.audioWidth}
              onChange={(event) => updateData({ audioWidth: event.target.value })}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none"
              placeholder="100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-bold">文字起こし</span>
            <textarea
              value={data.transcript}
              onChange={(event) => updateData({ transcript: event.target.value })}
              className="min-h-[100px] w-full resize-y rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm leading-6 outline-none"
              placeholder="音声の文字起こし"
            />
          </label>
        </div>
      </details>
    </div>
  );
}

function toCssSize(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return `${trimmed}%`;
  return trimmed;
}
