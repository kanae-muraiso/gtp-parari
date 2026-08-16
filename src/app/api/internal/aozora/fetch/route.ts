// src/app/api/internal/aozora/fetch/route.ts
// 2026/07/20 11:08

import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AOZORA_HOSTS = new Set([
  "www.aozora.gr.jp",
  "aozora.gr.jp",
]);

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

type AozoraSourceType = "card" | "xhtml" | "unknown";

type LoadedPage = {
  requestedUrl: URL;
  finalUrl: URL;
  contentType: string;
  charset: string;
  byteLength: number;
  html: string;
};

function classifyAozoraUrl(url: URL): AozoraSourceType {
  const pathname = url.pathname.toLowerCase();

  if (/\/cards\/\d+\/card\d+\.html?$/.test(pathname)) {
    return "card";
  }

  if (
    pathname.includes("/files/") &&
    /\.(html?|xhtml)$/.test(pathname)
  ) {
    return "xhtml";
  }

  return "unknown";
}

function validateAozoraUrl(value: unknown): URL {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("URLを入力してください。");
  }

  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("正しいURLを入力してください。");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("HTTPまたはHTTPSのURLだけを指定できます。");
  }

  if (!AOZORA_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("青空文庫のURLだけを指定できます。");
  }

  return url;
}

