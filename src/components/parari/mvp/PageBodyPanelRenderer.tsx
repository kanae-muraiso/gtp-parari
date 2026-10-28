// apps/tools/parari/src/components/parari/mvp/PageBodyPanelRenderer.tsx
// apps/tools/parari/src/components/parari/mvp/PageBodyPanelRenderer.tsx
// 2026-06-26 23:20 JST
// PART: MVP Page body renderer via ssot-v2 blocks + PanelFrame
// コメント:
// - PagePublicView の本文Renderer
// - TextBlock は RichTextRenderer に渡す
// - PanelBlock は PanelDefinition registry の Renderer に渡す
// - PanelBlockの外側余白は PanelFrame で共通管理する
// - 親の space-y-* ではなく、PanelFrameの下余白で制御する

"use client";

import React from "react";
import RichTextRenderer from "@/components/parari/richText/RichTextRenderer";
import RichTextReadingSupportRenderer from "@/components/parari/richText/RichTextReadingSupportRenderer";
import { getPanelDefinition } from "@/components/parari/panels/registry";
import { PanelFrame } from "@/components/parari/panels/shared/PanelFrame";
import { resolvePanelGap } from "@/components/parari/panels/shared/panelGap";
import { parseRichText } from "@/lib/parari/richText/parseRichText";
import {
  hasTextReadingSupport,
  parseTextReadingSupportAttrs,
} from "@/lib/parari/richText/textReadingSupport";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";
import {
  resolvePanelVisualStyle,
  stripPanelStyleAttrs,
  stripPanelVisualStyleFromRaw,
} from "@/lib/parari/ssot-v2/panelStyle";
import type {
  PanelBlock,
  SsotBlock,
  TextBlock,
} from "@/lib/parari/ssot-v2/panelTypes";

type PageBodyPanelRendererProps = {
  bodySsot: string;
};

export default function PageBodyPanelRenderer({
  bodySsot,
}: PageBodyPanelRendererProps) {
  const blocks = React.useMemo(() => {
    return parseBlocks(bodySsot);
  }, [bodySsot]);

  if (blocks.length === 0) {
    return <p className="text-sm text-neutral-400">本文はまだありません。</p>;
  }

  return (
    <div>
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: SsotBlock }) {
  if (block.kind === "text") {
    return <TextBlockView block={block} />;
  }

  return <PanelBlockView block={block} />;
}

function TextBlockView({ block }: { block: TextBlock }) {
  const text = String(block.raw ?? "").trim();

  if (text.length === 0) {
    return null;
  }

  const document = parseRichText(text);
  const readingSupport = parseTextReadingSupportAttrs(block.attrs);

  const panelStyle = resolvePanelVisualStyle("TEXT", block.attrs);

  return (
    <PanelFrame style={panelStyle} defaultWidth="text">
      <div className="text-neutral-800">
        {hasTextReadingSupport(readingSupport) ? (
          <RichTextReadingSupportRenderer
            document={document}
            options={readingSupport}
          />
        ) : (
          <RichTextRenderer document={document} />
        )}
      </div>
    </PanelFrame>
  );
}

function PanelBlockView({ block }: { block: PanelBlock }) {
  const definition = getPanelDefinition(block.tag);
  const Renderer = definition.Renderer;
  const gap = resolvePanelGap(block);
  const panelStyle = resolvePanelVisualStyle(block.tag, block.attrs, block.variant);
  const contentRaw = stripPanelVisualStyleFromRaw(block.raw);
  const contentBlock: PanelBlock = {
    ...block,
    raw: contentRaw,
    attrs: stripPanelStyleAttrs(block.attrs),
  };
  const defaultWidth = defaultWidthForPanelTag(block.tag);

  if (!Renderer) {
    return (
      <PanelFrame gap={gap} style={panelStyle} defaultWidth={defaultWidth}>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
          [{block.tag}] は表示用Rendererがまだありません。
        </div>
      </PanelFrame>
    );
  }

  const data = definition.parse(contentRaw, contentBlock);

  return (
    <PanelFrame gap={gap} style={panelStyle} defaultWidth={defaultWidth}>
      <Renderer
        block={contentBlock}
        data={data}
        renderNestedPanelViewer={(nestedSsot) => (
          <PageBodyPanelRenderer bodySsot={nestedSsot} />
        )}
      />
    </PanelFrame>
  );
}


function defaultWidthForPanelTag(tag: string): "text" | "panel" | "full" {
  const normalizedTag = String(tag ?? "").trim().toUpperCase();

  if (normalizedTag === "NOTICE") {
    return "text";
  }

  if (normalizedTag === "IMAGE" || normalizedTag === "CAROUSEL") {
    return "full";
  }

  return "panel";
}
