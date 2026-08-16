// src/lib/paginateParariPage.ts
// 2026/06/14 13:49 JST

/**
 * PART: paginateParariPage
 * コメント:
 * - Viewer 用の表示モード判定
 * - 1つの意味ページ([PAGE])を複数の表示ページへ変換
 * - 最小実装:
 *   - 画像は先に1ページ使う
 *   - 本文は段落優先で積む
 *   - 入らない段落は 文 → 改行 → 文字 の順で fallback
 */

import type { LegacyParariPage } from "./parariParse";

export type DisplayMode = "scroll" | "page";

export type DisplayPage =
  | {
      kind: "image";
      pageIndex: number;
      imageUrl: string;
      chapterTitle?: string;
    }
  | {
      kind: "text";
      pageIndex: number;
      chapterTitle?: string;
      body: string;
    };

// src/lib/paginateParariPage.ts
// 2026/06/14 13:55 JST
// PART: pagination font size
// コメント:
// - pagination時の測定にも読者文字サイズを反映する
// - PublicParariViewer側の ReaderFontSize と同じ値を使う

// src/lib/paginateParariPage.ts
// 2026/06/14 17:50 JST
// PART: pagination font family type
// コメント:
// - pagination測定時にも標準/文学の書体を反映する
// - PublicParariViewer 側の ReaderFontFamily と同じ値を使う

export type PaginationFontSize = "small" | "medium" | "large";
export type PaginationFontFamily = "standard" | "literary";

type PaginationOptions = {
  fontSize?: PaginationFontSize;
  fontFamily?: PaginationFontFamily;
};

function getPaginationFontMetrics(fontSize: PaginationFontSize = "medium") {
  if (fontSize === "small") {
    return {
      paragraphFontSize: 15,
      paragraphLineHeight: 1.85,
      chapterFontSize: 18,
      chapterLineHeight: 1.6,
    };
  }

  if (fontSize === "large") {
    return {
      paragraphFontSize: 18,
      paragraphLineHeight: 1.95,
      chapterFontSize: 22,
      chapterLineHeight: 1.6,
    };
  }

  return {
    paragraphFontSize: 16.5,
    paragraphLineHeight: 1.9,
    chapterFontSize: 20,
    chapterLineHeight: 1.6,
  };
}

// src/lib/paginateParariPage.ts
// 2026/06/14 13:55 JST
// PART: FitsParams
// コメント:
// - 測定時の文字サイズを受け取る

// src/lib/paginateParariPage.ts
// 2026/06/14 17:50 JST
// PART: FitsParams
// コメント:
// - 測定時の文字サイズと書体を受け取る

type FitsParams = {
  chapterTitle?: string;
  body: string;
  measureBox: HTMLElement;
  maxHeight: number;
  fontSize?: PaginationFontSize;
  fontFamily?: PaginationFontFamily;
};

// src/lib/paginateParariPage.ts
// 2026/06/14 17:50 JST
// PART: split / pack params
// コメント:
// - 長すぎる段落・文を分割する時も測定書体を維持する

type SplitOversizedParams = {
  block: string;
  chapterTitle?: string;
  measureBox: HTMLElement;
  maxHeight: number;
  fontSize?: PaginationFontSize;
  fontFamily?: PaginationFontFamily;
};

type PackUnitsParams = {
  units: string[];
  chapterTitle?: string;
  measureBox: HTMLElement;
  maxHeight: number;
  fontSize?: PaginationFontSize;
  fontFamily?: PaginationFontFamily;
};

/**
 * PART: resolveDisplayMode
 * コメント:
 * - mode と PAGE数から最終表示モードを決める
 */
export function resolveDisplayMode(
  bookMode: string | undefined,
  pageCount: number
): DisplayMode {
  if (bookMode === "scroll") return "scroll";
  if (bookMode === "page") return "page";
  return pageCount >= 2 ? "page" : "scroll";
}

/**
 * PART: paginatePage
 * コメント:
 * - 1つの [PAGE] を DisplayPage[] に変換
 * - 画像があれば先に image page を作る
 * - 本文は高さに応じて text page に分割
 */
// src/lib/paginateParariPage.ts
// 2026/06/14 13:55 JST
// PART: paginatePage args
// コメント:
// - pagination時のページ分割にも文字サイズを反映する

