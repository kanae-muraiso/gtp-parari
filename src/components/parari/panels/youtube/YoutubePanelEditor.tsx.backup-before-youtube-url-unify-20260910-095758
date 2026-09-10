// apps/tools/parari/src/components/parari/panels/youtube/YoutubePanelEditor.tsx
// 2026-06-22 20:05 JST - YOUTUBE専用PanelEditor

"use client";

import type { PanelEditorProps } from "../panelDefinitionTypes";
import type { YoutubePanelData } from "./parseYoutubePanel";
import { serializeYoutubePanel } from "./serializeYoutubePanel";

export function YoutubePanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<YoutubePanelData>) {
  const updateData = (partial: Partial<YoutubePanelData>) => {
    const nextData: YoutubePanelData = {
      ...data,
      ...partial,
    };

    onChangeRaw?.(serializeYoutubePanel(nextData));
  };

  const videoId = extractYoutubeVideoId(data.url);
  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}`
    : "";

  return (
    <div className="rounded-xl border border-yellow-200 bg-white p-3">
      <div className="mb-3">
        <span className="rounded-full bg-yellow-100 px-2 py-1 text-[11px] font-bold text-yellow-900">
          YOUTUBE 専用エディタ
        </span>
        <p className="mt-2 text-xs leading-5 text-neutral-600">
          YouTube URLを指定して、PARARI内で埋め込み表示するパネルです。
        </p>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold text-neutral-700">
          YouTube URL
        </span>
        <input
          value={data.url}
          onChange={(event) => updateData({ url: event.target.value })}
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          placeholder="https://www.youtube.com/watch?v=xxxx"
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
          placeholder="レッスン動画"
        />
      </label>

      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-neutral-700">
            アスペクト比
          </span>
          <input
            value={data.aspect}
            onChange={(event) => updateData({ aspect: event.target.value })}
            className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            placeholder="16:9"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-neutral-700">
            表示幅
          </span>
          <input
            value={data.youtubeWidth}
            onChange={(event) =>
              updateData({ youtubeWidth: event.target.value })
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
          onChange={(event) => updateData({ caption: event.target.value })}
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          placeholder="動画の説明"
        />
      </label>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <p className="mb-2 text-[11px] font-bold text-neutral-500">
          表示イメージ
        </p>

        {embedUrl ? (
          <div className="rounded-lg bg-white p-3 ring-1 ring-neutral-200">
            {data.title.trim().length > 0 ? (
              <p className="mb-2 text-sm font-bold text-neutral-800">
                {data.title.trim()}
              </p>
            ) : null}

            <iframe
              src={embedUrl}
              title={data.title.trim() || "YouTube video"}
              className="mx-auto w-full rounded-lg bg-black"
              style={{
                width: toCssSize(data.youtubeWidth) ?? "100%",
                aspectRatio: toCssAspectRatio(data.aspect) ?? "16 / 9",
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />

            {data.caption.trim().length > 0 ? (
              <p className="mt-2 text-center text-xs text-neutral-500">
                {data.caption.trim()}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-3 text-xs text-neutral-500">
            YouTube URLから動画IDを取得できません。
          </p>
        )}
      </div>

    </div>
  );
}

function extractYoutubeVideoId(url: string): string {
  const trimmed = url.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "").trim();
    }

    if (parsed.pathname.startsWith("/shorts/")) {
      return parsed.pathname.replace("/shorts/", "").split("/")[0] ?? "";
    }

    if (parsed.pathname.startsWith("/embed/")) {
      return parsed.pathname.replace("/embed/", "").split("/")[0] ?? "";
    }

    return parsed.searchParams.get("v") ?? "";
  } catch {
    return "";
  }
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
