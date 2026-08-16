// apps/tools/parari/src/components/parari/panels/audio/AudioPanelEditor.tsx
// 2026-06-22 20:05 JST - AUDIO専用PanelEditor

"use client";

import type { PanelEditorProps } from "../panelDefinitionTypes";
import type { AudioPanelData } from "./parseAudioPanel";
import { serializeAudioPanel } from "./serializeAudioPanel";

export function AudioPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<AudioPanelData>) {
  const updateData = (partial: Partial<AudioPanelData>) => {
    const nextData: AudioPanelData = {
      ...data,
      ...partial,
    };

    onChangeRaw?.(serializeAudioPanel(nextData));
  };

  return (
    <div className="rounded-xl border border-yellow-200 bg-white p-3">
      <div className="mb-3">
        <span className="rounded-full bg-yellow-100 px-2 py-1 text-[11px] font-bold text-yellow-900">
          AUDIO 専用エディタ
        </span>
        <p className="mt-2 text-xs leading-5 text-neutral-600">
          mp3などの音声URLを指定して、PARARI内で再生するパネルです。
          音声ファイル自体はPARARIには保存しません。
        </p>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold text-neutral-700">
          音声URL
        </span>
        <input
          value={data.url}
          onChange={(event) => updateData({ url: event.target.value })}
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          placeholder="https://example.com/audio.mp3"
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold text-neutral-700">
          タイトル
        </span>
        <input
          value={data.title}
          onChange={(event) => updateData({ title: event.target.value })}
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          placeholder="音声解説"
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold text-neutral-700">
          音声プレイヤー幅
        </span>
        <input
          value={data.audioWidth}
          onChange={(event) => updateData({ audioWidth: event.target.value })}
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          placeholder="100"
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold text-neutral-700">
          キャプション
        </span>
        <input
          value={data.caption}
          onChange={(event) => updateData({ caption: event.target.value })}
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          placeholder="再生して内容を確認してください。"
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold text-neutral-700">
          TRANSCRIPT
        </span>
        <textarea
          value={data.transcript}
          onChange={(event) => updateData({ transcript: event.target.value })}
          spellCheck={false}
          className="min-h-[100px] w-full resize-y rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm leading-6 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          placeholder="音声の文字起こし"
        />
      </label>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <p className="mb-2 text-[11px] font-bold text-neutral-500">
          表示イメージ
        </p>

        {data.url.trim().length > 0 ? (
          <div className="rounded-lg bg-white p-3 ring-1 ring-neutral-200">
            {data.title.trim().length > 0 ? (
              <p className="mb-2 text-sm font-bold text-neutral-800">
                {data.title.trim()}
              </p>
            ) : null}

            <audio
              controls
              src={data.url.trim()}
              className="max-w-full"
              style={{
                width: toCssSize(data.audioWidth) ?? "100%",
              }}
            />

            {data.caption.trim().length > 0 ? (
              <p className="mt-2 text-xs text-neutral-500">
                {data.caption.trim()}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-3 text-xs text-neutral-500">
            音声URLが未入力です。
          </p>
        )}
      </div>

    </div>
  );
}

function toCssSize(value: string): string | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return `${trimmed}%`;
  }

  return trimmed;
}
