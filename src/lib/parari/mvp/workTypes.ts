// src/lib/parari/mvp/workTypes.ts
// 2026-06-23 JST
// PARARI MVP: 作品リスト用の型と旧BOOK / 新PAGE判定

export type ParariWorkFormat =
  | "page_v1"
  | "book_legacy"
  | "web_v1"
  | "unknown";

export type ParariWorkVisibility = "private" | "unlisted" | "public";

export type ParariWorkListItem = {
  id: string;
  owner: string;

  title: string;
  visibility: ParariWorkVisibility;
  isPublic: boolean;

  stableSlug: string;
  slug: string | null;
  customSlug: string | null;

  format: ParariWorkFormat;
  entryMode: string | null;

  showInProfileWorks: boolean;

  createdAt: string;
  updatedAt: string;

  contentHead: string;
};

export type RawParariBookRow = {
  id: string;
  owner: string;
  title: string | null;
  content: string | null;
  visibility: string | null;
  is_public: boolean | null;
  stable_slug: string | null;
  slug: string | null;
  custom_slug: string | null;
  entry_mode: string | null;
  show_in_profile_works: boolean | null;
  created_at: string;
  updated_at: string;
};

export function toParariWorkListItem(row: RawParariBookRow): ParariWorkListItem {
  const content = row.content ?? "";

  return {
    id: row.id,
    owner: row.owner,

    title: normalizeWorkListTitle(content, row.title),
    visibility: normalizeVisibility(row.visibility, row.is_public),
    isPublic: row.is_public === true,

    stableSlug: row.stable_slug ?? "",
    slug: row.slug,
    customSlug: row.custom_slug,

    format: detectWorkFormat(content),
    entryMode: row.entry_mode,

    showInProfileWorks: row.show_in_profile_works === true,

    createdAt: row.created_at,
    updatedAt: row.updated_at,

    contentHead: content.slice(0, 240),
  };
}

export function detectWorkFormat(content: string): ParariWorkFormat {
  const normalized = content.trimStart();

  if (normalized.startsWith("[PAGE]")) {
    return "page_v1";
  }

  if (
    normalized.startsWith("[WEB]") ||
    normalized.startsWith("[WEBINFO]")
  ) {
    return "web_v1";
  }

  if (normalized.startsWith("[BOOK]")) {
    return "book_legacy";
  }

  return "unknown";
}

function normalizeWorkListTitle(content: string, dbTitle: string | null): string {
  const ssotTitle = extractTitleFromSsot(content);

  if (ssotTitle) {
    return ssotTitle;
  }

  return normalizeTitle(dbTitle);
}

function extractTitleFromSsot(content: string): string {
  const text = String(content ?? "").replace(/\r\n/g, "\n");

  const bookTitle = extractInfoTitle(text, ["BOOK", "BOOKINFO"]);

  if (bookTitle) {
    return bookTitle;
  }

  const pageTitle = extractInfoTitle(text, ["PAGE", "PAGEINFO"]);

  if (pageTitle) {
    return pageTitle;
  }

  return "";
}

function extractInfoTitle(content: string, tags: string[]): string {
  const lines = content.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const tagPattern = new RegExp(
      `^\\s*\\[(${tags.join("|")})(?::[^\\]]+)?\\]\\s*(.*)$`,
      "i",
    );

    const matched = line.match(tagPattern);

    if (!matched) {
      continue;
    }

    const markerTitle = String(matched[2] ?? "").trim();

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const candidate = lines[cursor] ?? "";
      const trimmed = candidate.trim();

      if (/^\[[A-Za-z][A-Za-z0-9_]*(?::[^\]]+)?\]/.test(trimmed)) {
        break;
      }

      const titleMatched = trimmed.match(/^title\s*:\s*(.*)$/i);

      if (titleMatched) {
        const metaTitle = String(titleMatched[1] ?? "").trim();

        if (metaTitle) {
          return metaTitle;
        }
      }
    }

    if (markerTitle) {
      return markerTitle;
    }
  }

  return "";
}

function normalizeTitle(value: string | null): string {
  const title = value?.trim();

  if (title && title.length > 0) {
    return title;
  }

  return "Untitled";
}

function normalizeVisibility(
  visibility: string | null,
  isPublic: boolean | null,
): ParariWorkVisibility {
  if (visibility === "public") {
    return "public";
  }

  if (visibility === "unlisted") {
    return "unlisted";
  }

  if (visibility === "private") {
    return "private";
  }

  if (isPublic === true) {
    return "public";
  }

  return "private";
}