// src/lib/paginateParariPage.ts
// 2026/06/14 17:50 JST
// PART: paginatePage options
// コメント:
// - pagination時のページ分割に文字サイズと書体を反映する

export function paginatePage(
  parsedPage: LegacyParariPage,
  measureBox: HTMLElement,
  maxHeight: number,
  options: PaginationOptions = {},
): DisplayPage[] {
  const fontSize = options.fontSize ?? "medium";
  const fontFamily = options.fontFamily ?? "standard";
  const result: DisplayPage[] = [];

  // 1) 画像があれば最初に画像ページを追加
    if (parsedPage.imageUrl) {
      result.push({
        kind: "image",
        pageIndex: result.length,
        imageUrl: parsedPage.imageUrl,
          chapterTitle: parsedPage.chapterTitle || undefined,
      });
    }

  // 2) 本文を正規化
  const body = normalizeBody(parsedPage.body);
  if (!body) return result;

  // 3) 段落配列へ
  const paragraphBlocks = splitIntoParagraphBlocks(body);

  // 4) ページを組み立て
  let currentText = "";
    let isFirstTextPage = !parsedPage.imageUrl;

  for (const block of paragraphBlocks) {
    const candidate = joinBlocks(currentText, block);

    if (
      fitsInPage({
      chapterTitle:
        isFirstTextPage && parsedPage.chapterTitle
          ? parsedPage.chapterTitle
          : undefined,
        body: candidate,
        measureBox,
        maxHeight,
        fontSize,
          fontFamily,
      })
    ) {
      currentText = candidate;
      continue;
    }

    // block を足すと入らない
    if (!currentText) {
      // block 単体でも大きすぎる → fallback 分割
      const splitPages = splitOversizedBlockIntoPages({
        block,
        chapterTitle:
          isFirstTextPage && parsedPage.chapterTitle
            ? parsedPage.chapterTitle
            : undefined,
        measureBox,
        maxHeight,
        fontSize,
      });

      for (const pageBody of splitPages) {
        result.push({
          kind: "text",
          pageIndex: result.length,
          chapterTitle:
            isFirstTextPage && parsedPage.chapterTitle
              ? parsedPage.chapterTitle
              : undefined,
          body: pageBody,
        });
        isFirstTextPage = false;
      }

      currentText = "";
      continue;
    }

    // 今の currentText を1ページ確定
    result.push({
      kind: "text",
      pageIndex: result.length,
      chapterTitle:
        isFirstTextPage && parsedPage.chapterTitle
          ? parsedPage.chapterTitle
          : undefined,
      body: currentText,
    });
    isFirstTextPage = false;

    // 次ページで block を処理
    if (
      fitsInPage({
        chapterTitle: undefined,
        body: block,
        measureBox,
        maxHeight,
        fontSize,
          fontFamily,
      })
    ) {
      currentText = block;
    } else {
      const splitPages = splitOversizedBlockIntoPages({
        block,
        chapterTitle: undefined,
        measureBox,
        maxHeight,
        fontSize,
      });

      for (const pageBody of splitPages) {
        result.push({
          kind: "text",
          pageIndex: result.length,
          chapterTitle: undefined,
          body: pageBody,
        });
      }

      currentText = "";
    }
  }

  // 5) 残りを確定
  if (currentText) {
    result.push({
      kind: "text",
      pageIndex: result.length,
      chapterTitle:
        isFirstTextPage && parsedPage.chapterTitle
          ? parsedPage.chapterTitle
          : undefined,
      body: currentText,
    });
  }

  return result;
}

/**
 * PART: normalizeBody
 * コメント:
 * - 改行コード統一
 * - 空行連打の軽い正規化
 * - 前後空白除去
 */
