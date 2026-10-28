"use client";

import React from "react";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";
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
  const blocks = React.useMemo(() => parseBlocks(value), [value]);
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
      <RichTextField
        value=""
        onChange={(raw) => {
          const suffix = value.trimEnd();
          onChange([suffix, "[T]", raw, ""].filter(Boolean).join("\n"));
        }}
        placeholder={placeholder}
        minHeightClassName="min-h-[65vh]"
        quiet
      />
    );
  }

  return (
    <div className="min-h-[65vh]">
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
