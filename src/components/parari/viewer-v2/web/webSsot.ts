// src/components/parari/viewer-v2/web/webSsot.ts
// src/components/parari/viewer-v2/web/webSsot.ts
// PART: WEB SSOT helpers
// - [WEB] と [WEBPAGE]...[/WEBPAGE] 群を分離する
// - WEBPAGE metaからpageType / title / slug / menu設定を読む
// - HOMEまたは指定slugのWEBPAGEを選択する
// - WEBPAGEの本文部分だけを既存パネルビューアーへ渡す

export type WebPageType =
  | "top"
  | "fixed"
  | "post"
  | "none";

export type WebDesignType =
  | "top"
  | "fixed"
  | "post";

export type WebDesignSection =
  | "topline"
  | "image"
  | "menu";

export type WebToplineItem =
  | "logo"
  | "brand"
  | "catch"
  | "link1"
  | "link2"
  | "link3"
  | "cta";

export type WebImageFit =
  | "cover"
  | "contain";

export type WebPageDesign = {
  sectionOrder: WebDesignSection[];
  toplineOrder: WebToplineItem[];

  brandName: string;
  catchText: string;

  link1Label: string;
  link1Href: string;

  link2Label: string;
  link2Href: string;

  link3Label: string;
  link3Href: string;

  ctaLabel: string;
  ctaHref: string;

  imageUrl: string;
  imageFit: WebImageFit;

  menuEnabled: boolean;
  menuLinks: string;
  menuStyle: "pill" | "bar";
  menuColor:
    | "primary"
    | "secondary"
    | "success"
    | "danger"
    | "warning"
    | "info"
    | "light"
    | "dark"
    | "white";
};

export function isWebLikeSsot(ssot: string): boolean {
  const normalized = String(ssot ?? "").trimStart();

  return /^\[(WEB|WEBINFO)\b/i.test(normalized);
}

export type WebInfo = {
  title: string;
  homePageSlug: string;

  designs: {
    top: WebPageDesign;
    fixed: WebPageDesign;
    post: WebPageDesign;
  };

  /*
   * 旧Viewerを次工程まで動かすための一時互換値。
   * 新Viewerへ置換後に削除する。
   */
  headerTopLayout: string;
  headerTagline: string;
  headerAuxLinks: string;
  headerCtaLabel: string;
  headerCtaHref: string;
  headerImageLayout: string;
  headerImageUrl: string;
  headerImageTitleMode: string;
  headerMenu: string;
  brandMode: string;
  brandSize: string;
  brandAlign: string;

  footer: string;
  raw: string;
};

export type WebPageSegment = {
  index: number;
  pageType: WebPageType;
  title: string;
  slug: string;
  isHome: boolean;
  menuLabel: string;
  showInMenu: boolean;
  menuOrder: number | null;
  keywords: string;

  /**
   * WEBPAGE開始タグ、meta、終了タグを含む全体。
   * PAGE単位の移動・削除・複製に使用する。
   */
  containerRaw: string;

  /**
   * WEBPAGE内の通常パネル部分だけ。
   * ParariPanelViewerへ渡す。
   */
  raw: string;
};

export type ParsedWebSsot = {
  webInfo: WebInfo;
  pages: WebPageSegment[];
};

type RawWebPageSegment = {
  start: number;
  end: number;
  raw: string;
};

export function parseWebSsot(ssot: string): ParsedWebSsot {
  const source = normalizeNewlines(ssot);
  const rawPages = splitWebPages(source);

  const firstPageStart = rawPages[0]?.start ?? source.length;
  const webInfoRaw = source.slice(0, firstPageStart).trim();

  return {
    webInfo: parseWebInfo(webInfoRaw),
    pages: rawPages.map((page, index) =>
      parseWebPage(page.raw, index),
    ),
  };
}

export function selectWebPage(
  parsed: ParsedWebSsot,
  requestedSlug?: string | null,
): WebPageSegment | null {
  const normalizedRequestedSlug = normalizeSlug(requestedSlug ?? "");

  if (normalizedRequestedSlug) {
    return (
      parsed.pages.find(
        (page) => normalizeSlug(page.slug) === normalizedRequestedSlug,
      ) ?? null
    );
  }

  const explicitHome = parsed.pages.find((page) => page.isHome);

  if (explicitHome) {
    return explicitHome;
  }

  const homePageSlug = normalizeSlug(parsed.webInfo.homePageSlug);

  if (homePageSlug) {
    const matchedHome = parsed.pages.find(
      (page) => normalizeSlug(page.slug) === homePageSlug,
    );

    if (matchedHome) {
      return matchedHome;
    }
  }

  return parsed.pages[0] ?? null;
}

/**
 * WEB作品から [WEBPAGE]...[/WEBPAGE] を切り出す。
 *
 * - BOOKの [PAGE] とは完全に独立
 * - 終了タグがないWEBPAGEは無効として採用しない
 * - WEBPAGE同士の入れ子は認めない
 */
function splitWebPages(source: string): RawWebPageSegment[] {
  const lines = splitLinesWithOffsets(source);
  const pages: RawWebPageSegment[] = [];

  let openStart: number | null = null;

  for (const line of lines) {
    const trimmed = line.text.trim();

    if (/^\[WEBPAGE(?:\:[^\]]+)?\](?:\s|$)/i.test(trimmed)) {
      openStart = line.start;
      continue;
    }

    if (/^\[\/WEBPAGE\]\s*$/i.test(trimmed)) {
      if (openStart === null) {
        continue;
      }

      pages.push({
        start: openStart,
        end: line.end,
        raw: source.slice(openStart, line.end),
      });

      openStart = null;
    }
  }

  return pages;
}

