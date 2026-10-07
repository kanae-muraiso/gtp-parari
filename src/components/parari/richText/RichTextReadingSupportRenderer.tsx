"use client";

import React from "react";
import { useEnglishAuthoring } from "@/components/parari/english/EnglishAuthoringProvider";
import { dictionaryStatus, DICTIONARY_MARK_CLASSES, type DictionaryEntry as LookupEntry, type DictionaryResults, type DictionaryResult as LookupResult } from "@/lib/parari/english/dictionary";
import { eikenBackgroundColor } from "@/lib/parari/english/eikenBackground";
import RichTextRenderer from "@/components/parari/richText/RichTextRenderer";
import type {
  RichDocument,
  RichInline,
} from "@/lib/parari/richText/types";
import {
  formatEikenLevelJa,
  type TextReadingSupportOptions,
} from "@/lib/parari/richText/textReadingSupport";

type Props = {
  document: RichDocument;
  options: TextReadingSupportOptions;
};

const WORD_PATTERN = /\b[A-Za-z][A-Za-z'’-]*\b/g;

export default function RichTextReadingSupportRenderer({
  document,
  options,
}: Props) {
  const authoring = useEnglishAuthoring();
  const authoringEnabled = authoring?.enabled;
  const authoringLookup = authoring?.lookupWords;
  const [lookupMap, setLookupMap] = React.useState<Record<string, LookupResult>>(
    {},
  );

  const words = React.useMemo(() => collectWords(document), [document]);
  const wordKey = React.useMemo(() => words.join("\u0001"), [words]);

  React.useEffect(() => {
    if (
      authoringEnabled === false ||
      words.length === 0 ||
      (!options.dictionary && !options.eikenLevel)
    ) {
      setLookupMap({});
      return;
    }

    const controller = new AbortController();
    setLookupMap({});

    async function load() {
      try {
        let results: DictionaryResults;
        if (authoringLookup) {
          results = await authoringLookup(words, controller.signal);
        } else {
          const response = await fetch("/api/english/dictionary", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ words }),
            signal: controller.signal,
          });
          if (!response.ok) return;
          results = (await response.json()).results ?? {};
        }
        if (!controller.signal.aborted) setLookupMap(results);
      } catch {
        // 読む支援が取得できなくても本文表示は壊さない。
      }
    }

    void load();

    return () => controller.abort();
  }, [
    wordKey,
    authoringEnabled,
    authoringLookup,
    options.dictionary,
    options.eikenLevel,
  ]);

  const transformed = React.useMemo(
    () => transformDocument(document, options, lookupMap),
    [document, lookupMap, options],
  );

  return <RichTextRenderer document={authoringEnabled === false ? document : transformed} />;
}

function collectWords(document: RichDocument): string[] {
  const seen = new Set<string>();

  for (const block of document.blocks) {
    if (!("inlines" in block)) continue;

    for (const inline of block.inlines) {
      if (typeof inline.text !== "string") continue;
      if (containsInlineLinkSyntax(inline.text)) continue;

      const matches = inline.text.match(WORD_PATTERN) ?? [];
      for (const word of matches) {
        seen.add(normalizeWord(word));
        if (seen.size >= 500) {
          return Array.from(seen);
        }
      }
    }
  }

  return Array.from(seen);
}

function transformDocument(
  document: RichDocument,
  options: TextReadingSupportOptions,
  lookupMap: Record<string, LookupResult>,
): RichDocument {
  return {
    ...document,
    blocks: document.blocks.map((block, blockIndex) => {
      if (!("inlines" in block)) return block;

      return {
        ...block,
        inlines: block.inlines.map((inline, inlineIndex) =>
          transformInline(
            inline,
            options,
            lookupMap,
            `reading-${blockIndex}-${inlineIndex}`,
          ),
        ),
      };
    }),
  };
}

