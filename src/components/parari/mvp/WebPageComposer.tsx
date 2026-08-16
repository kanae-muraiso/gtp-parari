// src/components/parari/mvp/WebPageComposer.tsx
// PART: WEBPAGE composer

"use client";

import { useState } from "react";

import { PagePanelComposer } from "./PagePanelComposer";
import { WebPageInfoEditor } from "./WebPageInfoEditor";

import { PanelBlockCard } from "@/components/parari/editor-v2/PanelBlockCard";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";

import {
  appendWebPage,
  parseWebSsot,
  replaceWebInfoRaw,
  replaceWebPageBody,
  replaceWebPageMetaValue,
  type WebPageType,
} from "@/components/parari/viewer-v2/web/webSsot";

type WebPageComposerProps = {
  value: string;
  onChange: (nextValue: string) => void;
  pageLimit?: number | null;
  onLimitMessage?: (message: string) => void;
  publicBasePath?: string;
  ownerUsername?: string;
  siteSlug?: string;
  onSiteSlugChange?: (nextSlug: string) => void;
};

export function WebPageComposer({
  value,
  onChange,
  pageLimit,
  onLimitMessage,
  publicBasePath,
  ownerUsername,
  siteSlug,
  onSiteSlugChange,
}: WebPageComposerProps) {
  const parsed = parseWebSsot(value);

  const [newPageType, setNewPageType] =
    useState<WebPageType>("fixed");

  const webInfoBlock = parseBlocks(
    parsed.webInfo.raw,
  ).find(
    (block) =>
      block.kind === "panel" &&
      block.tag === "WEB",
  );

  const canAddPage =
    pageLimit == null ||
    parsed.pages.length < pageLimit;

  const handleAddPage = () => {
    if (!canAddPage) {
      onLimitMessage?.(
        `このプランではWEBPAGEを${pageLimit}件まで作成できます。`,
      );

      return;
    }

    onChange(
      appendWebPage(
        value,
        newPageType,
      ),
    );
  };

  return (
    <div className="space-y-8">
      <section>
        {webInfoBlock?.kind === "panel" ? (
          <PanelBlockCard
            block={webInfoBlock}
            onChangeRaw={(nextWebInfoRaw) => {
              onChange(
                replaceWebInfoRaw(
                  value,
                  nextWebInfoRaw,
                ),
              );
            }}
            publicBasePath={publicBasePath}
            ownerUsername={ownerUsername}
            siteSlug={siteSlug}
            onSiteSlugChange={onSiteSlugChange}
            webPages={parsed.pages.map((page) => ({
              title:
                page.title ||
                page.menuLabel ||
                `PAGE ${page.index + 1}`,
              slug: page.slug,
              isHome: page.isHome,
            }))}
          />
        ) : (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            WEBINFOを読み込めませんでした。
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-bold text-violet-700">
              WEBPAGE
            </div>

            <div className="mt-1 text-sm font-bold text-neutral-900">
              新しいWEBPAGEを追加
            </div>

            <div className="mt-1 text-[11px] leading-5 text-neutral-500">
              ページの種類を選んで、作品の末尾へ追加します。
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={newPageType}
              onChange={(event) =>
                setNewPageType(
                  event.target.value as WebPageType,
                )
              }
              className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            >
              <option value="top">
                トップ
              </option>

              <option value="fixed">
                固定
              </option>

              <option value="post">
                投稿
              </option>

              <option value="none">
                なし（本文のみ）
              </option>
            </select>

            <button
              type="button"
              onClick={handleAddPage}
              disabled={!canAddPage}
              className="rounded-xl bg-violet-700 px-5 py-2 text-sm font-bold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              ＋ WEBPAGEを追加
            </button>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-neutral-400">
          現在 {parsed.pages.length} PAGE
          {pageLimit != null
            ? ` ／ 上限 ${pageLimit} PAGE`
            : ""}
        </div>
      </section>

      {parsed.pages.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-sky-200 bg-sky-50 p-8 text-center">
          <div className="text-sm font-bold text-sky-800">
            WEBPAGEがありません
          </div>

          <div className="mt-2 text-xs leading-6 text-sky-600">
            上の「WEBPAGEを追加」から最初のページを作成してください。
          </div>
        </div>
      ) : null}

      {parsed.pages.map((page) => (
        <section
          key={`${page.slug}-${page.index}`}
          className="overflow-hidden rounded-3xl border border-sky-200 bg-sky-50"
        >
          <WebPageInfoEditor
            page={page}
            publicBasePath={publicBasePath}
            onChangeMeta={(
              key,
              nextValue,
            ) => {
              onChange(
                replaceWebPageMetaValue(
                  value,
                  page.index,
                  key,
                  nextValue,
                ),
              );
            }}
          />

          <div className="bg-white p-4">
            <PagePanelComposer
              value={page.raw}
              onChange={(nextBodyRaw) => {
                onChange(
                  replaceWebPageBody(
                    value,
                    page.index,
                    nextBodyRaw,
                  ),
                );
              }}
              textPlaceholder="このWEBPAGEの本文"
              publicBasePath={publicBasePath}
            />
          </div>
        </section>
      ))}
    </div>
  );
}
