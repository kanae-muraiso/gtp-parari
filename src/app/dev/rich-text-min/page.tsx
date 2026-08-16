// src/app/dev/rich-text-min/page.tsx
// src/app/dev/rich-text-min/page.tsx
// 2026-06-24 JST
// PARARI dev: Lexical 最小入力テスト

"use client";

import { useEffect, useState } from "react";
import {
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_CRITICAL,
  FORMAT_TEXT_COMMAND,
  KEY_ENTER_COMMAND,
  type EditorState,
  type LexicalNode,
} from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

type DebugBlock = {
  index: number;
  type: string;
  text: string;
  children: Array<{
    type: string;
    text: string;
  }>;
};

const initialConfig = {
  namespace: "ParariLexicalMinTest",
  theme: {
    paragraph: "mb-4 last:mb-0",
    text: {
      bold: "font-bold",
      italic: "italic",
    },
  },
  editable: true,
  onError(error: Error) {
    console.error(error);
  },
};

export default function RichTextMinPage() {
  const [debugBlocks, setDebugBlocks] = useState<DebugBlock[]>([]);
  const [ssotText, setSsotText] = useState("");
  const [visibleSsotText, setVisibleSsotText] = useState("");

  const handleChange = (editorState: EditorState) => {
    editorState.read(() => {
      const root = $getRoot();
      const children = root.getChildren();

      const blocks: DebugBlock[] = children.map((node, index) => {
        const childNodes = $isParagraphNode(node) ? node.getChildren() : [];

        return {
          index,
          type: node.getType(),
          text: node.getTextContent(),
          children: childNodes.map((child) => ({
            type: child.getType(),
            text: child.getTextContent(),
          })),
        };
      });

      const exported = exportLexicalToParariSsotText();
      setDebugBlocks(blocks);
      setSsotText(exported);
      setVisibleSsotText(makeNewlinesVisible(exported));
    });
  };

  return (
    <main className="min-h-screen bg-white p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-xl font-bold text-neutral-900">
          Lexical 最小入力テスト
        </h1>

        <div className="rounded-2xl border border-neutral-200 bg-white">
          <LexicalComposer initialConfig={initialConfig}>
            <MiniToolbar />
            <SoftReturnPlugin />

            <div className="relative border-t border-neutral-100">
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    className="min-h-[240px] w-full cursor-text px-4 py-3 text-base leading-8 text-neutral-900 outline-none"
                    spellCheck={false}
                  />
                }
                placeholder={
                  <div className="pointer-events-none absolute left-4 top-3 text-base text-neutral-300">
                    ここに入力できるか確認
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
            </div>

            <HistoryPlugin />
            <OnChangePlugin onChange={handleChange} />
          </LexicalComposer>
        </div>

        <div className="mt-4 rounded-2xl bg-neutral-50 p-4 text-sm leading-7 text-neutral-600">
          <div className="font-bold text-neutral-800">確認項目</div>
          <div>1. 文字入力できる</div>
          <div>2. Bボタンで太字にできる</div>
          <div>3. Iボタンで斜体にできる</div>
          <div>4. Enterで段落改行できる</div>
          <div>5. Shift+Enterでソフトリターンできる</div>
          <div>6. SSOT出力で段落改行とソフトリターンを区別できる</div>
        </div>

        <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="mb-2 text-sm font-bold text-neutral-800">
            SSOT出力
          </div>

          <pre className="min-h-[120px] whitespace-pre-wrap rounded-xl bg-neutral-950 p-3 font-mono text-sm leading-7 text-neutral-100">
            {ssotText || "まだ入力がありません"}
          </pre>

          <div className="mt-3 text-xs leading-6 text-neutral-500">
            Enterは空行を含む段落区切り、Shift+Enterは単一改行として出る想定です。
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="mb-2 text-sm font-bold text-neutral-800">
            改行可視化
          </div>

          <pre className="min-h-[120px] whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 font-mono text-sm leading-7 text-neutral-700">
            {visibleSsotText || "まだ入力がありません"}
          </pre>

          <div className="mt-3 text-xs leading-6 text-neutral-500">
            <div>↵ = 単一改行 / ソフトリターン候補</div>
            <div>¶ = 段落区切り</div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="mb-2 text-sm font-bold text-neutral-800">
            Lexical内部構造
          </div>

          <pre className="max-h-[320px] overflow-auto rounded-xl bg-neutral-950 p-3 text-xs leading-5 text-neutral-100">
            {JSON.stringify(debugBlocks, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}

function MiniToolbar() {
  const [editor] = useLexicalComposerContext();

  const applyFormat = (format: "bold" | "italic") => {
    editor.focus();
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <button
        type="button"
        onMouseDown={(event) => {
          event.preventDefault();
          applyFormat("bold");
        }}
        className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-bold text-neutral-700 hover:bg-neutral-100"
      >
        B
      </button>

      <button
        type="button"
        onMouseDown={(event) => {
          event.preventDefault();
          applyFormat("italic");
        }}
        className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs italic text-neutral-700 hover:bg-neutral-100"
      >
        I
      </button>
    </div>
  );
}

function SoftReturnPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (!event) {
          return false;
        }

        if (!event.shiftKey) {
          return false;
        }

        if (event.isComposing) {
          return false;
        }

        event.preventDefault();

        editor.update(() => {
          const selection = $getSelection();

          if (!$isRangeSelection(selection)) {
            return;
          }

          selection.insertLineBreak();
        });

        return true;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor]);

  return null;
}

function exportLexicalToParariSsotText(): string {
  const root = $getRoot();

  return root
    .getChildren()
    .map((node) => {
      if ($isParagraphNode(node)) {
        return node.getChildren().map(serializeNodeToSsot).join("");
      }

      return node.getTextContent();
    })
    .join("\n\n");
}

function serializeNodeToSsot(node: LexicalNode): string {
  const nodeType = node.getType();

  if (nodeType === "linebreak") {
    return "\n";
  }

  if ($isTextNode(node)) {
    let text = node.getTextContent();

    if (text.length === 0) {
      return "";
    }

    if (node.hasFormat("bold")) {
      text = `**${text}**`;
    }

    if (node.hasFormat("italic")) {
      text = `*${text}*`;
    }

    return text;
  }

  return node.getTextContent();
}

function makeNewlinesVisible(value: string): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/\n\n/g, "\n¶\n")
    .replace(/\n/g, "↵\n");
}
