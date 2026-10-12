// src/components/parari/reader/ReaderBodyPanelRenderer.tsx
// 2026-07-02 JST
// PART: Reader body panel renderer via ssot-v2 blocks + [TOC]

"use client";

import React from "react";
import { materializeReaderBlock, type PreparedReaderBlock } from "@/lib/parari/readerProjectionTypes";
import { getPanelDefinition } from "@/components/parari/panels/registry";
import { PanelFrame } from "@/components/parari/panels/shared/PanelFrame";
import { resolvePanelGap } from "@/components/parari/panels/shared/panelGap";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";
import type {
  PanelBlock,
  SsotBlock,
  TextBlock,
} from "@/lib/parari/ssot-v2/panelTypes";
import { PageTocPanel } from "./PageTocPanel";
import type { PageTocEntry } from "./PageTocPanel";

export type ReaderTextBlockRenderer = (args: {
  block: TextBlock;
  text: string;
  index: number;
  tocHeadingStartIndex: number;
  tocHeadingIdPrefix: string;
}) => React.ReactNode;

type ReaderBodyPanelRendererProps = {
  bodySsot: string;
  preparedBlocks?: PreparedReaderBlock[];
  renderTextBlock: ReaderTextBlockRenderer;
  emptyFallback?: React.ReactNode;
};

type PageTocState = {
  entries: PageTocEntry[];
  headingStartIndexByBlockId: Record<string, number>;
};

export function ReaderBodyPanelRenderer({
  bodySsot,
  preparedBlocks,
  renderTextBlock,
  emptyFallback = null,
}: ReaderBodyPanelRendererProps) {
  const instanceId = React.useId();
  const tocHeadingIdPrefix = `parari-page-heading-${instanceId}`;
  const blocks = React.useMemo(() => {
    return preparedBlocks?.map(materializeReaderBlock) ?? parseBlocks(normalizeReaderTocTags(bodySsot));
  }, [bodySsot, preparedBlocks]);

  const preparedById = React.useMemo(() => new Map(preparedBlocks?.map(block => [block.id, block])), [preparedBlocks]);

  const meaningfulBlocks = React.useMemo(() => {
    return blocks.filter((block) => {
      if (block.kind === "panel") {
        return true;
      }

      return String(block.raw ?? "").trim().length > 0;
    });
  }, [blocks]);

  const tocState = React.useMemo(() => {
    return createPageTocState(meaningfulBlocks, tocHeadingIdPrefix);
  }, [meaningfulBlocks, tocHeadingIdPrefix]);

  if (meaningfulBlocks.length === 0) {
    return emptyFallback ? <>{emptyFallback}</> : null;
  }

  return (
    <div>
      {meaningfulBlocks.map((block, index) => (
        <BlockView
          key={block.id}
          block={block}
          prepared={preparedById.get(block.id)}
          index={index}
          renderTextBlock={renderTextBlock}
          tocEntries={tocState.entries}
          headingStartIndexByBlockId={tocState.headingStartIndexByBlockId}
          tocHeadingIdPrefix={tocHeadingIdPrefix}
        />
      ))}
    </div>
  );
}

function BlockView({
  block,
  prepared,
  index,
  renderTextBlock,
  tocEntries,
  headingStartIndexByBlockId,
  tocHeadingIdPrefix,
}: {
  block: SsotBlock;
  prepared?: PreparedReaderBlock;
  index: number;
  renderTextBlock: ReaderTextBlockRenderer;
  tocEntries: PageTocEntry[];
  headingStartIndexByBlockId: Record<string, number>;
  tocHeadingIdPrefix: string;
}) {
  if (block.kind === "text") {
    return (
      <TextBlockView
        block={block}
        index={index}
        renderTextBlock={renderTextBlock}
        tocHeadingStartIndex={headingStartIndexByBlockId[block.id] ?? 0}
        tocHeadingIdPrefix={tocHeadingIdPrefix}
      />
    );
  }

  return (
    <PanelBlockView
      block={block}
      prepared={prepared}
      tocEntries={tocEntries}
      renderTextBlock={renderTextBlock}
    />
  );
}

function TextBlockView({
  block,
  index,
  renderTextBlock,
  tocHeadingStartIndex,
  tocHeadingIdPrefix,
}: {
  block: TextBlock;
  index: number;
  renderTextBlock: ReaderTextBlockRenderer;
  tocHeadingStartIndex: number;
  tocHeadingIdPrefix: string;
}) {
  const text = String(block.raw ?? "");

  if (text.trim().length === 0) {
    return null;
  }

  return (
    <React.Fragment>
      {renderTextBlock({
        block,
        text,
        index,
        tocHeadingStartIndex,
        tocHeadingIdPrefix,
      })}
    </React.Fragment>
  );
}

