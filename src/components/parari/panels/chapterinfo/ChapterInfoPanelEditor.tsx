// src/components/parari/panels/chapterinfo/ChapterInfoPanelEditor.tsx
// PART: CHAPTERINFO editor
// コメント:
// - 章タイトル、章番号、サブタイトル、章扉画像、目次表示を編集する
// - PAGE所属はSSOT上の並びから自動計算するため、ここでは保存しない
// - 日本語IME変換中は親SSOTへ書き戻さず、blur / compositionendで確定する

"use client";

import { heicTo } from "heic-to";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { compressImageToJpeg } from "../image/imageUploadUtils";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import {
  getBooleanMeta,
  getMetaValue,
  parseMetaFields,
} from "../shared/metaFields";
import { normalizeChapterInfoRaw } from "./chapterInfoRaw";

export type ChapterInfoPanelData = {
  raw: string;
  title?: string;
};

export function ChapterInfoPanelEditor({
  block,
  data,
  onChangeRaw,
}: PanelEditorProps<ChapterInfoPanelData>) {
  const imageInputId = `chapterinfo-image-${block.id.replace(/[^A-Za-z0-9_-]/g, "-")}`;
  const [draftRaw, setDraftRaw] = useState(data.raw);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setDraftRaw(data.raw);
  }, [data.raw]);

  const fields = useMemo(() => parseMetaFields(draftRaw), [draftRaw]);
  const number = getMetaValue(fields, ["number"], "");
  const title = getMetaValue(fields, ["title"], "");
  const subtitle = getMetaValue(fields, ["subtitle"], "");
  const mainImage = getMetaValue(fields, ["mainImage", "main_image"], "");
  const showInToc = getBooleanMeta(
    fields,
    ["showInToc", "show_in_toc"],
    true,
  );

  const updateDraftMeta = (key: string, value: string) => {
    setDraftRaw((current) => setColonMetaValue(current, key, value));
  };

  const commitMeta = (key: string, value: string) => {
    const nextRaw = setColonMetaValue(draftRaw, key, value);
    const normalized = normalizeChapterInfoRaw(nextRaw);
    setDraftRaw(normalized);
    onChangeRaw?.(normalized);
  };

  const commitBooleanMeta = (key: string, checked: boolean) => {
    commitMeta(key, checked ? "true" : "false");
  };

  const handlePickImage = async (file: File) => {
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
      setUploadStatus("画像ファイルを選んでください");
      return;
    }

    setIsUploading(true);
    setUploadStatus("画像を準備中…");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        setUploadStatus("ログインしてください");
        return;
      }

      const normalizedFile = await normalizeChapterImageFile(file);
      const blob = await compressImageToJpeg(normalizedFile, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.72,
      });
      const uploadPath = `${userData.user.id}/chapter/${Date.now()}-${crypto.randomUUID()}.jpg`;

      setUploadStatus("画像をアップロード中…");

      const { error: uploadError } = await supabase.storage
        .from("parari-images")
        .upload(uploadPath, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        setUploadStatus(`アップロード失敗: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("parari-images")
        .getPublicUrl(uploadPath);

      commitMeta("mainImage", publicUrlData.publicUrl);
      setUploadStatus("章扉画像を設定しました");
    } catch (error) {
      setUploadStatus(
        error instanceof Error
          ? `アップロード失敗: ${error.message}`
          : "画像のアップロードに失敗しました",
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-violet-700">CHAPTERINFO</div>
          <p className="mt-1 text-[11px] leading-5 text-violet-700/80">
            このパネルから次のCHAPTERINFO直前までのPAGEが、この章に所属します。
          </p>
        </div>

      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <DraftTextField
          label="章番号"
          value={number}
          placeholder="1 / 第一部 / Prologue など"
          onChange={(value) => updateDraftMeta("number", value)}
          onCommit={(value) => commitMeta("number", value)}
        />

        <DraftTextField
          label="章タイトル"
          value={title}
          placeholder="章タイトル"
          onChange={(value) => updateDraftMeta("title", value)}
          onCommit={(value) => commitMeta("title", value)}
        />

        <div className="md:col-span-2">
          <DraftTextField
            label="サブタイトル"
            value={subtitle}
            placeholder="章の副題・説明など"
            onChange={(value) => updateDraftMeta("subtitle", value)}
            onCommit={(value) => commitMeta("subtitle", value)}
          />
        </div>

        <div className="md:col-span-2">
          <div className="text-[11px] font-bold text-neutral-500">章扉画像</div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              id={imageInputId}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                event.currentTarget.value = "";

                if (file) {
                  void handlePickImage(file);
                }
              }}
            />
            <label
              htmlFor={imageInputId}
              aria-disabled={isUploading}
              className={[
                "rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 transition hover:bg-violet-50",
                isUploading
                  ? "pointer-events-none cursor-not-allowed opacity-50"
                  : "cursor-pointer",
              ].join(" ")}
            >
              {isUploading ? "アップロード中…" : "画像を選ぶ"}
            </label>
            {uploadStatus ? (
              <span className="text-xs text-neutral-500">{uploadStatus}</span>
            ) : null}
          </div>

          <div className="mt-3">
            <DraftTextField
              label="章扉画像URL"
              value={mainImage}
              placeholder="https://..."
              onChange={(value) => updateDraftMeta("mainImage", value)}
              onCommit={(value) => commitMeta("mainImage", value)}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2 text-sm text-neutral-700 md:col-span-2">
          <input
            type="checkbox"
            checked={showInToc}
            onChange={(event) =>
              commitBooleanMeta("showInToc", event.target.checked)
            }
          />
          目次にこの章と所属PAGEを表示する
        </label>
      </div>

      {mainImage ? (
        <div className="mt-4 overflow-hidden rounded-2xl bg-white p-2 ring-1 ring-violet-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mainImage}
            alt=""
            className="max-h-72 w-full rounded-xl object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}

function DraftTextField({
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
  onCommit: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-neutral-500">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onCommit(event.currentTarget.value)}
        onCompositionEnd={(event) => onCommit(event.currentTarget.value)}
        onKeyDown={(event) => event.stopPropagation()}
        className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-violet-400"
      />
    </label>
  );
}

async function normalizeChapterImageFile(file: File): Promise<File> {
  const looksHeic = /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);

  if (!looksHeic) {
    return file;
  }

  const converted = await heicTo({
    blob: file,
    type: "image/jpeg",
    quality: 0.92,
  });
  const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
  const jpegName = file.name.replace(/\.(heic|heif)$/i, ".jpg") || "chapter.jpg";

  return new File([jpegBlob], jpegName, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function setColonMetaValue(raw: string, key: string, value: string): string {
  const lines = String(raw ?? "").replace(/\r\n/g, "\n").split("\n");
  const safeValue = value.replace(/\r?\n/g, " ");
  const pattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*:`, "i");
  const existingIndex = lines.findIndex((line) => pattern.test(line));

  if (existingIndex >= 0) {
    lines[existingIndex] = `${key}: ${safeValue}`;
    return lines.join("\n");
  }

  let insertIndex = Math.min(1, lines.length);

  while (
    insertIndex < lines.length &&
    /^\s*[A-Za-z][A-Za-z0-9_-]*\s*:/.test(lines[insertIndex] ?? "")
  ) {
    insertIndex += 1;
  }

  lines.splice(insertIndex, 0, `${key}: ${safeValue}`);
  return lines.join("\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
