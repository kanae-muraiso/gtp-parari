export type BookPageRef = {
  id: string;
};

const PAGE_REF_RE =
  /^\s*\[PAGE_REF\s+id=([^\]\s]+)\]\s*$/i;

export function parseBookPageRefs(ssot: string): BookPageRef[] {
  return String(ssot ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.match(PAGE_REF_RE))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ id: String(match[1] ?? "").trim() }))
    .filter((ref) => ref.id.length > 0);
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
  const normalized = String(ssot ?? "").replace(/\r\n/g, "\n");
  const lines = normalized
    .split("\n")
    .filter((line) => !PAGE_REF_RE.test(line));

  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  const refs = pageIds
    .map((id) => String(id ?? "").trim())
    .filter(Boolean)
    .map((id) => `[PAGE_REF id=${id}]`);

  return refs.length > 0
    ? [...lines, "", ...refs, ""].join("\n")
    : [...lines, ""].join("\n");
}

export function resolveBookPageRefs(
  ssot: string,
  pageContentById: Map<string, string>,
): string {
  const normalized = String(ssot ?? "").replace(/\r\n/g, "\n");
  const output: string[] = [];

  for (const line of normalized.split("\n")) {
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
