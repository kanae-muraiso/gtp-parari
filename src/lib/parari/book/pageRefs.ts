export type BookPageRef = {
  id: string;
};

export type BookChapterRef = {
  id: string;
  title: string;
};

export type BookOutlineEntry =
  | { kind: "page"; id: string }
  | { kind: "chapter"; id: string; title: string };

const PAGE_REF_RE =
  /^\s*\[PAGE_REF\s+id=([^\]\s]+)\]\s*$/i;

const CHAPTER_REF_RE =
  /^\s*\[BOOK_CHAPTER\s+id=([^\]\s]+)\]\s*(.*)$/i;

export function parseBookPageRefs(ssot: string): BookPageRef[] {
  return parseBookOutline(ssot)
    .filter((entry): entry is Extract<BookOutlineEntry, { kind: "page" }> =>
      entry.kind === "page",
    )
    .map((entry) => ({ id: entry.id }));
}

export function parseBookOutline(ssot: string): BookOutlineEntry[] {
  const entries: BookOutlineEntry[] = [];

  for (const line of String(ssot ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const pageMatch = line.match(PAGE_REF_RE);

    if (pageMatch) {
      const id = String(pageMatch[1] ?? "").trim();
      if (id) {
        entries.push({ kind: "page", id });
      }
      continue;
    }

    const chapterMatch = line.match(CHAPTER_REF_RE);

    if (chapterMatch) {
      const id = String(chapterMatch[1] ?? "").trim();
      const title = String(chapterMatch[2] ?? "").trim() || "新しい章";

      if (id) {
        entries.push({
          kind: "chapter",
          id,
          title,
        });
      }
    }
  }

  return entries;
}

export function hasBookPageRefs(ssot: string): boolean {
  return parseBookPageRefs(ssot).length > 0;
}

export function hasEmbeddedBookPages(ssot: string): boolean {
  return String(ssot ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .some((line) =>
      /^\s*\[(PAGE|PAGEINFO)(?::[^\]]+)?\](?:\s|$)/i.test(line),
    );
}

export function isBookSsot(ssot: string): boolean {
  return /^\s*\[(BOOK|BOOKINFO)\b/i.test(String(ssot ?? ""));
}

export function isReferenceBookSsot(ssot: string): boolean {
  return isBookSsot(ssot) && !hasEmbeddedBookPages(ssot);
}

export function replaceBookPageRefs(
  ssot: string,
  pageIds: string[],
): string {
  const existingChapters = parseBookOutline(ssot).filter(
    (entry): entry is Extract<BookOutlineEntry, { kind: "chapter" }> =>
      entry.kind === "chapter",
  );

  return replaceBookOutline(ssot, [
    ...existingChapters,
    ...pageIds
      .map((id) => String(id ?? "").trim())
      .filter(Boolean)
      .map((id) => ({ kind: "page" as const, id })),
  ]);
}

export function replaceBookOutline(
  ssot: string,
  outline: BookOutlineEntry[],
): string {
  const normalized = String(ssot ?? "").replace(/\r\n/g, "\n");
  const lines = normalized
    .split("\n")
    .filter(
      (line) =>
        !PAGE_REF_RE.test(line) &&
        !CHAPTER_REF_RE.test(line),
    );

  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  const outlineLines = outline.flatMap((entry) => {
    if (entry.kind === "page") {
      const id = String(entry.id ?? "").trim();
      return id ? [`[PAGE_REF id=${id}]`] : [];
    }

    const id = String(entry.id ?? "").trim();
    const title = String(entry.title ?? "")
      .replace(/\r?\n/g, " ")
      .trim() || "新しい章";

    return id ? [`[BOOK_CHAPTER id=${id}] ${title}`] : [];
  });

  return outlineLines.length > 0
    ? [...lines, "", ...outlineLines, ""].join("\n")
    : [...lines, ""].join("\n");
}

export function resolveBookPageRefs(
  ssot: string,
  pageContentById: Map<string, string>,
): string {
  const normalized = String(ssot ?? "").replace(/\r\n/g, "\n");
  const output: string[] = [];

  for (const line of normalized.split("\n")) {
    const chapterMatch = line.match(CHAPTER_REF_RE);

    if (chapterMatch) {
      const id = String(chapterMatch[1] ?? "").trim();
      const title = String(chapterMatch[2] ?? "").trim() || "新しい章";

      output.push("");
      output.push("[CHAPTER]");
      output.push(`id: ${id}`);
      output.push(`title: ${title}`);
      output.push("showInToc: true");
      output.push("");
      continue;
    }

    const match = line.match(PAGE_REF_RE);

    if (!match) {
      output.push(line);
      continue;
    }

    const id = String(match[1] ?? "").trim();
    const pageContent = pageContentById.get(id);

    if (!pageContent) {
      continue;
    }

    output.push("");
    output.push(pageContent.trim());
    output.push("");
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export function updateBookTitle(
  ssot: string,
  title: string,
): string {
  const safeTitle = String(title ?? "").replace(/\r?\n/g, " ").trim();
  const source = String(ssot ?? "");
  const titleLine = /^title:\s*.*$/im;

  if (titleLine.test(source)) {
    return source.replace(titleLine, `title: ${safeTitle}`);
  }

  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const bookIndex = lines.findIndex((line) =>
    /^\s*\[(BOOK|BOOKINFO)\b/i.test(line),
  );

  if (bookIndex >= 0) {
    lines.splice(bookIndex + 1, 0, `title: ${safeTitle}`);
    return lines.join("\n");
  }

  return source;
}
