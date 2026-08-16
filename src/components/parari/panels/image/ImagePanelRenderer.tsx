// src/components/parari/panels/image/ImagePanelRenderer.tsx
// PART: Image panel renderer for viewer-v2

import type { PanelRendererProps } from "../panelDefinitionTypes";
import type { ImagePanelData } from "./parseImagePanel";

function sanitizeImageUrl(value: string): string {
  const text = String(value ?? "").trim();

  if (text.length === 0) return "";

  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/")) return text;

  return "";
}

function sanitizeLinkUrl(value: string): string {
  const text = String(value ?? "").trim();

  if (text.length === 0) return "";

  const fixedText = text
    .replace(/^https\/\//i, "https://")
    .replace(/^http\/\//i, "http://");

  if (/^https?:\/\//i.test(fixedText)) return fixedText;
  if (fixedText.startsWith("/")) return fixedText;

  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(fixedText)) {
    return `https://${fixedText}`;
  }

  return "";
}

function imageWidthClass(value: unknown): string {
  const width = String(value ?? "normal").trim().toLowerCase();

  if (width === "wide" || width === "90") {
    return "mx-auto w-[90%]";
  }

  if (width === "full" || width === "100") {
    return "mx-auto w-full";
  }

  if (width === "bleed" || width === "device" || width === "device-full") {
    return "relative left-1/2 w-screen max-w-[720px] -translate-x-1/2";
  }

  return "mx-auto w-[75%]";
}

export function ImagePanelRenderer({
  data,
}: PanelRendererProps<ImagePanelData>) {
  const src = sanitizeImageUrl(data.url);

  if (!src) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm font-semibold text-neutral-400">
        画像なし
      </div>
    );
  }

  const caption = String(data.caption ?? "").trim();
  const linkUrl = sanitizeLinkUrl(data.linkUrl);
  const figureClassName = imageWidthClass(data.imageWidth);

  const imageElement = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={caption || "画像"}
      className="block h-auto w-full object-contain"
      loading="lazy"
    />
  );

  return (
    <figure className={figureClassName}>
      {linkUrl ? (
        <a
          href={linkUrl}
          target="_blank"
          rel="noreferrer"
          className="block"
        >
          {imageElement}
        </a>
      ) : (
        imageElement
      )}

      {caption ? (
        <figcaption className="mt-2 text-center text-xs leading-5 text-neutral-500">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
