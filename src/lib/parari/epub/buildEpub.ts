// src/lib/parari/epub/buildEpub.ts
// PART: EPUB3 package builder
//
// EpubBookModelから、一般的なリフロー型EPUB3を生成する。
// Viewerの物理ページネーションは使用しない。

import JSZip from "jszip";

import type {
  EpubBookModel,
  EpubContentBlock,
  EpubContentItem,
} from "./buildEpubModel";

export type BuildEpubResult = {
  blob: Blob;
  filename: string;
  warnings: string[];
};

type StoredImage = {
  sourceUrl: string;
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
  manifestId: string;
};

export async function buildEpub(
  model: EpubBookModel,
): Promise<BuildEpubResult> {
  const zip = new JSZip();
  const warnings: string[] = [];

  const identifier = createIdentifier();
  const modifiedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const imageUrls = collectImageUrls(model);
  const images = await downloadImages(imageUrls, warnings);
  const imageByUrl = new Map(
    images.map((image) => [image.sourceUrl, image]),
  );

  /*
   * EPUB仕様上、mimetypeはZIPの先頭に置き、
   * 圧縮せず保存する必要がある。
   */
  zip.file("mimetype", "application/epub+zip", {
    compression: "STORE",
  });

  zip.file(
    "META-INF/container.xml",
    createContainerXml(),
  );

  zip.file(
    "EPUB/styles/book.css",
    createBookCss(),
  );

  for (const image of images) {
    zip.file(`EPUB/images/${image.fileName}`, image.bytes);
  }

  const spineItems: string[] = [];
  const manifestItems: string[] = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="styles/book.css" media-type="text/css"/>`,
  ];

  for (const image of images) {
    const properties =
      image.sourceUrl === model.coverImageUrl
        ? ` properties="cover-image"`
        : "";

    manifestItems.push(
      `<item id="${escapeXml(image.manifestId)}" href="images/${escapeXml(
        image.fileName,
      )}" media-type="${escapeXml(image.mediaType)}"${properties}/>`,
    );
  }

  const contentDocuments: Array<{
    id: string;
    fileName: string;
    title: string;
    showInToc: boolean;
    level: 1 | 2;
  }> = [];

  const coverImage = imageByUrl.get(model.coverImageUrl);

  if (model.includeCover && coverImage) {
    const id = "cover-page";
    const fileName = "cover.xhtml";

    zip.file(
      `EPUB/${fileName}`,
      createCoverXhtml(model, coverImage),
    );

    manifestItems.push(
      `<item id="${id}" href="${fileName}" media-type="application/xhtml+xml"/>`,
    );
    spineItems.push(`<itemref idref="${id}"/>`);
  }

  if (model.includeTitlePage) {
    const id = "title-page";
    const fileName = "title-page.xhtml";

    zip.file(
      `EPUB/${fileName}`,
      createTitlePageXhtml(model),
    );

    manifestItems.push(
      `<item id="${id}" href="${fileName}" media-type="application/xhtml+xml"/>`,
    );
    spineItems.push(`<itemref idref="${id}"/>`);
  }

  if (model.includeToc) {
    const id = "toc-page";
    const fileName = "toc.xhtml";

    zip.file(
      `EPUB/${fileName}`,
      createVisibleTocXhtml(model),
    );

    manifestItems.push(
      `<item id="${id}" href="${fileName}" media-type="application/xhtml+xml"/>`,
    );
    spineItems.push(`<itemref idref="${id}"/>`);
  }

  model.items.forEach((item, index) => {
    const sequence = String(index + 1).padStart(4, "0");
    const documentId = `content-${sequence}`;
    const fileName = `text/${sequence}.xhtml`;

    zip.file(
      `EPUB/${fileName}`,
      createContentXhtml(item, imageByUrl),
    );

    manifestItems.push(
      `<item id="${documentId}" href="${fileName}" media-type="application/xhtml+xml"/>`,
    );
    spineItems.push(`<itemref idref="${documentId}"/>`);

    contentDocuments.push({
      id: documentId,
      fileName,
      title: item.title || `PAGE ${index + 1}`,
      showInToc: item.showInToc,
      level: item.kind === "chapter" ? 1 : 2,
    });
  });

  zip.file(
    "EPUB/nav.xhtml",
    createNavXhtml(model, contentDocuments),
  );

  zip.file(
    "EPUB/package.opf",
    createPackageOpf({
      model,
      identifier,
      modifiedAt,
      manifestItems,
      spineItems,
    }),
  );

  const bytes = await zip.generateAsync({
    type: "uint8array",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: {
      level: 6,
    },
  });

  const arrayBuffer = bytes.slice().buffer;

  return {
    blob: new Blob([arrayBuffer], {
      type: "application/epub+zip",
    }),
    filename: `${sanitizeFileName(model.title || "parari-book")}.epub`,
    warnings,
  };
}

function collectImageUrls(model: EpubBookModel): string[] {
  const urls: string[] = [];

  appendUniqueUrl(urls, model.coverImageUrl);

  for (const item of model.items) {
    for (const block of item.blocks) {
      if (block.type === "image") {
        appendUniqueUrl(urls, block.url);
      }
    }
  }

  return urls;
}

