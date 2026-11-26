"use client";

import { useEffect, useRef, useState } from "react";
import { heicTo, isHeic } from "heic-to";
import { supabase } from "@/lib/supabaseClient";
import { compressImageToJpeg } from "./imageUploadUtils";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import { ImagePanelRenderer } from "./ImagePanelRenderer";
import type {
  ImagePanelData,
  ImagePanelGap,
  ImageWidthMode,
} from "./parseImagePanel";
import { serializeImagePanel } from "./serializeImagePanel";

const IMAGE_WIDTH_OPTIONS: { value: ImageWidthMode; label: string }[] = [
  { value: "full", label: "全幅 最大720px" },
  { value: "100", label: "キャンバス100%" },
  { value: "90", label: "本文幅90%" },
  { value: "normal", label: "通常75%" },
];

const PANEL_GAP_OPTIONS: { value: ImagePanelGap; label: string }[] = [
  { value: "default", label: "通常" },
  { value: "zero", label: "なし" },
];

type ImageLibraryFile = {
  name: string;
  path: string;
  id: string;
  created_at?: string | null;
  metadata?: { mimetype?: string; size?: number } | null;
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

  if (!reallyHeic) return { file, converted: false };

  const converted = await heicTo({
    blob: file,
    type: "image/jpeg",
    quality: 0.92,
  });
  const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
  const jpegName =
    file.name.replace(/.(heic|heif)$/i, ".jpg") || "image.jpg";

  return {
    file: new File([jpegBlob], jpegName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    }),
    converted: true,
  };
}

