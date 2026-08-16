// apps/tools/parari/src/lib/parari/parariPatcher.ts
// apps/tools/parari/src/lib/parari/parariPatcher.ts
// 2026/06/10 16:41 JST

/**
 * PART: Types
 * コメント:
 * - patcher専用の最小型定義
 * - UI / DB / React には依存しない
 */

/**
 * PART: BookFieldKey
 * コメント:
 * - BOOKメタ情報として扱えるキー一覧
 * - titlePage は「タイトルPAGEを自動表示するかどうか」を管理する
 * - 表紙 cover / 目次 toc と同じ前付け系の設定
 */
export type BookFieldKey =
  | "subtitle"
  | "url"
  | "time"
  | "place"
  | "topics"
  | "displayMode"
  | "renderMode"
  | "physicalPagination"
  | "expiresAt"
  | "mode"
  | "cover"
  | "titlePage"
  | "toc"
  | "coverImage"
  | "coverImageWidth"
  | "memo"
  | "modulesEnabled"
  | "coverTitle";

export type MediaKind = "IMAGE" | "YOUTUBE" | "INSTAGRAM" | "VIMEO";

export type PageInfo = {
  index: number;
  start: number;
  end: number;
  raw: string;
  headerLine: string;
  chapterTitle: string;
};

type BookSectionSplit = {
  bookSection: string;
  pagesSection: string;
};

type PageBodyParts = {
  bodyText: string;
  bodyStart: number | null;
  bodyEnd: number | null;
};

/**
 * PART: Constants
 * コメント:
 * - BOOK固定スロット順
 * - patchBookInfo はこの順で不足行を挿入する
 */

/**
 * PART: BOOK_FIELD_ORDER
 * コメント:
 * - BOOK固定スロット順
 * - 前付け系は cover → coverTitle → titlePage → toc の順で並べる
 * - titlePage は2PAGE以上の作品で使うタイトルPAGE表示フラグ
 */
const BOOK_FIELD_ORDER: BookFieldKey[] = [
  "subtitle",
  "url",
  "time",
  "place",
  "topics",
  "displayMode",
  "renderMode",
  "physicalPagination",
  "expiresAt",
  "mode",
  "cover",
  "coverTitle",
  "titlePage",
  "toc",
  "modulesEnabled",
  "coverImage",
  "memo",
];

/**
 * PART: Public API - splitBookSection
 * コメント:
 * - [BOOK] 〜 最初の [PAGE] 直前までを BOOK領域として返す
 * - PAGEが無い場合は全文をBOOK領域として返す
 */

export function splitBookSection(ssot: string): BookSectionSplit {
  const normalized = ensureString(ssot);
  const firstPageMatch = normalized.match(/^\[PAGE\].*$/m);

  if (!firstPageMatch || firstPageMatch.index == null) {
    return {
      bookSection: normalized,
      pagesSection: "",
    };
  }

  const splitAt = firstPageMatch.index;

  return {
    bookSection: normalized.slice(0, splitAt),
    pagesSection: normalized.slice(splitAt),
  };
}

/**
 * PART: Public API - splitPages
 * コメント:
 * - PAGEブロックを独立単位として分割
 * - start/end はSSOT全文に対する絶対位置
 */

export function splitPages(ssot: string): PageInfo[] {
  const text = ensureString(ssot);
  const pageStartRegex = /^\[PAGE\].*$/gm;
  const starts: { index: number; headerLine: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = pageStartRegex.exec(text)) !== null) {
    starts.push({
      index: match.index,
      headerLine: match[0],
    });
  }

  return starts.map((item, idx) => {
    const start = item.index;
    const end = idx + 1 < starts.length ? starts[idx + 1].index : text.length;
    const raw = text.slice(start, end);
    const chapterTitle = item.headerLine.replace(/^\[PAGE\]\s*/, "").trim();

    return {
      index: idx,
      start,
      end,
      raw,
      headerLine: item.headerLine,
      chapterTitle,
    };
  });
}