function appendUniqueUrl(urls: string[], value: string): void {
  const url = String(value ?? "").trim();

  if (url && !urls.includes(url)) {
    urls.push(url);
  }
}

async function downloadImages(
  urls: string[],
  warnings: string[],
): Promise<StoredImage[]> {
  const images: StoredImage[] = [];

  for (let index = 0; index < urls.length; index += 1) {
    const sourceUrl = urls[index];

    try {
      const response = await fetch(sourceUrl);

      if (!response.ok) {
        warnings.push(
          `画像を取得できませんでした: ${sourceUrl} (${response.status})`,
        );
        continue;
      }

      const mediaType = resolveImageMediaType(
        response.headers.get("content-type"),
        sourceUrl,
      );

      if (!mediaType) {
        warnings.push(
          `未対応の画像形式のため除外しました: ${sourceUrl}`,
        );
        continue;
      }

      const extension = extensionForMediaType(mediaType);
      const fileNumber = String(images.length + 1).padStart(4, "0");

      images.push({
        sourceUrl,
        fileName: `image-${fileNumber}.${extension}`,
        mediaType,
        bytes: new Uint8Array(await response.arrayBuffer()),
        manifestId: `image-${fileNumber}`,
      });
    } catch (error) {
      warnings.push(
        `画像取得中にエラーが発生しました: ${sourceUrl} (${errorMessage(
          error,
        )})`,
      );
    }
  }

  return images;
}

function createContainerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0"
  xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile
      full-path="EPUB/package.opf"
      media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

function createPackageOpf(args: {
  model: EpubBookModel;
  identifier: string;
  modifiedAt: string;
  manifestItems: string[];
  spineItems: string[];
}): string {
  const {
    model,
    identifier,
    modifiedAt,
    manifestItems,
    spineItems,
  } = args;

  return `<?xml version="1.0" encoding="UTF-8"?>
<package
  xmlns="http://www.idpf.org/2007/opf"
  version="3.0"
  unique-identifier="book-id"
  xml:lang="ja">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeXml(identifier)}</dc:identifier>
    <dc:title>${escapeXml(model.title || "Untitled")}</dc:title>
    ${model.subtitle ? `<meta property="title-type">subtitle</meta>` : ""}
    ${
      model.subtitle
        ? `<dc:description>${escapeXml(model.subtitle)}</dc:description>`
        : ""
    }
    ${
      model.author
        ? `<dc:creator>${escapeXml(model.author)}</dc:creator>`
        : ""
    }
    <dc:language>ja</dc:language>
    <meta property="dcterms:modified">${escapeXml(modifiedAt)}</meta>
  </metadata>
  <manifest>
    ${manifestItems.join("\n    ")}
  </manifest>
  <spine>
    ${spineItems.join("\n    ")}
  </spine>
</package>`;
}

function createNavXhtml(
  model: EpubBookModel,
  documents: Array<{
    fileName: string;
    title: string;
    showInToc: boolean;
    level: 1 | 2;
  }>,
): string {
  const visibleDocuments = documents.filter(
    (document) => document.showInToc,
  );

  const links = visibleDocuments
    .map(
      (document) =>
        `<li class="toc-level-${document.level}"><a href="${escapeXml(
          document.fileName,
        )}">${escapeXml(document.title)}</a></li>`,
    )
    .join("\n");

  return createXhtmlDocument({
    title: "目次",
    body: `<nav epub:type="toc" id="toc">
  <h1>目次</h1>
  <ol>
    ${links}
  </ol>
</nav>`,
    extraNamespaces: ` xmlns:epub="http://www.idpf.org/2007/ops"`,
  });
}

function createVisibleTocXhtml(model: EpubBookModel): string {
  const entries = model.items
    .map((item, index) => ({
      item,
      href: `text/${String(index + 1).padStart(4, "0")}.xhtml`,
    }))
    .filter(({ item }) => item.showInToc)
    .map(({ item, href }) => {
      const className =
        item.kind === "chapter" ? "toc-chapter" : "toc-page";

      return `<li class="${className}"><a href="${href}">${escapeXml(
        item.title,
      )}</a></li>`;
    })
    .join("\n");

  return createXhtmlDocument({
    title: "目次",
    body: `<section class="toc-page">
  <h1>目次</h1>
  <ol>
    ${entries}
  </ol>
</section>`,
  });
}

function createCoverXhtml(
  model: EpubBookModel,
  image: StoredImage,
): string {
  return createXhtmlDocument({
    title: model.title,
    body: `<section class="cover-page" epub:type="cover">
  <img src="images/${escapeXml(image.fileName)}" alt="${escapeXml(
    model.title,
  )}"/>
</section>`,
    extraNamespaces: ` xmlns:epub="http://www.idpf.org/2007/ops"`,
  });
}

