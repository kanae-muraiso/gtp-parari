"use client";

import type { PanelRendererProps } from "../panelDefinitionTypes";
import type { AudioPanelData } from "./parseAudioPanel";

export function AudioPanelRenderer({
  data,
}: PanelRendererProps<AudioPanelData>) {
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

      <audio
        controls
        src={url}
        className="max-w-full"
        style={{
          width: toCssSize(data.audioWidth) ?? "100%",
        }}
      />

      {data.caption.trim() ? (
        <p className="mt-2 text-xs text-neutral-500">
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
