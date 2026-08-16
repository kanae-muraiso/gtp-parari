// apps/tools/parari/src/components/parari/panels/bookinfo/BookInfoPanelRenderer.tsx
// PART: BOOKINFO view renderer
// コメント:
// - BOOKINFOのVIEW表示用Renderer
// - 読者向けに生成される「表紙 / 扉 / 目次」の最大3シートだけを表示する
// - BOOK内部情報・設定は読者向け表示には出さない

import type { ReactNode } from "react";
import type { PanelRendererProps } from "../panelDefinitionTypes";
import {
  getBooleanMeta,
  getMetaValue,
  parseMetaFields,
} from "../shared/metaFields";
import type { BookInfoPanelData } from "./BookInfoPanelEditor";

export function BookInfoPanelRenderer({
  data,
}: PanelRendererProps<BookInfoPanelData>) {
  const fields = parseMetaFields(data.raw);

  const title = getMetaValue(fields, ["title"], "");
  const subtitle = getMetaValue(fields, ["subtitle"], "");
  const author = getMetaValue(fields, ["author"], "");
  const coverImage = getMetaValue(fields, ["coverImage", "cover_image"], "");

  const hasCover = getBooleanMeta(fields, ["cover"], false);
  const hasTitlePage = getBooleanMeta(fields, ["titlePage", "title_page"], false);
  const hasToc = getBooleanMeta(fields, ["toc"], false);

  const previewTitle = title || "Untitled BOOK";

  if (!hasCover && !hasTitlePage && !hasToc) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
      <div className="mb-3 text-[11px] font-bold text-amber-700">
        BOOK
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {hasCover ? (
          <BookSheetView title="表紙">
            <CoverSheet
              title={previewTitle}
              subtitle={subtitle}
              author={author}
              coverImage={coverImage}
            />
          </BookSheetView>
        ) : null}

        {hasTitlePage ? (
          <BookSheetView title="扉">
            <TitlePageSheet
              title={previewTitle}
              subtitle={subtitle}
              author={author}
            />
          </BookSheetView>
        ) : null}

        {hasToc ? (
          <BookSheetView title="目次">
            <TocSheet />
          </BookSheetView>
        ) : null}
      </div>
    </div>
  );
}

function BookSheetView({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-3 shadow-sm">
      <div className="mb-2 text-[11px] font-bold text-amber-700">{title}</div>
      {children}
    </div>
  );
}

function CoverSheet({
  title,
  subtitle,
  author,
  coverImage,
}: {
  title: string;
  subtitle: string;
  author: string;
  coverImage: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white">
      {coverImage ? (
        <img
          src={coverImage}
          alt=""
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-neutral-100 px-4 text-center">
          <div className="text-sm font-bold leading-6 text-neutral-700">
            {title}
          </div>
        </div>
      )}

      <div className="border-t border-neutral-100 p-3">
        <div className="line-clamp-2 text-sm font-bold leading-5 text-neutral-900">
          {title}
        </div>

        {subtitle ? (
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">
            {subtitle}
          </div>
        ) : null}

        {author ? (
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">
            {author}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TitlePageSheet({
  title,
  subtitle,
  author,
}: {
  title: string;
  subtitle: string;
  author: string;
}) {
  return (
    <div className="flex min-h-[170px] items-center justify-center rounded-xl border border-neutral-100 bg-neutral-50 px-5 py-8 text-center">
      <div>
        <div className="text-base font-bold leading-7 text-neutral-900">
          {title}
        </div>

        {subtitle ? (
          <div className="mt-2 text-xs leading-5 text-neutral-500">
            {subtitle}
          </div>
        ) : null}

        {author ? (
          <div className="mt-2 text-xs leading-5 text-neutral-500">
            {author}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TocSheet() {
  return (
    <div className="flex min-h-[170px] items-center justify-center rounded-xl border border-neutral-100 bg-white px-5 py-8 text-center">
      <div className="text-base font-bold tracking-[0.2em] text-neutral-800">
        目次
      </div>
    </div>
  );
}
