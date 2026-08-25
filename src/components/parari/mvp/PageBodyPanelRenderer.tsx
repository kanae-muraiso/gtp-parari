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
import { getPanelDefinition } from "@/components/parari/panels/registry";
import { PanelFrame } from "@/components/parari/panels/shared/PanelFrame";
import { resolvePanelGap } from "@/components/parari/panels/shared/panelGap";
import { parseRichText } from "@/lib/parari/richText/parseRichText";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";
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

  return (
    <div className="mb-6 text-neutral-800">
      <RichTextRenderer document={parseRichText(text)} />
    </div>
  );
}

function PanelBlockView({ block }: { block: PanelBlock }) {
  const definition = getPanelDefinition(block.tag);
  const Renderer = definition.Renderer;
  const gap = resolvePanelGap(block);
  const width =
    String(block.tag ?? "").trim().toUpperCase() === "CAROUSEL"
      ? "full"
      : "default";

  if (!Renderer) {
    return (
      <PanelFrame gap={gap} width={width}>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
          [{block.tag}] は表示用Rendererがまだありません。
        </div>
      </PanelFrame>
    );
  }

  const data = definition.parse(block.raw, block);

  return (
    <PanelFrame gap={gap} width={width}>
      <Renderer
        block={block}
        data={data}
        renderNestedPanelViewer={(nestedSsot) => (
          <PageBodyPanelRenderer bodySsot={nestedSsot} />
        )}
      />
    </PanelFrame>
  );
}