function normalizeCharset(charset: string): string {
  const normalized = charset
    .trim()
    .toLowerCase()
    .replace(/["']/g, "");

  switch (normalized) {
    case "shift_jis":
    case "shift-jis":
    case "sjis":
    case "x-sjis":
    case "windows-31j":
    case "ms932":
    case "cp932":
      return "shift_jis";

    case "euc-jp":
    case "euc_jp":
      return "euc-jp";

    case "utf8":
    case "utf-8":
      return "utf-8";

    default:
      return normalized;
  }
}

function detectCharset(
  bytes: ArrayBuffer,
  contentType: string | null,
): string {
  /*
   * まずHTTPレスポンスヘッダーを確認します。
   */
  const headerMatch = contentType?.match(
    /charset\s*=\s*["']?([^;"'\s]+)/i,
  );

  if (headerMatch?.[1]) {
    return normalizeCharset(headerMatch[1]);
  }

  /*
   * charset宣言そのものはASCII文字なので、
   * 一旦ASCIIとしてHTML冒頭を読み取ります。
   */
  const headBytes = bytes.slice(0, 8192);
  const asciiHead = new TextDecoder("ascii").decode(headBytes);

  const metaCharsetMatch = asciiHead.match(
    /<meta[^>]+charset\s*=\s*["']?\s*([^"'\s/>;]+)/i,
  );

  if (metaCharsetMatch?.[1]) {
    return normalizeCharset(metaCharsetMatch[1]);
  }

  const metaContentTypeMatch = asciiHead.match(
    /<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([^"'\s;>]+)/i,
  );

  if (metaContentTypeMatch?.[1]) {
    return normalizeCharset(metaContentTypeMatch[1]);
  }

  /*
   * 青空文庫の旧XHTMLではShift_JISが多いため、
   * 宣言が見つからない場合はShift_JISを既定値にします。
   */
  return "shift_jis";
}

function decodeHtml(
  bytes: ArrayBuffer,
  contentType: string | null,
): {
  html: string;
  charset: string;
} {
  const charset = detectCharset(bytes, contentType);

  try {
    return {
      html: new TextDecoder(charset).decode(bytes),
      charset,
    };
  } catch {
    /*
     * 未対応の文字コード名だった場合だけUTF-8へ退避します。
     */
    return {
      html: new TextDecoder("utf-8").decode(bytes),
      charset: "utf-8",
    };
  }
}

async function loadAozoraPage(url: URL): Promise<LoadedPage> {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    headers: {
      Accept: "application/xhtml+xml,text/html;q=0.9,*/*;q=0.8",
      "User-Agent":
        "PARARI-Aozora-Analyzer/0.2 (+internal development tool)",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `取得に失敗しました。HTTP ${response.status}`,
    );
  }

  const finalUrl = validateAozoraUrl(response.url);

  const contentLengthHeader =
    response.headers.get("content-length");

  const announcedLength = contentLengthHeader
    ? Number(contentLengthHeader)
    : null;

  if (
    announcedLength !== null &&
    Number.isFinite(announcedLength) &&
    announcedLength > MAX_RESPONSE_BYTES
  ) {
    throw new Error("ファイルサイズが5MBを超えています。");
  }

  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength > MAX_RESPONSE_BYTES) {
    throw new Error("ファイルサイズが5MBを超えています。");
  }

    const contentTypeHeader =
      response.headers.get("content-type");

    const decoded = decodeHtml(
      arrayBuffer,
      contentTypeHeader,
    );

    return {
      requestedUrl: url,
      finalUrl,
      contentType: contentTypeHeader ?? "不明",
      charset: decoded.charset,
      byteLength: arrayBuffer.byteLength,
      html: decoded.html,
    };
}

function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type OutlineBlockType =
  | "TITLE"
  | "AUTHOR"
  | "HEADING"
  | "TEXT"
  | "IMAGE"
  | "PAGE_BREAK";

type OutlineMergeDirection =
  | "PREVIOUS"
  | "NEXT"
  | null;

type OutlineBlock = {
  type: OutlineBlockType;
  text?: string;
  level?: number;
  src?: string;
  alt?: string;

  /*
   * TEXTブロックの確認用情報
   */
  characterCount?: number;
  preview?: string;
  mergeCandidate?: boolean;
  mergeDirection?: OutlineMergeDirection;
  mergeReason?: string;
};

function isPageBreakElement(
  $: cheerio.CheerioAPI,
  element: any,
): boolean {
  const node = $(element);

  const className = node.attr("class") ?? "";
  const style = node.attr("style") ?? "";

  return (
    className.includes("pagebreak") ||
    className.includes("page-break") ||
    className.includes("newpage") ||
    style.includes("page-break")
  );
}

function extractRubyText(
  $: cheerio.CheerioAPI,
  element: any,
): string {
  const ruby = $(element);

  const reading = normalizeText(
    ruby.find("rt").first().text(),
  );

  const clone = ruby.clone();

  /*
   * 読み仮名と、古いブラウザ向けの括弧を除き、
   * 親文字だけを取得します。
   */
  clone.find("rt, rp").remove();

  const base = normalizeText(clone.text());

  if (!base) {
    return "";
  }

  /*
   * 読みが取得できなかった場合は、
   * 親文字だけを残します。
   */
  if (!reading) {
    return base;
  }

  return `[[${base}|${reading}]]`;
}

function extractElementText(
  $: cheerio.CheerioAPI,
  element: any,
): string {
  const parts: string[] = [];

  function walkText(current: any) {
    if (current.type === "text") {
      const text = current.data ?? "";

      if (text) {
        parts.push(text);
      }

      return;
    }

    if (current.type !== "tag") {
      return;
    }

    const tagName =
      current.tagName?.toLowerCase() ?? "";

    const node = $(current);

    if (
      tagName === "script" ||
      tagName === "style" ||
      tagName === "rt" ||
      tagName === "rp"
    ) {
      return;
    }

    if (
      node.hasClass("notes") ||
      node.hasClass("notation_notes")
    ) {
      return;
    }

    /*
     * ruby要素は、PARARIのSSOTルビ記法へ変換します。
     */
    if (tagName === "ruby") {
      const rubyText = extractRubyText(
        $,
        current,
      );

      if (rubyText) {
        parts.push(rubyText);
      }

      return;
    }

    for (const child of current.children ?? []) {
      walkText(child);
    }
  }

  walkText(element);

  return normalizeText(parts.join(""));
}

function endsWithSentenceMark(text: string): boolean {
  return /[。！？!?」』”’）)\]]$/.test(
    text.trim(),
  );
}

function startsWithClosingMark(text: string): boolean {
  return /^[、。！？!?」』”’）)\]]/.test(
    text.trim(),
  );
}

