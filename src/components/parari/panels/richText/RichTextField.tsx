// src/components/parari/panels/richText/RichTextField.tsx
// src/components/parari/panels/richText/RichTextField.tsx
// 2026-06-24 JST
// PARARI RichTextPanel: RichTextField / SSOT入出力・段落・soft return対応版

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isParagraphNode,
  $isRangeSelection,
  $setSelection,
  $isTextNode,
  COMMAND_PRIORITY_CRITICAL,
  FORMAT_TEXT_COMMAND,
  KEY_ENTER_COMMAND,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
  type ElementNode,
} from "lexical";

import {
  $createLinkNode,
  $isLinkNode,
  LinkNode,
  TOGGLE_LINK_COMMAND,
} from "@lexical/link";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { PanelizeTag } from "@/lib/parari/ssot-v2/patchBlocks";

import {
  RichTextInlineInsertMenu,
  type RichTextInlineMenuAction,
} from "./RichTextInlineInsertMenu";

// PART: RichText装飾 import追加

import {
  $createHeadingNode,
  $isHeadingNode,
  HeadingNode,
} from "@lexical/rich-text";
import {
  $patchStyleText,
  $setBlocksType,
} from "@lexical/selection";

import {
  checkParariEnglishDictionaryWord,
} from "@/lib/parari/english/basicWordGlossary";

type DictionaryLookupState =
  | {
      kind: "result";
      result: ReturnType<typeof checkParariEnglishDictionaryWord>;
    }
  | {
      kind: "message";
      message: string;
    };

const PARARI_DICTIONARY_HIGHLIGHT_NAME =
  "parari-dictionary-editor";

const PARARI_ENGLISH_WORD_PATTERN =
  /[A-Za-z]+(?:[’'][A-Za-z]+)*/g;

type CssHighlightRegistry = {
  set: (name: string, highlight: unknown) => void;
  delete: (name: string) => boolean;
};

type HighlightConstructor = new (
  ...ranges: Range[]
) => unknown;

function getCssHighlightRegistry():
  | CssHighlightRegistry
  | null {
  if (typeof CSS === "undefined") {
    return null;
  }

  return (
    (
      CSS as unknown as {
        highlights?: CssHighlightRegistry;
      }
    ).highlights ?? null
  );
}

function rebuildParariDictionaryHighlights() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return;
  }

  const registry = getCssHighlightRegistry();

  const HighlightCtor = (
    window as unknown as {
      Highlight?: HighlightConstructor;
    }
  ).Highlight;

  if (!registry || !HighlightCtor) {
    return;
  }

  const ranges: Range[] = [];

  const roots =
    document.querySelectorAll<HTMLElement>(
      '[data-parari-rich-text-dictionary-root="true"]',
    );

  roots.forEach((root) => {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
    );

    let currentNode = walker.nextNode();

    while (currentNode) {
      const textNode = currentNode as Text;
      const text = textNode.data;

      PARARI_ENGLISH_WORD_PATTERN.lastIndex = 0;

      let match: RegExpExecArray | null;

      while (
        (match =
          PARARI_ENGLISH_WORD_PATTERN.exec(text)) !==
        null
      ) {
        const word = match[0];

        const dictionaryResult =
          checkParariEnglishDictionaryWord(word);

        if (
          dictionaryResult.visibleInStandard
        ) {
          const range = document.createRange();

          range.setStart(
            textNode,
            match.index,
          );

          range.setEnd(
            textNode,
            match.index + word.length,
          );

          ranges.push(range);
        }
      }

      currentNode = walker.nextNode();
    }
  });

  if (ranges.length === 0) {
    registry.delete(
      PARARI_DICTIONARY_HIGHLIGHT_NAME,
    );
    return;
  }

  registry.set(
    PARARI_DICTIONARY_HIGHLIGHT_NAME,
    new HighlightCtor(...ranges),
  );
}

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
  showDebugLabel?: boolean;
};

const PARARI_NOTE_URL_PREFIX = "parari-note:";
const RED_COLOR = "#dc2626";

const theme = {
  paragraph: "mb-4 last:mb-0",
      heading: {
        h2: "mb-3 mt-6 text-[24px] font-semibold leading-[1.45] text-neutral-900",
        h3: "mb-2 mt-5 text-[19px] font-semibold leading-[1.55] text-neutral-900",
      },
  text: {
    bold: "font-bold",
    italic: "italic",
  },
  link: "text-blue-600 underline underline-offset-4 hover:text-blue-800",
};

