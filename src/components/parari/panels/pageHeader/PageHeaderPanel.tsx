// src/components/parari/panels/pageHeader/PageHeaderPanel.tsx
// src/components/parari/panels/pageHeader/PageHeaderPanel.tsx
// 2026-06-28 11:15 JST
// PARARI PageHeaderPanel: title / PAGE image / visibility / save controls
// PART: PAGE image upload
// コメント:
// - PAGE画像に「画像を選ぶ」ボタンを追加
// - HEIC / HEIF は JPEG に変換
// - 既存の compressImageToJpeg を流用して長辺1200px / JPEG品質0.72へ圧縮
// - Supabase Storage parari-images に保存
// - 取得した publicUrl を mainImageUrl に反映する

"use client";

import { useMemo, useRef, useState } from "react";
import { heicTo, isHeic } from "heic-to";
import { supabase } from "@/lib/supabaseClient";
import { compressImageToJpeg } from "../image/imageUploadUtils";
import type {
  PageHeaderPanelTexts,
  PageVisibility,
} from "./pageHeaderPanelTypes";

type PageHeaderPanelProps = {
  title: string;
  onTitleChange: (nextTitle: string) => void;

  authorName?: string;
  authorUrl?: string;

  mainImageUrl?: string;
  onMainImageUrlChange?: (nextUrl: string) => void;

  mainImageAlt?: string;
  onMainImageAltChange?: (nextAlt: string) => void;

  visibility: PageVisibility;
  onVisibilityChange: (nextVisibility: PageVisibility) => void;

  backHref?: string;
  viewHref?: string;

  saving?: boolean;
  onSave: () => void;

  texts?: Partial<PageHeaderPanelTexts>;
};

const DEFAULT_TEXTS: PageHeaderPanelTexts = {
  back: "←",
  save: "保存",
  saving: "保存中…",
  preview: "表示",
  image: "IMG",
  settings: "SET",
  titlePlaceholder: "タイトル",
  imageUrlPlaceholder: "PAGE画像URL",
  imageAltPlaceholder: "画像の説明",
  imageEmpty: "PAGE画像を追加",
  clearImage: "画像を削除",
  visibilityLabel: "公開設定",
  visibilityPrivate: "非公開",
  visibilityUnlisted: "限定公開",
  visibilityPublic: "公開",
};

async function normalizeUploadImage(
  file: File,
): Promise<{ file: File; converted: boolean }> {
  const mime = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();

  const looksHeic =
    mime === "image/heic" ||
    mime === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif");

  const reallyHeic = looksHeic || (await isHeic(file).catch(() => false));

  if (!reallyHeic) {
    return { file, converted: false };
  }

  const converted = await heicTo({
    blob: file,
    type: "image/jpeg",
    quality: 0.92,
  });

  const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
  const jpegName =
    file.name.replace(/\.(heic|heif)$/i, ".jpg") || "image.jpg";

  return {
    file: new File([jpegBlob], jpegName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    }),
    converted: true,
  };
}

