// 2026-10-07 JST — Display-only highlights from the real dictionary; never alter Lexical/SSOT.
"use client";

import { useEffect, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEnglishAuthoring } from "./EnglishAuthoringProvider";
import { normalizeEnglishWord } from "@/lib/parari/english/dictionary";

const NAME = "parari-dictionary-editor";
const WORDS = /[A-Za-z]+(?:[’'][A-Za-z]+)*/g;
const roots = new Map<HTMLElement, Set<string>>();

function rebuild() {
  const registry = (globalThis.CSS as unknown as { highlights?: Map<string, unknown> } | undefined)?.highlights;
  const Highlight = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  if (!registry || !Highlight) return false;
  const ranges: Range[] = [];
  for (const [root, known] of roots) {
    if (!root.isConnected) continue;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest("a")) continue;
      for (const match of (node.textContent ?? "").matchAll(WORDS)) {
        if (!known.has(normalizeEnglishWord(match[0]))) continue;
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        ranges.push(range);
      }
    }
  }
  if (ranges.length) registry.set(NAME, new Highlight(...ranges));
  else registry.delete(NAME);
  return true;
}

export default function DictionaryUnderlinePlugin({ enabled }: { enabled: boolean }) {
  const [editor] = useLexicalComposerContext();
  const support = useEnglishAuthoring();
  const lookup = support?.lookupWords;
  const active = enabled && support?.enabled;
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    if (!active || !lookup) return;
    if (!rebuild()) {
      setError("このブラウザーは辞書の下線表示に対応していません。選択語の辞書確認は利用できます。");
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let currentRoot: HTMLElement | null = null;
    const schedule = () => {
      clearTimeout(timer);
      controller?.abort();
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
          roots.set(root, new Set(Object.entries(results).filter(([, result]) => result.found && result.best).map(([word]) => word)));
          rebuild();
          setError("");
        } catch {
          if (request.signal.aborted) return;
          roots.delete(root);
          rebuild();
          setError("辞書の下線を取得できませんでした。OFFにしてから再度ONにしてください。");
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
  }, [active, editor, lookup]);

  return active && error ? <p role="status" className="px-3 py-2 text-xs text-amber-800">{error}</p> : null;
}