export function RichTextField({
  value,
  onChange,
  placeholder = "ここから本文",
  minHeightClassName = "min-h-[260px]",
  panelizeActions = [],
  onPanelizeSelection,
  showDebugLabel = false,
}: RichTextFieldProps) {
  const initialValueRef = useRef(value);
  const lastEmittedValueRef = useRef(value);
  const suppressNextChangeRef = useRef(false);
  const isRichTextEditingRef = useRef(false);
    // src/components/parari/panels/richText/RichTextField.tsx
    // 2026-06-29 22:45 JST
    // PART: RichText editor shell ref
    // コメント:
    // - 横フローティングメニューの位置計算に使うeditor shell ref

      const editorShellRef = useRef<HTMLDivElement | null>(null);
    const [richTextActive, setRichTextActive] = useState(false);
    
    const [dictionaryUnderlineEnabled, setDictionaryUnderlineEnabled] =
      useState(false);

    const initialConfig = useMemo(
      () => ({
        namespace: "ParariRichTextPanel",
        theme,
        nodes: [LinkNode, HeadingNode],
        editable: true,
        onError(error: Error) {
          console.error(error);
        },
        editorState: () => {
          importParariSsotTextToLexical(initialValueRef.current);
        },
      }),
      [],
    );

    const handleChange = (editorState: EditorState) => {
      editorState.read(() => {
        const nextValue = removeParariPanelMarkers(
          exportLexicalToParariSsotText(),
        );

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
      <div ref={editorShellRef} className="rounded-xl border border-neutral-200 bg-white">
            <style>{`
              ::highlight(parari-dictionary-editor) {
                text-decoration-line: underline;
                text-decoration-style: solid;
                text-decoration-color: #d97706;
                text-decoration-thickness: 2px;
                text-underline-offset: 3px;
              }
            `}</style>
            <LexicalComposer initialConfig={initialConfig}>
              <ForceEditablePlugin />
              <SoftReturnPlugin />
            <DictionaryUnderlinePlugin
              enabled={dictionaryUnderlineEnabled}
            />
          <LinkPlugin />

          <ExternalValueSyncPlugin
            value={value}
            lastEmittedValueRef={lastEmittedValueRef}
            isRichTextEditingRef={isRichTextEditingRef}
          />

            <RichTextToolbar
              visible={richTextActive}
              suppressNextChangeRef={suppressNextChangeRef}
              panelizeActions={panelizeActions}
              onPanelizeSelection={onPanelizeSelection}
              showDebugLabel={showDebugLabel}
              editorShellRef={editorShellRef}
              dictionaryUnderlineEnabled={dictionaryUnderlineEnabled}
              onToggleDictionaryUnderline={() =>
                setDictionaryUnderlineEnabled((current) => !current)
              }
            />
            
        <div className="relative border-t border-neutral-100">
          <RichTextPlugin
            contentEditable={
                <ContentEditable
                  data-parari-rich-text-dictionary-root={
                    dictionaryUnderlineEnabled ? "true" : undefined
                  }
                  className={`${minHeightClassName} w-full cursor-text px-3 py-2 text-sm leading-7 text-neutral-900 outline-none`}
                  spellCheck={false}
                  aria-placeholder={placeholder}
                  placeholder={
                    <div className="pointer-events-none absolute left-3 top-2 text-sm text-neutral-400">
                      {placeholder}
                    </div>
                  }
                  onFocus={() => {
                    isRichTextEditingRef.current = true;
                    setRichTextActive(true);
                  }}
                  onBlur={() => {
                    window.setTimeout(() => {
                      isRichTextEditingRef.current = false;
                      setRichTextActive(false);
                    }, 120);
                  }}
                />
            }
            placeholder={null}
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>

        <HistoryPlugin />
        <OnChangePlugin onChange={handleChange} />
      </LexicalComposer>
    </div>
  );
}

function ForceEditablePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.setEditable(true);
  }, [editor]);

  return null;
}

                 function DictionaryUnderlinePlugin({
                   enabled,
                 }: {
                   enabled: boolean;
                 }) {
                   const [editor] = useLexicalComposerContext();

                   useEffect(() => {
                     let timerId: number | null = null;

                     const scheduleRebuild = () => {
                       if (timerId !== null) {
                         window.clearTimeout(timerId);
                       }

                       timerId = window.setTimeout(() => {
                         rebuildParariDictionaryHighlights();
                         timerId = null;
                       }, 120);
                     };

                     // ON/OFF切替直後にも再構築
                     scheduleRebuild();

                     if (!enabled) {
                       return () => {
                         if (timerId !== null) {
                           window.clearTimeout(timerId);
                         }

                         window.setTimeout(() => {
                           rebuildParariDictionaryHighlights();
                         }, 0);
                       };
                     }

                     const unregister =
                       editor.registerUpdateListener(() => {
                         scheduleRebuild();
                       });

                     return () => {
                       unregister();

                       if (timerId !== null) {
                         window.clearTimeout(timerId);
                       }

                       window.setTimeout(() => {
                         rebuildParariDictionaryHighlights();
                       }, 0);
                     };
                   }, [editor, enabled]);

                   return null;
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

function ExternalValueSyncPlugin({
  value,
  lastEmittedValueRef,
  isRichTextEditingRef,
}: {
  value: string;
  lastEmittedValueRef: MutableRefObject<string>;
  isRichTextEditingRef: MutableRefObject<boolean>;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // 入力中に外部valueでLexicalを再同期すると、カーソルが文頭へ戻ることがある。
    if (isRichTextEditingRef.current) {
      return;
    }

    if (value === lastEmittedValueRef.current) {
      return;
    }

    editor.update(() => {
      importParariSsotTextToLexical(value);
    });

    lastEmittedValueRef.current = value;
  }, [editor, value, lastEmittedValueRef, isRichTextEditingRef]);

  return null;
}

