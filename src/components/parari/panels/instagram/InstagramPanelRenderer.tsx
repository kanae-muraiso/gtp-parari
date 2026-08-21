"use client";

import { useEffect, type CSSProperties } from "react";
import type { PanelRendererProps } from "../panelDefinitionTypes";
import type { InstagramPanelData } from "./parseInstagramPanel";

declare global {
  interface Window {
    instgrm?: {
      Embeds?: {
        process: () => void;
      };
    };
  }
}

export function InstagramPanelRenderer({
  data,
}: PanelRendererProps<InstagramPanelData>) {
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
    return null;
  }

  return (
    <div className="space-y-3">
      {data.title.trim() ? (
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

      {data.thumbnail.trim() ? (
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
        </a>
      ) : null}

      {data.caption.trim() ? (
        <div className="whitespace-pre-wrap text-sm leading-6 text-neutral-700">
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
  const trimmed = String(value ?? "").trim();

  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);

    if (!url.hostname.includes("instagram.com")) {
      return "";
    }

    url.search = "";

    if (!url.pathname.endsWith("/")) {
      url.pathname = `${url.pathname}/`;
    }

    return url.toString();
  } catch {
    return "";
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
