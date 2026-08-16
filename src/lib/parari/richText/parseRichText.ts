// src/lib/parari/richText/parseRichText.ts
// src/lib/parari/richText/parseRichText.ts
// 2026/06/13 19:00 JST

import type {
  ParseRichTextOptions,
  RichBlock,
  RichDocument,
  RichInline,
  RichColorTone,
} from "./types";

/**
 * PART: 正規化
 * コメント:
 * - 改行コードを LF に寄せる
 */
function normalizeText(input: string): string {
  return String(input ?? "").replace(/\r\n?/g, "\n");
}

/**
 * PART: chapter 判定
 * コメント:
 * - 新仕様の [PAGE]章名 を最優先で chapter とみなす
 * - 旧仕様の #...# も後方互換で受理する
 */
function matchChapter(line: string): string | null {
  const trimmed = line.trim();

  // RichTextEditor h2 保存形式: ## 見出し
  const markdownH2Matched = trimmed.match(/^##\s+(.+)$/);
  if (markdownH2Matched) {
    return String(markdownH2Matched[1] ?? "").trim();
  }

  const pageMatched = trimmed.match(/^\[PAGE\](.*)$/);
  if (pageMatched) {
    return String(pageMatched[1] ?? "").trim();
  }

  const legacyMatched = trimmed.match(/^#([^#].*?)#$/);
  return legacyMatched ? legacyMatched[1].trim() : null;
}
/**
 * PART: subheading 判定
 * コメント:
 * - 単独行で ##...## のみを subheading とみなす
 */
function matchSubheading(line: string): string | null {
  const trimmed = line.trim();

  // RichTextEditor h3 保存形式: ### 見出し
  const markdownH3Matched = trimmed.match(/^###\s+(.+)$/);
  if (markdownH3Matched) {
    return String(markdownH3Matched[1] ?? "").trim();
  }

  const matched = trimmed.match(/^##(.+?)##$/);
  return matched ? matched[1].trim() : null;
}

/**
 * PART: inline 追加 helper
 * コメント:
 * - 空文字は追加しない
 */
function pushTextInline(target: RichInline[], text: string) {
  if (!text) return;
  target.push({ type: "text", text });
}

/**
 * PART: color tone 決定
 * コメント:
 * - 現時点では最小実装
 * - 「！！...！！」は意味上 alert 扱い
 * - 将来ここで tone 推定ロジックを差し替え可能
 */
function resolveColorTone(_text: string): RichColorTone {
  return "alert";
}

/**
 * PART: inline parser
 * コメント:
 * - **...** → bold
 * - !!...!! / ！！...！！ → color
 * - ネストは今は扱わない
 * - 最小文法優先で、左から順に早く見つかった記号を処理する
 */
export function parseRichInlines(text: string): RichInline[] {
  const result: RichInline[] = [];
  let rest = text;

  while (rest.length > 0) {
    const boldIndex = rest.indexOf("**");
    const colorHalfIndex = rest.indexOf("!!");
    const colorFullIndex = rest.indexOf("！！");

    const candidates = [
      { type: "bold" as const, index: boldIndex, open: "**", close: "**" },
      { type: "color" as const, index: colorHalfIndex, open: "!!", close: "!!" },
      { type: "color" as const, index: colorFullIndex, open: "！！", close: "！！" },
    ].filter((item) => item.index >= 0);

    if (candidates.length === 0) {
      pushTextInline(result, rest);
      break;
    }

    const next = candidates.reduce((prev, curr) =>
      curr.index < prev.index ? curr : prev,
    );

    if (next.index > 0) {
      pushTextInline(result, rest.slice(0, next.index));
      rest = rest.slice(next.index);
    }

    const closingIndex = rest.indexOf(next.close, next.open.length);
    if (closingIndex < 0) {
      pushTextInline(result, rest);
      break;
    }

    const inner = rest.slice(next.open.length, closingIndex);

    if (next.type === "bold") {
      result.push({ type: "bold", text: inner });
    } else {
      result.push({
        type: "color",
        text: inner,
        tone: resolveColorTone(inner),
      });
    }

    rest = rest.slice(closingIndex + next.close.length);
  }

  return result;
}

// src/lib/parari/richText/parseRichText.ts
// 2026/06/13 11:10 JST
// PART: paragraph block 作成
// コメント:
// - PARARI SSOT本文文法
// - 単独改行 = 段落内改行
// - 空行 = 段落区切り
// - そのため paragraph は複数行テキストを保持できる

function createParagraphBlock(text: string): RichBlock {
  return {
    type: "paragraph",
    inlines: parseRichInlines(text),
  };
}

// src/lib/parari/richText/parseRichText.ts
// 2026/06/13 11:10 JST
// PART: main parser
// コメント:
// - PARARI SSOT本文文法をここで正式に扱う
// - 単独改行 = 段落内改行
// - 空行 = 段落区切り
// - 見出しは「単独ブロック」の時だけ見出しとして扱う
// - 複数行 paragraph 内の単独改行は保持する

export function parseRichText(
  input: string,
  _options?: ParseRichTextOptions,
): RichDocument {
  const text = normalizeText(input)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) {
    return { blocks: [] };
  }

  const chunks = text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const blocks: RichBlock[] = [];

  for (const chunk of chunks) {
    const isSingleLine = !chunk.includes("\n");

    if (isSingleLine) {
      const subheading = matchSubheading(chunk);
      if (subheading !== null) {
        blocks.push({
          type: "subheading",
          inlines: parseRichInlines(subheading),
        });
        continue;
      }

      const chapter = matchChapter(chunk);
      if (chapter !== null) {
        blocks.push({
          type: "chapter",
          inlines: parseRichInlines(chapter),
        });
        continue;
      }
    }

    blocks.push(createParagraphBlock(chunk));
  }

  return { blocks };
}
