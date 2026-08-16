// src/lib/parari/inlineLinks.ts
// 2026-03-31 JST

/**
 * PART: inline link types
 * コメント:
 * - PARARI本文内のインラインリンク専用
 * - LinksはDBを使わず、SSOT本文だけで完結する
 * - 記法: ⟦lk:https://example.com|表示文字列⟧
 */

export type ParariInlinePart =
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "link";
      href: string;
      label: string;
      raw: string;
    };

/**
 * PART: constants
 * コメント:
 * - markerの開始/終了記号
 */
const LINK_OPEN = "⟦lk:";
const LINK_CLOSE = "⟧";

/**
 * PART: buildInlineLinkMarker
 * コメント:
 * - UI側でリンク文字列を自動生成するための関数
 * - 今回はURL直書き方式で固定
 */
export function buildInlineLinkMarker(url: string, label: string): string {
  const safeUrl = (url ?? "").trim();
  const safeLabel = (label ?? "").trim();

  if (!safeUrl || !safeLabel) {
    return "";
  }

  return `⟦lk:${safeUrl}|${safeLabel}⟧`;
}

/**
 * PART: normalizeLinkUrl
 * コメント:
 * - 今回は http / https のみ許可
 * - 不正なら null を返す
 */
export function normalizeLinkUrl(input: string): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  if (!(raw.startsWith("http://") || raw.startsWith("https://"))) {
    return null;
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * PART: parseSingleInlineLinkPayload
 * コメント:
 * - "https://example.com|表示文字列" を分解する
 * - 壊れている場合は null
 */
function parseSingleInlineLinkPayload(
  payload: string,
  raw: string
): Extract<ParariInlinePart, { kind: "link" }> | null {
  const dividerIndex = payload.indexOf("|");
  if (dividerIndex <= 0) return null;

  const urlPart = payload.slice(0, dividerIndex).trim();
  const labelPart = payload.slice(dividerIndex + 1).trim();

  if (!urlPart || !labelPart) return null;

  const normalizedHref = normalizeLinkUrl(urlPart);
  if (!normalizedHref) return null;

  return {
    kind: "link",
    href: normalizedHref,
    label: labelPart,
    raw,
  };
}

/**
 * PART: parseInlineLinks
 * コメント:
 * - 本文文字列を text / link の配列に分解する
 * - 壊れたmarkerはリンク化せず、元の文字列のままtextとして返す
 * - 改行をまたいでもそのまま文字列処理するが、marker不正時は壊さない
 */
export function parseInlineLinks(text: string): ParariInlinePart[] {
  const source = text ?? "";
  if (!source) {
    return [{ kind: "text", text: "" }];
  }

  const parts: ParariInlinePart[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const openIndex = source.indexOf(LINK_OPEN, cursor);

    if (openIndex === -1) {
      const tail = source.slice(cursor);
      if (tail) {
        parts.push({ kind: "text", text: tail });
      }
      break;
    }

    if (openIndex > cursor) {
      parts.push({
        kind: "text",
        text: source.slice(cursor, openIndex),
      });
    }

    const payloadStart = openIndex + LINK_OPEN.length;
    const closeIndex = source.indexOf(LINK_CLOSE, payloadStart);

    if (closeIndex === -1) {
      parts.push({
        kind: "text",
        text: source.slice(openIndex),
      });
      break;
    }

    const raw = source.slice(openIndex, closeIndex + LINK_CLOSE.length);
    const payload = source.slice(payloadStart, closeIndex);

    const parsed = parseSingleInlineLinkPayload(payload, raw);
    if (parsed) {
      parts.push(parsed);
    } else {
      parts.push({
        kind: "text",
        text: raw,
      });
    }

    cursor = closeIndex + LINK_CLOSE.length;
  }

  if (parts.length === 0) {
    return [{ kind: "text", text: "" }];
  }

  return mergeAdjacentTextParts(parts);
}

/**
 * PART: mergeAdjacentTextParts
 * コメント:
 * - textが連続したときにまとめる
 * - React描画時の扱いを少し素直にする
 */
function mergeAdjacentTextParts(parts: ParariInlinePart[]): ParariInlinePart[] {
  const merged: ParariInlinePart[] = [];

  for (const part of parts) {
    const prev = merged[merged.length - 1];

    if (part.kind === "text" && prev?.kind === "text") {
      prev.text += part.text;
      continue;
    }

    merged.push(
      part.kind === "text"
        ? { kind: "text", text: part.text }
        : {
            kind: "link",
            href: part.href,
            label: part.label,
            raw: part.raw,
          }
    );
  }

  return merged;
}
