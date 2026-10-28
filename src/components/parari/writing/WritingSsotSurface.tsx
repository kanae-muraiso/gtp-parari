"use client";

import React from "react";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";
import type { SsotBlock } from "@/lib/parari/ssot-v2/panelTypes";
import { RichTextField } from "@/components/parari/panels/richText/RichTextField";
import PageBodyPanelRenderer from "@/components/parari/mvp/PageBodyPanelRenderer";

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
}: {
  block: SsotBlock;
  nextBlock?: SsotBlock;
  source: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  if (block.kind === "text") {
    return (
      <RichTextField
        value={trimTextBoundary(block.raw)}
        onChange={(raw) => {
          const start = Math.max(0, block.start ?? 0);
          const end = Math.max(start, block.end ?? start);
          const before = source.slice(0, start);
          const after = source.slice(end);
          const body = trimTextBoundary(raw);
          const boundary = nextBlock?.kind === "panel" ? "\n\n" : "";
          onChange(before + body + boundary + after.replace(/^\s+/, ""));
        }}
        placeholder={placeholder}
        minHeightClassName={nextBlock?.kind === "panel" ? "min-h-0" : "min-h-[120px]"}
        quiet
      />
    );
  }

  return (
    <div className="my-5">
      <PageBodyPanelRenderer bodySsot={block.raw} />
    </div>
  );
}


function trimTextBoundary(value: string) {
  return String(value ?? "").replace(/\s+$/g, "");
}