export function normalizeBody(body: string): string {
  return (body ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * PART: splitIntoParagraphBlocks
 * コメント:
 * - 空行区切りを段落として扱う
 * - 空行が無ければ全文1ブロック
 */
export function splitIntoParagraphBlocks(body: string): string[] {
  const parts = body
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [body];
}

/**
 * PART: joinBlocks
 * コメント:
 * - 段落ブロックを空行1つで連結
 */
export function joinBlocks(currentText: string, nextBlock: string): string {
  if (!currentText) return nextBlock;
  return currentText + "\n\n" + nextBlock;
}

/**
 * PART: fitsInPage
 * コメント:
 * - 測定DOMに描画して maxHeight に収まるか判定
 */
// src/lib/paginateParariPage.ts
// 2026/06/14 16:30 JST
// PART: fitsInPage
// コメント:
// - 測定DOMにも readerFontSize を渡す
// - これを渡さないと、表示だけ大きくなってもページ分割は標準サイズのままになる

// src/lib/paginateParariPage.ts
// 2026/06/14 17:50 JST
// PART: fitsInPage
// コメント:
// - 測定DOMに文字サイズと書体を渡す

export function fitsInPage({
  chapterTitle,
  body,
  measureBox,
  maxHeight,
  fontSize = "medium",
  fontFamily = "standard",
}: FitsParams): boolean {
  renderToMeasureBox({
    chapterTitle,
    body,
    measureBox,
    fontSize,
    fontFamily,
  });

  const h = measureBox.scrollHeight;
  return h <= maxHeight;
}

/**
 * PART: renderToMeasureBox
 * コメント:
 * - Viewer と同じ幅・近いCSSを持つ hidden DOM に描画する
 * - display:none は使わない前提
 */
// src/lib/paginateParariPage.ts
// 2026/06/14 13:55 JST
// PART: renderToMeasureBox
// コメント:
// - hidden測定DOMの文字サイズを readerFontSize と一致させる

// src/lib/paginateParariPage.ts
// 2026/06/14 17:50 JST
// PART: renderToMeasureBox
// コメント:
// - hidden測定DOMの文字サイズと書体を reader 設定に合わせる

export function renderToMeasureBox({
  chapterTitle,
  body,
  measureBox,
  fontSize = "medium",
  fontFamily = "standard",
}: {
  chapterTitle?: string;
  body: string;
  measureBox: HTMLElement;
  fontSize?: PaginationFontSize;
  fontFamily?: PaginationFontFamily;
}) {
  const metrics = getPaginationFontMetrics(fontSize);

  const fontFamilyCss =
    fontFamily === "literary"
      ? `Georgia, Cambria, "Times New Roman", Times, serif`
      : `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const titleHtml = chapterTitle
      ? `<div style="font-family:${fontFamilyCss};font-size:${metrics.chapterFontSize}px;font-weight:600;line-height:${metrics.chapterLineHeight};margin-bottom:16px;">${escapeHtml(
          chapterTitle
        )}</div>`
      : "";

  const bodyHtml = body
    .split("\n")
    .map((line) => {
      const safe = escapeHtml(line);
        return `<div style="font-family:${fontFamilyCss};font-size:${metrics.paragraphFontSize}px;line-height:${metrics.paragraphLineHeight};white-space:pre-wrap;">${
          safe || "&nbsp;"
        }</div>`;
    })
    .join("");

  measureBox.innerHTML = `
    <div style="width:100%;padding:0;">
      ${titleHtml}
      <div>${bodyHtml}</div>
    </div>
  `;
}

// src/lib/paginateParariPage.ts
// 2026/06/14 14:45 JST
// PART: splitOversizedBlockIntoPages
// コメント:
// - PARARI pagination v1
// - 段落が1ページに入らない場合は、まず文単位で分ける
// - 1文そのものが1ページに入らない場合だけ、自然単位に分ける
// - 行単位分割は使わない
// - 英文単語の途中では切らない

// src/lib/paginateParariPage.ts
// 2026/06/14 18:05 JST
// PART: splitOversizedBlockIntoPages
// コメント:
// - 長すぎる段落・文を分割する時も fontFamily を維持する
// - pagination測定時に標準/文学の書体差が反映されるようにする

export function splitOversizedBlockIntoPages({
  block,
  chapterTitle,
  measureBox,
  maxHeight,
  fontSize = "medium",
  fontFamily = "standard",
}: SplitOversizedParams): string[] {
  const sentenceUnits = splitIntoSentences(block);

  if (sentenceUnits.length > 1) {
    return packUnitsIntoPages({
      units: sentenceUnits,
      chapterTitle,
      measureBox,
      maxHeight,
      fontSize,
      fontFamily,
    });
  }
  const naturalUnits = splitLongSentenceIntoUnits(block);

  return packUnitsIntoPages({
    units: naturalUnits,
    chapterTitle,
    measureBox,
    maxHeight,
    fontSize,
      fontFamily
  });
}

/**
 * PART: splitIntoSentences
 * コメント:
 * - 最小版の日本語文分割
 */
export function splitIntoSentences(block: string): string[] {
  const parts = block.match(/[^。！？]+[。！？]?/g) || [block];
  return parts.map((s) => s.trim()).filter(Boolean);
}

// src/lib/paginateParariPage.ts
// 2026/06/14 14:45 JST
// PART: splitLongSentenceIntoUnits
// コメント:
// - 1文が1ページに入らない場合だけ使う
// - 英文は単語途中で切らない
// - 日本語は読点・カンマ・括弧などの自然な区切りを優先する
// - それでも分けられない日本語文だけ、最後に文字単位へ落とす

export function splitLongSentenceIntoUnits(sentence: string): string[] {
  const text = String(sentence ?? "").trim();
  if (!text) return [];

  const punctuationUnits = splitByNaturalPunctuation(text);
  if (punctuationUnits.length > 1) {
    return punctuationUnits;
  }

  const wordUnits = splitByWordBoundary(text);
  if (wordUnits.length > 1) {
    return wordUnits;
  }

  if (containsJapanese(text)) {
    return splitIntoChars(text);
  }

  return [text];
}

// src/lib/paginateParariPage.ts
// 2026/06/14 14:45 JST
// PART: splitByNaturalPunctuation
// コメント:
// - 読点、カンマ、セミコロン、コロン、ダッシュ、括弧閉じなどで分ける
// - 区切り記号は前の単位に残す
// - 文末記号 。！？.!? は splitIntoSentences 側の担当なので、ここでは主対象にしない

export function splitByNaturalPunctuation(text: string): string[] {
  const units: string[] = [];
  let current = "";

  for (const char of text) {
    current += char;

    if (/[、，,；;：:・…—）」』】）]/.test(char)) {
      const unit = current.trim();
      if (unit) units.push(unit);
      current = "";
    }
  }

  const rest = current.trim();
  if (rest) units.push(rest);

  return units.length > 0 ? units : [text];
}

// src/lib/paginateParariPage.ts
// 2026/06/14 14:45 JST
// PART: splitByWordBoundary
// コメント:
// - 英文やスペース区切り文を単語境界で分ける
// - 空白は前の単位に残す
// - 単語途中でページ分割しないための安全装置

export function splitByWordBoundary(text: string): string[] {
  const matches = text.match(/\S+\s*/g);
  if (!matches || matches.length <= 1) return [text];

  return matches.map((unit) => unit).filter(Boolean);
}

// src/lib/paginateParariPage.ts
// 2026/06/14 14:45 JST
// PART: containsJapanese
// コメント:
// - 日本語を含む文だけ、最後の非常用として文字単位fallbackを許す
// - 英単語やURLだけの塊は文字単位分割しない

export function containsJapanese(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
}

/**
 * PART: splitIntoLineUnits
 * コメント:
 * - 改行単位分割
 */
export function splitIntoLineUnits(block: string): string[] {
  return block
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * PART: splitIntoChars
 * コメント:
 * - 最終 fallback の文字単位分割
 */
export function splitIntoChars(block: string): string[] {
  return [...block];
}

/**
 * PART: packUnitsIntoPages
 * コメント:
 * - 単位列を高さに応じてページへ詰める共通関数
 */
export function packUnitsIntoPages({
  units,
  chapterTitle,
  measureBox,
  maxHeight,
  fontSize = "medium",
  fontFamily = "standard",
}: PackUnitsParams): string[] {
  const pages: string[] = [];
  let current = "";
  let isFirst = true;

  for (const unit of units) {
    const candidate = current ? current + unit : unit;

    if (
      fitsInPage({
        chapterTitle: isFirst ? chapterTitle : undefined,
        body: candidate,
        measureBox,
        maxHeight,
        fontSize,
      })
    ) {
      current = candidate;
      continue;
    }

    if (current) {
      pages.push(current);
      isFirst = false;
      current = unit;
      continue;
    }

    // unit 1個でも入らない異常ケース
    pages.push(unit);
    isFirst = false;
    current = "";
  }

  if (current) {
    pages.push(current);
  }

  return pages;
}

/**
 * PART: escapeHtml
 * コメント:
 * - 測定DOM描画時の最低限のHTMLエスケープ
 */
function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