/**
 * PART: Public API - extractPage
 * コメント:
 * - 指定indexのPAGE生文字列を返す
 * - 無ければ空文字
 */

export function extractPage(ssot: string, pageIndex: number): string {
  const pages = splitPages(ssot);
  const page = pages[pageIndex];
  return page ? page.raw : "";
}

/**
 * PART: Public API - replacePage
 * コメント:
 * - 指定PAGEブロックだけを差し替える
 * - 他領域は一切触らない
 */

export function replacePage(
  ssot: string,
  pageIndex: number,
  nextPageRaw: string,
): string {
  const text = ensureString(ssot);
  const pages = splitPages(text);
  const target = pages[pageIndex];
  if (!target) return text;

  const before = text.slice(0, target.start);
  const after = text.slice(target.end);

  const eol = detectEol(text);

  // コメント:
  // - 次のPAGEが続く場合は、必ず nextPageRaw の末尾に改行を確保する
  // - これをしないと blur 保存時に
  //   「本文末尾[PAGE] 次章」
  //   のようにくっつくことがある
  const afterTrimStart = after.replace(/^\r\n|\r|\n/, "");
  const nextStartsWithPage = /^\[PAGE\]/.test(afterTrimStart);

  let safeNextPageRaw = nextPageRaw;

  if (nextStartsWithPage && !safeNextPageRaw.endsWith(eol)) {
    safeNextPageRaw += eol;
  }

  return before + safeNextPageRaw + after;
}

/**
 * PART: Public API - patchBookTitle
 * コメント:
 * - BOOKタイトルは [BOOK] 行末ではなく title: 行で管理する
 * - [BOOK] は常に単独行へ正規化する
 * - title: 行があれば置換、無ければ BOOK直下へ挿入する
 * - 旧形式 [BOOK] タイトル が来ても新形式へ寄せて返す
 */

export function patchBookTitle(ssot: string, nextTitle: string): string {
  const text = ensureString(ssot);
  const eol = detectEol(text);
  const { bookSection, pagesSection } = splitBookSection(text);
  const lines = splitLinesPreserveEmpty(bookSection);

  if (lines.length === 0) return text;
  if (!/^\[BOOK\](?:\s.*)?$/.test(lines[0])) return text;

  const normalizedTitle = ensureString(nextTitle).trim();
  const titleLineRegex = /^title:\s*(.*)$/;
  const existingTitleIndex = lines.findIndex(
    (line, idx) => idx > 0 && titleLineRegex.test(line),
  );

  // [BOOK] 行は常に単独行へ正規化
  lines[0] = "[BOOK]";

  // title が空なら title: 行を削除して返す
  if (normalizedTitle === "") {
    if (existingTitleIndex >= 0) {
      lines.splice(existingTitleIndex, 1);
    }
    return lines.join(eol) + pagesSection;
  }

  const nextTitleLine = `title: ${normalizedTitle}`;

  if (existingTitleIndex >= 0) {
    lines[existingTitleIndex] = nextTitleLine;
    return lines.join(eol) + pagesSection;
  }

  // title: は BOOK直下の最優先メタとして入れる
  lines.splice(1, 0, nextTitleLine);
  return lines.join(eol) + pagesSection;
}

/**
 * PART: Public API - patchBookInfo
 * コメント:
 * - BOOK固定スロットの1項目だけを更新
 * - 既存行があれば置換
 * - 無ければ固定順に従って最小挿入
 * - value が null / "" の場合は行を削除
 */

