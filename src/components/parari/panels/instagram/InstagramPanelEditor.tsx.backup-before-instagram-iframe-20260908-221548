// apps/tools/parari/src/components/parari/panels/instagram/InstagramPanelEditor.tsx
// 2026-06-23 JST - Instagram panel editor / 表示だけMVP

"use client";

import { useEffect, type CSSProperties } from "react";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import type { InstagramPanelData } from "./parseInstagramPanel";
import { serializeInstagramPanel } from "./serializeInstagramPanel";

declare global {
  interface Window {
    instgrm?: {
      Embeds?: {
        process: () => void;
      };
    };
  }
}

export function InstagramPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<InstagramPanelData>) {
  const updateData = (nextData: InstagramPanelData) => {
    onChangeRaw?.(serializeInstagramPanel(nextData));
  };

  const updateField = <K extends keyof InstagramPanelData>(
    key: K,
    value: InstagramPanelData[K]
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
            onChange={(event) => updateField("url", event.target.value)}
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
              updateField("instagramWidth", event.target.value)
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
            onChange={(event) => updateField("title", event.target.value)}
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
            onChange={(event) => updateField("aspect", event.target.value)}
            placeholder="9:16"
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] font-bold text-neutral-500">
          サムネイルURL 任意 / 埋め込み失敗時の予備
        </span>
        <input
          value={data.thumbnail}
          onChange={(event) => updateField("thumbnail", event.target.value)}
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
          onChange={(event) => updateField("caption", event.target.value)}
          placeholder="この動画についてのメモを書きます。"
          className="min-h-[80px] w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </label>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <div className="mb-2 text-[11px] font-bold text-neutral-400">
          表示プレビュー
        </div>

        <InstagramPreview data={data} />
      </div>

    </div>
  );
}

function InstagramPreview({ data }: { data: InstagramPanelData }) {
  const normalizedUrl = normalizeInstagramUrl(data.url);
  const width = toCssWidth(data.instagramWidth);

  useEffect(() => {
    if (!normalizedUrl) {
      return;
    }

    ensureInstagramEmbedScript(() => {
      window.instgrm?.Embeds?.process();
    });
  }, [normalizedUrl]);

  if (!normalizedUrl) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-200 bg-white px-3 py-6 text-center text-sm text-neutral-400">
        Instagram URLを入力してください。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.title.trim().length > 0 ? (
        <div className="text-sm font-bold text-neutral-900">
          {data.title.trim()}
        </div>
      ) : null}

      <div style={{ width }} className="max-w-full">
        <blockquote
          key={normalizedUrl}
          className="instagram-media"
          data-instgrm-permalink={normalizedUrl}
          data-instgrm-version="14"
          style={instagramBlockquoteStyle}
        >
          <a href={normalizedUrl} target="_blank" rel="noreferrer">
            Instagramで開く
          </a>
        </blockquote>
      </div>

      {data.thumbnail.trim().length > 0 ? (
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-xl border border-neutral-200 bg-white"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.thumbnail.trim()}
            alt={data.title.trim() || "Instagram thumbnail"}
            className="h-auto w-full object-cover"
          />
          <div className="px-3 py-2 text-xs font-bold text-neutral-600">
            Instagramで開く
          </div>
        </a>
      ) : null}

      {data.caption.trim().length > 0 ? (
        <div className="whitespace-pre-wrap rounded-lg bg-white px-3 py-2 text-sm leading-6 text-neutral-700">
          {data.caption.trim()}
        </div>
      ) : null}

      <a
        href={normalizedUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
      >
        Instagramで開く
      </a>
    </div>
  );
}

const instagramBlockquoteStyle: CSSProperties = {
  background: "#fff",
  border: 0,
  borderRadius: 12,
  boxShadow: "0 0 1px rgba(0,0,0,0.4), 0 1px 10px rgba(0,0,0,0.12)",
  margin: 0,
  maxWidth: 540,
  minWidth: 260,
  padding: 0,
  width: "100%",
};

function ensureInstagramEmbedScript(onReady: () => void) {
  const existingScript = document.getElementById("instagram-embed-script");

  if (window.instgrm?.Embeds?.process) {
    onReady();
    return;
  }

  if (existingScript) {
    existingScript.addEventListener("load", onReady, { once: true });
    return;
  }

  const script = document.createElement("script");
  script.id = "instagram-embed-script";
  script.async = true;
  script.src = "https://www.instagram.com/embed.js";
  script.onload = onReady;

  document.body.appendChild(script);
}

function normalizeInstagramUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);

    if (!url.hostname.includes("instagram.com")) {
      return trimmed;
    }

    url.search = "";

    if (!url.pathname.endsWith("/")) {
      url.pathname = `${url.pathname}/`;
    }

    return url.toString();
  } catch {
    return trimmed;
  }
}

function toCssWidth(value: string): string {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "100%";
  }

  const clamped = Math.min(Math.max(numeric, 20), 100);

  return `${clamped}%`;
}