export function ImagePanelEditor({
  block,
  data,
  onChangeRaw,
}: PanelEditorProps<ImagePanelData>) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draftData, setDraftData] = useState<ImagePanelData>(data);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [imageLibraryOpen, setImageLibraryOpen] = useState(false);
  const [imageLibraryFiles, setImageLibraryFiles] = useState<ImageLibraryFile[]>([]);
  const [imageLibraryVisibleCount, setImageLibraryVisibleCount] = useState(60);
  const [imageLibraryHasMore, setImageLibraryHasMore] = useState(false);
  const [imageLibraryLoading, setImageLibraryLoading] = useState(false);
  const [imageLibraryError, setImageLibraryError] = useState("");

  useEffect(() => {
    setDraftData(data);
  }, [data.raw]);

  const commitData = (nextData: ImagePanelData = draftData) => {
    onChangeRaw?.(serializeImagePanel(nextData));
  };

  const updateDraftData = (partial: Partial<ImagePanelData>) => {
    setDraftData((current) => ({ ...current, ...partial }));
  };

  const updateAndCommitData = (partial: Partial<ImagePanelData>) => {
    const nextData = { ...draftData, ...partial };
    setDraftData(nextData);
    commitData(nextData);
  };

  const loadImageLibrary = async () => {
    if (imageLibraryLoading) return;
    setImageLibraryLoading(true);
    setImageLibraryError("");

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        setImageLibraryError("ログイン状態を確認できませんでした。");
        return;
      }

      const uid = userData.user.id;

      // Older uploads live in several user-owned folders, so walk only this
      // user's folder tree and collect image objects from every generation.
      const pendingFolders = [uid];
      const files: ImageLibraryFile[] = [];

      while (pendingFolders.length > 0) {
        const folderBatch = pendingFolders.splice(0, 8);
        const folderResults = await Promise.all(folderBatch.map(async (folderPath) => {
          const childFolders: string[] = [];
          const folderFiles: ImageLibraryFile[] = [];
          let offset = 0;
          let hasNextPage = true;

          while (hasNextPage) {
            const { data, error } = await supabase.storage
              .from("parari-images")
              .list(folderPath, {
                limit: 100,
                offset,
                sortBy: { column: "created_at", order: "desc" },
              });

            if (error) throw new Error(error.message);

            const entries = data ?? [];
            for (const item of entries) {
              if (item.id === null) {
                childFolders.push(folderPath + "/" + item.name);
                continue;
              }

              const mime = item.metadata?.mimetype ?? "";
              const isImage = mime.startsWith("image/") || /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(item.name);
              if (isImage) {
                folderFiles.push({
                  name: item.name,
                  path: folderPath + "/" + item.name,
                  id: item.id,
                  created_at: item.created_at,
                  metadata: item.metadata,
                });
              }
            }

            hasNextPage = entries.length === 100;
            offset += entries.length;
          }

          return { childFolders, folderFiles };
        }));

        for (const result of folderResults) {
          pendingFolders.push(...result.childFolders);
          files.push(...result.folderFiles);
        }
      }

      files.sort((a, b) => {
        const dateDifference = new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
        return dateDifference || a.path.localeCompare(b.path);
      });
      setImageLibraryFiles(files);
      setImageLibraryVisibleCount(60);
      setImageLibraryHasMore(files.length > 60);
    } catch (error: any) {
      setImageLibraryError("画像を読み込めませんでした: " + (error?.message ?? String(error)));
    } finally {
      setImageLibraryLoading(false);
    }
  };

  const openImageLibrary = () => {
    setImageLibraryFiles([]);
    setImageLibraryVisibleCount(60);
    setImageLibraryHasMore(false);
    setImageLibraryOpen(true);
    void loadImageLibrary();
  };

  const showMoreLibraryImages = () => {
    const nextCount = imageLibraryVisibleCount + 60;
    setImageLibraryVisibleCount(nextCount);
    setImageLibraryHasMore(imageLibraryFiles.length > nextCount);
  };

  const chooseLibraryImage = (path: string) => {
    const { data: publicUrlData } = supabase.storage
      .from("parari-images")
      .getPublicUrl(path);
    const nextData = { ...draftData, url: publicUrlData.publicUrl };
    setDraftData(nextData);
    commitData(nextData);
    setUploadStatus("マイ画像を反映しました");
    setImageLibraryOpen(false);
  };

  const handlePickImageFile = async (file: File) => {
    if (!file.type.startsWith("image/") && !/.(heic|heif)$/i.test(file.name)) {
      setUploadStatus("画像ファイルを選んでください");
      return;
    }

    setIsUploading(true);
    setUploadStatus("画像を準備中…");

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        setUploadStatus("ログインしてください");
        return;
      }

      const { file: normalizedFile } = await normalizeUploadImage(file);
      const blob = await compressImageToJpeg(normalizedFile, 1200, 0.72);
      const uid = userData.user.id;
      const path = `${uid}/inline/${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;

      setUploadStatus("画像をアップロード中…");
      const { error: uploadError } = await supabase.storage
        .from("parari-images")
        .upload(path, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        setUploadStatus(`アップロード失敗: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("parari-images")
        .getPublicUrl(path);

      const nextData = {
        ...draftData,
        url: publicUrlData.publicUrl,
      };
      setDraftData(nextData);
      commitData(nextData);
      setUploadStatus("画像を反映しました");
    } catch (error: any) {
      setUploadStatus(`画像処理失敗: ${error?.message ?? String(error)}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          if (file) void handlePickImageFile(file);
          event.currentTarget.value = "";
        }}
      />

      {draftData.url.trim().length > 0 ? (
        <div className="group relative overflow-hidden rounded-xl">
          <ImagePanelRenderer block={block} data={draftData} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-neutral-700 opacity-0 shadow-sm ring-1 ring-neutral-200 transition group-hover:opacity-100 focus:opacity-100"
          >
            {isUploading ? "処理中…" : "画像を変更"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex min-h-[180px] w-full items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-sm font-bold text-neutral-400 hover:bg-neutral-100"
        >
          {isUploading ? "画像を処理中…" : "＋ 画像を選ぶ"}
        </button>
      )}

      <div className="mt-2 flex justify-center">
        <button
          type="button"
          onClick={openImageLibrary}
          className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
        >
          マイ画像から選ぶ
        </button>
      </div>

      <input
        value={draftData.caption}
        onChange={(event) => updateDraftData({ caption: event.target.value })}
        onBlur={() => commitData()}
        className="mt-2 w-full border-0 bg-transparent px-1 py-1 text-center text-xs text-neutral-500 outline-none placeholder:text-neutral-300"
        placeholder="キャプション"
      />

      {uploadStatus ? (
        <div className="mt-1 text-center text-xs text-neutral-400">{uploadStatus}</div>
      ) : null}

      {imageLibraryOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setImageLibraryOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="image-library-title"
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <div>
                <h2 id="image-library-title" className="text-base font-bold text-neutral-900">マイ画像</h2>
                <p className="mt-1 text-xs text-neutral-500">アップロード済みの画像を選んで作品に挿入できます。</p>
              </div>
              <button type="button" onClick={() => setImageLibraryOpen(false)} className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-600">閉じる</button>
            </header>
            <div className="overflow-y-auto p-5">
              {imageLibraryError ? <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{imageLibraryError}</p> : null}
              {!imageLibraryLoading && imageLibraryFiles.length === 0 && !imageLibraryError ? (
                <div className="rounded-xl bg-neutral-50 px-4 py-10 text-center text-sm text-neutral-500">
                  まだ画像がありません。新しい画像をアップロードすると、次回からここで選べます。
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {imageLibraryFiles.slice(0, imageLibraryVisibleCount).map((file) => {
                  const imageUrl = supabase.storage.from("parari-images").getPublicUrl(file.path).data.publicUrl;
                  return (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => chooseLibraryImage(file.path)}
                      className="overflow-hidden rounded-xl border border-neutral-200 text-left hover:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400"
                    >
                      <img src={imageUrl} alt="" className="aspect-square w-full bg-neutral-100 object-cover" />
                      <div className="px-2 py-2 text-[11px] text-neutral-500">
                        {file.created_at ? new Date(file.created_at).toLocaleDateString("ja-JP") : "アップロード済み"}
                      </div>
                    </button>
                  );
                })}
              </div>
              {imageLibraryLoading ? <p className="py-4 text-center text-xs text-neutral-500">画像を読み込んでいます…</p> : null}
              {!imageLibraryLoading && imageLibraryHasMore ? (
                <div className="pt-4 text-center"><button type="button" onClick={showMoreLibraryImages} className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600">さらに表示</button></div>
              ) : null}
              <div className="mt-5 border-t border-neutral-100 pt-4 text-center">
                <button type="button" onClick={() => { setImageLibraryOpen(false); fileInputRef.current?.click(); }} className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white">新しい画像をアップロード</button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <details className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
        <summary className="cursor-pointer select-none font-bold">設定</summary>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold">画像URL</span>
            <input
              value={draftData.url}
              onChange={(event) => updateDraftData({ url: event.target.value })}
              onBlur={() => commitData()}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none"
              placeholder="https://..."
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-bold">画像リンクURL</span>
            <input
              value={draftData.linkUrl}
              onChange={(event) => updateDraftData({ linkUrl: event.target.value })}
              onBlur={() => commitData()}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none"
              placeholder="https://..."
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2">
              幅
              <select
                value={draftData.imageWidth}
                onChange={(event) =>
                  updateAndCommitData({
                    imageWidth: event.target.value as ImageWidthMode,
                  })
                }
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs"
              >
                {IMAGE_WIDTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              下余白
              <select
                value={draftData.panelGap}
                onChange={(event) =>
                  updateAndCommitData({
                    panelGap: event.target.value as ImagePanelGap,
                  })
                }
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs"
              >
                {PANEL_GAP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </details>
    </div>
  );
}