export function patchBookInfo(
  ssot: string,
  key: BookFieldKey,
  value: string | null,
): string {
  const text = ensureString(ssot);
  const eol = detectEol(text);
  const { bookSection, pagesSection } = splitBookSection(text);
  const lines = splitLinesPreserveEmpty(bookSection);

  if (lines.length === 0) return text;
  if (!/^\[BOOK\](?:\s.*)?$/.test(lines[0])) return text;

  const fieldRegex = new RegExp(`^${escapeRegExp(key)}:\\s*(.*)$`);
  const existingIndex = lines.findIndex((line, idx) => idx > 0 && fieldRegex.test(line));

  if (value == null || value === "") {
    if (existingIndex >= 0) {
      lines.splice(existingIndex, 1);
      return lines.join(eol) + pagesSection;
    }
    return text;
  }

  const nextLine = `${key}: ${value}`;

  if (existingIndex >= 0) {
    if (lines[existingIndex] === nextLine) return text;
    lines[existingIndex] = nextLine;
    return lines.join(eol) + pagesSection;
  }

  const targetOrderIndex = BOOK_FIELD_ORDER.indexOf(key);
  if (targetOrderIndex < 0) return text;

  for (let i = targetOrderIndex - 1; i >= 0; i -= 1) {
    const prevKey = BOOK_FIELD_ORDER[i];
    const prevIndex = lines.findIndex((line, idx) =>
      idx > 0 ? new RegExp(`^${escapeRegExp(prevKey)}:\\s*`).test(line) : false,
    );
    if (prevIndex >= 0) {
      lines.splice(prevIndex + 1, 0, nextLine);
      return lines.join(eol) + pagesSection;
    }
  }

  for (let i = targetOrderIndex + 1; i < BOOK_FIELD_ORDER.length; i += 1) {
    const nextKey = BOOK_FIELD_ORDER[i];
    const nextIndex = lines.findIndex((line, idx) =>
      idx > 0 ? new RegExp(`^${escapeRegExp(nextKey)}:\\s*`).test(line) : false,
    );
    if (nextIndex >= 0) {
      lines.splice(nextIndex, 0, nextLine);
      return lines.join(eol) + pagesSection;
    }
  }

  lines.splice(1, 0, nextLine);
  return lines.join(eol) + pagesSection;
}

/**
 * PART: Public API - patchPageBody
 * コメント:
 * - 指定PAGEの本文だけを差し替える
 * - ブロック要素行は温存
 * - 本文行が既に存在すればその範囲だけを置換
 * - 本文行が無ければPAGE末尾に追加
 */

export function patchPageBody(
  ssot: string,
  pageIndex: number,
  nextBody: string,
): string {
  const text = ensureString(ssot);
  const pageRaw = extractPage(text, pageIndex);
  if (!pageRaw) return text;

  const eol = detectEol(pageRaw);
  const parts = getPageBodyParts(pageRaw);
  const normalizedBody = normalizeInnerText(nextBody, eol);

  let nextPageRaw: string;

  if (parts.bodyStart != null && parts.bodyEnd != null) {
    nextPageRaw =
      pageRaw.slice(0, parts.bodyStart) +
      normalizedBody +
      pageRaw.slice(parts.bodyEnd);
  } else {
    const suffix = pageRaw.endsWith(eol) || pageRaw.length === 0 ? "" : eol;
    nextPageRaw = pageRaw + suffix + normalizedBody;
  }

  return replacePage(text, pageIndex, nextPageRaw);
}

/**
 * PART: Public API - patchPageImage
 * コメント:
 * - [IMAGE] / [YOUTUBE] / [INSTAGRAM] / [VIMEO] の1行だけを更新
 * - 同種の行があれば置換
 * - 無ければPAGE先頭側のブロック群の末尾へ挿入
 * - url が null / "" の場合はその行を削除
 */

