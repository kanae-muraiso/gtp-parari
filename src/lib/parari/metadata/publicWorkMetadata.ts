import type { Metadata } from "next";

export const SITE_NAME = "PARARI";
export const DEFAULT_DESCRIPTION = "PARARIで公開された作品です。";
export const DEFAULT_OG_IMAGE =
  "https://www.parari.app/ogp/parari-ogp.png";

export type AuthorBrandImages = {
  homepage_header_logo_url?: string | null;
  avatar_url?: string | null;
  cover_image_url?: string | null;
};

type BuildPublicWorkMetadataInput = {
  content: string;
  url: string;
  fallbackTitle?: string | null;
  brandImages?: AuthorBrandImages | null;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function firstNonEmptyLine(lines: string[], startIndex: number): string {
  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i]?.trim() ?? "";
    if (line) return line;
  }

  return "";
}

function extractBookTitle(content: string): string {
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    const line = raw.trim();

    if (line.startsWith("[BOOK]")) {
      const inlineTitle = line.replace(/^\[BOOK\]/, "").trim();
      if (inlineTitle) return inlineTitle;

      const next = firstNonEmptyLine(lines, i + 1);
      const titleMatch = next.match(/^title\s*:\s*(.+)$/i);
      if (titleMatch?.[1]) {
        return titleMatch[1].trim();
      }
    }

    const titleMatch = line.match(/^title\s*:\s*(.+)$/i);
    if (titleMatch?.[1]) {
      return titleMatch[1].trim();
    }
  }

  return "";
}

function extractSubtitle(content: string): string {
  const lines = content.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    const match = line.match(/^subtitle\s*:\s*(.+)$/i);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

export function normalizeOgImageUrl(value: string): string {
  const candidate = value.trim().replace(/^["']|["']$/g, "");

  try {
    const url = new URL(candidate);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

/**
 * OGP画像の作品内優先順位:
 * 1. BOOK coverImage
 * 2. PAGE mainImage
 * 3. 旧作品の先頭IMAGEパネル
 */
function extractWorkImage(content: string): string {
  const lines = content.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    const match = line.match(/^coverImage\s*:\s*(.+)$/i);

    if (match?.[1]) {
      const url = normalizeOgImageUrl(match[1]);
      if (url) return url;
    }
  }

  for (const raw of lines) {
    const line = raw.trim();
    const match = line.match(/^mainImage\s*:\s*(.+)$/i);

    if (match?.[1]) {
      const url = normalizeOgImageUrl(match[1]);
      if (url) return url;
    }
  }

  // 旧作品との互換用。現行の本文IMAGEパネルはOGP候補にしない。
  for (const raw of lines) {
    const line = raw.trim();

    const imageBracketMatch = line.match(
      /^\[IMAGE\]\s+(https?:\/\/\S+)$/i,
    );
    if (imageBracketMatch?.[1]) {
      const url = normalizeOgImageUrl(imageBracketMatch[1]);
      if (url) return url;
    }

    const imageInlineMatch = line.match(
      /^\[IMAGE\s+(https?:\/\/\S+)\]$/i,
    );
    if (imageInlineMatch?.[1]) {
      const url = normalizeOgImageUrl(imageInlineMatch[1]);
      if (url) return url;
    }
  }

  return "";
}

/**
 * OGP画像の作者ブランド優先順位:
 * 1. homepage_header_logo_url
 * 2. avatar_url
 * 3. cover_image_url
 */
function pickAuthorBrandImage(
  brandImages?: AuthorBrandImages | null,
): string {
  if (!brandImages) return "";

  const candidates = [
    brandImages.homepage_header_logo_url,
    brandImages.avatar_url,
    brandImages.cover_image_url,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    const url = normalizeOgImageUrl(candidate);
    if (url) return url;
  }

  return "";
}

function extractBodyPreview(content: string): string {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("["))
    .filter((line) => !/^[a-zA-Z][a-zA-Z0-9_]*\s*:/.test(line));

  return normalizeText(lines.join(" "));
}

function pickTitle(
  content: string,
  fallbackTitle?: string | null,
): string {
  const extractedTitle = normalizeText(extractBookTitle(content));
  const rowTitle = normalizeText(fallbackTitle ?? "");
  const title = extractedTitle || rowTitle;

  if (!title) return SITE_NAME;
  return `${title} | ${SITE_NAME}`;
}

function pickDescription(content: string): string {
  const subtitle = normalizeText(extractSubtitle(content));
  if (subtitle) {
    return subtitle.slice(0, 110);
  }

  const body = extractBodyPreview(content);
  if (body) {
    return body.slice(0, 110);
  }

  return DEFAULT_DESCRIPTION;
}

export function buildDefaultPublicMetadata(url: string): Metadata {
  return {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    openGraph: {
      title: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      url,
      siteName: SITE_NAME,
      type: "article",
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export function buildPublicWorkMetadata({
  content,
  url,
  fallbackTitle,
  brandImages,
}: BuildPublicWorkMetadataInput): Metadata {
  const title = pickTitle(content, fallbackTitle);
  const description = pickDescription(content);
  const image =
    extractWorkImage(content) ||
    pickAuthorBrandImage(brandImages) ||
    DEFAULT_OG_IMAGE;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "article",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