function RichTextToolbar({
  visible,
  suppressNextChangeRef,
  panelizeActions,
  onPanelizeSelection,
  showDebugLabel,
  editorShellRef,
      dictionaryUnderlineEnabled,
      onToggleDictionaryUnderline,
}: {
  visible: boolean;
  suppressNextChangeRef: MutableRefObject<boolean>;
  panelizeActions: RichTextPanelizeAction[];
  onPanelizeSelection?: (payload: RichTextPanelizePayload) => void;
  showDebugLabel: boolean;
  editorShellRef: MutableRefObject<HTMLDivElement | null>;
    dictionaryUnderlineEnabled: boolean;
    onToggleDictionaryUnderline: () => void;
}) {
  const [editor] = useLexicalComposerContext();

  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

    const updateMenuPosition = useCallback(() => {
        const selection = window.getSelection();
        
        if (!selection || selection.rangeCount === 0) {
            return;
        }
        
        const range = selection.getRangeAt(0);
        const rect =
        range.getClientRects()[0] ??
        range.getBoundingClientRect();
        
        if (!rect) {
            return;
        }
        
        // src/components/parari/panels/richText/RichTextField.tsx
        // 2026-06-29 22:45 JST
        // PART: Put inline menu above cursor
        // コメント:
        // - 横フローティングメニューをカーソル行の上に出す
        // - 画面端では左右にはみ出さないように補正する
        // - 本文操作と重なりにくい位置へ逃がす
        
        const shellRect = editorShellRef.current?.getBoundingClientRect();

        const viewportPadding = 12;
        const rawLeft = rect.left + rect.width / 2;

        let minLeft = viewportPadding;
        let maxLeft = window.innerWidth - viewportPadding;

        if (shellRect) {
          minLeft = Math.max(shellRect.left + viewportPadding, minLeft);
          maxLeft = Math.min(shellRect.right - viewportPadding, maxLeft);
        }

        const safeLeft = Math.min(Math.max(rawLeft, minLeft), maxLeft);

        // 横メニューはカーソル行の上に出す。
        // 画面上端に近すぎる場合だけ最低位置を確保する。
        const safeTop = Math.max(rect.top, 72);

        setMenuPosition({
          left: safeLeft,
          top: safeTop,
        });
    }, [editorShellRef]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const update = () => {
      window.requestAnimationFrame(updateMenuPosition);
    };

    update();

    document.addEventListener("selectionchange", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);

    return () => {
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [visible, updateMenuPosition]);
    
    const [dictionaryLookup, setDictionaryLookup] =
      useState<DictionaryLookupState | null>(null);
    
    const textActions: RichTextInlineMenuAction[] = [
      { kind: "block", block: "h2", label: "h2", title: "見出し H2" },
      { kind: "block", block: "h3", label: "h3", title: "見出し H3" },
      { kind: "block", block: "plain", label: "plain", title: "標準" },
      { kind: "format", format: "bold", label: "B", title: "太字" },
      { kind: "format", format: "red", label: "赤", title: "赤字" },
      { kind: "divider", label: "―", title: "区切り線" },
      {
        kind: "panel",
        tag: "IMAGE",
        label: "画像",
        title: "画像を挿入",
      },
      {
        kind: "link",
        label: "リンク",
        title: "リンク / 注釈",
      },
      {
        kind: "dictionary",
        label: "辞書",
        title: "選択した英単語をPARARI辞書で確認",
      },
    ];

  const panelActions: RichTextInlineMenuAction[] = panelizeActions.map(
    (item) => ({
      kind: "panel" as const,
      tag: item.tag,
      label: item.label,
      title: item.label,
    }),
  );

  const applyFormat = (format: "bold" | "italic") => {
    editor.focus();
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

    const applyBlockKind = (kind: "h2" | "h3" | "plain") => {
      editor.focus();

      editor.update(() => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return;
        }

        if (kind === "h2" || kind === "h3") {
          const selectedText = selection
            .getTextContent()
            .replace(/\r\n/g, "\n")
            .trim();

          if (selectedText.length > 0) {
            const headingNode = $createHeadingNode(kind);

            selectedText.split("\n").forEach((line, index) => {
              if (index > 0) {
                headingNode.append($createLineBreakNode());
              }

              headingNode.append($createTextNode(line));
            });

            const nextParagraphNode = $createParagraphNode();

            // 選択範囲だけを独立した見出しブロックにし、
            // 直後に本文用のplain段落を作る。
            $insertNodes([headingNode, nextParagraphNode]);
            nextParagraphNode.selectStart();
            return;
          }

          $setBlocksType(selection, () => $createHeadingNode(kind));
          return;
        }

        $setBlocksType(selection, () => $createParagraphNode());
      });
    };


    const toggleRed = () => {
      editor.focus();

      editor.update(() => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return;
        }

        const makeRed = !isSelectionRed();

        $patchStyleText(selection, {
          color: makeRed ? RED_COLOR : null,
          "font-weight": null,
        });
      });
    };

    const isSelectionRed = (): boolean => {
      const selection = $getSelection();

      if (!$isRangeSelection(selection)) {
        return false;
      }

      return selection.getNodes().some((node) => {
        if (!$isTextNode(node)) {
          return false;
        }

        return isRedTextNode(node);
      });
    };
    
    const handleDictionaryLookup = () => {
      let selectedText = "";

      editor.getEditorState().read(() => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return;
        }

        selectedText = selection.getTextContent().trim();
      });

      if (!selectedText) {
        setDictionaryLookup({
          kind: "message",
          message: "確認したい英単語を選択してください。",
        });
        return;
      }

      const normalized = selectedText
        .replace(/[’]/g, "'")
        .trim();

      const match = normalized.match(
        /^[^A-Za-z]*([A-Za-z]+(?:'[A-Za-z]+)*)[^A-Za-z]*$/,
      );

      if (!match) {
        setDictionaryLookup({
          kind: "message",
          message: "第1段階では英単語を1語だけ選択してください。",
        });
        return;
      }

      setDictionaryLookup({
        kind: "result",
        result: checkParariEnglishDictionaryWord(match[1]),
      });
    };
    
  const handlePanelize = (tag: PanelizeTag) => {
    if (!onPanelizeSelection) {
      return;
    }

    let payload: RichTextPanelizePayload | null = null;

    editor.update(() => {
      const selection = $getSelection();

      if (!$isRangeSelection(selection)) {
        return;
      }

      // カーソル位置が取れていない状態で marker を入れると、
      // 本文先頭へ挿入されて文章が壊れることがある。
      if (!selection.anchor || !selection.focus) {
        return;
      }

      const selected = selection.getTextContent();
      const marker = createPanelMarker();

      suppressNextChangeRef.current = true;

      // 選択範囲があれば選択範囲をmarkerに置換。
      // 選択範囲がなくカーソルだけなら、その位置にmarkerを挿入。
      selection.insertText(marker);

      const markedRaw = exportLexicalToParariSsotText();

      // export用に一時挿入したmarkerは、Lexical本文から即座に取り除く。
      // ここを消さないと @@PARARI_PANEL_MARKER... が本文へ漏れたり、
      // 以後の入力位置が壊れることがある。
      replacePanelMarkerInCurrentEditorState(marker, selected);

      payload = {
        tag,
        marker,
        selected,
        markedRaw,
      };
    });

    if (!payload) {
      window.alert("本文内の挿入位置を選んでください。");
      return;
    }

    onPanelizeSelection(payload);
  };

  const handleAction = (action: RichTextInlineMenuAction) => {
    // ここで先に editor.focus() すると、Lexical の選択位置が先頭へ戻ることがある。
    // パネル挿入・リンク操作では現在のカーソル位置を守るため、各処理側に任せる。

      if (action.kind === "format") {
        if (action.format === "bold") {
          applyFormat("bold");
          return;
        }

        if (action.format === "red") {
          toggleRed();
          return;
        }

        return;
      }

      if (action.kind === "block") {
        if (
          action.block === "h2" ||
          action.block === "h3" ||
          action.block === "plain"
        ) {
          applyBlockKind(action.block);
        }

        return;
      }

      if (action.kind === "dictionary") {
        handleDictionaryLookup();
        return;
      }
      
    if (action.kind === "divider") {
      window.alert("区切り線は次の段階で既存仕様に接続します。");
      return;
    }

      if (action.kind === "linkExternal") {
        applyExternalLink(editor);
        return;
      }

      if (action.kind === "linkNote") {
        applyNoteLink(editor);
        return;
      }

      if (action.kind === "linkRemove") {
        clearInlineLink(editor);
        return;
      }
      
    if (action.kind === "panel") {
      handlePanelize(action.tag);
    }
  };

  return (
    <>
          <RichTextInlineInsertMenu
            visible={visible}
            textActions={textActions}
            panelActions={panelActions}
            position={menuPosition}
            onSelect={handleAction}
            dictionaryUnderlineEnabled={dictionaryUnderlineEnabled}
            onToggleDictionaryUnderline={onToggleDictionaryUnderline}
          />
          
          {dictionaryLookup ? (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-neutral-700">
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-amber-800">
                  PARARI辞書
                </div>

                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setDictionaryLookup(null)}
                  className="text-neutral-400 hover:text-neutral-700"
                  aria-label="辞書確認を閉じる"
                >
                  ×
                </button>
              </div>

              {dictionaryLookup.kind === "message" ? (
                <div className="mt-1">
                  {dictionaryLookup.message}
                </div>
              ) : dictionaryLookup.result.entry ? (
                <div className="mt-1 space-y-1">
                  <div className="text-sm font-semibold text-neutral-900">
                    {dictionaryLookup.result.word}
                  </div>

                  <div>
                    {dictionaryLookup.result.meaning}
                  </div>

                  <div className="text-neutral-500">
                    lemma: {dictionaryLookup.result.entry.lemma}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      標準：
                      {dictionaryLookup.result.visibleInStandard
                        ? "● 表示されます"
                        : "― 表示されません"}
                    </span>

                    <span>
                      学習：
                      {dictionaryLookup.result.visibleInStudy
                        ? "● 表示されます"
                        : "― 表示されません"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-1">
                  <div className="font-semibold text-neutral-900">
                    {dictionaryLookup.result.word}
                  </div>
                  <div className="mt-1">
                    PARARI辞書には登録されていません。
                  </div>
                </div>
              )}
            </div>
          ) : null}
          
      {showDebugLabel && visible ? (
        <div className="fixed bottom-3 left-3 z-40 rounded-full bg-white/90 px-2 py-1 text-[10px] text-neutral-400 shadow-sm">
          RichTextPanel
        </div>
      ) : null}
    </>
  );
}

