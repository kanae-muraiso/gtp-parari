// src/components/parari/richText/RichTextRenderer.tsx
// src/components/parari/richText/RichTextRenderer.tsx
// 2026/06/11 19:23 JST

"use client";

/**
 * PART: RichTextRenderer
 * コメント:
 * - RichDocument を React 表示する
 * - text / bold / color を描画
 * - Tパネル内部の inline link をここで最終解釈する
 * - [[url|表示文字]]
 * - [[表示文字|url]]
 * - ⟦lk:https://example.com|表示文字⟧
 * に対応
 */

import React from "react";
import type {
  RichBlock,
  RichDocument,
  RichInline,
  RichTextTheme,
} from "@/lib/parari/richText/types";

/**
 * PART: className helper
 * コメント:
 * - Tailwind 用の軽量 helper
 */
function cx(...values: Array<string | undefined | null | false>) {
  return values.filter(Boolean).join(" ");
}

/**
 * PART: default theme
 * コメント:
 * - FLOW / preview / public 共通の最小テーマ
 */
// PART: default rich text theme
// コメント:
// - 読者表示の本文をPARARI向けに少し読みやすくする
// - 本文は少し大きめ、行間ゆったり、段落間も広め
// - whitespace-pre-wrap により、通常改行・ソフトリターンを維持する

const defaultTheme: RichTextTheme = {
  documentClassName: "space-y-5",
  paragraphClassName:
    "text-[16.5px] leading-[1.9] text-neutral-900 whitespace-pre-wrap",
  chapterClassName:
    "pt-3 text-xl leading-snug font-semibold text-neutral-900",
  subheadingClassName:
    "pt-3 text-lg leading-snug font-semibold text-neutral-900",
  boldClassName: "font-semibold",
  colorClassName: "",
  colorToneClassNames: {
    alert: "text-red-600",
    accent: "text-blue-600",
    success: "text-green-600",
    muted: "text-neutral-500",
    custom: "",
  },
};

export type RichTextRendererProps = {
  document: RichDocument;
  theme?: RichTextTheme;
};

/**
 * PART: url helper
 * コメント:
 * - link 記法の左右どちらが URL か判定する
 */
function looksLikeUrl(value: string): boolean {
  const v = String(value || "").trim();
  return /^https?:\/\//i.test(v) || /^mailto:/i.test(v);
}

// apps/tools/parari/src/components/parari/richText/RichTextRenderer.tsx
// 2026-05-03 JST

/**
 * PART: renderInlineLinksInText
 * コメント:
 * - 文字列中の inline link を a タグに変換する
 * - UIが作る [[label]](url)
 * - 一般的な [label](url)
 * - [[url|label]]
 * - [[label|url]]
 * - ⟦lk:url|label⟧
 * に対応
 */
