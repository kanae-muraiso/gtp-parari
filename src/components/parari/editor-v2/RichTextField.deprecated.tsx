// apps/tools/parari/src/components/parari/editor-v2/RichTextField.tsx
// apps/tools/parari/src/components/parari/editor-v2/RichTextField.tsx
// 2026-06-23 JST - RichTextField / コピー&マーカー置換方式のPanelBlock化

"use client";

import {
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  FORMAT_TEXT_COMMAND,
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
import type { PanelizeTag } from "@/lib/parari/ssot-v2/patchBlocks";

export type RichTextPanelizeAction = {
  tag: PanelizeTag;
  label: string;
};

export type RichTextPanelizePayload = {
  tag: PanelizeTag;
  marker: string;
  selected: string;
  markedRaw: string;
};

type RichTextFieldProps = {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
  panelizeActions?: RichTextPanelizeAction[];
  onPanelizeSelection?: (payload: RichTextPanelizePayload) => void;
};

const theme = {
  paragraph: "mb-2 last:mb-0",
  text: {
    bold: "font-bold",
    italic: "italic",
  },
};

export function RichTextField({
  value,
  onChange,
  placeholder = "本文を入力してください",
  minHeightClassName = "min-h-[160px]",
  panelizeActions = [],
  onPanelizeSelection,
}: RichTextFieldProps) {
  const initialValueRef = useRef(value);
  const lastEmittedValueRef = useRef(value);
  const suppressNextChangeRef = useRef(false);

  const initialConfig = useMemo(
    () => ({
      namespace: "ParariRichTextField",
      theme,
      onError(error: Error) {
        console.error(error);
      },
      editorState: () => {
        importMarkdownLikeTextToLexical(initialValueRef.current);
      },
    }),
    []
  );

  const handleChange = (editorState: EditorState) => {
    editorState.read(() => {
      const nextValue = exportLexicalToMarkdownLikeText();

      if (suppressNextChangeRef.current) {
        suppressNextChangeRef.current = false;
        lastEmittedValueRef.current = nextValue;
        return;
      }

      if (nextValue === lastEmittedValueRef.current) {
        return;
      }

      lastEmittedValueRef.current = nextValue;
      onChange(nextValue);
    });
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <LexicalComposer initialConfig={initialConfig}>
        <ExternalValueSyncPlugin
          value={value}
          lastEmittedValueRef={lastEmittedValueRef}
        />

        <RichTextToolbar
          suppressNextChangeRef={suppressNextChangeRef}
          panelizeActions={panelizeActions}
          onPanelizeSelection={onPanelizeSelection}
        />

        <div className="relative border-t border-neutral-100">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className={`${minHeightClassName} w-full resize-y px-3 py-2 text-sm leading-7 text-neutral-900 outline-none`}
                aria-placeholder={placeholder}
                placeholder={
                  <div className="pointer-events-none absolute left-3 top-2 text-sm text-neutral-400">
                    {placeholder}
                  </div>
                }
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />

          <HistoryPlugin />
          <OnChangePlugin onChange={handleChange} />
        </div>
      </LexicalComposer>
    </div>
  );
}

function ExternalValueSyncPlugin({
  value,
  lastEmittedValueRef,
}: {
  value: string;
  lastEmittedValueRef: MutableRefObject<string>;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (value === lastEmittedValueRef.current) {
      return;
    }

    editor.update(() => {
      importMarkdownLikeTextToLexical(value);
    });

    lastEmittedValueRef.current = value;
  }, [editor, value, lastEmittedValueRef]);

  return null;
}

function RichTextToolbar({
  suppressNextChangeRef,
  panelizeActions,
  onPanelizeSelection,
}: {
  suppressNextChangeRef: MutableRefObject<boolean>;
  panelizeActions: RichTextPanelizeAction[];
  onPanelizeSelection?: (payload: RichTextPanelizePayload) => void;
}) {
  const [editor] = useLexicalComposerContext();

  const applyFormat = (format: "bold" | "italic") => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const handlePanelize = (tag: PanelizeTag) => {
    if (!onPanelizeSelection) {
      return;
    }

    let payload: RichTextPanelizePayload | null = null;

    editor.update(() => {
      const selection = $getSelection();

      if (!$isRangeSelection(selection) || selection.isCollapsed()) {
        return;
      }

      const selected = selection.getTextContent();

      if (selected.trim().length === 0) {
        return;
      }

      const marker = createPanelMarker();

      /**
       * 選択部分を一時マーカーへ置換する。
       * その後、Lexical全体をMarkdown風SSOT本文へexportする。
       */
      suppressNextChangeRef.current = true;
      selection.insertText(marker);

      const markedRaw = exportLexicalToMarkdownLikeText();

      payload = {
        tag,
        marker,
        selected,
        markedRaw,
      };
    });

    if (!payload) {
      window.alert("パネル化する範囲を選択してください。");
      return;
    }

    onPanelizeSelection(payload);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1">
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

      {panelizeActions.length > 0 ? (
        <>
          <span className="mx-2 h-5 w-px bg-neutral-200" />

          {panelizeActions.map((item) => (
            <button
              key={item.tag}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                handlePanelize(item.tag);
              }}
              className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] font-bold text-neutral-600 hover:bg-neutral-50"
            >
              {item.label}
            </button>
          ))}
        </>
      ) : null}

      <span className="ml-2 text-[11px] text-neutral-400">
        RichText / 選択部分をPanelBlock化
      </span>
    </div>
  );
}

function createPanelMarker(): string {
  return `@@PARARI_PANEL_MARKER_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}@@`;
}

/**
 * 通常保存用。
 * RichText本文をMarkdown風テキストへ戻す。
 */
function exportLexicalToMarkdownLikeText(): string {
  const root = $getRoot();

  return root
    .getChildren()
    .map((node) => {
      if ($isParagraphNode(node)) {
        return node.getChildren().map(serializeNode).join("");
      }

      return node.getTextContent();
    })
    .join("\n");
}

function serializeNode(node: LexicalNode): string {
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

function importMarkdownLikeTextToLexical(value: string) {
  const root = $getRoot();
  root.clear();

  const normalized = value.replace(/\r\n/g, "\n");
  const lines = normalized.length > 0 ? normalized.split("\n") : [""];

  for (const line of lines) {
    const paragraph = $createParagraphNode();

    for (const part of parseInlineMarkdownLikeText(line)) {
      const textNode = $createTextNode(part.text);

      if (part.bold) {
        textNode.toggleFormat("bold");
      }

      if (part.italic) {
        textNode.toggleFormat("italic");
      }

      paragraph.append(textNode);
    }

    root.append(paragraph);
  }
}

type InlinePart = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

function parseInlineMarkdownLikeText(line: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        text: line.slice(lastIndex, match.index),
      });
    }

    const token = match[0];

    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push({
        text: token.slice(2, -2),
        bold: true,
      });
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push({
        text: token.slice(1, -1),
        italic: true,
      });
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) {
    parts.push({
      text: line.slice(lastIndex),
    });
  }

  if (parts.length === 0) {
    parts.push({
      text: "",
    });
  }

  return parts;
}
