// apps/tools/parari/src/components/parari/panels/image/ImagePanelEditor.tsx
// apps/tools/parari/src/components/parari/panels/image/ImagePanelEditor.tsx
// 2026-06-28 10:45 JST
// PART: IMAGE editor with upload + local draft state
// コメント:
// - 文中IMAGEパネルに画像ファイル選択を追加
// - 既存の compressImageToJpeg を流用して長辺1200px / JPEG品質0.72へ圧縮
// - HEIC / HEIF は JPEG に変換してから圧縮する
// - Supabase Storage の parari-images に保存し、取得した publicUrl を [IMAGE] に反映する
// - URL/キャプション入力中は親SSOTを更新せず、blur時にcommitする

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

const IMAGE_WIDTH_OPTIONS: {
  value: ImageWidthMode;
  label: string;
}[] = [
  { value: "full", label: "全幅 最大720px" },
  { value: "100", label: "キャンバス100%" },
  { value: "90", label: "本文幅90%" },
  { value: "normal", label: "通常75%" },
];

const PANEL_GAP_OPTIONS: {
  value: ImagePanelGap;
  label: string;
}[] = [
  { value: "default", label: "通常" },
  { value: "zero", label: "なし" },
];

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

export function ImagePanelEditor({
  block,
  data,
  onChangeRaw,
}: PanelEditorProps<ImagePanelData>) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [draftData, setDraftData] = useState<ImagePanelData>(data);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setDraftData(data);
  }, [data.raw]);

  const commitData = (nextData: ImagePanelData = draftData) => {
    onChangeRaw?.(serializeImagePanel(nextData));
  };

  const updateDraftData = (partial: Partial<ImagePanelData>) => {
    setDraftData((current) => ({
      ...current,
      ...partial,
    }));
  };

  const updateAndCommitData = (partial: Partial<ImagePanelData>) => {
    const nextData: ImagePanelData = {
      ...draftData,
      ...partial,
    };

    setDraftData(nextData);
    commitData(nextData);
  };

  const handlePickImageFile = async (file: File) => {
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
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

      const { file: normalizedFile, converted } =
        await normalizeUploadImage(file);

      if (converted) {
        setUploadStatus("HEIC を JPEG に変換中…");
      }

      setUploadStatus("画像を圧縮中…");
      const blob = await compressImageToJpeg(normalizedFile, 1200, 0.72);

      const uid = userData.user.id;
      const path = `${uid}/inline/${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}.jpg`;

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

      const publicUrl = publicUrlData.publicUrl;

      const nextData: ImagePanelData = {
        ...draftData,
        url: publicUrl,
      };

      setDraftData(nextData);
      commitData(nextData);

      setUploadStatus(
        converted
          ? "HEIC を JPEG に変換して画像を反映しました"
          : "画像を反映しました",
      );
    } catch (error: any) {
      setUploadStatus(`画像処理失敗: ${error?.message ?? String(error)}`);
    } finally {
      setIsUploading(false);
    }
  };

  const raw = serializeImagePanel(draftData);

  return (
    <div className="rounded-xl border border-yellow-200 bg-white p-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;

          if (file) {
            void handlePickImageFile(file);
          }

          event.currentTarget.value = "";
        }}
      />

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-yellow-100 px-2 py-1 text-[11px] font-bold text-yellow-900">
            IMAGE 専用エディタ
          </span>
          <p className="mt-2 text-xs leading-5 text-neutral-600">
            画像URL、画像幅、画像下余白、キャプションを編集します。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            画像幅
            <select
              value={draftData.imageWidth}
              onChange={(event) =>
                updateAndCommitData({
                  imageWidth: event.target.value as ImageWidthMode,
                })
              }
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {IMAGE_WIDTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-neutral-600">
            下余白
            <select
              value={draftData.panelGap}
              onChange={(event) =>
                updateAndCommitData({
                  panelGap: event.target.value as ImagePanelGap,
                })
              }
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {PANEL_GAP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? "アップロード中…" : "画像を選ぶ"}
        </button>

        {uploadStatus ? (
          <span className="text-xs text-neutral-500">{uploadStatus}</span>
        ) : (
          <span className="text-xs text-neutral-400">
            スマホでは写真ライブラリやカメラから選べます
          </span>
        )}
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold text-neutral-700">
          画像URL
        </span>
        <input
          value={draftData.url}
          onChange={(event) =>
            updateDraftData({
              url: event.target.value,
            })
          }
          onBlur={(event) =>
            commitData({
              ...draftData,
              url: event.currentTarget.value,
            })
          }
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          placeholder="https://example.com/photo.jpg"
        />
      </label>

          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-bold text-neutral-700">
              画像リンクURL（任意）
            </span>
            <input
              value={draftData.linkUrl}
              onChange={(event) =>
                updateDraftData({
                  linkUrl: event.target.value,
                })
              }
              onBlur={(event) =>
                commitData({
                  ...draftData,
                  linkUrl: event.currentTarget.value,
                })
              }
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              placeholder="https://example.com/"
            />
          </label>
          
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold text-neutral-700">
          キャプション
        </span>
        <input
          value={draftData.caption}
          onChange={(event) =>
            updateDraftData({
              caption: event.target.value,
            })
          }
          onBlur={(event) =>
            commitData({
              ...draftData,
              caption: event.currentTarget.value,
            })
          }
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          placeholder="写真の説明"
        />
      </label>

      <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <p className="mb-2 text-[11px] font-bold text-neutral-500">
          公開表示プレビュー
        </p>

        {draftData.url.trim().length > 0 ? (
          <div className="overflow-hidden rounded-xl bg-white p-3 ring-1 ring-neutral-200">
            <ImagePanelRenderer block={block} data={draftData} />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm font-semibold text-neutral-400">
            画像なし
          </div>
        )}
      </div>

      {draftData.extraLines.length > 0 ? (
        <details className="mt-3 rounded-lg border border-neutral-200 bg-white px-3 py-2">
          <summary className="cursor-pointer text-[11px] font-bold text-neutral-500">
            未対応の追加行
          </summary>
          <pre className="mt-2 max-h-[160px] overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-neutral-500">
            {draftData.extraLines.join("\n")}
          </pre>
        </details>
      ) : null}

    </div>
  );
}
