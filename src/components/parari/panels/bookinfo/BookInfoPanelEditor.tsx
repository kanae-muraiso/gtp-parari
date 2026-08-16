// apps/tools/parari/src/components/parari/panels/bookinfo/BookInfoPanelEditor.tsx
// PART: BOOKINFO editor
// コメント:
// - BOOKINFOは読者向けに「表紙 / 扉 / 目次」の最大3シートを生成する
// - BOOK内部情報・設定は編集可能でも、読者向けプレビューには出さない
// - 目次はPAGEINFO一覧から後で生成されるため、ここでは「目次」とだけ表示する

"use client";

import { heicTo, isHeic } from "heic-to";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { compressImageToJpeg } from "../image/imageUploadUtils";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import {
  getBooleanMeta,
  getMetaValue,
  parseMetaFields,
} from "../shared/metaFields";

export type BookInfoPanelData = {
  raw: string;
};

async function normalizeBookInfoCoverImageFile(file: File): Promise<File> {
  const fileNameLooksHeic = /\.(heic|heif)$/i.test(file.name);
  const mimeLooksHeic = /heic|heif/i.test(file.type);

  if (!fileNameLooksHeic && !mimeLooksHeic) {
    return file;
  }

  try {
    const converted = await heicTo({
      blob: file,
      type: "image/jpeg",
      quality: 0.92,
    });

    const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
    const jpegName =
      file.name.replace(/\.(heic|heif)$/i, ".jpg") || "image.jpg";

    return new File([jpegBlob], jpegName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn("[PARARI image] HEIC conversion skipped", {
      fileName: file.name,
      fileType: file.type,
      error,
    });

    return file;
  }
}

export function BookInfoPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<BookInfoPanelData>) {
  const coverImageInputId = "bookinfo-cover-image-input";

  const [draftRaw, setDraftRaw] = useState(data.raw);
  const [titleDraft, setTitleDraft] = useState(() =>
    getMetaValue(parseMetaFields(data.raw), ["title"], ""),
  );
  const [coverImageUploadStatus, setCoverImageUploadStatus] = useState("");
  const [isUploadingCoverImage, setIsUploadingCoverImage] = useState(false);
  const [isDetailEditing, setIsDetailEditing] = useState(false);

  useEffect(() => {
    setDraftRaw(data.raw);
    setTitleDraft(getMetaValue(parseMetaFields(data.raw), ["title"], ""));
  }, [data.raw]);

  const fields = useMemo(() => parseMetaFields(draftRaw), [draftRaw]);

  // parseMetaFieldsは値をtrimするため、タイトル入力中は専用stateを使う。
  // これにより、語の途中のスペースと日本語IMEの変換状態を保持できる。
  const title = titleDraft;
  const subtitle = getMetaValue(fields, ["subtitle"], "");
  const author = getMetaValue(fields, ["author"], "");
  const coverImage = getMetaValue(fields, ["coverImage", "cover_image"], "");
  const coverTitleOverlay = getBooleanMeta(
    fields,
    ["coverTitleOverlay", "cover_title_overlay"],
    false,
  );

  const url = getMetaValue(fields, ["url"], "");
  const time = getMetaValue(fields, ["time"], "");
  const place = getMetaValue(fields, ["place"], "");
  const topics = getMetaValue(fields, ["topics"], "");
  const workType = getMetaValue(fields, ["workType", "work_type"], "book");
  const renderMode = getMetaValue(fields, ["renderMode", "render_mode"], "page");

  const hasCover = getBooleanMeta(fields, ["cover"], false);
  const hasTitlePage = getBooleanMeta(fields, ["titlePage", "title_page"], false);
  const hasToc = getBooleanMeta(fields, ["toc"], false);
  const hasPhysicalPagination = getBooleanMeta(
    fields,
    ["physicalPagination", "physical_pagination"],
    false,
  );
  const defaultReadingMode = normalizeDefaultReadingMode(
    getMetaValue(
      fields,
      ["defaultReadingMode", "default_reading_mode"],
      "",
    ),
    renderMode,
    hasPhysicalPagination,
  );

    const defaultDisplayMode:
      | "full-scroll"
      | "page-scroll"
      | "paged" =
      defaultReadingMode === "scroll"
        ? "full-scroll"
        : hasPhysicalPagination
          ? "paged"
          : "page-scroll";
    
  const previewTitle = title || "Untitled BOOK";

  const commitRaw = (nextRaw = draftRaw) => {
    onChangeRaw?.(normalizeBookInfoRaw(nextRaw));
  };

  const updateMeta = (key: string, value: string) => {
    const nextRaw = setColonMetaValue(draftRaw, key, value);
    setDraftRaw(nextRaw);
    onChangeRaw?.(normalizeBookInfoRaw(nextRaw));
  };

  const commitTitle = (value = titleDraft) => {
    setTitleDraft(value);

    const nextRaw = setColonMetaValue(draftRaw, "title", value);
    setDraftRaw(nextRaw);
    onChangeRaw?.(normalizeBookInfoRaw(nextRaw));
  };

  const updateBooleanMeta = (key: string, checked: boolean) => {
    updateMeta(key, checked ? "true" : "false");
  };

    const updateDefaultReadingMode = (
      value: "full-scroll" | "page-scroll" | "paged",
    ) => {
      let nextRaw = draftRaw;

      if (value === "full-scroll") {
        nextRaw = setColonMetaValue(
          nextRaw,
          "defaultReadingMode",
          "scroll",
        );
        nextRaw = setColonMetaValue(
          nextRaw,
          "physicalPagination",
          "false",
        );
        nextRaw = setColonMetaValue(
          nextRaw,
          "renderMode",
          "page-scroll",
        );
      } else if (value === "page-scroll") {
        nextRaw = setColonMetaValue(
          nextRaw,
          "defaultReadingMode",
          "paged",
        );
        nextRaw = setColonMetaValue(
          nextRaw,
          "physicalPagination",
          "false",
        );
        nextRaw = setColonMetaValue(
          nextRaw,
          "renderMode",
          "page",
        );
      } else {
        nextRaw = setColonMetaValue(
          nextRaw,
          "defaultReadingMode",
          "paged",
        );
        nextRaw = setColonMetaValue(
          nextRaw,
          "physicalPagination",
          "true",
        );
        nextRaw = setColonMetaValue(
          nextRaw,
          "renderMode",
          "page",
        );
      }

      setDraftRaw(nextRaw);
      onChangeRaw?.(normalizeBookInfoRaw(nextRaw));
    };

  const handlePickCoverImageFile = async (file: File) => {
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
      setCoverImageUploadStatus("画像ファイルを選んでください");
      return;
    }

    setIsUploadingCoverImage(true);
    setCoverImageUploadStatus("画像を準備中…");

    try {
      if (!supabase) {
        setCoverImageUploadStatus("Supabaseの接続設定を確認できませんでした");
        return;
      }

      const { data: userData, error: userErr } = await supabase.auth.getUser();

      if (userErr || !userData.user) {
        setCoverImageUploadStatus("ログインしてください");
        return;
      }

      const normalizedFile = await normalizeBookInfoCoverImageFile(file);
      const blob = await compressImageToJpeg(normalizedFile, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.72,
      });

      const uid = userData.user.id;
      const uploadPath = `${uid}/book-cover/${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}.jpg`;

      setCoverImageUploadStatus("画像をアップロード中…");

      const { error: uploadError } = await supabase.storage
        .from("parari-images")
        .upload(uploadPath, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        setCoverImageUploadStatus(`アップロード失敗: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("parari-images")
        .getPublicUrl(uploadPath);

      const nextRaw = setColonMetaValue(
        normalizeBookInfoRaw(draftRaw),
        "coverImage",
        publicUrlData.publicUrl,
      );

      setDraftRaw(nextRaw);
      onChangeRaw?.(normalizeBookInfoRaw(nextRaw));
      setCoverImageUploadStatus("画像を設定しました");
    } catch (error) {
      console.error("[BOOKINFO image] FORCE-CATCH-20260705", error);

      let message = "詳細不明";

      if (error instanceof Error) {
        message = `${error.name}: ${error.message}`;
      } else if (typeof error === "string") {
        message = error;
      } else {
        try {
          message = JSON.stringify(error);
        } catch {
          message = String(error);
        }
      }

      setCoverImageUploadStatus(`アップロード失敗 FORCE-CATCH-20260705: ${message}`);
    } finally {
      setIsUploadingCoverImage(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-amber-700">BOOKINFO</div>
          <div className="mt-1 text-[11px] leading-5 text-amber-700/80">
            BOOKのタイトル・著者・表紙・読者向けシートを設定します。
          </div>
        </div>

      </div>

      {!isDetailEditing ? (
        <div className="mb-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-bold text-neutral-500">
                BOOKタイトル
              </span>
              <input
              onKeyDown={stopTitleInputShortcutKeys}
                value={title}
                onChange={(event) => setTitleDraft(event.currentTarget.value)}
                onBlur={(event) => commitTitle(event.currentTarget.value)}
                onCompositionEnd={(event) =>
                  commitTitle(event.currentTarget.value)
                }
                className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-400"
                placeholder="BOOKタイトル"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-bold text-neutral-500">
                サブタイトル
              </span>
              <input
              onKeyDown={stopTitleInputShortcutKeys}
                value={subtitle}
                onChange={(event) => updateMeta("subtitle", event.target.value)}
                className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-400"
                placeholder="副題・説明など"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-bold text-neutral-500">
                著者名
              </span>
              <input
              onKeyDown={stopTitleInputShortcutKeys}
                value={author}
                onChange={(event) => updateMeta("author", event.target.value)}
                className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-400"
                placeholder="著者名"
              />
            </label>

            <div className="mt-2 space-y-2 md:col-span-2">
              <div className="text-[11px] font-bold text-neutral-500">
                表紙画像
              </div>

              <input
              onKeyDown={stopTitleInputShortcutKeys}
                id={coverImageInputId}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  event.currentTarget.value = "";

                  if (file) {
                    void handlePickCoverImageFile(file);
                  }
                }}
              />

              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor={coverImageInputId}
                  aria-disabled={isUploadingCoverImage}
                  className={[
                    "rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-50",
                    isUploadingCoverImage
                      ? "pointer-events-none cursor-not-allowed opacity-50"
                      : "cursor-pointer",
                  ].join(" ")}
                >
                  {isUploadingCoverImage ? "アップロード中…" : "画像を選ぶ"}
                </label>

                {coverImageUploadStatus ? (
                  <span className="text-xs text-neutral-500">
                    {coverImageUploadStatus}
                  </span>
                ) : (
                  <span className="text-xs text-neutral-400">
                    スマホでは写真ライブラリやカメラから選べます
                  </span>
                )}
              </div>

              <label className="block">
                <span className="text-[11px] font-bold text-neutral-500">
                  URL
                </span>
                <input
              onKeyDown={stopTitleInputShortcutKeys}
                  value={coverImage}
                  onChange={(event) => updateMeta("coverImage", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-400"
                  placeholder="https://..."
                />
              </label>
            </div>
          </div>

          {coverImage ? (
            <div className="overflow-hidden rounded-2xl bg-white p-2 ring-1 ring-amber-100">
              <img
                src={coverImage}
                alt=""
                className="max-h-72 w-full object-contain"
              />
            </div>
          ) : null}

          <div className="rounded-2xl border border-amber-100 bg-white p-3">
            <div className="mb-3 text-[11px] font-bold text-neutral-500">
              読者向けに表示するシート
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <CheckboxField
                checked={hasCover}
                onChange={(checked) => updateBooleanMeta("cover", checked)}
              >
                表紙
              </CheckboxField>

              <CheckboxField
                checked={hasTitlePage}
                onChange={(checked) => updateBooleanMeta("titlePage", checked)}
              >
                扉
              </CheckboxField>

              <CheckboxField
                checked={hasToc}
                onChange={(checked) => updateBooleanMeta("toc", checked)}
              >
                目次
              </CheckboxField>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-white p-3">
            <CheckboxField
              checked={coverTitleOverlay}
              onChange={(checked) =>
                updateBooleanMeta("coverTitleOverlay", checked)
              }
            >
              表紙画像にタイトルを重ねる
            </CheckboxField>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsDetailEditing(true)}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-50"
            >
              詳細編集
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4 space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsDetailEditing(false)}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-50"
            >
              簡易編集に戻る
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-bold text-neutral-500">
                BOOKタイトル
              </span>
              <input
              onKeyDown={stopTitleInputShortcutKeys}
                value={title}
                onChange={(event) => setTitleDraft(event.currentTarget.value)}
                onBlur={(event) => commitTitle(event.currentTarget.value)}
                onCompositionEnd={(event) =>
                  commitTitle(event.currentTarget.value)
                }
                className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-400"
                placeholder="BOOKタイトル"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-bold text-neutral-500">
                サブタイトル
              </span>
              <input
              onKeyDown={stopTitleInputShortcutKeys}
                value={subtitle}
                onChange={(event) => updateMeta("subtitle", event.target.value)}
                className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-400"
                placeholder="副題・説明など"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-bold text-neutral-500">
                著者名
              </span>
              <input
              onKeyDown={stopTitleInputShortcutKeys}
                value={author}
                onChange={(event) => updateMeta("author", event.target.value)}
                className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-400"
                placeholder="著者名"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-[11px] font-bold text-neutral-500">
                表紙画像URL
              </span>
              <input
              onKeyDown={stopTitleInputShortcutKeys}
                value={coverImage}
                onChange={(event) => updateMeta("coverImage", event.target.value)}
                className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-400"
                placeholder="https://..."
              />
            </label>

            <div className="md:col-span-2">
              <CheckboxField
                checked={coverTitleOverlay}
                onChange={(checked) =>
                  updateBooleanMeta("coverTitleOverlay", checked)
                }
              >
                表紙画像にタイトルを重ねる
              </CheckboxField>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-white p-3">
            <div className="mb-3 text-[11px] font-bold text-neutral-500">
              読者向けに生成するシート
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <CheckboxField
                checked={hasCover}
                onChange={(checked) => updateBooleanMeta("cover", checked)}
              >
                表紙
              </CheckboxField>

              <CheckboxField
                checked={hasTitlePage}
                onChange={(checked) => updateBooleanMeta("titlePage", checked)}
              >
                扉
              </CheckboxField>

              <CheckboxField
                checked={hasToc}
                onChange={(checked) => updateBooleanMeta("toc", checked)}
              >
                目次
              </CheckboxField>
            </div>
          </div>

          <details className="rounded-2xl border border-amber-100 bg-white p-3">
            <summary className="cursor-pointer text-[11px] font-bold text-neutral-500">
              内部メタ・表示設定
            </summary>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-bold text-neutral-500">
                  workType
                </span>
                <input
              onKeyDown={stopTitleInputShortcutKeys}
                  value={workType}
                  onChange={(event) => updateMeta("workType", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-400"
                  placeholder="book"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-bold text-neutral-500">
                  renderMode
                </span>
                <input
              onKeyDown={stopTitleInputShortcutKeys}
                  value={renderMode}
                  onChange={(event) => updateMeta("renderMode", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-400"
                  placeholder="page"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-bold text-neutral-500">
                  URL
                </span>
                <input
              onKeyDown={stopTitleInputShortcutKeys}
                  value={url}
                  onChange={(event) => updateMeta("url", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-400"
                  placeholder="https://..."
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-bold text-neutral-500">
                  日時
                </span>
                <input
              onKeyDown={stopTitleInputShortcutKeys}
                  value={time}
                  onChange={(event) => updateMeta("time", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-400"
                  placeholder="2026年6月 など"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-bold text-neutral-500">
                  場所
                </span>
                <input
              onKeyDown={stopTitleInputShortcutKeys}
                  value={place}
                  onChange={(event) => updateMeta("place", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-400"
                  placeholder="Kyoto / Honolulu など"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-bold text-neutral-500">
                  トピック
                </span>
                <input
              onKeyDown={stopTitleInputShortcutKeys}
                  value={topics}
                  onChange={(event) => updateMeta("topics", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-400"
                  placeholder="旅行 / 読書 / 教材 など"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-[11px] font-bold text-neutral-500">
                  読者が最初に開いたときの表示
                </span>
           <select
             value={defaultDisplayMode}
             onChange={(event) =>
               updateDefaultReadingMode(
                 event.target.value as
                   | "full-scroll"
                   | "page-scroll"
                   | "paged",
               )
             }
                  className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-400"
                >
           <option value="full-scroll">全文スクロール</option>
           <option value="page-scroll">PAGEスクロール</option>
           <option value="paged">ページめくり</option>                </select>
                <p className="mt-1 text-[10px] leading-4 text-neutral-400">
                  読者は読書中に表示方法を自由に変更できます。
                </p>
              </label>
            </div>

            <p className="mt-3 text-[11px] leading-5 text-neutral-400">
              ここで設定した内部メタは、BOOKINFOから生成される表紙・扉・目次には直接表示しません。
            </p>
          </details>
        </div>
      )}

      <div className="mb-2 text-[11px] font-bold text-amber-700">
        生成される読者向けシート
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <BookSheetPreviewCard title="表紙">
          {hasCover ? (
            <CoverPreview
              title={previewTitle}
              subtitle={subtitle}
              author={author}
              coverImage={coverImage}
              emptyImageLabel="coverImageなし"
            />
          ) : (
            <EmptyBookPreview label="表紙なし" />
          )}
        </BookSheetPreviewCard>

        <BookSheetPreviewCard title="扉">
          {hasTitlePage ? (
            <TitlePagePreview
              title={previewTitle}
              subtitle={subtitle}
              author={author}
            />
          ) : (
            <EmptyBookPreview label="扉なし" />
          )}
        </BookSheetPreviewCard>

        <BookSheetPreviewCard title="目次">
          {hasToc ? <TocPreview /> : <EmptyBookPreview label="目次なし" />}
        </BookSheetPreviewCard>
      </div>
    </div>
  );
}


function BookSheetPreviewCard({
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

function CoverPreview({
  title,
  subtitle,
  author,
  coverImage,
  emptyImageLabel,
}: {
  title: string;
  subtitle: string;
  author: string;
  coverImage: string;
  emptyImageLabel: string;
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
        <div className="flex aspect-[4/3] items-center justify-center bg-neutral-100 px-4 text-center text-xs leading-5 text-neutral-400">
          {emptyImageLabel}
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

function TitlePagePreview({
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

function TocPreview() {
  return (
    <div className="flex min-h-[170px] items-center justify-center rounded-xl border border-neutral-100 bg-white px-5 py-8 text-center">
      <div className="text-base font-bold tracking-[0.2em] text-neutral-800">
        目次
      </div>
    </div>
  );
}

function EmptyBookPreview({ label }: { label: string }) {
  return (
    <div className="flex min-h-[130px] items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 text-center text-xs font-bold text-neutral-400">
      {label}
    </div>
  );
}

function CheckboxField({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
      <input
              onKeyDown={stopTitleInputShortcutKeys}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
      <span>{children}</span>
    </label>
  );
}

function normalizeBookInfoRaw(value: string): string {
  const raw = value.replace(/\r\n/g, "\n").trim();

  if (raw.length === 0) {
    return [
      "[BOOK] 新しいBOOK",
      "title: 新しいBOOK",
      "subtitle:",
      "author:",
      "coverImage:",
    ].join("\n");
  }

  const lines = raw.split("\n");

  let bookLineIndex = lines.findIndex((line) =>
    /^\s*\[BOOK(?::[^\]]+)?\]/i.test(line.trim()),
  );

  if (bookLineIndex < 0) {
    lines.unshift("[BOOK]");
    bookLineIndex = 0;
  }

  const bookLine = lines[bookLineIndex] ?? "[BOOK]";
  const headerTitle =
    bookLine.match(/^\s*\[BOOK(?::[^\]]+)?\]\s*(.*)$/i)?.[1] ?? "";

  const titleLineIndex = lines.findIndex((line) =>
    /^\s*title\s*:/i.test(line.trim()),
  );

  const titleFromMeta =
    titleLineIndex >= 0
      ? lines[titleLineIndex].replace(/^\s*title\s*:\s*/i, "")
      : "";

  const title =
    titleFromMeta.trim().length > 0
      ? titleFromMeta
      : headerTitle.trim().length > 0
        ? headerTitle
        : "新しいBOOK";

  lines[bookLineIndex] = `[BOOK] ${title}`;

  if (titleLineIndex >= 0) {
    lines[titleLineIndex] = `title: ${title}`;
  } else {
    lines.splice(bookLineIndex + 1, 0, `title: ${title}`);
  }

  return lines.join("\n").trim();
}

function hasMeaningfulBookInfo(raw: string): boolean {
  const fields = parseMetaFields(raw);

  return Boolean(
    getMetaValue(fields, ["title"], "") ||
      getMetaValue(fields, ["subtitle"], "") ||
      getMetaValue(fields, ["author"], "") ||
      getMetaValue(fields, ["coverImage", "cover_image"], "") ||
      getMetaValue(fields, ["url"], "") ||
      getMetaValue(fields, ["time"], "") ||
      getMetaValue(fields, ["place"], "") ||
      getMetaValue(fields, ["topics"], "") ||
      getMetaValue(fields, ["workType", "work_type"], "") ||
      getMetaValue(fields, ["renderMode", "render_mode"], "") ||
      getMetaValue(
        fields,
        ["defaultReadingMode", "default_reading_mode"],
        "",
      ) ||
      getBooleanMeta(fields, ["cover"], false) ||
      getBooleanMeta(fields, ["titlePage", "title_page"], false) ||
      getBooleanMeta(fields, ["toc"], false) ||
      getBooleanMeta(
        fields,
        ["physicalPagination", "physical_pagination"],
        false,
      ),
  );
}

function normalizeDefaultReadingMode(
  value: string,
  renderMode: string,
  physicalPagination: boolean,
): "paged" | "scroll" {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (["scroll", "page-scroll", "continuous"].includes(normalized)) {
    return "scroll";
  }

  if (["paged", "page", "physical"].includes(normalized)) {
    return "paged";
  }

  const normalizedRenderMode = String(renderMode ?? "").trim().toLowerCase();

  if (["scroll", "page-scroll", "cover-scroll"].includes(normalizedRenderMode)) {
    return "scroll";
  }

  if (physicalPagination) {
    return "paged";
  }

  // 既存BOOKは現在のページ送り表示を維持する。
  return "paged";
}

function setColonMetaValue(raw: string, key: string, value: string): string {
  const preparedRaw = raw.replace(/\r\n/g, "\n");
  const sourceRaw =
    preparedRaw.trim().length > 0
      ? preparedRaw
      : normalizeBookInfoRaw(preparedRaw);
  const lines = sourceRaw.split("\n");
  const keyPattern = new RegExp(`^${escapeRegExp(key)}\\s*:`, "i");

  const nextLine = `${key}: ${value}`;
  const foundIndex = lines.findIndex((line) => keyPattern.test(line.trim()));

  if (foundIndex >= 0) {
    lines[foundIndex] = nextLine;
    return lines.join("\n");
  }

  const insertIndex = lines.findIndex((line, index) => {
    if (index === 0) {
      return false;
    }

    return line.trim().startsWith("[");
  });

  if (insertIndex >= 0) {
    const before = lines.slice(0, insertIndex);
    const after = lines.slice(insertIndex);
    return [...before, nextLine, "", ...after].join("\n");
  }

  return [...lines, nextLine].join("\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


function stopTitleInputShortcutKeys(
  event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
) {
  // 親側のパネル選択・ショートカットに Space / Enter などを拾わせない。
  // 入力欄では通常の文字入力を優先する。
  event.stopPropagation();
}

