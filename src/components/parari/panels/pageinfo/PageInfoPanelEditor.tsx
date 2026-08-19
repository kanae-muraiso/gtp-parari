// apps/tools/parari/src/components/parari/panels/pageinfo/PageInfoPanelEditor.tsx
// apps/tools/parari/src/components/parari/panels/pageinfo/PageInfoPanelEditor.tsx
// 2026-06-29 11:05 JST
// PART: Integrated PAGEINFO Panel Editor
// コメント:
// - PAGEINFOをPAGEヘッダー + URL + 公開期間 + 表示設定の統合パネルにする
// - title / subtitle / author / url / publishFrom / publishUntil / timezone / renderMode / mainImage / time / place / topics を編集可能にする
// - 作品自体の公開設定は「自分の作品」で管理する
// - 公開期限は入力表示はローカル、SSOT保存はUTC ISO文字列にする
// - 通常時はPAGEプレビュー、編集時だけフォームを開く

"use client";

import { heicTo, isHeic } from "heic-to";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { compressImageToJpeg } from "../image/imageUploadUtils";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import { getMetaValue, parseMetaFields } from "../shared/metaFields";
import { viewerImageWidthClass } from "../../viewer/viewerWidthRules";

export type PageInfoPanelData = {
  raw: string;
};

type RenderModeValue = "page-scroll" | "page" | "book" | "plain";