function applyExternalLink(editor: LexicalEditor) {
  const existing = getSelectedLinkUrl(editor);
  const existingUrl =
    existing && !existing.startsWith(PARARI_NOTE_URL_PREFIX) ? existing : "";

  if (!existing && !hasSelectedText(editor)) {
    window.alert("リンクにする文字を選択してください。");
    return;
  }

  const nextUrl = window.prompt("リンク先URLを入力してください", existingUrl);

  if (nextUrl === null) {
    return;
  }

  const sanitized = sanitizeUrl(nextUrl);

  if (!sanitized) {
    window.alert("無効なURLです。http / https のURLを入力してください。");
    return;
  }

  editor.dispatchCommand(TOGGLE_LINK_COMMAND, sanitized);
}

function applyNoteLink(editor: LexicalEditor) {
  const existing = getSelectedLinkUrl(editor);
  const existingNote =
    existing && existing.startsWith(PARARI_NOTE_URL_PREFIX)
      ? decodeURIComponent(existing.slice(PARARI_NOTE_URL_PREFIX.length))
      : "";

  if (!existing && !hasSelectedText(editor)) {
    window.alert("注釈を付ける文字を選択してください。");
    return;
  }

  const nextNote = window.prompt("注釈本文を入力してください", existingNote);

  if (nextNote === null) {
    return;
  }

  const trimmedNote = nextNote.trim();

  if (!trimmedNote) {
    window.alert("注釈本文が空です。");
    return;
  }

  editor.dispatchCommand(
    TOGGLE_LINK_COMMAND,
    `${PARARI_NOTE_URL_PREFIX}${encodeURIComponent(trimmedNote)}`,
  );
}