function transformInline(
  inline: RichInline,
  options: TextReadingSupportOptions,
  lookupMap: Record<string, LookupResult>,
  keyPrefix: string,
): RichInline {
  if (typeof inline.text !== "string") {
    return inline;
  }

  if (containsInlineLinkSyntax(inline.text)) {
    return inline;
  }

  return {
    ...inline,
    text: renderSupportedText(
      inline.text,
      options,
      lookupMap,
      keyPrefix,
    ),
  } as RichInline;
}

function renderSupportedText(
  text: string,
  options: TextReadingSupportOptions,
  lookupMap: Record<string, LookupResult>,
  keyPrefix: string,
): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  WORD_PATTERN.lastIndex = 0;

  while ((match = WORD_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <React.Fragment key={`${keyPrefix}-plain-${index++}`}>
          {text.slice(lastIndex, match.index)}
        </React.Fragment>,
      );
    }

    const surface = match[0];
    const lookup = lookupMap[normalizeWord(surface)];
    const status = dictionaryStatus(lookup);
    const entry = status === "known" ? lookup.best : null;

    if (!entry && !(options.dictionary && status === "missing")) {
      nodes.push(
        <React.Fragment key={`${keyPrefix}-word-${index++}`}>
          {surface}
        </React.Fragment>,
      );
    } else {
      nodes.push(
        <SupportedWord
          key={`${keyPrefix}-word-${index++}`}
          surface={surface}
          entry={entry}
          options={options}
        />,
      );
    }

    lastIndex = match.index + surface.length;
  }

  if (lastIndex < text.length) {
    nodes.push(
      <React.Fragment key={`${keyPrefix}-tail-${index++}`}>
        {text.slice(lastIndex)}
      </React.Fragment>,
    );
  }

  return nodes;
}

function SupportedWord({
  surface,
  entry,
  options,
}: {
  surface: string;
  entry: LookupEntry | null;
  options: TextReadingSupportOptions;
}) {
  const [open, setOpen] = React.useState(false);
  const backgroundColor = options.eikenLevel ? eikenBackgroundColor(entry?.eikenLevel) : undefined;

  return (
    <span className="relative inline">
      {options.dictionary ? (
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}
          className={`inline border-0 bg-transparent p-0 text-inherit underline underline-offset-4 ${entry ? DICTIONARY_MARK_CLASSES.known : DICTIONARY_MARK_CLASSES.missing} hover:bg-neutral-50`}
          style={{ font: "inherit", backgroundColor }}
          title={options.eikenLevel ? formatEikenLevelJa(entry?.eikenLevel) || undefined : undefined}
        >
          {surface}
        </button>
      ) : (
        <span style={{ backgroundColor }} title={options.eikenLevel ? formatEikenLevelJa(entry?.eikenLevel) || undefined : undefined}>{surface}</span>
      )}

      {open ? (
        <span className="absolute left-0 top-[1.6em] z-50 w-64 rounded-xl border border-neutral-200 bg-white p-3 text-left text-xs font-normal leading-5 text-neutral-700 shadow-xl">
          <span className="block font-semibold text-neutral-900">{surface}</span>
          {entry && entry.lemma.toLowerCase() !== surface.toLowerCase() ? (
            <span className="block text-[10px] text-neutral-400">
              原形: {entry.lemma}
            </span>
          ) : null}
          {entry?.eikenLevel ? (
            <span className="block text-[10px] text-amber-700">
              {formatEikenLevelJa(entry.eikenLevel)}
            </span>
          ) : null}
          <span className="mt-1 block">{entry ? entry.meaningJa : "PARARI辞書には登録されていません。"}</span>
        </span>
      ) : null}
    </span>
  );
}

function normalizeWord(value: string): string {
  return String(value ?? "")
    .replace(/[’‘`]/g, "'")
    .toLowerCase();
}

function containsInlineLinkSyntax(value: string): boolean {
  return (
    value.includes("http://") ||
    value.includes("https://") ||
    /\[[^\]]+\]\([^)]+\)/.test(value) ||
    /\[\[[^\]]+\]\]/.test(value) ||
    value.includes("⟦lk:")
  );
}