export function patchPageImage(
  ssot: string,
  pageIndex: number,
  kind: MediaKind,
  url: string | null,
): string {
  const text = ensureString(ssot);
  const pageRaw = extractPage(text, pageIndex);
  if (!pageRaw) return text;

  const eol = detectEol(pageRaw);
  const lines = splitLinesPreserveEmpty(pageRaw);
  if (lines.length === 0) return text;

  const targetRegex = new RegExp(`^\\[${escapeRegExp(kind)}\\]\\s+.*$`);
  const targetIndex = lines.findIndex((line, idx) => idx > 0 && targetRegex.test(line));

  if (url == null || url === "") {
    if (targetIndex >= 0) {
      lines.splice(targetIndex, 1);
      return replacePage(text, pageIndex, lines.join(eol));
    }
    return text;
  }

  const nextLine = `[${kind}] ${url}`;

  if (targetIndex >= 0) {
    if (lines[targetIndex] === nextLine) return text;
    lines[targetIndex] = nextLine;
    return replacePage(text, pageIndex, lines.join(eol));
  }

  const insertAt = findBlockInsertIndex(lines);
  lines.splice(insertAt, 0, nextLine);
  return replacePage(text, pageIndex, lines.join(eol));
}

/**
 * PART: Public API - patchPageApplication
 * コメント:
 * - module 1行完結ルール用
 * - 例: [application id="99"]
 * - attrs が null のときは対象module行を削除
 * - attrs がある場合は既存module行を更新、無ければ挿入
 */

export function patchPageApplication(
  ssot: string,
  pageIndex: number,
  moduleName: string,
  attrs: Record<string, string> | null,
): string {
  const text = ensureString(ssot);
  const pageRaw = extractPage(text, pageIndex);
  if (!pageRaw) return text;

  const eol = detectEol(pageRaw);
  const lines = splitLinesPreserveEmpty(pageRaw);
  if (lines.length === 0) return text;

  const moduleRegex = new RegExp(`^\\[${escapeRegExp(moduleName)}(?:\\s+[^\\]]+)?\\]$`);
  const targetIndex = lines.findIndex((line, idx) => idx > 0 && moduleRegex.test(line));

  if (attrs == null) {
    if (targetIndex >= 0) {
      lines.splice(targetIndex, 1);
      return replacePage(text, pageIndex, lines.join(eol));
    }
    return text;
  }

  const nextLine = buildModuleLine(moduleName, attrs);

  if (targetIndex >= 0) {
    if (lines[targetIndex] === nextLine) return text;
    lines[targetIndex] = nextLine;
    return replacePage(text, pageIndex, lines.join(eol));
  }

  const insertAt = findBlockInsertIndex(lines);
  lines.splice(insertAt, 0, nextLine);
  return replacePage(text, pageIndex, lines.join(eol));
}

/**
 * PART: Public API - patchPageChapterTitle
 * コメント:
 * - [PAGE] ヘッダ行だけを更新
 * - タイトル空文字なら [PAGE] 単独行にする
 */

export function patchPageChapterTitle(
  ssot: string,
  pageIndex: number,
  chapterTitle: string,
): string {
  const text = ensureString(ssot);
  const pageRaw = extractPage(text, pageIndex);
  if (!pageRaw) return text;

  const eol = detectEol(pageRaw);
  const lines = splitLinesPreserveEmpty(pageRaw);
  if (lines.length === 0) return text;

  const trimmed = chapterTitle.trim();
  const nextHeader = trimmed ? `[PAGE] ${trimmed}` : `[PAGE]`;

  if (lines[0] === nextHeader) return text;

  lines[0] = nextHeader;
  return replacePage(text, pageIndex, lines.join(eol));
}

/**
 * PART: Public API - insertInlineLink
 * コメント:
 * - 本文内だけにインラインリンクを挿入
 * - bodyOffset は「現在の本文文字列」に対する挿入位置
 * - 本文が無い場合は本文として新規作成
 */

export function insertInlineLink(
  ssot: string,
  pageIndex: number,
  bodyOffset: number,
  type: string,
  data: string,
  label: string,
): string {
  const text = ensureString(ssot);
  const pageRaw = extractPage(text, pageIndex);
  if (!pageRaw) return text;

  const parts = getPageBodyParts(pageRaw);
  const token = `⟦${type}:${data}|${label}⟧`;

  if (parts.bodyStart == null || parts.bodyEnd == null) {
    return patchPageBody(text, pageIndex, token);
  }

  const currentBody = parts.bodyText;
  const safeOffset = clamp(bodyOffset, 0, currentBody.length);
  const nextBody =
    currentBody.slice(0, safeOffset) + token + currentBody.slice(safeOffset);

  return patchPageBody(text, pageIndex, nextBody);
}

