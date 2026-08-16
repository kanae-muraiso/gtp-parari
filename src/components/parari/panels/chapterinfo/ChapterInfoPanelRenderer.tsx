// src/components/parari/panels/chapterinfo/ChapterInfoPanelRenderer.tsx
// PART: CHAPTERINFO renderer

import type { PanelRendererProps } from "../panelDefinitionTypes";
import { getMetaValue, parseMetaFields } from "../shared/metaFields";
import { viewerImageWidthClass } from "../../viewer/viewerWidthRules";
import type { ChapterInfoPanelData } from "./ChapterInfoPanelEditor";

export function ChapterInfoPanelRenderer({
  data,
}: PanelRendererProps<ChapterInfoPanelData>) {
  const fields = parseMetaFields(data.raw);
  const number = getMetaValue(fields, ["number"], "");
  const title = getMetaValue(fields, ["title"], "");
  const subtitle = getMetaValue(fields, ["subtitle"], "");
  const mainImage = getMetaValue(fields, ["mainImage", "main_image"], "");

  if (!number && !title && !subtitle && !mainImage) {
    return null;
  }

  return (
    <section className="my-8 border-y border-violet-100 py-8 text-center">
      <div className="text-xs font-bold tracking-[0.2em] text-violet-500">
        {formatChapterLabel(number)}
      </div>

      {title ? (
        <h2 className="mt-3 text-2xl font-bold leading-tight text-neutral-950 md:text-3xl">
          {title}
        </h2>
      ) : null}

      {subtitle ? (
        <p className="mt-3 text-sm leading-7 text-neutral-500">{subtitle}</p>
      ) : null}

      {mainImage ? (
        <div className={["mt-6", viewerImageWidthClass("full", "max")].join(" ")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mainImage.trim()}
            alt=""
            className="h-auto w-full rounded-3xl object-cover"
          />
        </div>
      ) : null}
    </section>
  );
}

function formatChapterLabel(number: string): string {
  const normalized = number.trim();

  if (!normalized) {
    return "CHAPTER";
  }

  if (/^\d+$/.test(normalized)) {
    return `第${normalized}章`;
  }

  return normalized;
}
