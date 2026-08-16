// apps/tools/parari/src/lib/parari/extractWorkListMeta.ts
// SSOTから作品一覧用メタ情報を抽出する

export type ParariWorkListMeta = {
  title: string;
  bookTitle: string;
  pageTitle: string;
  mainImage: string;
  coverImage: string;
};

export function extractWorkListMetaFromSsot(ssot: string): ParariWorkListMeta {
  const text = String(ssot ?? "").replace(/\r\n/g, "\n");

  const bookBlock = extractFirstInfoBlock(text, "BOOK");
  const pageBlock = extractFirstInfoBlock(text, "PAGE");

  const bookMarkerTitle = extractMarkerTitle(bookBlock.header);
  const pageMarkerTitle = extractMarkerTitle(pageBlock.header);

  const bookTitle =
    getColonMeta(bookBlock.body, ["title", "name"]) ||
    bookMarkerTitle ||
    "";

  const pageTitle =
    getColonMeta(pageBlock.body, ["title", "name"]) ||
    pageMarkerTitle ||
    "";

  const coverImage =
    getColonMeta(bookBlock.body, ["coverImage", "cover_image"]) || "";

  const mainImage =
    getColonMeta(pageBlock.body, ["mainImage", "main_image"]) || "";

  const title =
    bookTitle ||
    pageTitle ||
    firstMeaningfulTextLine(text) ||
    "無題";

  return {
    title,
    bookTitle,
    pageTitle,
    mainImage,
    coverImage,
  };
}

function extractFirstInfoBlock(
  ssot: string,
  tag: "BOOK" | "PAGE",
): {
  header: string;
  body: string;
} {
  const pattern = new RegExp(
    `^\\\\s*\\\\[(${tag}|${tag}INFO)(?::[^\\\\]]+)?\\\\].*$`,
    "im",
  );

  const match = pattern.exec(ssot);

  if (!match || match.index < 0) {
    return {
      header: "",
      body: "",
    };
  }

  const start = match.index;
  const afterHeaderIndex = start + match[0].length;
  const rest = ssot.slice(afterHeaderIndex);

  const nextTagMatch = /^\s*\[[A-Za-z][A-Za-z0-9_]*(?::[^\]]+)?\].*$/m.exec(rest);
  const body =
    nextTagMatch && typeof nextTagMatch.index === "number"
      ? rest.slice(0, nextTagMatch.index)
      : rest;

  return {
    header: match[0],
    body,
  };
}

function extractMarkerTitle(header: string): string {
  const match = header.match(/^\s*\[[^\]]+\]\s*(.*)$/);

  return match?.[1]?.trim() ?? "";
}

function getColonMeta(body: string, keys: string[]): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");

  for (const key of keys) {
    const escapedKey = escapeRegExp(key);
    const pattern = new RegExp(`^\\\\s*${escapedKey}\\\\s*:\\\\s*(.*)$`, "i");

    for (const line of lines) {
      const match = line.match(pattern);

      if (match) {
        return String(match[1] ?? "").trim();
      }
    }
  }

  return "";
}

function firstMeaningfulTextLine(ssot: string): string {
  const lines = ssot.replace(/\r\n/g, "\n").split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    if (/^\[[A-Za-z][A-Za-z0-9_]*(?::[^\]]+)?\]/.test(trimmed)) {
      continue;
    }

    if (/^[A-Za-z][A-Za-z0-9_]*\s*:/.test(trimmed)) {
      continue;
    }

    return trimmed.replace(/^#+\s*/, "").slice(0, 80);
  }

  return "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
