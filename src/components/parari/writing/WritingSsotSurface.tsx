"use client";

import React from "react";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";
import { parseMarkdownForParari } from "@/lib/parari/markdown/parseMarkdownForParari";
import type { SsotBlock } from "@/lib/parari/ssot-v2/panelTypes";
import { RichTextField } from "@/components/parari/panels/richText/RichTextField";
import PageBodyPanelRenderer from "@/components/parari/mvp/PageBodyPanelRenderer";
import { PanelFrame } from "@/components/parari/panels/shared/PanelFrame";
import { parsePanelVisualStyle } from "@/lib/parari/ssot-v2/panelStyle";

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
};

const STRUCTURE_TAGS = new Set(["PAGE", "PAGEINFO", "BOOK", "BOOKINFO", "CHAPTER"]);

export default function WritingSsotSurface({
  value,
  onChange,
  placeholder = "書き始める…",
}: Props) {
  const [markdownOpen,setMarkdownOpen] = React.useState(false);
  const [markdown,setMarkdown] = React.useState("");
  const [markdownError,setMarkdownError] = React.useState("");
  const blocks = React.useMemo(() => parseBlocks(value), [value]);
  const importMarkdown = () => {
    const parts = parseMarkdownForParari(markdown);
    if (!parts.length) {setMarkdownError("貼り付ける文章を入力してください。");return;}
    if (parts.some(part=>part.kind==="table") && !window.confirm("Markdown表をTABLEパネルに変換します。よろしいですか？")) return;
    const ssot=parts.map(part=>part.kind==="table"?part.ssot:"[T]\n"+part.ssot).join("\n\n");
    onChange([value.trimEnd(),ssot].filter(Boolean).join("\n\n"));
    setMarkdown("");setMarkdownError("");setMarkdownOpen(false);
  };
  const markdownControls = <div className="mb-4 rounded-lg border border-neutral-200 p-3">
    <button type="button" className="text-sm font-semibold underline" onClick={()=>setMarkdownOpen(v=>!v)}>Markdownを貼り付け</button>
    {markdownOpen && <div className="mt-3 space-y-2">
      <textarea aria-label="Markdown本文" value={markdown} onChange={e=>setMarkdown(e.target.value)} rows={8} className="w-full rounded-lg border p-3 font-mono text-sm" placeholder="Markdown文章を貼り付けてください" />
      <p className="text-xs text-neutral-500">既存本文は保持し、末尾に追加します。表は確認後TABLEパネルへ変換します。</p>
      {markdownError && <p role="alert" className="text-sm text-red-700">{markdownError}</p>}
      <button type="button" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white" onClick={importMarkdown}>変換して追加</button>
    </div>}
  </div>;
  const contentBlocks = blocks.filter((block) => {
    if (block.kind === "text") return true;
    return !STRUCTURE_TAGS.has(String(block.tag ?? "").trim().toUpperCase());
  });

  const continuationFocusIndex = contentBlocks.reduce((lastIndex, block, index) => {
    const previousBlock = contentBlocks[index - 1];
    const isEmptyText =
      block.kind === "text" &&
      String(block.raw ?? "")
        .replace(/\u200B/g, "")
        .replace(/\uFEFF/g, "")
        .trim().length === 0;

    return isEmptyText && previousBlock?.kind === "panel" ? index : lastIndex;
  }, -1);

  if (contentBlocks.length === 0) {
    return (
      <>{markdownControls}<RichTextField
        value=""
        onChange={(raw) => {
          const suffix = value.trimEnd();
          onChange([suffix, "[T]", raw, ""].filter(Boolean).join("\n"));
        }}
        placeholder={placeholder}
        minHeightClassName="min-h-[65vh]"
        quiet
      /></>
    );
  }

  return (
    <div className="min-h-[65vh]">
      {markdownControls}
      {contentBlocks.map((block, index) => (
        <WritingBlock
          key={`${block.kind}-${index}`}
          block={block}
          nextBlock={contentBlocks[index + 1]}
          source={value}
          onChange={onChange}
          placeholder={placeholder}
          autoFocus={index === continuationFocusIndex}
        />
      ))}
    </div>
  );
}

function WritingBlock({
  block,
  nextBlock,
  source,
  onChange,
  placeholder,
  autoFocus,
}: {
  block: SsotBlock;
  nextBlock?: SsotBlock;
  source: string;
  onChange: (next: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  if (block.kind === "text") {
    const panelStyle = parsePanelVisualStyle(block.attrs);

    return (
      <PanelFrame style={panelStyle} defaultWidth="text">
        <RichTextField
        value={normalizeWritingText(nextBlock?.kind === "panel" ? trimTextBoundary(block.raw) : block.raw)}
        onChange={(raw) => {
          const start = Math.max(0, block.start ?? 0);
          const end = Math.max(start, block.end ?? start);
          const before = source.slice(0, start);
          const after = source.slice(end);
          const hasFollowingPanel = nextBlock?.kind === "panel";
          const body = hasFollowingPanel ? trimTextBoundary(raw) : raw;
          const boundary = hasFollowingPanel ? "\n\n" : "";
          onChange(before + body + boundary + after.replace(/^\s+/, ""));
        }}
        placeholder={placeholder}
        minHeightClassName={nextBlock?.kind === "panel" ? "min-h-0" : "min-h-[120px]"}
        quiet
        autoFocus={autoFocus}
      />
      </PanelFrame>
    );
  }

  return <PageBodyPanelRenderer bodySsot={block.raw} />;
}


function trimTextBoundary(value: string) {
  return String(value ?? "").replace(/\s+$/g, "");
}

function normalizeWritingText(value: string) {
  return String(value ?? "")
    .replace(/\u200B/g, "")
    .replace(/\uFEFF/g, "");
}