function clearInlineLink(editor: LexicalEditor) {
  const existing = getSelectedLinkUrl(editor);

  if (!existing) {
    window.alert("解除するリンクまたは注釈を選択してください。");
    return;
  }

  editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
}



function replacePanelMarkerInCurrentEditorState(
  marker: string,
  originalText: string,
): void {
  const root = $getRoot();
  const textNodes = root.getAllTextNodes();

  for (const node of textNodes) {
    const text = node.getTextContent();
    const markerIndex = text.indexOf(marker);

    if (markerIndex < 0) {
      continue;
    }

    const before = text.slice(0, markerIndex);
    const after = text.slice(markerIndex + marker.length);

    node.setTextContent(`${before}${originalText}${after}`);
    return;
  }
}


function removeParariPanelMarkers(value: string): string {
  return String(value ?? "").replace(
    /@@PARARI_PANEL_MARKER_\d+_[A-Za-z0-9_-]+@@/g,
    "",
  );
}


function sanitizeUrl(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function hasSelectedText(editor: LexicalEditor): boolean {
  let hasText = false;

  editor.getEditorState().read(() => {
    const selection = $getSelection();

    if (!$isRangeSelection(selection)) {
      return;
    }

    hasText = selection.getTextContent().trim().length > 0;
  });

  return hasText;
}

function getSelectedLinkUrl(editor: LexicalEditor): string | null {
  let url: string | null = null;

  editor.getEditorState().read(() => {
    const selection = $getSelection();

    if (!$isRangeSelection(selection)) {
      return;
    }

    const nodes = selection.getNodes();

    for (const node of nodes) {
      const linkNode = getNearestLinkNode(node);

      if (linkNode) {
        url = linkNode.getURL();
        return;
      }
    }

    const anchorLinkNode = getNearestLinkNode(selection.anchor.getNode());

    if (anchorLinkNode) {
      url = anchorLinkNode.getURL();
    }
  });

  return url;
}

function getNearestLinkNode(node: LexicalNode) {
  let current: LexicalNode | null = node;

  while (current) {
    if ($isLinkNode(current)) {
      return current;
    }

    current = current.getParent();
  }

  return null;
}


function clearNativeSelection() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.getSelection()?.removeAllRanges();
  } catch {
    // stale DOM selection は無視する
  }
}