function parseWebInfo(raw: string): WebInfo {
  const meta = parseLeadingMeta(raw, "WEB");

  return {
    title:
      meta.title ||
      meta.markerTitle ||
      "新しいWEB",

    homePageSlug:
      meta.homepageslug ||
      meta.home_page_slug ||
      "home",

    designs: {
      top: parseWebPageDesign(meta, "top", {
        sectionOrder: ["topline", "image", "menu"],
        toplineOrder: [
          "logo",
          "brand",
          "catch",
          "link1",
          "link2",
          "link3",
          "cta",
        ],
      }),

      fixed: parseWebPageDesign(meta, "fixed", {
        sectionOrder: ["topline", "menu"],
        toplineOrder: [
          "logo",
          "brand",
          "catch",
          "link1",
          "link2",
          "link3",
          "cta",
        ],
      }),

      post: parseWebPageDesign(meta, "post", {
        sectionOrder: ["topline", "menu"],
        toplineOrder: [
          "logo",
          "brand",
          "catch",
          "link1",
          "link2",
          "link3",
          "cta",
        ],
      }),
    },

    // ここから一時互換用
    headerTopLayout: "none",
    headerTagline: "",
    headerAuxLinks: "",
    headerCtaLabel: "",
    headerCtaHref: "",
    headerImageLayout: "none",
    headerImageUrl: "",
    headerImageTitleMode: "none",
    headerMenu: "none",
    brandMode: "title",
    brandSize: "medium",
    brandAlign: "center",
    // ここまで一時互換用

    footer: meta.footer || "1",
    raw,
  };
}

type WebPageDesignDefaults = {
  sectionOrder: WebDesignSection[];
  toplineOrder: WebToplineItem[];
};

