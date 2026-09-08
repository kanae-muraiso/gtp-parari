"use client";

import type { PanelRendererProps } from "../panelDefinitionTypes";
import type { VideoPanelData } from "./parseVideoPanel";

export function VideoPanelRenderer({
  data,
}: PanelRendererProps<VideoPanelData>) {
  const url = data.url.trim();

  if (!url) {
    return null;
  }

  return (
    <div className="w-full">
      {data.title.trim() ? (
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
        src={url}
        className="mx-auto max-w-full rounded-lg bg-black"
        style={{
          width: toCssSize(data.videoWidth) ?? "100%",
          aspectRatio: toCssAspectRatio(data.aspect),
        }}
      />

      {data.caption.trim() ? (
        <p className="mt-2 text-center text-xs text-neutral-500">
          {data.caption.trim()}
        </p>
      ) : null}
    </div>
  );
}

function toCssSize(value: string): string | undefined {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) return undefined;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return `${trimmed}%`;
  }

  return trimmed;
}

function toCssAspectRatio(value: string): string | undefined {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) return undefined;

  const match = trimmed.match(
    /^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/,
  );

  if (!match) return undefined;

  return `${match[1]} / ${match[2]}`;
}
