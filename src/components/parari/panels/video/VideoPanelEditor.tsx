// apps/tools/parari/src/components/parari/panels/video/VideoPanelEditor.tsx
// 2026-06-22 19:35 JST - VIDEO専用PanelEditor

"use client";

import type { PanelEditorProps } from "../panelDefinitionTypes";
import type { VideoPanelData } from "./parseVideoPanel";
import { serializeVideoPanel } from "./serializeVideoPanel";

export function VideoPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<VideoPanelData>) {
  const updateData = (partial: Partial<VideoPanelData>) => {
    const nextData: VideoPanelData = {
      ...data,
      ...partial,
    };

    onChangeRaw?.(serializeVideoPanel(nextData));
  };

  return (
    <div className="rounded-xl border border-yellow-200 bg-white p-3">
      <div className="mb-3">
        <span className="rounded-full bg-yellow-100 px-2 py-1 text-[11px] font-bold text-yellow-900">
          VIDEO 専用エディタ
        </span>
        <p className="mt-2 text-xs leading-5 text-neutral-600">
          mp4などの動画URLを指定して、PARARI内で再生するパネルです。
          動画ファイル自体はPARARIには保存しません。
        </p>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold text-neutral-700">
          動画URL
        </span>
        <input
          value={data.url}
          onChange={(event) =>
            updateData({
              url: event.target.value,
            })
          }
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          placeholder="https://example.com/movie.mp4"
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold text-neutral-700">
          タイトル
        </span>
        <input
          value={data.title}
          onChange={(event) =>
            updateData({
              title: event.target.value,
            })
          }
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          placeholder="レッスン紹介動画"
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold text-neutral-700">
          ポスター画像URL
        </span>
        <input
          value={data.poster}
          onChange={(event) =>
            updateData({
              poster: event.target.value,
            })
          }
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          placeholder="https://example.com/poster.jpg"
        />
      </label>

      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-neutral-700">
            アスペクト比
          </span>
          <input
            value={data.aspect}
            onChange={(event) =>
              updateData({
                aspect: event.target.value,
              })
            }
            className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            placeholder="16:9"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-neutral-700">
            動画幅
          </span>
          <input
            value={data.videoWidth}
            onChange={(event) =>
              updateData({
                videoWidth: event.target.value,
              })
            }
            className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            placeholder="100"
          />
        </label>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold text-neutral-700">
          キャプション
        </span>
        <input
          value={data.caption}
          onChange={(event) =>
            updateData({
              caption: event.target.value,
            })
          }
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          placeholder="動画の説明"
        />
      </label>

      <div className="mb-3 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-xs font-bold text-neutral-700">
          <input
            type="checkbox"
            checked={data.loop}
            onChange={(event) =>
              updateData({
                loop: event.target.checked,
              })
            }
          />
          ループ再生
        </label>

        <label className="flex items-center gap-2 text-xs font-bold text-neutral-700">
          <input
            type="checkbox"
            checked={data.muted}
            onChange={(event) =>
              updateData({
                muted: event.target.checked,
              })
            }
          />
          ミュート
        </label>
      </div>

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

            <video
              controls
              playsInline
              loop={data.loop}
              muted={data.muted}
              poster={data.poster.trim() || undefined}
              src={data.url.trim()}
              className="mx-auto max-h-[320px] max-w-full rounded-lg bg-black"
              style={{
                width: toCssSize(data.videoWidth),
                aspectRatio: toCssAspectRatio(data.aspect),
              }}
            />

            {data.caption.trim().length > 0 ? (
              <p className="mt-2 text-center text-xs text-neutral-500">
                {data.caption.trim()}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-3 text-xs text-neutral-500">
            動画URLが未入力です。
          </p>
        )}
      </div>

      {data.extraLines.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] font-bold text-neutral-500">
            未対応の追加行
          </summary>
          <pre className="mt-2 max-h-[160px] overflow-auto whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs leading-5 text-neutral-800">
            {data.extraLines.join("\n")}
          </pre>
        </details>
      ) : null}

    </div>
  );
}

function toCssAspectRatio(value: string): string | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.includes(":")) {
    return trimmed.replace(":", " / ");
  }

  return trimmed;
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