function parseWebPageDesign(
  meta: Record<string, string>,
  designType: WebDesignType,
  defaults: WebPageDesignDefaults,
): WebPageDesign {
  const prefix = designType.toLowerCase();

  return {
    sectionOrder: parseDesignSectionOrder(
      meta[`${prefix}sectionorder`] ||
        meta[`${prefix}_section_order`] ||
        "",
      defaults.sectionOrder,
    ),

    toplineOrder: parseToplineOrder(
      meta[`${prefix}toplineorder`] ||
        meta[`${prefix}_topline_order`] ||
        "",
      defaults.toplineOrder,
    ),

    brandName:
      meta[`${prefix}brandname`] ||
      meta[`${prefix}_brand_name`] ||
      "",

    catchText:
      meta[`${prefix}catchtext`] ||
      meta[`${prefix}_catch_text`] ||
      "",

    link1Label:
      meta[`${prefix}link1label`] ||
      meta[`${prefix}_link1_label`] ||
      "",

    link1Href:
      meta[`${prefix}link1href`] ||
      meta[`${prefix}_link1_href`] ||
      "",

    link2Label:
      meta[`${prefix}link2label`] ||
      meta[`${prefix}_link2_label`] ||
      "",

    link2Href:
      meta[`${prefix}link2href`] ||
      meta[`${prefix}_link2_href`] ||
      "",

    link3Label:
      meta[`${prefix}link3label`] ||
      meta[`${prefix}_link3_label`] ||
      "",

    link3Href:
      meta[`${prefix}link3href`] ||
      meta[`${prefix}_link3_href`] ||
      "",

    ctaLabel:
      meta[`${prefix}ctalabel`] ||
      meta[`${prefix}_cta_label`] ||
      "",

    ctaHref:
      meta[`${prefix}ctahref`] ||
      meta[`${prefix}_cta_href`] ||
      "",

    imageUrl:
      meta[`${prefix}imageurl`] ||
      meta[`${prefix}_image_url`] ||
      "",

    imageFit: normalizeImageFit(
      meta[`${prefix}imagefit`] ||
        meta[`${prefix}_image_fit`] ||
        "cover",
    ),

    menuEnabled: parseBooleanWithDefault(
      meta[`${prefix}menuenabled`] ||
        meta[`${prefix}_menu_enabled`],
      true,
    ),

    menuLinks:
      meta[`${prefix}menulinks`] ||
      meta[`${prefix}_menu_links`] ||
      "",

    menuStyle:
      normalizeMenuStyle(
        meta[`${prefix}menustyle`] ||
        meta[`${prefix}_menu_style`] ||
        "bar",
      ),

    menuColor:
      normalizeBootstrapColor(
        meta[`${prefix}menucolor`] ||
        meta[`${prefix}_menu_color`] ||
        "dark",
      ),
  };
}

function parseDesignSectionOrder(
  value: string,
  fallback: WebDesignSection[],
): WebDesignSection[] {
  const allowed = new Set<WebDesignSection>([
    "topline",
    "image",
    "menu",
  ]);

  const parsed = parseCommaList(value)
    .filter(
      (item): item is WebDesignSection =>
        allowed.has(item as WebDesignSection),
    );

  return parsed.length > 0
    ? removeDuplicates(parsed)
    : [...fallback];
}

function parseToplineOrder(
  value: string,
  fallback: WebToplineItem[],
): WebToplineItem[] {
  const allowed = new Set<WebToplineItem>([
    "logo",
    "brand",
    "catch",
    "link1",
    "link2",
    "link3",
    "cta",
  ]);

  const parsed = parseCommaList(value)
    .filter(
      (item): item is WebToplineItem =>
        allowed.has(item as WebToplineItem),
    );

  return parsed.length > 0
    ? removeDuplicates(parsed)
    : [...fallback];
}

function parseCommaList(value: string): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function removeDuplicates<T extends string>(
  values: T[],
): T[] {
  return Array.from(new Set(values));
}

function normalizeImageFit(
  value: string,
): WebImageFit {
  return String(value ?? "")
    .trim()
    .toLowerCase() === "contain"
    ? "contain"
    : "cover";
}

function parseBooleanWithDefault(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return defaultValue;
  }

  if (
    ["true", "1", "yes", "on"].includes(normalized)
  ) {
    return true;
  }

  if (
    ["false", "0", "no", "off"].includes(normalized)
  ) {
    return false;
  }

  return defaultValue;
}

