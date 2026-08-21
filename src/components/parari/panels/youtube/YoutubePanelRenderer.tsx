"use client";

import type { PanelRendererProps } from "../panelDefinitionTypes";
import type { YoutubePanelData } from "./parseYoutubePanel";

export function YoutubePanelRenderer({
  data,
}: PanelRendererProps<YoutubePanelData>) {
  const videoId = extractYoutubeVideoId(data.url);

  if (!videoId) {
    return null;
  }

  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  const width = toCssSize(data.youtubeWidth) ?? "100%";
  const aspectRatio = toCssAspectRatio(data.aspect) ?? "16 / 9";

  return (
    <div className="w-full">
      <iframe
        src={embedUrl}
        title={data.title.trim() || "YouTube video"}
        className="mx-auto block max-w-full rounded-lg border-0 bg-black"
        style={{
          width,
          aspectRatio,
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />

      {data.caption.trim() ? (
        <div className="mt-2 text-center text-xs leading-5 text-neutral-500">
          {data.caption.trim()}
        </div>
      ) : null}
    </div>
  );
}

function extractYoutubeVideoId(value: string): string {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  try {
    const url = new URL(text);

    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    }

    if (url.hostname.includes("youtube.com")) {
      const videoId = url.searchParams.get("v");

      if (videoId) {
        return videoId;
      }

      const embedMatch = url.pathname.match(/^\/embed\/([^/]+)/);

      if (embedMatch?.[1]) {
        return embedMatch[1];
      }
    }
  } catch {
    return "";
  }

  return "";
}

function toCssSize(value: string): string | undefined {
  const text = String(value ?? "").trim();

  if (!text) {
    return undefined;
  }

  if (/^\d+(?:\.\d+)?$/.test(text)) {
    return `${text}%`;
  }

  return text;
}

function toCssAspectRatio(value: string): string | undefined {
  const text = String(value ?? "").trim();

  if (!text) {
    return undefined;
  }

  const match = text.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);

  if (!match) {
    return undefined;
  }

  return `${match[1]} / ${match[2]}`;
}
