// src/components/parari/mvp/WebPageInfoEditor.tsx
// 2026/07/22 9:49

"use client";

import { useState } from "react";
import type {
  WebPageSegment,
  WebPageType,
} from "@/components/parari/viewer-v2/web/webSsot";

type WebPageInfoEditorProps = {
  page: WebPageSegment;
  publicBasePath?: string;
  onChangeMeta: (key: string, value: string) => void;
};

export function WebPageInfoEditor({
  page,
  publicBasePath,
  onChangeMeta,
}: WebPageInfoEditorProps) {
  const [isEditing, setIsEditing] = useState(false);

  const normalizedBasePath = String(
    publicBasePath ?? "",
  ).replace(/\/+$/, "");

  const currentPagePath =
    normalizedBasePath &&
    !page.isHome &&
    page.slug
      ? `${normalizedBasePath}/${encodeURIComponent(
          page.slug,
        )}`
      : normalizedBasePath;

  return (
    <div className="border-b border-sky-200 bg-sky-50 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-sky-700">
            WEBPAGE INFO
          </div>

          <div className="mt-1 text-base font-bold text-neutral-900">
            {page.title}
          </div>

          {normalizedBasePath ? (
            <div className="mt-3 grid gap-1 rounded-xl border border-sky-100 bg-white px-3 py-2 text-[11px] leading-5 text-neutral-600">
              <div>
                <span className="font-bold text-neutral-500">
                  所属WEBサイト：
                </span>
                <span className="ml-1 break-all font-mono">
                  {normalizedBasePath}
                </span>
              </div>

              <div>
                <span className="font-bold text-neutral-500">
                  現在のページ：
                </span>
                <span className="ml-1 break-all font-mono">
                  {currentPagePath}
                </span>
              </div>
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
            <span>種類：{page.pageType}</span>
            <span>slug：{page.slug}</span>
            <span>
              メニュー：
              {page.showInMenu ? page.menuLabel : "非表示"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsEditing((current) => !current)}
          className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-bold text-sky-700"
        >
          {isEditing ? "閉じる" : "編集"}
        </button>
      </div>

      {isEditing ? (
        <div className="mt-4 grid gap-4 rounded-2xl border border-sky-100 bg-white p-4">
          <label className="grid gap-1">
            <span className="text-xs font-bold text-neutral-600">
              ページの種類
            </span>

            <select
              value={page.pageType}
              onChange={(event) =>
                onChangeMeta(
                  "pageType",
                  event.target.value as WebPageType,
                )
              }
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            >
              <option value="top">トップページ</option>
              <option value="fixed">固定ページ</option>
              <option value="post">投稿ページ</option>
              <option value="none">なし（本文のみ）</option>
            </select>
          </label>

                    {page.pageType === "post" ? (
                      <div className="grid gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div>
                          <div className="text-xs font-bold text-amber-800">
                            投稿ページ設定
                          </div>

                          <div className="mt-1 text-[11px] leading-5 text-amber-700">
                            投稿を分類したり、投稿一覧で絞り込むためのキーワードです。
                          </div>
                        </div>

                        <label className="grid gap-1">
                          <span className="text-xs font-bold text-neutral-600">
                            分類キーワード
                          </span>

                          <input
                            type="text"
                            value={page.keywords}
                            onChange={(event) =>
                              onChangeMeta("keywords", event.target.value)
                            }
                            placeholder="お知らせ, 開発日記, イベント"
                            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
                          />

                          <span className="text-[11px] leading-5 text-neutral-400">
                            複数のキーワードはカンマで区切ってください。
                          </span>
                        </label>
                      </div>
                    ) : null}
                    
          <label className="grid gap-1">
            <span className="text-xs font-bold text-neutral-600">
              タイトル
            </span>

            <input
              type="text"
              value={page.title}
              onChange={(event) =>
                onChangeMeta("title", event.target.value)
              }
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-bold text-neutral-600">
              slug
            </span>

            <input
              type="text"
              value={page.slug}
              onChange={(event) =>
                onChangeMeta("slug", event.target.value)
              }
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={page.isHome}
              onChange={(event) =>
                onChangeMeta(
                  "isHome",
                  event.target.checked ? "true" : "false",
                )
              }
            />
            このページをHOMEにする
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-bold text-neutral-600">
              メニュー表記
            </span>

            <input
              type="text"
              value={page.menuLabel}
              onChange={(event) =>
                onChangeMeta("menuLabel", event.target.value)
              }
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={page.showInMenu}
              onChange={(event) =>
                onChangeMeta(
                  "showInMenu",
                  event.target.checked ? "true" : "false",
                )
              }
            />
            メニューに表示する
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-bold text-neutral-600">
              メニュー順
            </span>

            <input
              type="number"
              value={page.menuOrder ?? ""}
              onChange={(event) =>
                onChangeMeta("menuOrder", event.target.value)
              }
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