function parseWebPage(
  containerRaw: string,
  index: number,
): WebPageSegment {
  const meta = parseLeadingMeta(containerRaw, "WEBPAGE");

  const title =
    meta.title ||
    meta.markerTitle ||
    `WEBPAGE ${index + 1}`;

  const slug =
    normalizeSlug(meta.slug || meta.url) ||
    `page-${index + 1}`;

  return {
    index,

    pageType: normalizePageType(
      meta.pagetype ||
      meta.page_type ||
      (parseBoolean(meta.ishome || meta.is_home) ? "top" : "fixed"),
    ),

    title,
    slug,

    isHome: parseBoolean(
      meta.ishome ||
      meta.is_home,
    ),

    menuLabel:
      meta.menulabel ||
      meta.menu_label ||
      title,

    showInMenu:
      !Object.prototype.hasOwnProperty.call(meta, "showinmenu") &&
      !Object.prototype.hasOwnProperty.call(meta, "show_in_menu")
        ? true
        : parseBoolean(
            meta.showinmenu ||
            meta.show_in_menu,
          ),

    menuOrder: parseOptionalNumber(
      meta.menuorder ||
      meta.menu_order,
    ),
      
  keywords:
    meta.keywords ||
    meta.keyword ||
    "",

    containerRaw: containerRaw.trim(),
    raw: extractWebPageBody(containerRaw),
  };
}

/**
 * [WEBPAGE]開始行とmeta、[/WEBPAGE]を除き、
 * 中の通常パネルだけを返す。
 */
function extractWebPageBody(containerRaw: string): string {
  const normalized = normalizeNewlines(containerRaw);
  const lines = normalized.split("\n");

  if (lines.length === 0) {
    return "";
  }

  let bodyStartLine = 1;

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      bodyStartLine = index + 1;
      break;
    }

    if (
      /^\s*[A-Za-z][A-Za-z0-9_-]*\s*:\s*/.test(line)
    ) {
      bodyStartLine = index + 1;
      continue;
    }

    bodyStartLine = index;
    break;
  }

  let bodyEndLine = lines.length;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (/^\s*\[\/WEBPAGE\]\s*$/i.test(lines[index] ?? "")) {
      bodyEndLine = index;
      break;
    }
  }

  return lines
    .slice(bodyStartLine, bodyEndLine)
    .join("\n")
    .trim();
}

function parseLeadingMeta(
  raw: string,
  expectedTag: "WEB" | "WEBPAGE",
): Record<string, string> & { markerTitle: string } {
  const lines = normalizeNewlines(raw).split("\n");

  const markerPattern = new RegExp(
    `^\\s*\\[${expectedTag}(?::[^\\]]+)?\\]\\s*(.*)$`,
    "i",
  );

  const markerMatch = (lines[0] ?? "").match(markerPattern);

  const result: Record<string, string> & {
    markerTitle: string;
  } = {
    markerTitle: markerMatch?.[1]?.trim() ?? "",
  };

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      break;
    }

    const match = line.match(
      /^\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*$/,
    );

    if (!match) {
      break;
    }

    result[normalizeMetaKey(match[1])] = match[2] ?? "";
  }

  return result;
}

function normalizePageType(
  value: string,
): WebPageType {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    normalized === "top" ||
    normalized === "fixed" ||
    normalized === "post" ||
    normalized === "none"
  ) {
    return normalized;
  }

  // 途中版のblankは「デザインなし」として読む
  if (normalized === "blank") {
    return "none";
  }

  return "fixed";
}

function parseOptionalNumber(
  value: string | undefined,
): number | null {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value: string): boolean {
  return ["true", "1", "yes", "on"].includes(
    String(value ?? "").trim().toLowerCase(),
  );
}

function normalizeMetaKey(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]/g, "_");
}