function createTextPreview(
  text: string,
  maxLength = 60,
): string {
  const normalized = normalizeText(text);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}…`;
}

function enrichOutlineBlocks(
  blocks: OutlineBlock[],
): OutlineBlock[] {
  return blocks.map((block, index) => {
    if (
      block.type !== "TEXT" ||
      !block.text
    ) {
      return block;
    }

    const text = block.text;
    const previous = blocks[index - 1];
    const next = blocks[index + 1];

    const previousText =
      previous?.type === "TEXT"
        ? previous.text ?? ""
        : "";

    const nextText =
      next?.type === "TEXT"
        ? next.text ?? ""
        : "";

    let mergeCandidate = false;
    let mergeDirection: OutlineMergeDirection =
      null;
    let mergeReason = "";

    /*
     * 前のTEXTが句点などで終わっていなければ、
     * 改行によって途中で分割された可能性があります。
     */
    if (
      previousText &&
      !endsWithSentenceMark(previousText)
    ) {
      mergeCandidate = true;
      mergeDirection = "PREVIOUS";
      mergeReason =
        "直前の本文が文末記号で終わっていません。";
    }

    /*
     * 現在のTEXTが非常に短く、
     * 前にもTEXTがある場合。
     */
    if (
      !mergeCandidate &&
      previousText &&
      text.length <= 20
    ) {
      mergeCandidate = true;
      mergeDirection = "PREVIOUS";
      mergeReason =
        "短い本文なので、直前の本文の続きかもしれません。";
    }

    /*
     * 閉じ括弧や句読点から始まる場合は、
     * 前の行の続きである可能性が高いです。
     */
    if (
      previousText &&
      startsWithClosingMark(text)
    ) {
      mergeCandidate = true;
      mergeDirection = "PREVIOUS";
      mergeReason =
        "閉じ括弧または句読点から始まっています。";
    }

    /*
     * 自分が文末記号で終わらず、
     * 次にもTEXTがある場合。
     */
    if (
      !mergeCandidate &&
      nextText &&
      !endsWithSentenceMark(text)
    ) {
      mergeCandidate = true;
      mergeDirection = "NEXT";
      mergeReason =
        "文末記号で終わっておらず、次にも本文があります。";
    }

    return {
      ...block,
      characterCount: text.length,
      preview: createTextPreview(text),
      mergeCandidate,
      mergeDirection,
      mergeReason,
    };
  });
}


function createOutline(
  html: string,
  documentUrl: URL,
): OutlineBlock[] {
  const $ = cheerio.load(html);
  const blocks: OutlineBlock[] = [];

  const title =
    normalizeText($(".title").first().text()) ||
    normalizeText($("h1").first().text()) ||
    normalizeText($("title").first().text());

  const author =
    normalizeText($(".author").first().text()) || null;

  if (title) {
    blocks.push({
      type: "TITLE",
      text: title,
    });
  }

  if (author) {
    blocks.push({
      type: "AUTHOR",
      text: author,
    });
  }

  /*
   * 青空文庫XHTMLでは、本文が .main_text に入っていることが多いため、
   * まずそこを使用します。
   * 見つからない場合だけbody全体を解析します。
   */
  const mainText =
    $(".main_text").first().length > 0
      ? $(".main_text").first()
      : $("body").first();

  let textBuffer: string[] = [];

  function flushTextBuffer() {
    const text = normalizeText(textBuffer.join(" "));

    if (text) {
      blocks.push({
        type: "TEXT",
        text,
      });
    }

    textBuffer = [];
  }

    function walk(element: any) {
    if (element.type === "text") {
      const text = normalizeText(element.data ?? "");

      if (text) {
        textBuffer.push(text);
      }

      return;
    }

        if (element.type !== "tag") {
          return;
        }

        const tagElement = element;
        const tagName =
          tagElement.tagName.toLowerCase();

        const node = $(tagElement);

        if (
          tagName === "script" ||
          tagName === "style"
        ) {
          return;
        }

        /*
         * ruby要素は子要素を個別に巡回せず、
         * PARARIのSSOT形式へまとめて変換します。
         */
        if (tagName === "ruby") {
          const rubyText = extractRubyText(
            $,
            tagElement,
          );

          if (rubyText) {
            textBuffer.push(rubyText);
          }

          return;
        }

        /*
         * rubyの中で処理されるため、
         * 単独のrt・rpは本文へ入れません。
         */
        if (
          tagName === "rt" ||
          tagName === "rp"
        ) {
          return;
        }

    if (
      node.hasClass("notes") ||
      node.hasClass("notation_notes")
    ) {
      return;
    }

        if (isPageBreakElement($, tagElement)) {
      flushTextBuffer();

      blocks.push({
        type: "PAGE_BREAK",
      });

      return;
    }

    if (/^h[1-6]$/.test(tagName)) {
      flushTextBuffer();

        const text = extractElementText($, tagElement);

      if (text) {
        blocks.push({
          type: "HEADING",
          level: Number(tagName.slice(1)),
          text,
        });
      }

      return;
    }

    /*
     * 青空文庫では見出しがhタグではなく、
     * classで表される作品もあります。
     */
    if (
      node.hasClass("o-midashi") ||
      node.hasClass("naka-midashi") ||
      node.hasClass("ko-midashi")
    ) {
      flushTextBuffer();

        const text = extractElementText($, tagElement);

      let level = 2;

      if (node.hasClass("o-midashi")) {
        level = 1;
      } else if (node.hasClass("naka-midashi")) {
        level = 2;
      } else if (node.hasClass("ko-midashi")) {
        level = 3;
      }

      if (text) {
        blocks.push({
          type: "HEADING",
          level,
          text,
        });
      }

      return;
    }

    if (tagName === "img") {
      flushTextBuffer();

      const rawSrc = node.attr("src") ?? "";
      let src = rawSrc;

      if (rawSrc) {
        try {
          src = new URL(rawSrc, documentUrl).toString();
        } catch {
          src = rawSrc;
        }
      }

      blocks.push({
        type: "IMAGE",
        src,
        alt: normalizeText(node.attr("alt") ?? ""),
      });

      return;
    }

    if (tagName === "br") {
      flushTextBuffer();
      return;
    }

    /*
     * ブロック要素の前後で本文を区切ります。
     */
    const blockTags = new Set([
      "p",
      "div",
      "section",
      "article",
      "blockquote",
      "li",
      "hr",
    ]);

    if (blockTags.has(tagName)) {
      flushTextBuffer();
    }

        for (const child of tagElement.children ?? []) {
          walk(child);
        }

    if (blockTags.has(tagName)) {
      flushTextBuffer();
    }
  }

  for (const child of mainText.get(0)?.children ?? []) {
    walk(child);
  }

  flushTextBuffer();

  /*
   * 同じ内容が連続した場合は1件にまとめます。
   */
    const uniqueBlocks = blocks.filter(
      (block, index, array) => {
        if (index === 0) {
          return true;
        }

        const previous = array[index - 1];

        if (
          block.type === previous.type &&
          block.text &&
          block.text === previous.text
        ) {
          return false;
        }

        return true;
      },
    );

    return enrichOutlineBlocks(uniqueBlocks);
}

function extractPageTitle(html: string): string | null {
  const $ = cheerio.load(html);
  const title = normalizeText($("title").first().text());

  return title || null;
}

function findXhtmlUrl(
  cardHtml: string,
  cardUrl: URL,
): URL | null {
  const $ = cheerio.load(cardHtml);

  let foundUrl: URL | null = null;

  $("a[href]").each((_, element) => {
    if (foundUrl) {
      return;
    }

    const href = $(element).attr("href");

    if (!href) {
      return;
    }

    let candidate: URL;

    try {
      candidate = new URL(href, cardUrl);
    } catch {
      return;
    }

    if (!AOZORA_HOSTS.has(candidate.hostname.toLowerCase())) {
      return;
    }

    const pathname = candidate.pathname.toLowerCase();

    if (
      pathname.includes("/files/") &&
      /\.(html?|xhtml)$/.test(pathname)
    ) {
      foundUrl = candidate;
    }
  });

  return foundUrl;
}

function extractCardMetadata(html: string) {
  const $ = cheerio.load(html);

  const pageText = normalizeText($("body").text());

  const title =
    normalizeText($("h1").first().text()) ||
    normalizeText($(".title").first().text()) ||
    null;

  const author =
    normalizeText($(".author").first().text()) ||
    null;

  return {
    title,
    author,
    hasCopyrightWarning:
      pageText.includes("著作権存続") ||
      pageText.includes("著作権が存続"),
  };
}

function analyzeXhtml(
  html: string,
  documentUrl: URL,
                      ) {
    const $ = cheerio.load(html);
    
    const headingCounts = {
        h1: $("h1").length,
        h2: $("h2").length,
        h3: $("h3").length,
        h4: $("h4").length,
        h5: $("h5").length,
        h6: $("h6").length,
    };
    
    const paragraphCount = $("p")
    .filter((_, element) => {
        return normalizeText($(element).text()).length > 0;
    })
    .length;
    
    const rubyCount = $("ruby").length;
    const imageCount = $("img").length;
    
    /*
     * 青空文庫XHTMLで改ページを示していそうな要素を、
     * 現段階では「候補」として数えます。
     * 実作品を確認してから条件を固めます。
     */
    const pageBreakCandidateCount = $(
                                      [
                                          ".pagebreak",
                                          ".page_break",
                                          ".newpage",
                                          '[style*="page-break"]',
                                          '[class*="pagebreak"]',
                                          '[class*="page-break"]',
                                      ].join(","),
                                      ).length;
    
    const bodyText = normalizeText($("body").text());
    
    const rubySamples = $("ruby")
    .slice(0, 5)
    .map((_, element) => {
        const ruby = $(element);
        const reading = normalizeText(ruby.find("rt").text());
        
        const clone = ruby.clone();
        clone.find("rt, rp").remove();
        
        const base = normalizeText(clone.text());
        
        return {
            base,
            reading,
        };
    })
    .get();
    
    const headingSamples = $(
                             "h1, h2, h3, h4, h5, h6",
                             )
    .slice(0, 20)
    .map((_, element) => ({
        tag: element.tagName.toLowerCase(),
        text: normalizeText($(element).text()),
    }))
    .get()
    .filter((item) => item.text.length > 0);
    
    const outline = createOutline(
      html,
      documentUrl,
    );

    return {
      documentTitle: extractPageTitle(html),
      headingCounts,
      headingTotal:
        headingCounts.h1 +
        headingCounts.h2 +
        headingCounts.h3 +
        headingCounts.h4 +
        headingCounts.h5 +
        headingCounts.h6,
      paragraphCount,
      rubyCount,
      imageCount,
      pageBreakCandidateCount,
      characterCount: bodyText.length,
      rubySamples,
      headingSamples,
      outline,
      outlineCounts: {
        title: outline.filter(
          (block) => block.type === "TITLE",
        ).length,
        author: outline.filter(
          (block) => block.type === "AUTHOR",
        ).length,
        heading: outline.filter(
          (block) => block.type === "HEADING",
        ).length,
        text: outline.filter(
          (block) => block.type === "TEXT",
        ).length,
        image: outline.filter(
          (block) => block.type === "IMAGE",
        ).length,
        pageBreak: outline.filter(
          (block) => block.type === "PAGE_BREAK",
        ).length,
      },
    };
    
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const inputUrl = validateAozoraUrl(body?.url);

    const firstPage = await loadAozoraPage(inputUrl);
    const sourceType = classifyAozoraUrl(firstPage.finalUrl);

    let card:
      | {
          url: string;
          pageTitle: string | null;
          title: string | null;
          author: string | null;
          hasCopyrightWarning: boolean;
        }
      | null = null;

    let xhtmlPage: LoadedPage;

    if (sourceType === "card") {
      const metadata = extractCardMetadata(firstPage.html);

      card = {
        url: firstPage.finalUrl.toString(),
        pageTitle: extractPageTitle(firstPage.html),
        title: metadata.title,
        author: metadata.author,
        hasCopyrightWarning:
          metadata.hasCopyrightWarning,
      };

      const xhtmlUrl = findXhtmlUrl(
        firstPage.html,
        firstPage.finalUrl,
      );

      if (!xhtmlUrl) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "図書カードからXHTML本文のリンクを見つけられませんでした。",
          },
          { status: 422 },
        );
      }

      xhtmlPage = await loadAozoraPage(xhtmlUrl);
    } else if (sourceType === "xhtml") {
      xhtmlPage = firstPage;
    } else {
      return NextResponse.json(
        {
          ok: false,
          error:
            "図書カードまたはXHTML本文のURLを指定してください。",
        },
        { status: 422 },
      );
    }

      const analysis = analyzeXhtml(
        xhtmlPage.html,
        xhtmlPage.finalUrl,
      );

    return NextResponse.json({
      ok: true,
      requestedUrl: inputUrl.toString(),
      sourceType,
      card,
        xhtml: {
          url: xhtmlPage.finalUrl.toString(),
          contentType: xhtmlPage.contentType,
          charset: xhtmlPage.charset,
          byteLength: xhtmlPage.byteLength,
          pageTitle: extractPageTitle(xhtmlPage.html),
        },
        
      analysis,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "解析中に不明なエラーが発生しました。";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}