function createTitlePageXhtml(model: EpubBookModel): string {
  return createXhtmlDocument({
    title: model.title,
    body: `<section class="title-page" epub:type="titlepage">
  <h1>${escapeXml(model.title)}</h1>
  ${
    model.subtitle
      ? `<p class="subtitle">${escapeXml(model.subtitle)}</p>`
      : ""
  }
  ${
    model.author
      ? `<p class="author">${escapeXml(model.author)}</p>`
      : ""
  }
</section>`,
    extraNamespaces: ` xmlns:epub="http://www.idpf.org/2007/ops"`,
  });
}

function createContentXhtml(
  item: EpubContentItem,
  imageByUrl: Map<string, StoredImage>,
): string {
  const blocks = item.blocks
    .map((block) => renderContentBlock(block, imageByUrl))
    .filter(Boolean)
    .join("\n");

  const heading =
    item.showTitle && item.title
      ? item.kind === "chapter"
        ? `<h1>${escapeXml(item.title)}</h1>`
        : `<h2>${escapeXml(item.title)}</h2>`
      : "";

  const subtitle = item.subtitle
    ? `<p class="subtitle">${escapeXml(item.subtitle)}</p>`
    : "";

  return createXhtmlDocument({
    title: item.title,
    body: `<section class="${item.kind}">
  ${heading}
  ${subtitle}
  ${blocks}
</section>`,
  });
}

function renderContentBlock(
  block: EpubContentBlock,
  imageByUrl: Map<string, StoredImage>,
): string {
  if (block.type === "text") {
    return renderText(block.text);
  }

  const storedImage = imageByUrl.get(block.url);

  if (!storedImage) {
    return "";
  }

  return `<figure>
  <img src="../images/${escapeXml(storedImage.fileName)}" alt="${escapeXml(
    block.caption ?? "",
  )}"/>
  ${
    block.caption
      ? `<figcaption>${escapeXml(block.caption)}</figcaption>`
      : ""
  }
</figure>`;
}

function renderText(text: string): string {
  const normalized = String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();

  if (!normalized) {
    return "";
  }

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => {
      const body = paragraph
        .split("\n")
        .map((line) => escapeXml(line.trim()))
        .join("<br/>");

      return `<p>${body}</p>`;
    })
    .join("\n");
}

function createXhtmlDocument(args: {
  title: string;
  body: string;
  extraNamespaces?: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"${
    args.extraNamespaces ?? ""
  } xml:lang="ja" lang="ja">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(args.title)}</title>
  <link rel="stylesheet" type="text/css" href="${
    args.title === "目次" || args.body.includes("cover-page") || args.body.includes("title-page")
      ? "styles/book.css"
      : "../styles/book.css"
  }"/>
</head>
<body>
${args.body}
</body>
</html>`;
}

function createBookCss(): string {
  return `@charset "UTF-8";

html {
  writing-mode: horizontal-tb;
}

body {
  margin: 5%;
  font-family: serif;
  line-height: 1.8;
  text-align: justify;
}

h1,
h2 {
  line-height: 1.4;
  text-align: left;
  break-after: avoid;
}

p {
  margin: 0 0 1em;
}

/*
 * CHAPTERは本文見出しではなく、独立した章扉として表示する。
 * PARARIと同様に、ページの縦横中央へ章タイトルを配置する。
 */
.chapter {
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.chapter > h1 {
  margin: 0;
  text-align: center;
}

.chapter > .subtitle {
  margin-top: 1em;
  text-align: center;
}

img {
  display: block;
  max-width: 100%;
  max-height: 90vh;
  margin: 1em auto;
  object-fit: contain;
}

figure {
  margin: 1.5em 0;
  text-align: center;
}

figcaption {
  margin-top: 0.5em;
  font-size: 0.85em;
  text-align: center;
}

.cover-page {
  margin: 0;
  padding: 0;
  text-align: center;
}

.cover-page img {
  width: 100%;
  max-height: 100vh;
  margin: 0 auto;
}

.title-page {
  margin-top: 25vh;
  text-align: center;
}

.title-page h1 {
  text-align: center;
}

.subtitle,
.author {
  text-align: center;
}

.toc-page ol,
nav ol {
  padding-left: 1.5em;
}

.toc-chapter,
.toc-level-1 {
  margin-top: 1em;
  font-weight: bold;
}

.toc-page,
.toc-level-2 {
  margin-left: 1em;
}`;
}

function resolveImageMediaType(
  contentType: string | null,
  url: string,
): string | null {
  const normalized = String(contentType ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (
    normalized === "image/jpeg" ||
    normalized === "image/png" ||
    normalized === "image/gif" ||
    normalized === "image/svg+xml" ||
    normalized === "image/webp"
  ) {
    return normalized;
  }

  const path = url.split("?")[0].toLowerCase();

  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (path.endsWith(".png")) {
    return "image/png";
  }

  if (path.endsWith(".gif")) {
    return "image/gif";
  }

  if (path.endsWith(".svg")) {
    return "image/svg+xml";
  }

  if (path.endsWith(".webp")) {
    return "image/webp";
  }

  return null;
}

function extensionForMediaType(mediaType: string): string {
  switch (mediaType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

function createIdentifier(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `urn:uuid:${globalThis.crypto.randomUUID()}`;
  }

  return `urn:parari:${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function sanitizeFileName(value: string): string {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || "parari-book";
}

function escapeXml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