function normalizeSlug(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function resolveWebInternalLinks(
  pageSsot: string,
  publicBasePath: string,
  homePageSlug: string,
): string {
  const basePath = String(publicBasePath ?? "")
    .trim()
    .replace(/\/+$/, "");

  if (!basePath) {
    return pageSsot;
  }

  const normalizedHomeSlug = normalizeSlug(homePageSlug);

  return normalizeNewlines(pageSsot)
    .split("\n")
    .map((line) => {
      return line.replace(
        /(\|\s*)page:([A-Za-z0-9_-]+)\s*$/i,
        (_matched, separator: string, rawSlug: string) => {
          const slug = normalizeSlug(rawSlug);

          const href =
            !slug || slug === normalizedHomeSlug
              ? basePath
              : `${basePath}/${encodeURIComponent(slug)}`;

          return `${separator}${href}`;
        },
      );
    })
    .join("\n");
}

type LineWithOffsets = {
  text: string;
  start: number;
  end: number;
};

function splitLinesWithOffsets(
  source: string,
): LineWithOffsets[] {
  const lines: LineWithOffsets[] = [];

  let start = 0;

  while (start < source.length) {
    const newlineIndex = source.indexOf("\n", start);

    if (newlineIndex < 0) {
      lines.push({
        text: source.slice(start),
        start,
        end: source.length,
      });
      break;
    }

    lines.push({
      text: source.slice(start, newlineIndex),
      start,
      end: newlineIndex + 1,
    });

    start = newlineIndex + 1;
  }

  if (source.length === 0) {
    return [];
  }

  return lines;
}

export function replaceWebInfoRaw(
  ssot: string,
  nextWebInfoRaw: string,
): string {
  const source = normalizeNewlines(ssot);
  const pages = splitWebPages(source);
  const firstPageStart = pages[0]?.start ?? source.length;

  const normalizedWebInfo = String(nextWebInfoRaw ?? "").trim();
  const pageArea = source.slice(firstPageStart).trimStart();

  if (!pageArea) {
    return normalizedWebInfo;
  }

  return `${normalizedWebInfo}\n\n${pageArea}`.trim();
}

export function replaceWebPageMetaValue(
  ssot: string,
  pageIndex: number,
  key: string,
  value: string,
): string {
  const source = normalizeNewlines(ssot);
  const pages = splitWebPages(source);
  const target = pages[pageIndex];

  if (!target) {
    return source;
  }

  const lines = normalizeNewlines(target.raw).split("\n");
  const normalizedKey = String(key ?? "").trim();

  if (!normalizedKey) {
    return source;
  }

  let metaEndIndex = 1;

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      metaEndIndex = index;
      break;
    }

    if (/^[A-Za-z][A-Za-z0-9_-]*\s*:/.test(trimmed)) {
      metaEndIndex = index + 1;
      continue;
    }

    metaEndIndex = index;
    break;
  }

  const pattern = new RegExp(
    `^\\s*${escapeRegExp(normalizedKey)}\\s*:`,
    "i",
  );

  const existingIndex = lines
    .slice(1, metaEndIndex)
    .findIndex((line) => pattern.test(line));

  if (existingIndex >= 0) {
    lines[existingIndex + 1] = `${normalizedKey}: ${value}`;
  } else {
    lines.splice(metaEndIndex, 0, `${normalizedKey}: ${value}`);
  }

  if (normalizedKey.toLowerCase() === "title") {
    lines[0] = `[WEBPAGE] ${value}`;
  }

  const nextContainer = lines.join("\n");

  return (
    source.slice(0, target.start) +
    nextContainer +
    source.slice(target.end)
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function replaceWebPageBody(
  ssot: string,
  pageIndex: number,
  nextBodyRaw: string,
): string {
  const source = normalizeNewlines(ssot);
  const pages = splitWebPages(source);
  const target = pages[pageIndex];

  if (!target) {
    return source;
  }

  const parsedPage = parseWebPage(target.raw, pageIndex);
  const nextContainer = buildWebPageContainer(
    parsedPage.containerRaw,
    nextBodyRaw,
  );

  return (
    source.slice(0, target.start) +
    nextContainer +
    source.slice(target.end)
  );
}

function buildWebPageContainer(
  containerRaw: string,
  bodyRaw: string,
): string {
  const normalized = normalizeNewlines(containerRaw);
  const lines = normalized.split("\n");

  const openingAndMeta: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (index === 0) {
      openingAndMeta.push(line);
      continue;
    }

    if (!trimmed) {
      break;
    }

    if (/^[A-Za-z][A-Za-z0-9_-]*\s*:/.test(trimmed)) {
      openingAndMeta.push(line);
      continue;
    }

    break;
  }

  const normalizedBody = String(bodyRaw ?? "").trim();

  return [
    ...openingAndMeta,
    "",
    normalizedBody,
    "[/WEBPAGE]",
  ]
    .filter((line, index, all) => {
      if (line !== "") {
        return true;
      }

      return index > 0 && all[index - 1] !== "";
    })
    .join("\n")
    .trim();
}

