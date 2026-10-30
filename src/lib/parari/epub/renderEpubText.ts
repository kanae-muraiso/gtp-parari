// src/lib/parari/epub/renderEpubText.ts
// 2026-10-30 JST
// PART: Read saved inline notation into safe, semantic EPUB XHTML.
// Notes are local to each content document. No SSOT is modified.
import { isRichTextColorName } from "@/lib/parari/richText/textColors";

export type EpubTextContext = { notes: string[]; warnings: string[] };

function escape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function looksLikeUrl(value: string): boolean {
  return /^(?:[a-z][a-z\d+.-]*:|\/|[a-z\d.-]+\.[a-z]{2,}(?:[/:?#]|$))/i.test(value.trim());
}

function safeLink(value: string): string | null {
  const text = value.trim().replace(/^https\/\//i, "https://").replace(/^http\/\//i, "http://");
  if (/[\u0000-\u0020\u007f]/.test(text)) return null;
  try {
    const url = new URL(text.startsWith("/") && !text.startsWith("//") ? `https://www.parari.app${text}` : /^[a-z\d.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(text) ? `https://${text}` : text);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function renderEpubInlines(text: string, context: EpubTextContext, depth = 0): string {
  if (depth > 12) return escape(text);
  // Current editor notation plus legacy link/color notation; malformed tokens remain text.
  const pattern = /\[\[([^\]]+)\]\]\(([^)]+)\)|\[\[([^\]]+)\]\]\{([^}]+)\}|\[\[([^\]|｜]+)[|｜]([^\]]+)\]\]|⟦lk:([^|⟧]+)\|([^⟧]+)⟧|\[([^\]]+)\]\(([^)]+)\)|!!([^!]+)!!|！！([^！]+)！！|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  const inline = (value: string) => renderEpubInlines(value, context, depth + 1);
  const link = (label: string, value: string) => {
    const url = safeLink(value);
    if (!url) {
      const warning = "EPUBで使用できないリンクは表示文字だけを残しました。";
      if (!context.warnings.includes(warning)) context.warnings.push(warning);
      return escape(label);
    }
    return `<a href="${escape(url)}">${escape(label)}</a>`;
  };
  let output = "";
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    output += escape(text.slice(offset, match.index));
    if (match[1] !== undefined) output += link(match[1], match[2]);
    else if (match[3] !== undefined) {
      const number = context.notes.push(match[4]);
      output += `${escape(match[3])}<a id="note-ref-${number}" href="#note-${number}" epub:type="noteref" role="doc-noteref" class="noteref" aria-label="注${number}">${number}</a>`;
    } else if (match[5] !== undefined) {
      if (looksLikeUrl(match[5])) output += link(match[6], match[5]);
      else if (looksLikeUrl(match[6])) output += link(match[5], match[6]);
      else output += `<ruby>${escape(match[5])}<rp>（</rp><rt>${escape(match[6])}</rt><rp>）</rp></ruby>`;
    } else if (match[7] !== undefined) output += link(match[8], match[7]);
    else if (match[9] !== undefined) output += link(match[9], match[10]);
    else if (match[11] !== undefined || match[12] !== undefined) {
      const inner = match[11] ?? match[12];
      const color = inner.match(/^([a-z]+(?:\+[a-z]+)*)\|([\s\S]*)$/i);
      const modifiers = color?.[1].toLowerCase().split("+") ?? [];
      const knownColor = isRichTextColorName(modifiers[0] ?? "");
      const body = inline(knownColor && color ? color[2] : inner);
      output += `<strong>${knownColor && modifiers.includes("italic") ? `<em>${body}</em>` : body}</strong>`;
    } else if (match[13] !== undefined) output += `<strong><em>${inline(match[13])}</em></strong>`;
    else if (match[14] !== undefined) output += `<strong>${inline(match[14])}</strong>`;
    else output += `<em>${inline(match[15])}</em>`;
    offset = match.index! + match[0].length;
  }
  return output + escape(text.slice(offset));
}

export function renderEpubText(text: string, context: EpubTextContext): string {
  return text.replace(/\r\n?/g, "\n").trim().split(/\n{2,}/).filter(Boolean).map(chunk => {
    const heading = chunk.match(/^(#{2,3})\s+([^\n]+)$/);
    const legacyHeading = chunk.match(/^(#{1,2})([^#\n].*?)\1$/);
    if (heading || legacyHeading) {
      const level = heading ? heading[1].length : legacyHeading![1].length + 1;
      return `<h${level}>${renderEpubInlines((heading ?? legacyHeading)![2], context)}</h${level}>`;
    }
    // Preserve mixed quoted/plain lines in order, grouping adjacent quote lines.
    const groups: Array<{ quote: boolean; lines: string[] }> = [];
    for (const line of chunk.split("\n")) {
      const quoted = line.match(/^> ?(.*)$/);
      const quote = Boolean(quoted);
      const last = groups.at(-1);
      if (last && last.quote === quote) last.lines.push(quoted ? quoted[1] : line);
      else groups.push({ quote, lines: [quoted ? quoted[1] : line] });
    }
    return groups.map(group => {
      const paragraph = `<p>${group.lines.map(line => renderEpubInlines(line, context)).join("<br/>")}</p>`;
      return group.quote ? `<blockquote>${paragraph}</blockquote>` : paragraph;
    }).join("\n");
  }).join("\n");
}

export function renderEpubFootnotes(context: EpubTextContext): string {
  if (!context.notes.length) return "";
  return `<section class="footnotes" aria-label="注釈">${context.notes.map((note, index) => {
    const number = index + 1;
    // Note bodies are plain text, as stored by the current note editor.
    return `<aside id="note-${number}" epub:type="footnote" role="doc-footnote"><p>${number}. ${escape(note).replace(/\r\n?|\n/g, "<br/>")} <a href="#note-ref-${number}" aria-label="本文の注${number}へ戻る">↩</a></p></aside>`;
  }).join("\n")}</section>`;
}