async function normalizePageInfoImageFile(file: File): Promise<File> {
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

export function PageInfoPanelEditor({
  data,
  onChangeRaw,
  publicBasePath,
}: PanelEditorProps<PageInfoPanelData>) {
  const mainImageInputId = "pageinfo-main-image-input";

  const [draftRaw, setDraftRaw] = useState(data.raw);
  const [titleDraft, setTitleDraft] = useState(() =>
    getMetaValue(parseMetaFields(data.raw), ["title"], ""),
  );
  const [mainImageUploadStatus, setMainImageUploadStatus] = useState("");
  const [isUploadingMainImage, setIsUploadingMainImage] = useState(false);
  const [isDetailEditing, setIsDetailEditing] = useState(false);

  const [publicUrlMessage, setPublicUrlMessage] = useState("");
    
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
    const url = getMetaValue(fields, ["slug", "url"], "");
    
    const isHome = normalizeBooleanMeta(
      getMetaValue(fields, ["isHome", "is_home"], "false"),
      false,
    );
    
    const menuLabel = getMetaValue(
      fields,
      ["menuLabel", "menu_label"],
      title,
    );

    const showInMenu = normalizeBooleanMeta(
      getMetaValue(fields, ["showInMenu", "show_in_menu"], "true"),
      true,
    );
    
    const menuOrder = getMetaValue(
      fields,
      ["menuOrder", "menu_order"],
      "",
    );
    
    const normalizedPublicBasePath = String(publicBasePath ?? "").replace(
      /\/+$/,
      "",
    );

    const normalizedPageSlug = String(url ?? "")
      .trim()
      .replace(/^\/+|\/+$/g, "");

    const pagePublicPath = normalizedPublicBasePath
      ? isHome || !normalizedPageSlug
        ? normalizedPublicBasePath
        : `${normalizedPublicBasePath}/${encodeURIComponent(normalizedPageSlug)}`
      : "";

    const pagePublicUrl =
      pagePublicPath && typeof window !== "undefined"
        ? `${window.location.origin}${pagePublicPath}`
        : pagePublicPath;
    
  const publishFrom = getMetaValue(fields, ["publishFrom", "publish_from"], "");
  const publishUntil = getMetaValue(fields, ["publishUntil", "publish_until"], "");
  const timezone = getMetaValue(fields, ["timezone"], "Asia/Tokyo");
  const renderMode = normalizeRenderMode(
    getMetaValue(fields, ["renderMode", "render_mode"], "page-scroll"),
  );

  const mainImage = getMetaValue(fields, ["mainImage", "main_image"], "");
  const mainImageWidth = normalizeMainImageWidth(
    getMetaValue(fields, ["mainImageWidth", "main_image_width"], "full"),
  );
  const mainImageOrder = normalizeMainImageOrder(
    getMetaValue(fields, ["mainImageOrder", "main_image_order"], "textFirst"),
  );
  const titleAlign = normalizeTitleAlign(
    getMetaValue(fields, ["titleAlign", "title_align"], "left"),
  );

  const showTitle = normalizeBooleanMeta(
    getMetaValue(fields, ["showTitle", "show_title"], "true"),
    true,
  );

  const time = getMetaValue(fields, ["time"], "");
  const place = getMetaValue(fields, ["place"], "");
  const topics = getMetaValue(fields, ["topics"], "");

  const commitRaw = (nextRaw = draftRaw) => {
    onChangeRaw?.(normalizePageInfoRaw(nextRaw));
  };

  const updateMeta = (key: string, value: string) => {
    const nextRaw = setColonMetaValue(draftRaw, key, value);
    setDraftRaw(nextRaw);
    onChangeRaw?.(normalizePageInfoRaw(nextRaw));
  };

  const commitTitle = (value = titleDraft) => {
    setTitleDraft(value);

    const nextRaw = setColonMetaValue(draftRaw, "title", value);
    setDraftRaw(nextRaw);
    onChangeRaw?.(normalizePageInfoRaw(nextRaw));
  };

  const updateLocalDateTimeMeta = (key: string, localValue: string) => {
    updateMeta(key, localDateTimeToUtcIso(localValue));
  };

    const handleCopyPagePublicUrl = async () => {
      if (!pagePublicUrl) {
        setPublicUrlMessage("公開URLを確認できませんでした。");
        return;
      }

      try {
        await navigator.clipboard.writeText(pagePublicUrl);
        setPublicUrlMessage("PAGE URLをコピーしました。");
      } catch {
        setPublicUrlMessage("URLをコピーできませんでした。");
      }
    };
    
  const handlePickMainImageFile = async (file: File) => {
    console.log("[PAGEINFO image] selected", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
      setMainImageUploadStatus("画像ファイルを選んでください");
      return;
    }

    setIsUploadingMainImage(true);
    setMainImageUploadStatus("画像を準備中…");

    let uploadStep = "開始";

    try {
      uploadStep = "Supabase確認";

      if (!supabase) {
        setMainImageUploadStatus("Supabaseの接続設定を確認できませんでした");
        return;
      }

      uploadStep = "ログイン確認";
      const { data: userData, error: userErr } = await supabase.auth.getUser();

      console.log("[PAGEINFO image] user", {
        hasUser: Boolean(userData.user),
        userErr,
      });

      if (userErr || !userData.user) {
        setMainImageUploadStatus("ログインしてください");
        return;
      }

      uploadStep = "HEIC確認";
      const normalizedFile = await normalizePageInfoImageFile(file);
      uploadStep = "画像圧縮";
      const blob = await compressImageToJpeg(normalizedFile, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.72,
      });

      const uid = userData.user.id;
      const uploadPath = `${uid}/inline/${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}.jpg`;

      uploadStep = "Storageアップロード";
      setMainImageUploadStatus("画像をアップロード中…");

      console.log("[PAGEINFO image] uploadPath", uploadPath);

      const { error: uploadError } = await supabase.storage
        .from("parari-images")
        .upload(uploadPath, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        console.error("[PAGEINFO image] uploadError", uploadError);
        setMainImageUploadStatus(`アップロード失敗: ${uploadError.message}`);
        return;
      }

      uploadStep = "公開URL取得";
      const { data: publicUrlData } = supabase.storage
        .from("parari-images")
        .getPublicUrl(uploadPath);

      console.log("[PAGEINFO image] publicUrl", publicUrlData.publicUrl);

      uploadStep = "mainImage反映";
      const nextRaw = setColonMetaValue(
        normalizePageInfoRaw(draftRaw),
        "mainImage",
        publicUrlData.publicUrl,
      );

      setDraftRaw(nextRaw);
      onChangeRaw?.(normalizePageInfoRaw(nextRaw));
      setMainImageUploadStatus("画像を設定しました");
    } catch (error) {
      console.error("[PAGEINFO image] FORCE-CATCH-20260705", error);

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

      setMainImageUploadStatus(`アップロード失敗 FORCE-CATCH-20260705: ${message}`);
    } finally {
      setIsUploadingMainImage(false);
    }
  };

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-sky-700">PAGEINFO</div>
          <div className="mt-1 text-[11px] leading-5 text-sky-700/80">
            章名とPAGE画像を設定します。公開設定などは詳細編集から変更できます。
          </div>
        </div>

      </div>

      {!isDetailEditing ? (
        <div className="mb-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label="章名"
              value={title}
              placeholder="第1章 / はじめに など"
              onChange={setTitleDraft}
              onCommit={commitTitle}
            />

            <label className="flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 md:self-end">
              <input
                type="checkbox"
                checked={showTitle}
                onChange={(event) =>
                  updateMeta(
                    "showTitle",
                    String(event.currentTarget.checked),
                  )
                }
                className="h-4 w-4 rounded border-sky-300"
              />
              <span className="text-xs font-bold text-neutral-700">
                PAGEタイトルを表示する
              </span>
            </label>

            <div className="mt-2 space-y-2 md:col-span-2">
              <div className="text-[11px] font-bold text-neutral-500">
                PAGE画像
              </div>

              <input
              onKeyDown={stopTitleInputShortcutKeys}
                id={mainImageInputId}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  event.currentTarget.value = "";

                  if (file) {
                    void handlePickMainImageFile(file);
                  }
                }}
              />

              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor={mainImageInputId}
                  aria-disabled={isUploadingMainImage}
                  className={[
                    "rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-bold text-sky-700 transition hover:bg-sky-50",
                    isUploadingMainImage
                      ? "pointer-events-none cursor-not-allowed opacity-50"
                      : "cursor-pointer",
                  ].join(" ")}
                >
                  {isUploadingMainImage ? "アップロード中…" : "画像を選ぶ"}
                </label>

                {mainImageUploadStatus ? (
                  <span className="text-xs text-neutral-500">
                    {mainImageUploadStatus}
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
                  value={mainImage}
                  onChange={(event) => updateMeta("mainImage", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-sky-400"
                  placeholder="https://..."
                />
              </label>
            </div>
          </div>

          {mainImage ? (
            <div className="overflow-hidden rounded-xl bg-white p-2 ring-1 ring-sky-100">
              <img
                src={mainImage}
                alt=""
                className="max-h-72 w-full object-contain"
              />
            </div>
          ) : null}

                           {pagePublicPath ? (
                             <div className="rounded-xl border border-sky-200 bg-white p-3">
                               <div className="text-[11px] font-bold text-neutral-500">
                                 PAGE URL
                               </div>

                               <div className="mt-1 break-all text-xs leading-5 text-neutral-700">
                                 {pagePublicUrl}
                               </div>

                               <div className="mt-3 flex flex-wrap items-center gap-2">
                                 <a
                                   href={pagePublicPath}
                                   target="_blank"
                                   rel="noreferrer"
                                   className="rounded-full bg-sky-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-sky-800"
                                 >
                                   PAGEを開く
                                 </a>

                                 <button
                                   type="button"
                                   onClick={handleCopyPagePublicUrl}
                                   className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-50"
                                 >
                                   URLをコピー
                                 </button>

                                 {publicUrlMessage ? (
                                   <span className="text-xs text-neutral-500">
                                     {publicUrlMessage}
                                   </span>
                                 ) : null}
                               </div>
                             </div>
                           ) : null}
                           
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsDetailEditing(true)}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-50"
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
              className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-50"
            >
              簡易編集に戻る
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label="PAGEタイトル"
              value={title}
              placeholder="PAGEタイトル"
              onChange={setTitleDraft}
              onCommit={commitTitle}
            />

            <label className="flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2">
              <input
                type="checkbox"
                checked={showTitle}
                onChange={(event) =>
                  updateMeta(
                    "showTitle",
                    String(event.currentTarget.checked),
                  )
                }
                className="h-4 w-4 rounded border-sky-300"
              />
              <span className="text-xs font-bold text-neutral-700">
                PAGEタイトルを公開画面に表示する
              </span>
            </label>

            <TextField
              label="サブタイトル"
              value={subtitle}
              placeholder="サブタイトル"
              onChange={(value) => updateMeta("subtitle", value)}
            />

            <TextField
              label="著者名"
              value={author}
              placeholder="青山太郎 など"
              onChange={(value) => updateMeta("author", value)}
            />

           <TextField
             label="PAGE slug"
             value={url}
             placeholder="about / access など"
             onChange={(value) => updateMeta("slug", value)}
           />

           <TextField
             label="PAGE slug"
             value={url}
             placeholder="about / access など"
             onChange={(value) => updateMeta("slug", value)}
           />

           <label className="flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2">
             <input
               type="checkbox"
               checked={isHome}
               onChange={(event) =>
                 updateMeta("isHome", String(event.currentTarget.checked))
               }
               className="h-4 w-4 rounded border-sky-300"
             />

             <span className="text-xs font-bold text-neutral-700">
               このPAGEをWEBのホームにする
             </span>
           </label>
           
           <TextField
             label="メニュー表示名"
             value={menuLabel}
             placeholder={title || "ABOUT"}
             onChange={(value) => updateMeta("menuLabel", value)}
           />

           <TextField
             label="メニュー表示順"
             value={menuOrder}
             placeholder="10 / 20 / 30 など"
             onChange={(value) => updateMeta("menuOrder", value)}
           />
           
           <label className="flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2">
             <input
               type="checkbox"
               checked={showInMenu}
               onChange={(event) =>
                 updateMeta("showInMenu", String(event.currentTarget.checked))
               }
               className="h-4 w-4 rounded border-sky-300"
             />

             <span className="text-xs font-bold text-neutral-700">
               共通HEADERのメニューに表示する
             </span>
           </label>

            <label className="block">
              <span className="text-[11px] font-bold text-neutral-500">
                表示方法
              </span>
              <select
                value={renderMode}
                onChange={(event) => updateMeta("renderMode", event.target.value)}
                className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-sky-400"
              >
                <option value="page-scroll">PAGEスクロール</option>
                <option value="page">PAGE表示</option>
                <option value="book">BOOK表示</option>
                <option value="plain">プレーン表示</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-bold text-neutral-500">
                公開開始
              </span>
              <input
              onKeyDown={stopTitleInputShortcutKeys}
                type="datetime-local"
                value={utcIsoToLocalDateTime(publishFrom)}
                onChange={(event) =>
                  updateLocalDateTimeMeta("publishFrom", event.target.value)
                }
                className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-sky-400"
              />
              <div className="mt-1 text-[10px] leading-4 text-neutral-400">
                SSOTにはUTCで保存されます。
              </div>
            </label>

            <label className="block">
              <span className="text-[11px] font-bold text-neutral-500">
                公開終了
              </span>
              <input
              onKeyDown={stopTitleInputShortcutKeys}
                type="datetime-local"
                value={utcIsoToLocalDateTime(publishUntil)}
                onChange={(event) =>
                  updateLocalDateTimeMeta("publishUntil", event.target.value)
                }
                className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-sky-400"
              />
              <div className="mt-1 text-[10px] leading-4 text-neutral-400">
                判定は nowUTC &lt; publishUntil で行います。
              </div>
            </label>

            <TextField
              label="タイムゾーン"
              value={timezone}
              placeholder="Asia/Tokyo"
              onChange={(value) => updateMeta("timezone", value)}
            />

            <TextField
              label="日時"
              value={time}
              placeholder="2026年6月 / 9:00 など"
              onChange={(value) => updateMeta("time", value)}
            />

            <TextField
              label="場所"
              value={place}
              placeholder="Kyoto / Honolulu など"
              onChange={(value) => updateMeta("place", value)}
            />

            <TextField
              label="トピック"
              value={topics}
              placeholder="旅行 / 食事 / 学習 など"
              onChange={(value) => updateMeta("topics", value)}
            />

            <label className="block md:col-span-2">
              <span className="text-[11px] font-bold text-neutral-500">
                PAGE画像URL
              </span>
              <input
              onKeyDown={stopTitleInputShortcutKeys}
                value={mainImage}
                onChange={(event) => updateMeta("mainImage", event.target.value)}
                className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-sky-400"
                placeholder="https://..."
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-bold text-neutral-500">
                PAGE画像の幅
              </span>
              <select
                value={mainImageWidth}
                onChange={(event) => updateMeta("mainImageWidth", event.target.value)}
                className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-sky-400"
              >
                <option value="full">全幅 最大720px</option>
                <option value="100">キャンバス100%</option>
                <option value="90">本文幅90%</option>
                <option value="normal">通常75%</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-bold text-neutral-500">
                画像とタイトルの順番
              </span>
              <select
                value={mainImageOrder}
                onChange={(event) => updateMeta("mainImageOrder", event.target.value)}
                className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-sky-400"
              >
                <option value="textFirst">タイトル → 画像</option>
                <option value="imageFirst">画像 → タイトル</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-bold text-neutral-500">
                タイトル位置
              </span>
              <select
                value={titleAlign}
                onChange={(event) => updateMeta("titleAlign", event.target.value)}
                className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-sky-400"
              >
                <option value="left">左寄せ</option>
                <option value="center">中央</option>
                <option value="right">右寄せ</option>
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}


function TextField({
  label,
  value,
  placeholder,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-neutral-500">{label}</span>
      <input
        onKeyDown={stopTitleInputShortcutKeys}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={(event) => onCommit?.(event.currentTarget.value)}
        onCompositionEnd={(event) => onCommit?.(event.currentTarget.value)}
        className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-sky-400"
        placeholder={placeholder}
      />
    </label>
  );
}

function InfoBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold text-sky-800">
      {children}
    </span>
  );
}

function PageInfoPreviewText({
  previewTitle,
  subtitle,
  author,
  url,
  publishFrom,
  publishUntil,
  timezone,
  time,
  place,
  topics,
  titleAlign,
}: {
  previewTitle: string;
  subtitle: string;
  author: string;
  url: string;
  publishFrom: string;
  publishUntil: string;
  timezone: string;
  time: string;
  place: string;
  topics: string;
  titleAlign: "left" | "center" | "right";
}) {
  return (
    <div className="mt-4">
      <h3 className="text-xl font-bold leading-7 text-neutral-900">
        {previewTitle}
      </h3>

      {subtitle ? (
        <div className="mt-1 text-sm leading-6 text-neutral-500">
          {subtitle}
        </div>
      ) : null}

      {author ? (
        <div className="mt-1 text-xs leading-5 text-neutral-500">
          {author}
        </div>
      ) : null}

      {url ? (
        <div className="mt-2 text-xs leading-5 text-neutral-400">
          URL: <code>{url}</code>
        </div>
      ) : null}

      {publishFrom || publishUntil || timezone ? (
        <div className="mt-3 rounded-2xl bg-sky-50 p-3 text-[11px] leading-5 text-sky-900">
          {publishFrom ? (
            <div>
              公開開始: {formatUtcIsoForDisplay(publishFrom)}{" "}
              <span className="text-sky-700/60">({timezone})</span>
            </div>
          ) : null}

          {publishUntil ? (
            <div>
              公開終了: {formatUtcIsoForDisplay(publishUntil)}{" "}
              <span className="text-sky-700/60">({timezone})</span>
            </div>
          ) : null}

          {!publishFrom && !publishUntil && timezone ? (
            <div>タイムゾーン: {timezone}</div>
          ) : null}
        </div>
      ) : null}

      {time || place || topics ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {time ? <InfoBadge>{time}</InfoBadge> : null}
          {place ? <InfoBadge>{place}</InfoBadge> : null}
          {topics ? <InfoBadge>{topics}</InfoBadge> : null}
        </div>
      ) : null}
    </div>
  );
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

function PageInfoPreviewImage({
  mainImage,
  mainImageWidth,
}: {
  mainImage: string;
  mainImageWidth: string;
}) {
  if (!mainImage) {
    return null;
  }

  return (
    <div className={["mt-5", mainImageWidthClass(mainImageWidth)].join(" ")}>
      <img src={mainImage} alt="" className="h-auto w-full rounded-2xl" />
    </div>
  );
}

function normalizePageInfoRaw(value: string): string {
  const raw = value.replace(/\r\n/g, "\n").trim();

  if (raw.length === 0) {
    return [
      "[PAGE] 新しいページ",
      "title: 新しいページ",
      "subtitle:",
      "mainImage:",
      "showTitle: true",
      "titleAlign: left",
    ].join("\n");
  }

  const lines = raw.split("\n");
  let pageLineIndex = lines.findIndex((line) =>
    /^\s*\[PAGE(?::[^\]]+)?\]/i.test(line.trim()),
  );

  if (pageLineIndex < 0) {
    lines.unshift("[PAGE]");
    pageLineIndex = 0;
  }

  const pageLine = lines[pageLineIndex] ?? "[PAGE]";
  const headerTitle =
    pageLine.match(/^\s*\[PAGE(?::[^\]]+)?\]\s*(.*)$/i)?.[1] ?? "";

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
        : "新しいページ";

  lines[pageLineIndex] = `[PAGE] ${title}`;

  if (titleLineIndex >= 0) {
    lines[titleLineIndex] = `title: ${title}`;
  } else {
    lines.splice(pageLineIndex + 1, 0, `title: ${title}`);
  }

  return lines.join("\n").trim();
}


