// src/components/parari/panels/pageinfo/serializePageInfoPanel.ts
// PAGEINFO serializer
// 2026-07-04 JST - [PAGE] header and title: are kept in sync

export type PageInfoPanelDataLike = {
  title?: string;
  subtitle?: string;
  mainImage?: string;
  showTitle?: boolean;
};

export function serializePageInfoPanel(data: PageInfoPanelDataLike): string {
  const rawTitle = data.title ?? "";
  const title = rawTitle.trim().length > 0 ? rawTitle : "新しいページ";
  const subtitle = data.subtitle?.trim() ?? "";
  const mainImage = data.mainImage?.trim() ?? "";
  const showTitle = data.showTitle !== false;

  return [
    `[PAGE] ${title}`,
    `title: ${title}`,
    `subtitle: ${subtitle}`,
    `mainImage: ${mainImage}`,
    `showTitle: ${showTitle}`,
  ].join("\n");
}