/**
 * PART: Public API - insertPage
 * コメント:
 * - 指定位置に PAGE raw string をそのまま挿入する
 * - BOOK領域は一切触らない
 * - PAGEがまだ1つも無い場合は、BOOK末尾に追加する
 * - insertIndex は 0 〜 pages.length に clamp する
 */

export function insertPage(
  ssot: string,
  insertIndex: number,
  pageRaw: string,
): string {
  const text = ensureString(ssot);
  const normalizedPageRaw = normalizeInsertedPageRaw(pageRaw, detectEol(text));

  if (!normalizedPageRaw) return text;
  if (!normalizedPageRaw.startsWith("[PAGE]")) return text;

  const pages = splitPages(text);

  if (pages.length === 0) {
    return appendFirstPageToBook(text, normalizedPageRaw);
  }

  const safeIndex = clamp(insertIndex, 0, pages.length);

  if (safeIndex === pages.length) {
    return insertPageAtEnd(text, normalizedPageRaw);
  }

  const target = pages[safeIndex];
  return text.slice(0, target.start) + normalizedPageRaw + text.slice(target.start);
}

/**
 * PART: Public API - deletePage
 * コメント:
 * - 指定PAGEを1つ削除する
 * - 他のPAGE内容は触らない
 * - index不正時は元文字列を返す
 */

export function deletePage(ssot: string, pageIndex: number): string {
  const text = ensureString(ssot);
  const pages = splitPages(text);
  const target = pages[pageIndex];
  if (!target) return text;

  return removeSliceAndTidyBoundary(text, target.start, target.end);
}

/**
 * PART: Public API - movePage
 * コメント:
 * - 指定PAGEを別位置へ移動する
 * - PAGE raw string をそのまま移動する
 * - 内容は一切変更しない
 * - fromIndex / toIndex が同じなら元文字列を返す
 */

export function movePage(
  ssot: string,
  fromIndex: number,
  toIndex: number,
): string {
  const text = ensureString(ssot);
  const pages = splitPages(text);

  if (!pages[fromIndex]) return text;
  if (fromIndex === toIndex) return text;

  const safeToIndex = clamp(toIndex, 0, pages.length - 1);
  if (fromIndex === safeToIndex) return text;

  const movingPageRaw = pages[fromIndex].raw;
  const withoutPage = deletePage(text, fromIndex);

  const adjustedPagesLength = pages.length - 1;
  const adjustedInsertIndex = clamp(safeToIndex, 0, adjustedPagesLength);

  return insertPage(withoutPage, adjustedInsertIndex, movingPageRaw);
}

/**
 * PART: Public API - copyPage
 * コメント:
 * - 指定PAGEを複製し、指定位置へ挿入する
 * - 元PAGEはそのまま残る
 * - 複製内容は raw string をそのまま使う
 */

export function copyPage(
  ssot: string,
  sourceIndex: number,
  insertIndex: number,
): string {
  const text = ensureString(ssot);
  const sourcePageRaw = extractPage(text, sourceIndex);
  if (!sourcePageRaw) return text;

  return insertPage(text, insertIndex, sourcePageRaw);
}

/**
 * PART: Public API - copyPageToBook
 * コメント:
 * - sourceSSOT から PAGE を取り出し、targetSSOT に挿入する
 * - source は一切変更しない
 * - target だけを返す
 */

export function copyPageToBook(
  sourceSsot: string,
  sourcePageIndex: number,
  targetSsot: string,
  targetInsertIndex: number,
): string {
  const sourcePageRaw = extractPage(sourceSsot, sourcePageIndex);
  if (!sourcePageRaw) return ensureString(targetSsot);

  return insertPage(targetSsot, targetInsertIndex, sourcePageRaw);
}