function normalizeNewlines(value: string): string {
  return String(value ?? "").replace(/\r\n/g, "\n");
}

export function appendWebPage(
  ssot: string,
  pageType: WebPageType,
): string {
  const source = normalizeNewlines(ssot).trim();
  const parsed = parseWebSsot(source);

  const normalizedPageType =
    pageType === "top" ||
    pageType === "fixed" ||
    pageType === "post" ||
    pageType === "none"
      ? pageType
      : "fixed";

  const pageNumber = parsed.pages.length + 1;

  const defaultTitle =
    normalizedPageType === "top"
      ? "新しいトップページ"
      : normalizedPageType === "post"
        ? "新しい投稿"
        : normalizedPageType === "none"
          ? "新しいページ"
          : "新しい固定ページ";

  const baseSlug =
    normalizedPageType === "top"
      ? "home"
      : normalizedPageType === "post"
        ? "post"
        : "page";

  const slug = createUniqueWebPageSlug(
    baseSlug,
    parsed.pages.map((page) => page.slug),
  );

  const shouldBeHome =
    normalizedPageType === "top" &&
    !parsed.pages.some((page) => page.isHome);

  const nextContainer = [
    `[WEBPAGE] ${defaultTitle}`,
    `pageType: ${normalizedPageType}`,
    `title: ${defaultTitle}`,
    `slug: ${slug}`,
    `isHome: ${shouldBeHome ? "true" : "false"}`,
    `menuLabel: ${defaultTitle}`,
    "showInMenu: true",
    `menuOrder: ${pageNumber - 1}`,
    "",
    "[T]",
    "本文を書いてください。",
    "[/WEBPAGE]",
  ].join("\n");

  if (!source) {
    return nextContainer;
  }

  return `${source}\n\n${nextContainer}`;
}

function createUniqueWebPageSlug(
  baseSlug: string,
  existingSlugs: string[],
): string {
  const normalizedBase =
    normalizeSlug(baseSlug) || "page";

  const usedSlugs = new Set(
    existingSlugs
      .map((slug) => normalizeSlug(slug))
      .filter(Boolean),
  );

  if (!usedSlugs.has(normalizedBase)) {
    return normalizedBase;
  }

  let suffix = 2;

  while (
    usedSlugs.has(
      `${normalizedBase}-${suffix}`,
    )
  ) {
    suffix += 1;
  }

  return `${normalizedBase}-${suffix}`;
}

function normalizeMenuStyle(
  value: string,
): "pill" | "bar" {
  return String(value ?? "")
    .trim()
    .toLowerCase() === "bar"
    ? "bar"
    : "pill";
}

function normalizeBootstrapColor(
  value: string,
):
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "light"
  | "dark"
  | "white" {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    normalized === "primary" ||
    normalized === "secondary" ||
    normalized === "success" ||
    normalized === "danger" ||
    normalized === "warning" ||
    normalized === "info" ||
    normalized === "light" ||
    normalized === "dark" ||
    normalized === "white"
  ) {
    return normalized;
  }

  return "primary";
}