function createPanelMarker(): string {
  return `@@PARARI_PANEL_MARKER_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}@@`;
}

function exportLexicalToParariSsotText(): string {
  const root = $getRoot();

    const paragraphs = root.getChildren().map((node) => {
      if ($isHeadingNode(node)) {
        const content = node.getChildren().map(serializeNodeToSsot).join("");

        if (node.getTag() === "h2") {
          return `## ${content}`;
        }

        if (node.getTag() === "h3") {
          return `### ${content}`;
        }

        return content;
      }

      if ($isParagraphNode(node)) {
        return node.getChildren().map(serializeNodeToSsot).join("");
      }

      return node.getTextContent();
    });

  if (paragraphs.length === 1 && paragraphs[0] === "") {
    return "";
  }

  return paragraphs.join("\n\n");
}

function serializeNodeToSsot(node: LexicalNode): string {
  const nodeType = node.getType();

  if (nodeType === "linebreak") {
    return "\n";
  }

    if ($isLinkNode(node)) {
      const label = node.getTextContent();
      const url = node.getURL();

      if (url.startsWith(PARARI_NOTE_URL_PREFIX)) {
        const note = decodeURIComponent(url.slice(PARARI_NOTE_URL_PREFIX.length));
        return `[[${label}]]{${note}}`;
      }

      return `[[${label}]](${url})`;
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

      if (isRedTextNode(node)) {
        text = `!!${text}!!`;
      }

      return text;
    }

  return node.getTextContent();
}