function PanelBlockView({
  block,
  prepared,
  tocEntries,
  renderTextBlock,
}: {
  block: PanelBlock;
  prepared?: PreparedReaderBlock;
  tocEntries: PageTocEntry[];
  renderTextBlock: ReaderTextBlockRenderer;
}) {
  const gap = prepared?.gap ?? resolvePanelGap(block);
  const width = panelFrameWidthForBlock(block);

  if (isTocBlock(block)) {
    if (tocEntries.length === 0) {
      return null;
    }

    return (
      <PanelFrame gap={gap} width="default">
        <PageTocPanel entries={tocEntries} />
      </PanelFrame>
    );
  }

  const definition = getPanelDefinition(block.tag);
  const Renderer = definition.Renderer;

  if (!Renderer) {
    return (
      <PanelFrame gap={gap} width={width}>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
          [{block.tag}] は表示用Rendererがまだありません。
        </div>
      </PanelFrame>
    );
  }

  const data = prepared ? prepared.data : definition.parse(block.raw, block);

  return (
    <PanelFrame gap={gap} width={width}>
      <Renderer
        block={block}
        data={data}
        renderNestedPanelViewer={(nestedSsot, nestedBlocks) => (
          <ReaderBodyPanelRenderer
            bodySsot={nestedSsot}
            preparedBlocks={nestedBlocks}
            renderTextBlock={renderTextBlock}
            emptyFallback={null}
          />
        )}
      />
    </PanelFrame>
  );
}

function panelFrameWidthForBlock(block: PanelBlock): "default" | "full" {
  const tag = String(block.tag ?? "").trim().toUpperCase();

  if (tag === "IMAGE" || tag === "CAROUSEL") {
    return "full";
  }

  return "default";
}

function isTocBlock(block: PanelBlock): boolean {
  return String(block.tag ?? "").trim().toUpperCase() === "TOC";
}

function normalizeReaderTocTags(ssot: string): string {
  const lines = String(ssot ?? "").replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];

  lines.forEach((line, index) => {
    output.push(line);

    const current = line.trim().toUpperCase();
    const next = lines[index + 1]?.trim().toUpperCase();

    if (current === "[TOC]" && next !== "[T]") {
      output.push("[T]");
    }
  });

  return output.join("\n");
}

function createPageTocState(blocks: SsotBlock[], headingIdPrefix: string): PageTocState {
  const entries: PageTocEntry[] = [];
  const headingStartIndexByBlockId: Record<string, number> = {};

  blocks.forEach((block) => {
    if (block.kind !== "text") {
      return;
    }

    headingStartIndexByBlockId[block.id] = entries.length;

    const headings = extractTextBlockHeadings(String(block.raw ?? ""));

    headings.forEach((heading) => {
      entries.push({
        id: `${headingIdPrefix}-${entries.length}`,
        level: heading.level,
        title: heading.title,
      });
    });
  });

  return {
    entries,
    headingStartIndexByBlockId,
  };
}

function extractTextBlockHeadings(
  raw: string,
): Array<{ level: 2 | 3; title: string }> {
  const normalized = String(raw ?? "").replace(/\r\n/g, "\n");
  const paragraphs = normalized.split(/\n{2,}/);

  return paragraphs
    .map((paragraph) => getHeadingFromParagraph(paragraph))
    .filter((heading): heading is { level: 2 | 3; title: string } => {
      return Boolean(heading);
    });
}

function getHeadingFromParagraph(
  paragraph: string,
): { level: 2 | 3; title: string } | null {
  const trimmed = String(paragraph ?? "").trim();

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
      title: normalizeTocTitle(line.slice(4)),
    };
  }

  if (line.startsWith("## ")) {
    return {
      level: 2,
      title: normalizeTocTitle(line.slice(3)),
    };
  }

  return null;
}

function normalizeTocTitle(value: string): string {
  return String(value ?? "")
    .replace(/\[\[([^\]]+)\]\]\(([^)]+)\)/g, "$1")
    .replace(/\[\[([^\]]+)\]\]\{([^}]+)\}/g, "$1")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$1")
    .replace(/!!([^!]+)!!/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