/**
 * PART: Public API - createEmptyPage
 * コメント:
 * - 新規PAGEの標準テンプレート
 * - 本文は空にして、エディタ側のplaceholderで案内する
 */
export function createEmptyPage(chapterTitle = ""): string {
  const trimmed = chapterTitle.trim();
  const header = trimmed ? `[PAGE] ${trimmed}` : `[PAGE]`;

  return `${header}\n`;
}

/**
 * PART: Public API - insertEmptyPage
 * コメント:
 * - createEmptyPage + insertPage の薄い合成関数
 */

export function insertEmptyPage(
  ssot: string,
  insertIndex: number,
  chapterTitle = "",
): string {
  const pageRaw = createEmptyPage(chapterTitle);
  return insertPage(ssot, insertIndex, pageRaw);
}

/**
 * PART: Helper - getPageBodyParts
 * コメント:
 * - PAGEブロックから本文領域だけを抽出
 * - 「非ブロック行」の最初から最後までを本文範囲とみなす
 */

function getPageBodyParts(pageRaw: string): PageBodyParts {
  const eol = detectEol(pageRaw);
  const lines = splitLinesWithOffsets(pageRaw, eol);

  if (lines.length <= 1) {
    return {
      bodyText: "",
      bodyStart: null,
      bodyEnd: null,
    };
  }

  const bodyLineIndexes = lines
    .map((item, idx) => ({ idx, line: item.line }))
    .filter(({ idx, line }) => idx > 0 && !isBlockLine(line))
    .map(({ idx }) => idx);

  if (bodyLineIndexes.length === 0) {
    return {
      bodyText: "",
      bodyStart: null,
      bodyEnd: null,
    };
  }

  const firstBodyLineIndex = bodyLineIndexes[0];
  const lastBodyLineIndex = bodyLineIndexes[bodyLineIndexes.length - 1];

  const bodyText = bodyLineIndexes
    .map((idx) => lines[idx].line)
    .join(eol);

  // コメント:
  // - bodyEnd は「最後の本文行の文字列終端」ではなく、
  //   可能なら「次の行の開始位置」まで含める
  // - これにより、本文末尾の改行が置換範囲に入り、
  //   次の [PAGE] が本文末尾にくっつく事故を防ぐ
  const nextLine = lines[lastBodyLineIndex + 1] ?? null;
  const bodyEnd = nextLine ? nextLine.start : lines[lastBodyLineIndex].end;

  return {
    bodyText,
    bodyStart: lines[firstBodyLineIndex].start,
    bodyEnd,
  };
}

/**
 * PART: Helper - findBlockInsertIndex
 * コメント:
 * - [PAGE] の次から連続するブロック要素群の末尾を返す
 */

function findBlockInsertIndex(lines: string[]): number {
  let i = 1;
  while (i < lines.length && isBlockLine(lines[i])) {
    i += 1;
  }
  return i;
}

/**
 * PART: Helper - isBlockLine
 * コメント:
 * - 1行完結ブロックのみ true
 * - [BOOK] / [PAGE] はブロック扱いしない
 */

function isBlockLine(line: string): boolean {
  if (/^\[(IMAGE|YOUTUBE|INSTAGRAM|VIMEO)\]\s+\S+.*$/.test(line)) {
    return true;
  }

  if (/^\[(BOOK|PAGE)\](?:\s.*)?$/.test(line)) {
    return false;
  }

  if (/^\[[a-z][a-z0-9-]*(?:\s+[^\]]+)?\]$/i.test(line)) {
    return true;
  }

  return false;
}

/**
 * PART: Helper - buildModuleLine
 * コメント:
 * - attrs順は入力順を採用
 */

function buildModuleLine(
  moduleName: string,
  attrs: Record<string, string>,
): string {
  const attrText = Object.entries(attrs)
    .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
    .join(" ");

  return attrText ? `[${moduleName} ${attrText}]` : `[${moduleName}]`;
}

