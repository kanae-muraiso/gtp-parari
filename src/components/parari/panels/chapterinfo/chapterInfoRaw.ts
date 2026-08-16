// src/components/parari/panels/chapterinfo/chapterInfoRaw.ts
// PART: CHAPTERINFO raw normalization

export function normalizeChapterInfoRaw(value: string): string {
  const raw = String(value ?? "").replace(/\r\n/g, "\n").trim();

  if (!raw) {
    return [
      "[CHAPTER] 新しい章",
      "number:",
      "title: 新しい章",
      "subtitle:",
      "mainImage:",
      "showInToc: true",
    ].join("\n");
  }

  const lines = raw.split("\n");
  let markerIndex = lines.findIndex((line) =>
    /^\s*\[CHAPTER(?::[^\]]+)?\]/i.test(line.trim()),
  );

  if (markerIndex < 0) {
    lines.unshift("[CHAPTER]");
    markerIndex = 0;
  }

  const markerLine = lines[markerIndex] ?? "[CHAPTER]";
  const markerTitle =
    markerLine.match(/^\s*\[CHAPTER(?::[^\]]+)?\]\s*(.*)$/i)?.[1] ?? "";
  const titleLineIndex = lines.findIndex((line) =>
    /^\s*title\s*:/i.test(line.trim()),
  );
  const titleFromMeta =
    titleLineIndex >= 0
      ? lines[titleLineIndex].replace(/^\s*title\s*:\s*/i, "")
      : "";
  const title = titleFromMeta.trim() || markerTitle.trim() || "新しい章";

  lines[markerIndex] = `[CHAPTER] ${title}`;

  if (titleLineIndex >= 0) {
    lines[titleLineIndex] = `title: ${title}`;
  } else {
    lines.splice(markerIndex + 1, 0, `title: ${title}`);
  }

  return lines.join("\n").trim();
}

export function normalizeLegacyChapterInfoRaw(value: string): string {
  const raw = String(value ?? "").replace(/\r\n/g, "\n").trim();
  const lines = raw.split("\n");
  const firstLine = lines[0] ?? "";
  const match = firstLine.match(/^\s*\[CHAPTER(?::([^\]\s]+))?\]\s*(.*)$/i);

  if (!match) {
    return raw;
  }

  const inlineTitle = match[2]?.trim() ?? "";

  if (!inlineTitle) {
    return raw;
  }

  const restLines = lines.slice(1);
  const alreadyHasTitle = restLines.some((line) =>
    /^title\s*:/i.test(line.trim()),
  );

  if (alreadyHasTitle) {
    return raw;
  }

  return ["[CHAPTER]", `title: ${inlineTitle}`, ...restLines].join("\n");
}