function hasMeaningfulPageInfo(raw: string): boolean {
  const fields = parseMetaFields(raw);

  return Boolean(
    getMetaValue(fields, ["title"], "") ||
      getMetaValue(fields, ["subtitle"], "") ||
      getMetaValue(fields, ["author"], "") ||
      getMetaValue(fields, ["url"], "") ||
      getMetaValue(fields, ["publishFrom", "publish_from"], "") ||
      getMetaValue(fields, ["publishUntil", "publish_until"], "") ||
      getMetaValue(fields, ["timezone"], "") ||
      getMetaValue(fields, ["renderMode", "render_mode"], "") ||
      getMetaValue(fields, ["mainImage", "main_image"], "") ||
                 
      getMetaValue(fields, ["mainImageWidth", "main_image_width"], "") ||
      getMetaValue(fields, ["mainImageOrder", "main_image_order"], "") ||
                 
      getMetaValue(fields, ["time"], "") ||
      getMetaValue(fields, ["place"], "") ||
      getMetaValue(fields, ["topics"], ""),
  );
}

function setColonMetaValue(raw: string, key: string, value: string): string {
  const preparedRaw = raw.replace(/\r\n/g, "\n");
  const sourceRaw =
    preparedRaw.trim().length > 0
      ? preparedRaw
      : normalizePageInfoRaw(preparedRaw);
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


function normalizeRenderMode(value: string): RenderModeValue {
  if (
    value === "page-scroll" ||
    value === "page" ||
    value === "book" ||
    value === "plain"
  ) {
    return value;
  }

  return "page-scroll";
}

function renderModeLabel(value: RenderModeValue): string {
  switch (value) {
    case "page-scroll":
      return "PAGEスクロール";
    case "page":
      return "PAGE表示";
    case "book":
      return "BOOK表示";
    case "plain":
      return "プレーン表示";
    default:
      return value;
  }
}

function utcIsoToLocalDateTime(value: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hour = pad2(date.getHours());
  const minute = pad2(date.getMinutes());

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function localDateTimeToUtcIso(value: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
}

function formatUtcIsoForDisplay(value: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hour = pad2(date.getHours());
  const minute = pad2(date.getMinutes());

  return `${year}/${month}/${day} ${hour}:${minute}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeMainImageWidth(
  value: string,
): "full" | "100" | "90" | "normal" {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "full" || normalized === "max" || normalized === "bleed") {
    return "full";
  }

  if (
    normalized === "100" ||
    normalized === "100%" ||
    normalized === "canvas" ||
    normalized === "container"
  ) {
    return "100";
  }

  if (
    normalized === "90" ||
    normalized === "90%" ||
    normalized === "wide" ||
    normalized === "standard" ||
    normalized === "text" ||
    normalized === "body"
  ) {
    return "90";
  }

  /**
   * 旧 narrow / small は新ルールでは通常画像へ寄せる。
   */
  if (
    normalized === "normal" ||
    normalized === "default" ||
    normalized === "narrow" ||
    normalized === "small" ||
    normalized === "70" ||
    normalized === "75" ||
    normalized === "80"
  ) {
    return "normal";
  }

  return "full";
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

function normalizeTitleAlign(value: string): "left" | "center" | "right" {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "center" || normalized === "中央") {
    return "center";
  }

  if (normalized === "right" || normalized === "右" || normalized === "右寄せ") {
    return "right";
  }

  return "left";
}

function normalizeMainImageOrder(value: string): "textFirst" | "imageFirst" {
  if (value === "imageFirst" || value === "textFirst") {
    return value;
  }

  return "textFirst";
}

function mainImageWidthClass(value: string): string {
  return viewerImageWidthClass(value, "max");
}


function stopTitleInputShortcutKeys(
  event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
) {
  // 親側のパネル選択・ショートカットに Space / Enter などを拾わせない。
  // 入力欄では通常の文字入力を優先する。
  event.stopPropagation();
}

