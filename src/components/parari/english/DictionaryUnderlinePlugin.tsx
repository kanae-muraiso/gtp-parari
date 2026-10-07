// 2026-10-07 JST — Display-only highlights from the real dictionary; never alter Lexical/SSOT.
"use client";

import { useEffect, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEnglishAuthoring } from "./EnglishAuthoringProvider";
import { dictionaryStatus, normalizeEnglishWord, type DictionaryResults } from "@/lib/parari/english/dictionary";
import { EIKEN_BACKGROUNDS } from "@/lib/parari/english/eikenBackground";

const KNOWN_NAME = "parari-dictionary-known";
const MISSING_NAME = "parari-dictionary-missing";
const WORDS = /[A-Za-z]+(?:[’'][A-Za-z]+)*/g;
const COLOR_NAMES = EIKEN_BACKGROUNDS.map(item => `parari-eiken-${item.level}`);
const roots = new Map<HTMLElement, { results: DictionaryResults; underline: boolean; colors: boolean }>();

function rebuild() {
  const registry = (globalThis.CSS as unknown as { highlights?: Map<string, unknown> } | undefined)?.highlights;
  const Highlight = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  if (!registry || !Highlight) return false;
  const ranges = new Map<string, Range[]>([KNOWN_NAME, MISSING_NAME, ...COLOR_NAMES].map(name => [name, []]));
  for (const [root, { results, underline, colors }] of roots) {
    if (!root.isConnected) continue;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest("a")) continue;
      for (const match of (node.textContent ?? "").matchAll(WORDS)) {
        const result = results[normalizeEnglishWord(match[0])];
        const status = dictionaryStatus(result);
        if (status === "unchecked") continue;
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        if (underline) ranges.get(status === "known" ? KNOWN_NAME : MISSING_NAME)!.push(range);
        if (colors && status === "known") ranges.get(`parari-eiken-${result.best?.eikenLevel}`)?.push(range);
      }
    }
  }
  for (const [name, wordRanges] of ranges) {
    if (wordRanges.length) registry.set(name, new Highlight(...wordRanges));
    else registry.delete(name);
  }
  return true;
}

export default function DictionaryUnderlinePlugin({ enabled, colorEnabled = false }: { enabled: boolean; colorEnabled?: boolean }) {
  const [editor] = useLexicalComposerContext();
  const support = useEnglishAuthoring();
  const lookup = support?.lookupWords;
  const active = (enabled || colorEnabled) && support?.enabled;
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    if (!active || !lookup) return;
    if (!rebuild()) {
      setError("このブラウザーは編集中の下線・色分けに対応していません。色分けは「完了」後に確認できます。単語のクリックや選択語の辞書確認は利用できます。");
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let currentRoot: HTMLElement | null = null;
    const schedule = () => {
      clearTimeout(timer);
      controller?.abort();
      // Clear stale marks as soon as text changes; never label an unchecked word as missing.
      if (currentRoot) roots.delete(currentRoot);
      rebuild();
      timer = setTimeout(async () => {
        const root = editor.getRootElement();
        if (!root) return;
        if (currentRoot && currentRoot !== root) roots.delete(currentRoot);
        currentRoot = root;
        const words = [...new Set((root.textContent?.match(WORDS) ?? []).map(normalizeEnglishWord))].slice(0, 500);
        const request = new AbortController();
        controller = request;
        try {
          const results = words.length ? await lookup(words, request.signal) : {};
          if (request.signal.aborted) return;
          roots.set(root, { results, underline: enabled, colors: colorEnabled });
          rebuild();
          setError("");
        } catch {
          if (request.signal.aborted) return;
          roots.delete(root);
          rebuild();
          setError("辞書の表示を取得できませんでした。本文を編集するか、表示をOFFにしてから再度ONにしてください。");
        }
      }, 250);
    };
    schedule();
    const unregister = editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      if (dirtyElements.size || dirtyLeaves.size) schedule();
    });
    return () => {
      clearTimeout(timer);
      controller?.abort();
      unregister();
      if (currentRoot) roots.delete(currentRoot);
      rebuild();
    };
  }, [active, enabled, colorEnabled, editor, lookup]);

  return active && error ? <p role="status" className="px-3 py-2 text-xs text-amber-800">{error}</p> : null;
}
