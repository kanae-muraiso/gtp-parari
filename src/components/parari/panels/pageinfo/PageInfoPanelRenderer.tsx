// apps/tools/parari/src/components/parari/panels/pageinfo/PageInfoPanelRenderer.tsx
// PART: Quiet PAGEINFO view renderer
// コメント:
// - VIEWではPAGEタイトルとPAGE画像だけを必要最小限で表示する
// - タイトルは本文と同じ開始位置で左寄せを標準にする
// - titleAlign: left / center / right に対応する
// - PAGE画像がない場合は余計な空白や「画像なし」表示を出さない

import {
  viewerImageWidthClass,
} from "../../viewer/viewerWidthRules";
import type { PanelRendererProps } from "../panelDefinitionTypes";
import { getMetaValue, parseMetaFields } from "../shared/metaFields";
import type { PageInfoPanelData } from "./PageInfoPanelEditor";

export function PageInfoPanelRenderer({
  data,
}: PanelRendererProps<PageInfoPanelData>) {
  const fields = parseMetaFields(data.raw);

  const title = getMetaValue(fields, ["title"], "");
  const subtitle = getMetaValue(fields, ["subtitle"], "");
  const mainImage = getMetaValue(fields, ["mainImage", "main_image"], "");
  const mainImageWidth = getMetaValue(
    fields,
    ["mainImageWidth", "main_image_width"],
    "full",
  );
  const mainImageOrder = getMetaValue(
    fields,
    ["mainImageOrder", "main_image_order"],
    "textFirst",
  );
  const titleAlign = getMetaValue(
    fields,
    ["titleAlign", "title_align"],
    "left",
  );

  const showTitle = normalizeBooleanMeta(
    getMetaValue(fields, ["showTitle", "show_title"], "true"),
    true,
  );

  const titleAlignClass = getTitleAlignClass(titleAlign);

  if ((!showTitle || !title) && !subtitle && !mainImage) {
    return null;
  }

  return (
    <header className="mb-8">
      {mainImage && mainImageOrder === "imageFirst" ? (
        <PageImage src={mainImage} width={mainImageWidth} />
      ) : null}

      {(showTitle && title) || subtitle ? (
        <div className={["w-full", titleAlignClass].join(" ")}>
          {showTitle && title ? (
            <h2 className="text-2xl font-bold leading-tight text-neutral-900 md:text-3xl">
              {title}
            </h2>
          ) : null}

          {subtitle ? (
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              {subtitle}
            </p>
          ) : null}
        </div>
      ) : null}

      {mainImage && mainImageOrder !== "imageFirst" ? (
        <PageImage src={mainImage} width={mainImageWidth} />
      ) : null}
    </header>
  );
}

function PageImage({
  src,
  width,
}: {
  src: string;
  width: string;
}) {
  const safeSrc = src.trim();

  if (!safeSrc) {
    return null;
  }

  return (
    <div className={["mt-5", viewerImageWidthClass(width, "max")].join(" ")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={safeSrc} alt="" className="h-auto w-full rounded-2xl" />
    </div>
  );
}

function normalizeBooleanMeta(
  value: string,
  defaultValue: boolean,
): boolean {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "on"
  ) {
    return true;
  }

  if (
    normalized === "false" ||
    normalized === "0" ||
    normalized === "no" ||
    normalized === "off"
  ) {
    return false;
  }

  return defaultValue;
}

function getTitleAlignClass(value: unknown): string {
  const normalized = String(value ?? "left").trim().toLowerCase();

  if (normalized === "center") {
    return "text-center";
  }

  if (normalized === "right") {
    return "text-right";
  }

  return "text-left";
}