function renderInlineLinksInText(
  text: string,
  keyPrefix: string,
): React.ReactNode[] {
  if (!text) return [];

  const pattern =
    /(⟦lk:([^|⟧]+)\|([^⟧]+)⟧|\[\[([^\]]+)\]\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\[\[([^|\]｜]+)[|｜]([^\]]+)\]\]|\[\[([^\]]+)\]\]\{([^}]+)\})/g;

  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let index = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const full = match[0];
    const start = match.index;

    if (start > lastIndex) {
      result.push(
        <React.Fragment key={`${keyPrefix}-text-${index++}`}>
          {text.slice(lastIndex, start)}
        </React.Fragment>,
      );
    }

    let href = "";
    let label = "";
    let note = "";

    // ⟦lk:url|label⟧
    if (match[2] && match[3]) {
      href = match[2].trim();
      label = match[3].trim();
    }

    // [[label]](url)
    else if (match[4] && match[5]) {
      label = match[4].trim();
      href = match[5].trim();
    }

    // [label](url)
    else if (match[6] && match[7]) {
      label = match[6].trim();
      href = match[7].trim();
    }

    // [[url|label]] / [[label|url]]
    else if (match[8] && match[9]) {
      const left = match[8].trim();
      const right = match[9].trim();

      if (looksLikeUrl(left)) {
        href = left;
        label = right || left;
      } else if (looksLikeUrl(right)) {
        href = right;
        label = left || right;
      }
    }

    // [[label]]{note}
    else if (match[10] && match[11]) {
      label = match[10].trim();
      note = match[11].trim();
    }

    if (note) {
      result.push(
        <span
          key={`${keyPrefix}-note-${index++}`}
          title={note}
          className="text-blue-600 underline decoration-dotted underline-offset-4"
        >
          {label}
        </span>,
      );
    } else if (href) {
      result.push(
        <a
          key={`${keyPrefix}-link-${index++}`}
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-blue-600 underline underline-offset-4 hover:text-blue-800"
        >
          {label || href}
        </a>,
      );
    } else {
      result.push(
        <React.Fragment key={`${keyPrefix}-raw-${index++}`}>
          {full}
        </React.Fragment>,
      );
    }

    lastIndex = start + full.length;
  }

  if (lastIndex < text.length) {
    result.push(
      <React.Fragment key={`${keyPrefix}-tail-${index++}`}>
        {text.slice(lastIndex)}
      </React.Fragment>,
    );
  }

  return result;
}

/**
 * PART: renderInlineText
 * コメント:
 * - string なら inline link を解釈
 * - ReactNode 化済みならそのまま返す
 */
function renderInlineText(
  value: unknown,
  keyPrefix: string,
): React.ReactNode {
  if (typeof value === "string") {
    return renderInlineLinksInText(value, keyPrefix);
  }

  return value as React.ReactNode;
}

function renderInline(inline: RichInline, theme: RichTextTheme, key: string) {
  switch (inline.type) {
    case "text":
      return (
        <React.Fragment key={key}>
          {renderInlineText(inline.text, key)}
        </React.Fragment>
      );

    case "bold":
      return (
        <strong key={key} className={theme.boldClassName}>
          {renderInlineText(inline.text, key)}
        </strong>
      );

    case "color": {
      const toneClass =
        inline.tone && theme.colorToneClassNames
          ? theme.colorToneClassNames[inline.tone]
          : undefined;

      return (
        <span key={key} className={cx(theme.colorClassName, toneClass)}>
          {renderInlineText(inline.text, key)}
        </span>
      );
    }

    default:
      return null;
  }
}

function renderBlock(block: RichBlock, theme: RichTextTheme, key: string) {
  switch (block.type) {
    case "chapter":
      return (
        <h1 key={key} className={theme.chapterClassName}>
          {block.inlines.map((inline, index) =>
            renderInline(inline, theme, `${key}-inline-${index}`),
          )}
        </h1>
      );

    case "subheading":
      return (
        <h2 key={key} className={theme.subheadingClassName}>
          {block.inlines.map((inline, index) =>
            renderInline(inline, theme, `${key}-inline-${index}`),
          )}
        </h2>
      );

    case "paragraph":
      return (
        <p key={key} className={theme.paragraphClassName}>
          {block.inlines.map((inline, index) =>
            renderInline(inline, theme, `${key}-inline-${index}`),
          )}
        </p>
      );

    case "panel":
      return (
        <div
          key={key}
          data-panel-type={block.panelType}
          className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500"
        >
          [panel:{block.panelType}]
        </div>
      );

    default:
      return null;
  }
}

export default function RichTextRenderer({
  document,
  theme,
}: RichTextRendererProps) {
  const mergedTheme: RichTextTheme = {
    ...defaultTheme,
    ...theme,
    colorToneClassNames: {
      ...defaultTheme.colorToneClassNames,
      ...theme?.colorToneClassNames,
    },
  };

  return (
    <div className={mergedTheme.documentClassName}>
      {document.blocks.map((block, index) =>
        renderBlock(block, mergedTheme, `block-${index}`),
      )}
    </div>
  );
}
