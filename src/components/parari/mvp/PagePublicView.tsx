// src/components/parari/mvp/PagePublicView.tsx
// src/components/parari/mvp/PagePublicView.tsx
// 2026-06-29 15:55 JST
// PART: PAGE public view supports mainImageOrder
// コメント:
// - PAGEINFO内で管理するPAGE画像を表示する
// - mainImageOrder により「画像→タイトル」「タイトル→画像」を切り替える
// - PAGE画像の幅は mainImageWidth だけで調整する

import type { ReactNode } from "react";
import type { ParariPageDraft } from "@/lib/parari/mvp/pageDocumentTypes";
import PageBodyPanelRenderer from "./PageBodyPanelRenderer";

type PagePublicViewProps = {
  draft: ParariPageDraft;
  backHref?: string;
  editHref?: string;
};

export function PagePublicView({
  draft,
  backHref,
  editHref,
}: PagePublicViewProps) {
  const titleBlock = <PageTitleBlock draft={draft} />;
  const imageBlock = <PageMainImageBlock draft={draft} />;

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {backHref ? (
            <a
              href={backHref}
              className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-100"
            >
              作品リストへ
            </a>
          ) : (
            <div />
          )}

          {editHref ? (
            <a
              href={editHref}
              className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-neutral-700"
            >
              編集
            </a>
          ) : null}
        </div>

        <article className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-sm">
          <div className="px-5 py-7 md:px-8 md:py-10">
            {draft.mainImageOrder === "imageFirst" ? (
              <>
                {imageBlock}
                {titleBlock}
              </>
            ) : (
              <>
                {titleBlock}
                {imageBlock}
              </>
            )}

            <PageBodyPanelRenderer bodySsot={draft.bodySsot} />
          </div>
        </article>
      </div>
    </main>
  );
}

function PageTitleBlock({ draft }: { draft: ParariPageDraft }) {
  return (
    <header className="mb-8">
      {draft.topics.trim().length > 0 ? (
        <div className="mb-3 text-xs font-semibold text-neutral-400">
          {draft.topics}
        </div>
      ) : null}

      <h1 className="w-full break-words text-left text-3xl font-semibold leading-tight text-neutral-950 md:text-4xl">
        {draft.title.trim() || "Untitled PAGE"}
      </h1>

      {draft.subtitle.trim().length > 0 ? (
        <p className="mt-3 text-base leading-7 text-neutral-500">
          {draft.subtitle}
        </p>
      ) : null}

      {draft.author.trim().length > 0 ? (
        <div className="mt-2 text-sm leading-6 text-neutral-500">
          {draft.author}
        </div>
      ) : null}

      {(draft.time.trim().length > 0 || draft.place.trim().length > 0) ? (
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-400">
          {draft.time.trim().length > 0 ? (
            <span className="rounded-full bg-neutral-100 px-3 py-1">
              {draft.time}
            </span>
          ) : null}

          {draft.place.trim().length > 0 ? (
            <span className="rounded-full bg-neutral-100 px-3 py-1">
              {draft.place}
            </span>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

function PageMainImageBlock({ draft }: { draft: ParariPageDraft }) {
  if (draft.mainImageUrl.trim().length === 0) {
    return null;
  }

  return (
    <div
      className={[
        "mb-8",
        draft.mainImageOrder === "imageFirst" ? "" : "",
        mainImageWidthClass(draft.mainImageWidth),
      ].join(" ")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={draft.mainImageUrl}
        alt=""
        className="h-auto w-full rounded-2xl"
      />
    </div>
  );
}

function mainImageWidthClass(value: string): string {
  switch (value) {
    case "narrow":
      return "mx-auto max-w-sm";
    case "normal":
      return "mx-auto max-w-2xl";
    case "wide":
      return "mx-auto max-w-3xl";
    case "full":
    default:
      return "w-full";
  }
}
