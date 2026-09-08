"use client";

import type { InstagramPanelData } from "./parseInstagramPanel";

type InstagramEmbedProps = {
  data: InstagramPanelData;
  emptyMessage?: string;
};

export function InstagramEmbed({
  data,
  emptyMessage = "Instagram URLを入力してください。",
}: InstagramEmbedProps) {
  const embedUrl = toInstagramEmbedUrl(data.url);
  const width = toCssWidth(data.instagramWidth);

  if (!embedUrl) {
    return (
      <div className="min-h-[72px] w-full rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-5 text-center text-sm text-neutral-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.title.trim() ? (
        <div className="text-sm font-bold text-neutral-900">
          {data.title.trim()}
        </div>
      ) : null}

      <div
        className="mx-auto w-full max-w-full overflow-hidden rounded-xl border border-neutral-200 bg-white"
        style={{ width }}
      >
        <iframe
          src={embedUrl}
          title={data.title.trim() || "Instagram"}
          className="block min-h-[650px] w-full border-0"
          scrolling="no"
          allow="encrypted-media; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      {data.caption.trim() ? (
        <div className="whitespace-pre-wrap text-sm leading-6 text-neutral-700">
          {data.caption.trim()}
        </div>
      ) : null}
    </div>
  );
}

export function toInstagramEmbedUrl(value: string): string | null {
  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  try {
    const url = new URL(text);

    const hostname = url.hostname.toLowerCase();

    if (
      hostname !== "instagram.com" &&
      hostname !== "www.instagram.com"
    ) {
      return null;
    }

    const parts = url.pathname
      .split("/")
      .filter(Boolean);

    if (parts.length < 2) {
      return null;
    }

    const kind = parts[0].toLowerCase();

    if (
      kind !== "p" &&
      kind !== "reel" &&
      kind !== "tv"
    ) {
      return null;
    }

    const shortcode = parts[1];

    if (!shortcode) {
      return null;
    }

    return `https://www.instagram.com/${kind}/${shortcode}/embed`;
  } catch {
    return null;
  }
}

function toCssWidth(value: string): string {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "100%";
  }

  const clamped = Math.min(
    Math.max(numeric, 20),
    100,
  );

  return `${clamped}%`;
}