export function PageHeaderPanel({
  title,
  onTitleChange,
  authorName,
  authorUrl,
  mainImageUrl = "",
  onMainImageUrlChange,
  mainImageAlt = "",
  onMainImageAltChange,
  visibility,
  onVisibilityChange,
  backHref,
  viewHref,
  saving = false,
  onSave,
  texts,
}: PageHeaderPanelProps) {
  const t = {
    ...DEFAULT_TEXTS,
    ...texts,
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [imageOpen, setImageOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadStatus, setImageUploadStatus] = useState("");

    const [copiedUrlKind, setCopiedUrlKind] = useState<
      "direct" | "author" | ""
    >("");

    const authorShareUrl = useMemo(() => {
      return toAbsoluteShareUrl(viewHref);
    }, [viewHref]);

    const directHref = useMemo(() => {
      return createDirectWorkHrefFromViewHref(viewHref);
    }, [viewHref]);

    const directShareUrl = useMemo(() => {
      return toAbsoluteShareUrl(directHref);
    }, [directHref]);

    const handleCopyUrl = (value: string, kind: "direct" | "author") => {
      if (!value) {
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard) {
        void navigator.clipboard.writeText(value);
        setCopiedUrlKind(kind);
        window.setTimeout(() => setCopiedUrlKind(""), 1800);
        return;
      }

      setCopiedUrlKind("");
    };
    
  const handlePickMainImageFile = async (file: File) => {
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
      setImageUploadStatus("画像ファイルを選んでください");
      return;
    }

    if (!onMainImageUrlChange) {
      setImageUploadStatus("PAGE画像を反映できません");
      return;
    }

    setIsUploadingImage(true);
    setImageUploadStatus("画像を準備中…");

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();

      if (userErr || !userData.user) {
        setImageUploadStatus("ログインしてください");
        return;
      }

      const { file: normalizedFile, converted } =
        await normalizeUploadImage(file);

      if (converted) {
        setImageUploadStatus("HEIC を JPEG に変換中…");
      }

      setImageUploadStatus("画像を圧縮中…");
      const blob = await compressImageToJpeg(normalizedFile, 1200, 0.72);

      const uid = userData.user.id;
      const path = `${uid}/page-main/${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}.jpg`;

      setImageUploadStatus("画像をアップロード中…");

      const { error: uploadError } = await supabase.storage
        .from("parari-images")
        .upload(path, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        setImageUploadStatus(`アップロード失敗: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("parari-images")
        .getPublicUrl(path);

      const publicUrl = publicUrlData.publicUrl;

      onMainImageUrlChange(publicUrl);
      setImageOpen(true);

      setImageUploadStatus(
        converted
          ? "HEIC を JPEG に変換してPAGE画像を反映しました"
          : "PAGE画像を反映しました",
      );
    } catch (error: any) {
      setImageUploadStatus(`画像処理失敗: ${error?.message ?? String(error)}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-sm">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;

          if (file) {
            void handlePickMainImageFile(file);
          }

          event.currentTarget.value = "";
        }}
      />

      <div className="flex items-start gap-3">
        {backHref ? (
          <a
            href={backHref}
            className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-sm text-neutral-500 hover:bg-neutral-50"
            aria-label="戻る"
          >
            {t.back}
          </a>
        ) : (
          <div className="h-8 w-8" />
        )}

        <div className="min-w-0 flex-1">
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder={t.titlePlaceholder}
            className="w-full bg-transparent text-2xl font-bold leading-tight text-neutral-900 outline-none placeholder:text-neutral-300"
          />

          {authorName ? (
            <div className="mt-1 text-xs text-neutral-400">
              by{" "}
              {authorUrl ? (
                <a href={authorUrl} className="hover:text-neutral-600">
                  {authorName}
                </a>
              ) : (
                <span>{authorName}</span>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setImageOpen((current) => !current)}
            className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-bold text-neutral-500 hover:bg-neutral-50"
          >
            {t.image}
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen((current) => !current)}
            className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-bold text-neutral-500 hover:bg-neutral-50"
          >
            {t.settings}
          </button>

          {viewHref ? (
            <a
              href={viewHref}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-bold text-neutral-500 hover:bg-neutral-50"
            >
              {t.preview}
            </a>
          ) : null}

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-full bg-neutral-900 px-4 py-1 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving ? t.saving : t.save}
          </button>
        </div>
      </div>

      {mainImageUrl ? (
        <div className="mt-4 overflow-hidden rounded-2xl bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mainImageUrl}
            alt={mainImageAlt || title || "PAGE image"}
            className="max-h-[320px] w-full object-cover"
          />
        </div>
      ) : null}

      {imageOpen ? (
        <div className="mt-4 rounded-2xl bg-neutral-50 p-3">
          <div className="mb-2 text-xs font-bold text-neutral-500">
            {mainImageUrl ? t.image : t.imageEmpty}
          </div>

          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploadingImage ? "アップロード中…" : "画像を選ぶ"}
            </button>

            {imageUploadStatus ? (
              <span className="text-xs text-neutral-500">
                {imageUploadStatus}
              </span>
            ) : (
              <span className="text-xs text-neutral-400">
                スマホでは写真ライブラリやカメラから選べます
              </span>
            )}
          </div>

          <input
            value={mainImageUrl}
            onChange={(event) => onMainImageUrlChange?.(event.target.value)}
            placeholder={t.imageUrlPlaceholder}
            className="mb-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
          />

          <input
            value={mainImageAlt}
            onChange={(event) => onMainImageAltChange?.(event.target.value)}
            placeholder={t.imageAltPlaceholder}
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
          />

          {mainImageUrl ? (
            <button
              type="button"
              onClick={() => {
                onMainImageUrlChange?.("");
                onMainImageAltChange?.("");
                setImageUploadStatus("");
              }}
              className="mt-2 text-xs font-bold text-neutral-400 hover:text-neutral-700"
            >
              {t.clearImage}
            </button>
          ) : null}
        </div>
      ) : null}

          {settingsOpen ? (
            <div className="mt-4 space-y-4 rounded-2xl bg-neutral-50 p-3">
              <div>
                <div className="mb-2 text-xs font-bold text-neutral-500">
                  {t.visibilityLabel}
                </div>

                <div className="flex flex-wrap gap-2">
                  <VisibilityButton
                    active={visibility === "private"}
                    label={t.visibilityPrivate}
                    onClick={() => onVisibilityChange("private")}
                  />

                  <VisibilityButton
                    active={visibility === "unlisted"}
                    label={t.visibilityUnlisted}
                    onClick={() => onVisibilityChange("unlisted")}
                  />

                  <VisibilityButton
                    active={visibility === "public"}
                    label={t.visibilityPublic}
                    onClick={() => onVisibilityChange("public")}
                  />
                </div>
              </div>

              {directShareUrl || authorShareUrl ? (
                <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-3">
                  <div className="text-xs font-bold text-neutral-500">
                    作品URL
                  </div>

                  {directShareUrl ? (
                    <ShareUrlRow
                      label="直接URL"
                      description="username未設定でも使えるURLです。読者に送る場合はこちらが便利です。"
                      href={directHref}
                      url={directShareUrl}
                      copied={copiedUrlKind === "direct"}
                      onCopy={() => handleCopyUrl(directShareUrl, "direct")}
                    />
                  ) : null}

                  {authorShareUrl ? (
                    <ShareUrlRow
                      label="作者URL"
                      description="作者名つきのURLです。作品一覧や作者ページとのつながりを見せたい場合に使います。"
                      href={viewHref}
                      url={authorShareUrl}
                      copied={copiedUrlKind === "author"}
                      onCopy={() => handleCopyUrl(authorShareUrl, "author")}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-3 text-xs leading-5 text-neutral-400">
                  保存後に作品URLを表示できます。
                </div>
              )}
            </div>
          ) : null}
    </section>
  );
}

// PART: ShareUrlRow
// コメント:
// - SET内で直接URL / 作者URLを表示してコピーする

function ShareUrlRow({
  label,
  description,
  href,
  url,
  copied,
  onCopy,
}: {
  label: string;
  description: string;
  href?: string;
  url: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-neutral-700">
          {label}
        </span>

        <span className="text-[11px] leading-5 text-neutral-400">
          {description}
        </span>
      </div>

      <div className="break-all rounded-lg bg-white px-3 py-2 text-xs leading-5 text-neutral-600 ring-1 ring-neutral-100">
        {url}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-neutral-700"
        >
          URLをコピー
        </button>

        {href ? (
          <a
            href={href}
            className="rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-bold text-neutral-500 hover:bg-neutral-50"
          >
            開く
          </a>
        ) : null}

        {copied ? (
          <span className="text-xs font-bold text-emerald-700">
            コピーしました
          </span>
        ) : null}
      </div>
    </div>
  );
}

function toAbsoluteShareUrl(href?: string): string {
  if (!href) {
    return "";
  }

  if (/^https?:\/\//i.test(href)) {
    return href;
  }

  if (typeof window === "undefined") {
    return href;
  }

  return new URL(href, window.location.origin).toString();
}

// src/components/parari/panels/pageHeader/PageHeaderPanel.tsx
// 2026-06-28 16:05 JST
// PART: createDirectWorkHrefFromViewHref
// コメント:
// - viewHrefの形式が多少違っても /p/{workId} を作れるようにする
// - /pages/{id}/view だけでなく /pages/{id} /edit / 旧slug形式にも対応する

function createDirectWorkHrefFromViewHref(viewHref?: string): string {
  if (!viewHref) {
    return "";
  }

  const path = viewHref.replace(/^https?:\/\/[^/]+/i, "").split(/[?#]/)[0] ?? "";

  // すでに直接URLの場合
  const directMatch = path.match(/^\/p\/([^/]+)$/);

  if (directMatch?.[1]) {
    return `/p/${directMatch[1]}`;
  }

  // 新PAGE URL:
  // /{username}/pages/{workId}/view
  // /{username}/pages/{workId}
  // /{username}/pages/{workId}/edit
  const pageMatch = path.match(/\/pages\/([^/]+)(?:\/(?:view|edit))?\/?$/);

  if (pageMatch?.[1]) {
    return `/p/${pageMatch[1]}`;
  }

  // 将来用:
  // /{username}/books/{workId}/view
  const bookMatch = path.match(/\/books\/([^/]+)(?:\/(?:view|edit))?\/?$/);

  if (bookMatch?.[1]) {
    return `/p/${bookMatch[1]}`;
  }

  // 将来用:
  // /{username}/applications/{workId}/view
  const applicationMatch = path.match(
    /\/applications\/([^/]+)(?:\/(?:view|edit))?\/?$/,
  );

  if (applicationMatch?.[1]) {
    return `/p/${applicationMatch[1]}`;
  }

  // 旧公開URL:
  // /{username}/{workSlug}
  // ただし /works は作品一覧なので除外する
  const oldPublicMatch = path.match(/^\/([^/]+)\/([^/]+)\/?$/);

  if (oldPublicMatch?.[2] && oldPublicMatch[2] !== "works") {
    return `/p/${oldPublicMatch[2]}`;
  }

  return "";
}

function VisibilityButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1 text-xs font-bold",
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