function importParariSsotTextToLexical(value: string) {
  const root = $getRoot();
  root.clear();

  const normalized = value.replace(/\r\n/g, "\n");

  if (normalized.length === 0) {
    root.append($createParagraphNode());
    return;
  }

  const paragraphs = normalized.split(/\n{2,}/);

    for (const paragraphText of paragraphs) {
      const headingMatch = paragraphText.match(/^(#{2,3})\s+(.+)$/);

      const paragraph =
        headingMatch?.[1] === "##"
          ? $createHeadingNode("h2")
          : headingMatch?.[1] === "###"
            ? $createHeadingNode("h3")
            : $createParagraphNode();

      const bodyText = headingMatch ? headingMatch[2] : paragraphText;
      const softLines = bodyText.split("\n");

      softLines.forEach((line, index) => {
        if (index > 0) {
          paragraph.append($createLineBreakNode());
        }

        appendInlineMarkdownLikeText(paragraph, line);
      });

      root.append(paragraph);
    }

  if (root.getChildrenSize() === 0) {
    root.append($createParagraphNode());
  }
}

function appendInlineMarkdownLikeText(
  paragraph: ElementNode,
  line: string,
) {
  const parts = parseInlineMarkdownLikeText(line);

  for (const part of parts) {
    const textNode = $createTextNode(part.text);

    if (part.bold) {
      textNode.toggleFormat("bold");
    }

      if (part.red) {
        textNode.setStyle(`color: ${RED_COLOR};`);
      }
      
    if (part.italic) {
      textNode.toggleFormat("italic");
    }

    if (part.linkUrl) {
      const linkNode = $createLinkNode(part.linkUrl);
      linkNode.append(textNode);
      paragraph.append(linkNode);
      continue;
    }

    paragraph.append(textNode);
  }
}

type InlinePart = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  red?: boolean;
  linkUrl?: string;
};

function parseInlineMarkdownLikeText(line: string): InlinePart[] {
  const parts: InlinePart[] = [];
    const pattern =
      /(\[\[[^\]]+\]\]\([^)]+\)|\[\[[^\]]+\]\]\{[^}]+\}|!![^!]+!!|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        text: line.slice(lastIndex, match.index),
      });
    }

    const token = match[0];

    const externalLinkMatch = token.match(/^\[\[([^\]]+)\]\]\(([^)]+)\)$/);
    if (externalLinkMatch) {
      parts.push({
        text: externalLinkMatch[1],
        linkUrl: externalLinkMatch[2],
      });
      lastIndex = match.index + token.length;
      continue;
    }

    const noteLinkMatch = token.match(/^\[\[([^\]]+)\]\]\{([^}]+)\}$/);
    if (noteLinkMatch) {
      parts.push({
        text: noteLinkMatch[1],
        linkUrl: `${PARARI_NOTE_URL_PREFIX}${encodeURIComponent(
          noteLinkMatch[2],
        )}`,
      });
      lastIndex = match.index + token.length;
      continue;
    }

      if (token.startsWith("!!") && token.endsWith("!!")) {
        parts.push({
          text: token.slice(2, -2),
          red: true,
        });
        lastIndex = match.index + token.length;
        continue;
      }
      
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

  return parts;
}

function isRedTextNode(node: LexicalNode): boolean {
  if (!$isTextNode(node)) {
    return false;
  }

  const style = node.getStyle();

  return (
    style.includes(RED_COLOR) ||
    style.includes("rgb(220, 38, 38)") ||
    style.includes("color: red")
  );
}
