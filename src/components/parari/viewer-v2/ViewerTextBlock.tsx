// src/components/parari/viewer-v2/ViewerTextBlock.tsx
// PART: viewer-v2 text block renderer with inline notes and English glossary

"use client";

import React from "react";
import { createPortal } from "react-dom";
import {
  formatParariEnglishGlossaryMeaning,
  getBestParariEnglishGlossaryEntry,
  shouldAnnotateParariEnglishWord,
} from "@/lib/parari/english/basicWordGlossary";
import type {
  ReaderDictionaryMode,
  ReaderRubyMode,
} from "./viewerTextStyles";

type ViewerTextBlockProps = {
  text: string;
  className?: string;
  dictionaryMode?: ReaderDictionaryMode;
  rubyMode?: ReaderRubyMode;
  headingStartIndex?: number;
};

type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "note"; label: string; note: string }
  | { kind: "ruby"; base: string; reading: string }
  | { kind: "link"; label: string; url: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "red"; text: string }
  | { kind: "word"; text: string };

type NoteState = {
  activeNoteKey: string | null;
  setActiveNoteKey: React.Dispatch<React.SetStateAction<string | null>>;
};

export function ViewerTextBlock({
  text,
  className = "",
  dictionaryMode = "off",
  rubyMode = "click",
  headingStartIndex,
}: ViewerTextBlockProps) {
  const source = String(text ?? "");
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [activeNoteKey, setActiveNoteKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;

      if (!root) {
        return;
      }

      const target = event.target;

      if (target instanceof Node && root.contains(target)) {
        return;
      }

      setActiveNoteKey(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-parari-text-block
      className={className}
    >
      {renderBlockText(
        source,
        dictionaryMode,
        rubyMode,
        {
          activeNoteKey,
          setActiveNoteKey,
        },
        headingStartIndex,
      )}
    </div>
  );
}

function renderBlockText(
  source: string,
  dictionaryMode: ReaderDictionaryMode,
  rubyMode: ReaderRubyMode,
  noteState: NoteState,
  headingStartIndex?: number,
): React.ReactNode {
  const normalized = String(source ?? "").replace(/\r\n/g, "\n");
  const blocks = normalized.split(/\n{2,}/);
  let headingOffset = 0;

  return blocks.map((block, blockIndex) => {
    const text = block.trimEnd();

    if (text.trim().length === 0) {
      return null;
    }

    const heading = getHeadingInfo(text);

    if (heading) {
      const headingId =
        typeof headingStartIndex === "number"
          ? `parari-page-heading-${headingStartIndex + headingOffset}`
          : undefined;

      headingOffset += 1;

      if (heading.level === 3) {
        return (
          <h3
            key={`block-${blockIndex}`}
            id={headingId}
            className="mb-3 mt-6 scroll-mt-24 text-lg font-bold leading-8 text-neutral-900"
          >
            {renderInlineContent(
              heading.title,
              dictionaryMode,
              rubyMode,
              noteState,
              `b${blockIndex}-h3`,
            )}
          </h3>
        );
      }

      return (
        <h2
          key={`block-${blockIndex}`}
          id={headingId}
          className="mb-4 mt-8 scroll-mt-24 text-xl font-bold leading-9 text-neutral-950"
        >
          {renderInlineContent(
            heading.title,
            dictionaryMode,
            rubyMode,
            noteState,
            `b${blockIndex}-h2`,
          )}
        </h2>
      );
    }

    const lines = text.split("\n");

    return (
      <p key={`block-${blockIndex}`} className="mb-4 last:mb-0">
        {lines.map((line, lineIndex) => (
          <React.Fragment key={`line-${blockIndex}-${lineIndex}`}>
            {lineIndex > 0 ? <br /> : null}
            {renderInlineContent(
              line,
              dictionaryMode,
              rubyMode,
              noteState,
              `b${blockIndex}-l${lineIndex}`,
            )}
          </React.Fragment>
        ))}
      </p>
    );
  });
}

function getHeadingInfo(
  source: string,
): { level: 2 | 3; title: string } | null {
  const trimmed = String(source ?? "").trim();

  if (!trimmed) {
    return null;
  }

  const lines = trimmed.split("\n");

  if (lines.length !== 1) {
    return null;
  }

  const line = lines[0].trim();

  if (line.startsWith("### ")) {
    return {
      level: 3,
      title: line.slice(4).trim(),
    };
  }

  if (line.startsWith("## ")) {
    return {
      level: 2,
      title: line.slice(3).trim(),
    };
  }

  return null;
}

function renderInlineContent(
  source: string,
  dictionaryMode: ReaderDictionaryMode,
  rubyMode: ReaderRubyMode,
  noteState: NoteState,
  keyPrefix: string,
): React.ReactNode[] {
  const tokens = tokenizeInlineContent(source);

  return tokens.map((token, index) => {
    const noteKey = `${keyPrefix}-${index}`;

    if (token.kind === "text") {
      return <React.Fragment key={`text-${noteKey}`}>{token.text}</React.Fragment>;
    }

    if (token.kind === "note") {
      return (
        <NoteInline
          key={`note-${noteKey}`}
          noteKey={`note-${noteKey}`}
          label={token.label}
          note={token.note}
          activeNoteKey={noteState.activeNoteKey}
          setActiveNoteKey={noteState.setActiveNoteKey}
        />
      );
    }

    if (token.kind === "ruby") {
      if (rubyMode === "off") {
        return (
          <React.Fragment key={`ruby-text-${noteKey}`}>
            {token.base}
          </React.Fragment>
        );
      }

      return (
        <NoteInline
          key={`ruby-${noteKey}`}
          noteKey={`ruby-${noteKey}`}
          label={token.base}
          note={token.reading}
          activeNoteKey={noteState.activeNoteKey}
          setActiveNoteKey={noteState.setActiveNoteKey}
          tone="ruby"
        />
      );
    }

    if (token.kind === "link") {
      const url = sanitizeLinkUrl(token.url);

      if (!url) {
        return <React.Fragment key={`link-text-${noteKey}`}>{token.label}</React.Fragment>;
      }

      return (
        <a
          key={`link-${noteKey}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-neutral-400 underline-offset-4 hover:text-blue-700"
        >
          {token.label}
        </a>
      );
    }

    if (token.kind === "bold") {
      return (
        <strong key={`bold-${noteKey}`} className="font-bold">
          {renderInlineContent(
            token.text,
            dictionaryMode,
            rubyMode,
            noteState,
            `${noteKey}-bold`,
          )}
        </strong>
      );
    }

    if (token.kind === "italic") {
      return (
        <em key={`italic-${noteKey}`} className="italic">
          {renderInlineContent(
            token.text,
            dictionaryMode,
            rubyMode,
            noteState,
            `${noteKey}-italic`,
          )}
        </em>
      );
    }

    if (token.kind === "red") {
      return (
        <span key={`red-${noteKey}`} className="font-semibold text-red-600">
          {renderInlineContent(
            token.text,
            dictionaryMode,
            rubyMode,
            noteState,
            `${noteKey}-red`,
          )}
        </span>
      );
    }

    if (token.kind === "word") {
      return renderWordToken(token.text, dictionaryMode, noteState, noteKey);
    }

    return null;
  });
}

function tokenizeInlineContent(source: string): InlineToken[] {
  const text = String(source ?? "");

  const pattern =
    /\[\[([^\]]+)\]\]\(([^)]+)\)|\[\[([^\]]+)\]\]\{([^}]+)\}|\[\[([^\]|]+)\|([^\]]+)\]\]|!!([^!]+)!!|\*\*([^*]+)\*\*|\*([^*]+)\*|\b[A-Za-z][A-Za-z'’-]*\b/g;

  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        kind: "text",
        text: text.slice(lastIndex, match.index),
      });
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      tokens.push({
        kind: "link",
        label: String(match[1] ?? ""),
        url: String(match[2] ?? ""),
      });
    } else if (match[3] !== undefined && match[4] !== undefined) {
      tokens.push({
        kind: "note",
        label: String(match[3] ?? ""),
        note: String(match[4] ?? ""),
      });
    } else if (match[5] !== undefined && match[6] !== undefined) {
      const left = String(match[5] ?? "");
      const right = String(match[6] ?? "");

      if (looksLikeUrl(left)) {
        tokens.push({ kind: "link", label: right, url: left });
      } else if (looksLikeUrl(right)) {
        tokens.push({ kind: "link", label: left, url: right });
      } else {
        tokens.push({ kind: "ruby", base: left, reading: right });
      }
    } else if (match[7] !== undefined) {
      tokens.push({ kind: "red", text: String(match[7] ?? "") });
    } else if (match[8] !== undefined) {
      tokens.push({ kind: "bold", text: String(match[8] ?? "") });
    } else if (match[9] !== undefined) {
      tokens.push({ kind: "italic", text: String(match[9] ?? "") });
    } else {
      tokens.push({ kind: "word", text: match[0] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({
      kind: "text",
      text: text.slice(lastIndex),
    });
  }

  return tokens;
}

function renderWordToken(
  word: string,
  dictionaryMode: ReaderDictionaryMode,
  noteState: NoteState,
  noteKey: string,
): React.ReactNode {
  if (dictionaryMode === "off") {
    return <React.Fragment key={`word-${noteKey}`}>{word}</React.Fragment>;
  }

  const cleanWord = word.replace(/[’']/g, "'");

   if (!shouldAnnotateParariEnglishWord(cleanWord, dictionaryMode)) {
    return <React.Fragment key={`word-${noteKey}`}>{word}</React.Fragment>;
  }

  const entry = getBestParariEnglishGlossaryEntry(cleanWord);

  if (!entry) {
    return <React.Fragment key={`word-${noteKey}`}>{word}</React.Fragment>;
  }

  const meaning = sanitizeNoteText(formatParariEnglishGlossaryMeaning(entry));

  if (!meaning) {
    return <React.Fragment key={`word-${noteKey}`}>{word}</React.Fragment>;
  }

  return (
    <NoteInline
      key={`word-note-${noteKey}`}
      noteKey={`word-note-${noteKey}`}
      label={word}
      note={meaning}
      activeNoteKey={noteState.activeNoteKey}
      setActiveNoteKey={noteState.setActiveNoteKey}
    />
  );
}

function NoteInline({
  noteKey,
  label,
  note,
  activeNoteKey,
  setActiveNoteKey,
  tone = "note",
}: {
  noteKey: string;
  label: string;
  note: string;
  activeNoteKey: string | null;
  setActiveNoteKey: React.Dispatch<React.SetStateAction<string | null>>;
  tone?: "note" | "ruby";
}) {
  const isOpen = activeNoteKey === noteKey;
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const popupRef = React.useRef<HTMLSpanElement | null>(null);
  const [popupPosition, setPopupPosition] = React.useState({
    left: -10000,
    top: -10000,
  });

  React.useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePosition = () => {
      const button = buttonRef.current;
      const popup = popupRef.current;

      if (!button || !popup) {
        return;
      }

      const margin = 12;
      const gap = 8;
      const buttonRect = button.getBoundingClientRect();
      const popupRect = popup.getBoundingClientRect();

      const contentRoot = button.closest<HTMLElement>(
        "[data-parari-text-block]",
      );
      const contentRect = contentRoot?.getBoundingClientRect();

      const minimumLeft = contentRect
        ? Math.max(margin, contentRect.left)
        : margin;

      const maximumRight = contentRect
        ? Math.min(window.innerWidth - margin, contentRect.right)
        : window.innerWidth - margin;

      let left =
        buttonRect.left + buttonRect.width / 2 - popupRect.width / 2;

      left = Math.max(
        minimumLeft,
        Math.min(left, maximumRight - popupRect.width),
      );

      let top = buttonRect.bottom + gap;

      if (top + popupRect.height > window.innerHeight - margin) {
        top = buttonRect.top - popupRect.height - gap;
      }

      top = Math.max(
        margin,
        Math.min(top, window.innerHeight - popupRect.height - margin),
      );

      setPopupPosition({ left, top });
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, note]);

  if (!label) {
    return null;
  }

  const popup =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <span
            ref={popupRef}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            style={{
              left: popupPosition.left,
              top: popupPosition.top,
            }}
            className={[
              "fixed z-[100] rounded-2xl border bg-white p-3 text-left text-xs leading-5 shadow-xl",
              tone === "ruby"
                ? "w-max max-w-64 border-sky-100 text-neutral-800"
                : "w-64 border-neutral-200 text-neutral-700",
            ].join(" ")}
          >
            {note}
          </span>,
          document.body,
        )
      : null;

  return (
    <span className="inline-block align-baseline">
      <button
        ref={buttonRef}
        type="button"
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          setActiveNoteKey((current) => (current === noteKey ? null : noteKey));
        }}
        className={[
          "inline rounded px-0.5 text-inherit underline decoration-dotted underline-offset-4",
          tone === "ruby"
            ? "decoration-neutral-400 hover:bg-sky-50"
            : "hover:bg-amber-50",
        ].join(" ")}
      >
        {label}
      </button>

      {popup}
    </span>
  );
}

function sanitizeNoteText(value: string): string {
  return String(value ?? "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeUrl(value: string): boolean {
  const text = String(value ?? "").trim();

  return (
    /^https?:\/\//i.test(text) ||
    text.startsWith("/") ||
    /^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(text)
  );
}

function sanitizeLinkUrl(value: string): string {
  const text = String(value ?? "").trim();

  if (text.length === 0) return "";

  const fixedText = text
    .replace(/^https\/\//i, "https://")
    .replace(/^http\/\//i, "http://");

  if (/^https?:\/\//i.test(fixedText)) return fixedText;
  if (fixedText.startsWith("/")) return fixedText;

  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(fixedText)) {
    return `https://${fixedText}`;
  }

  return "";
}
