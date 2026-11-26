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
  inUse: boolean | null;
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
  const [imagePickerStep, setImagePickerStep] = useState<"choose" | "library">("choose");
  const [deletingImagePath, setDeletingImagePath] = useState<string | null>(null);

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
                  inUse: null,
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
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) throw new Error("ログイン状態を確認できませんでした。");
      const usage = new Map<string, boolean>();
      for (let index = 0; index < files.length; index += 400) {
        const batch = files.slice(index, index + 400);
        const response = await fetch("/api/parari/images/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + sessionData.session.access_token },
          body: JSON.stringify({ action: "check", paths: batch.map((file) => file.path) }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok || !result.usage) throw new Error(result?.message ?? "画像の使用状況を確認できませんでした。");
        Object.entries(result.usage as Record<string, boolean>).forEach(([path, inUse]) => usage.set(path, inUse));
      }
      setImageLibraryFiles(files.map((file) => ({ ...file, inUse: usage.has(file.path) ? usage.get(file.path)! : null })));
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
    setImagePickerStep("choose");
    setImageLibraryOpen(true);
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

  const showImageLibrary = () => {
    setImagePickerStep("library");
    void loadImageLibrary();
  };

  const deleteLibraryImage = async (file: ImageLibraryFile) => {
    if (file.inUse !== false || deletingImagePath) return;
    if (!window.confirm("この画像を削除しますか？削除した画像は元に戻せません。")) return;
    setDeletingImagePath(file.path);
    setImageLibraryError("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) throw new Error("ログイン状態を確認できませんでした。");
      const response = await fetch("/api/parari/images/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + sessionData.session.access_token },
        body: JSON.stringify({ action: "delete", paths: [file.path] }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        if (response.status === 409) setImageLibraryFiles((current) => current.map((item) => item.path === file.path ? { ...item, inUse: true } : item));
        throw new Error(result?.message ?? "画像を削除できませんでした。");
      }
      setImageLibraryFiles((current) => current.filter((item) => item.path !== file.path));
    } catch (error: any) {
      setImageLibraryError(error?.message ?? "画像を削除できませんでした。");
    } finally {
      setDeletingImagePath(null);
    }
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
        <div className="overflow-hidden rounded-xl">
          <ImagePanelRenderer block={block} data={draftData} />
        </div>
      ) : (
        <div className="flex min-h-[180px] w-full items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-400">
          {isUploading ? "画像を処理中…" : "画像が選択されていません"}
        </div>
      )}

      <div className="mt-2 flex justify-center">
        <button type="button" onClick={openImageLibrary} disabled={isUploading} className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
          {isUploading ? "画像を処理中…" : draftData.url.trim().length > 0 ? "画像を変更" : "＋ 画像を選ぶ"}
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
          <section role="dialog" aria-modal="true" aria-labelledby="image-library-title" className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <div>
                <h2 id="image-library-title" className="text-base font-bold text-neutral-900">{imagePickerStep === "choose" ? "画像を選ぶ" : "マイ画像"}</h2>
                <p className="mt-1 text-xs text-neutral-500">{imagePickerStep === "choose" ? "画像の追加方法を選んでください。" : "アップロード済みの画像を選んで作品に挿入できます。"}</p>
              </div>
              <button type="button" onClick={() => setImageLibraryOpen(false)} className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-600">閉じる</button>
            </header>
            <div className="overflow-y-auto p-5">
              {imagePickerStep === "choose" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => { setImageLibraryOpen(false); fileInputRef.current?.click(); }} className="rounded-xl border border-neutral-200 p-5 text-left hover:border-neutral-500 hover:bg-neutral-50">
                    <span className="block font-bold text-neutral-900">新しくアップロード</span>
                    <span className="mt-2 block text-sm text-neutral-500">この端末から画像を選びます。</span>
                  </button>
                  <button type="button" onClick={showImageLibrary} className="rounded-xl border border-neutral-200 p-5 text-left hover:border-neutral-500 hover:bg-neutral-50">
                    <span className="block font-bold text-neutral-900">マイ画像から選ぶ</span>
                    <span className="mt-2 block text-sm text-neutral-500">以前アップロードした画像を使います。</span>
                  </button>
                </div>
              ) : (
                <>
                  <button type="button" onClick={() => setImagePickerStep("choose")} className="mb-4 text-xs font-bold text-neutral-600 hover:underline">← 選択方法に戻る</button>
                  {imageLibraryError ? <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{imageLibraryError}</p> : null}
                  {!imageLibraryLoading && imageLibraryFiles.length === 0 && !imageLibraryError ? (
                    <div className="rounded-xl bg-neutral-50 px-4 py-10 text-center text-sm text-neutral-500">まだ画像がありません。新しい画像をアップロードすると、次回からここで選べます。</div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {imageLibraryFiles.slice(0, imageLibraryVisibleCount).map((file) => {
                      const imageUrl = supabase.storage.from("parari-images").getPublicUrl(file.path).data.publicUrl;
                      const statusClass = file.inUse === false ? "text-emerald-700" : file.inUse === true ? "text-neutral-500" : "text-amber-700";
                      const statusText = file.inUse === false ? "削除可能" : file.inUse === true ? "使用中" : "使用状況を確認できません";
                      return (
                        <article key={file.path} className="overflow-hidden rounded-xl border border-neutral-200">
                          <button type="button" onClick={() => chooseLibraryImage(file.path)} className="block w-full text-left hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-neutral-400">
                            <img src={imageUrl} alt="" className="aspect-square w-full bg-neutral-100 object-cover" />
                            <span className="block px-2 pt-2 text-[11px] text-neutral-500">{file.created_at ? new Date(file.created_at).toLocaleDateString("ja-JP") : "アップロード済み"}</span>
                          </button>
                          <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
                            <span className={"text-[10px] font-bold " + statusClass}>{statusText}</span>
                            {file.inUse === false ? (
                              <button type="button" disabled={deletingImagePath === file.path} onClick={() => void deleteLibraryImage(file)} className="rounded-full border border-red-200 px-2 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                                {deletingImagePath === file.path ? "削除中…" : "削除"}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  {imageLibraryLoading ? <p className="py-4 text-center text-xs text-neutral-500">画像を読み込んでいます…</p> : null}
                  {!imageLibraryLoading && imageLibraryHasMore ? (
                    <div className="pt-4 text-center"><button type="button" onClick={showMoreLibraryImages} className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600">さらに表示</button></div>
                  ) : null}
                </>
              )}
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