/**
 * PART: Helper - normalizeInsertedPageRaw
 * コメント:
 * - 挿入PAGEの改行コードをSSOT側に合わせる
 * - 前後の余分な空白だけ軽く整える
 * - 末尾に1つだけ改行を補う
 */

function normalizeInsertedPageRaw(pageRaw: string, eol: string): string {
  const normalized = normalizeInnerText(ensureString(pageRaw).trim(), eol);
  if (!normalized) return "";
  return normalized.endsWith(eol) ? normalized : normalized + eol;
}

/**
 * PART: Helper - appendFirstPageToBook
 * コメント:
 * - PAGEがまだ存在しないSSOTに最初のPAGEを追加する
 */

function appendFirstPageToBook(ssot: string, pageRaw: string): string {
  const text = ensureString(ssot);
  const eol = detectEol(text);

  if (text.length === 0) {
    return pageRaw;
  }

  const separator = text.endsWith(eol + eol)
    ? ""
    : text.endsWith(eol)
      ? eol
      : eol + eol;

  return text + separator + pageRaw;
}

/**
 * PART: Helper - insertPageAtEnd
 * コメント:
 * - 末尾PAGEとして追加する
 */

function insertPageAtEnd(ssot: string, pageRaw: string): string {
  const text = ensureString(ssot);
  const eol = detectEol(text);

  if (text.endsWith(eol)) {
    return text + pageRaw;
  }

  return text + eol + pageRaw;
}

/**
 * PART: Helper - removeSliceAndTidyBoundary
 * コメント:
 * - 指定範囲を削除し、境界の改行だけ最小限整える
 */

function removeSliceAndTidyBoundary(
  text: string,
  start: number,
  end: number,
): string {
  const eol = detectEol(text);
  const before = text.slice(0, start);
  const after = text.slice(end);
  const joined = before + after;

  const triple = eol + eol + eol;
  return joined.replace(new RegExp(escapeRegExp(triple), "g"), eol + eol);
}

/**
 * PART: Helper - splitLinesWithOffsets
 * コメント:
 * - 行内容と生文字列上の位置を返す
 */

function splitLinesWithOffsets(
  text: string,
  eol: string,
): Array<{ line: string; start: number; end: number }> {
  const result: Array<{ line: string; start: number; end: number }> = [];
  let cursor = 0;

  if (text.length === 0) return result;

  const rawLines = text.split(eol);

  for (let i = 0; i < rawLines.length; i += 1) {
    const line = rawLines[i];
    const start = cursor;
    const end = cursor + line.length;
    result.push({ line, start, end });
    cursor = end + (i < rawLines.length - 1 ? eol.length : 0);
  }

  return result;
}

/**
 * PART: Helper - splitLinesPreserveEmpty
 * コメント:
 * - trailing empty lineも保持したいので単純splitを採用
 */

function splitLinesPreserveEmpty(text: string): string[] {
  const eol = detectEol(text);
  return text.split(eol);
}

/**
 * PART: Helper - normalizeInnerText
 * コメント:
 * - 本文用の改行だけ現在EOLにそろえる
 */

function normalizeInnerText(text: string, eol: string): string {
  return ensureString(text).replace(/\r\n|\r|\n/g, eol);
}

/**
 * PART: Helper - detectEol
 * コメント:
 * - 既存SSOTの改行コードを維持
 */

function detectEol(text: string): string {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

/**
 * PART: Helper - ensureString
 * コメント:
 * - 念のため文字列化
 */

function ensureString(value: string): string {
  return typeof value === "string" ? value : String(value ?? "");
}

/**
 * PART: Helper - escapeRegExp
 * コメント:
 * - 正規表現安全化
 */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * PART: Helper - escapeAttr
 * コメント:
 * - module属性値の最小エスケープ
 */

function escapeAttr(value: string): string {
  return ensureString(value).replace(/"/g, '\\"');
}

/**
 * PART: Helper - clamp
 * コメント:
 * - offset安全化
 */

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
