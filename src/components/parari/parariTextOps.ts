// apps/tools/parari/src/components/parari/parariTextOps.ts
// 2026-03-02 08:55 JST

/**
 * PART: parariTextOps
 * - テキストへの挿入/置換ロジックを切り出し
 * - UI（ParariEditor）から “文字列ゴリゴリ” を追い出して読みやすくする
 */

function getLineStart(text: string, pos: number) {
  const i = text.lastIndexOf("\n", Math.max(0, pos - 1));
  return i === -1 ? 0 : i + 1;
}

function getCurrentPageStart(text: string, pos: number) {
  const before = text.slice(0, pos);
  const lines = before.split("\n");
  let idx = 0;
  let lastPageStart = -1;
  for (const line of lines) {
    if (line.trimStart().startsWith("[PAGE]")) lastPageStart = idx;
    idx += line.length + 1;
  }
  return lastPageStart;
}

function getPageHeaderEnd(text: string, pageStart: number) {
  const nl = text.indexOf("\n", pageStart);
  return nl === -1 ? text.length : nl + 1;
}

function findAfterImageAndLinks(text: string, pageStart: number) {
  let i = getPageHeaderEnd(text, pageStart);

  // 先頭空行をスキップ
  while (i < text.length) {
    const nl = text.indexOf("\n", i);
    const line = (nl === -1 ? text.slice(i) : text.slice(i, nl)).trim();
    if (line === "") {
      i = nl === -1 ? text.length : nl + 1;
      continue;
    }
    break;
  }

  // [IMAGE] があれば1行だけ消費
  {
    const nl = text.indexOf("\n", i);
    const line = (nl === -1 ? text.slice(i) : text.slice(i, nl)).trim();
    if (line.startsWith("[IMAGE]") || line.startsWith("[YOUTUBE]")) i = nl === -1 ? text.length : nl + 1;
  }

  // [LINK] 群をスキップ
  while (i < text.length) {
    const nl = text.indexOf("\n", i);
    const line = (nl === -1 ? text.slice(i) : text.slice(i, nl)).trim();
    if (line.startsWith("[LINK]")) {
      i = nl === -1 ? text.length : nl + 1;
      continue;
    }
    break;
  }
  return i;
}

function replaceOrInsertImageLine(text: string, pageStart: number, imageUrl: string) {
  const nextPage = text.indexOf("\n[PAGE]", pageStart + 1);
  const end = nextPage === -1 ? text.length : nextPage;
  const segment = text.slice(pageStart, end);
  const lines = segment.split("\n");

  // [PAGE] の次の非空行を見て [IMAGE]/[LINK] を処理
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "") continue;
    if (t.startsWith("[LINK]")) continue;

    if (t.startsWith("[IMAGE]") || t.startsWith("[YOUTUBE]")) {
      lines[i] = `[IMAGE] ${imageUrl}`;
      const newSeg = lines.join("\n");
      return text.slice(0, pageStart) + newSeg + text.slice(end);
    }
    break;
  }

  // 無ければ [PAGE] ヘッダ直後に挿入
  const insertPos = getPageHeaderEnd(text, pageStart);
  return text.slice(0, insertPos) + `[IMAGE] ${imageUrl}\n` + text.slice(insertPos);
}

export function insertPageAtCursor(text: string, cursorPos: number) {
  const lineStart = getLineStart(text, cursorPos);
  // 行頭のみで使う想定だが、安全側で行頭に寄せる
  const pos = lineStart;
  const snippet = "[PAGE] \n";
  return text.slice(0, pos) + snippet + text.slice(pos);
}

export function insertImageAtCursor(text: string, cursorPos: number, url: string) {
  const pageStart = getCurrentPageStart(text, cursorPos);
  if (pageStart === -1) {
    return text.trimEnd() + "\n\n[PAGE] \n[IMAGE] " + url + "\n";
  }
  return replaceOrInsertImageLine(text, pageStart, url);
}

export function insertLinkAtCursor(text: string, cursorPos: number, id: string, url: string) {
  const pageStart = getCurrentPageStart(text, cursorPos);
  const snippet = `[LINK] ${id}, ${url}\n`;

  if (pageStart === -1) {
    return text.trimEnd() + "\n\n[PAGE] \n" + snippet;
  }

  const insertPos = findAfterImageAndLinks(text, pageStart);
  return text.slice(0, insertPos) + snippet + text.slice(insertPos);
}
