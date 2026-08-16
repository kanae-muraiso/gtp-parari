// src/components/parari/panels/image/imageUploadUtils.ts
// PART: Image upload helpers for panel editors

type CompressOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

export async function compressImageToJpeg(
  file: File,
  maxWidthOrOptions: number | CompressOptions = {},
  qualityArg = 0.86,
): Promise<File> {
  const options =
    typeof maxWidthOrOptions === "number"
      ? {
          maxWidth: maxWidthOrOptions,
          maxHeight: maxWidthOrOptions,
          quality: qualityArg,
        }
      : maxWidthOrOptions;

  const maxWidth = options.maxWidth ?? 1600;
  const maxHeight = options.maxHeight ?? maxWidth;
  const quality = options.quality ?? 0.86;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    return file;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });

  if (!blob) {
    return file;
  }

  const originalName = file.name.replace(/\.[^.]+$/, "");
  const jpegName = `${originalName || "image"}.jpg`;

  return new File([blob], jpegName, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
