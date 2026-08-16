// src/components/parari/viewer-v2/ParariWebViewer.tsx
// PART: WEB viewer
// - WEBPAGEのpageTypeに応じてWEBINFOのページデザインを選ぶ
// - sectionOrder順にトップライン・画像・メニューを表示する
// - pageType:noneでは共通デザインを表示しない

"use client";

import React from "react";
import ParariPanelViewer from "./ParariPanelViewer";

import {
  parseWebSsot,
  resolveWebInternalLinks,
  selectWebPage,
  type WebPageDesign,
  type WebPageSegment,
  type WebToplineItem,
} from "./web/webSsot";

type ParariWebViewerProps = {
  content?: string | null;
  pageSlug?: string | null;
  publicBasePath?: string;
  headerLogoUrl?: string | null;
};

type WebNavigationLink = {
  label: string;
  href: string;
  isCurrent: boolean;
};

export default function ParariWebViewer({
  content = "",
  pageSlug = null,
  publicBasePath = "",
  headerLogoUrl = null,
}: ParariWebViewerProps) {
  const parsed = React.useMemo(
    () => parseWebSsot(String(content ?? "")),
    [content],
  );

  const selectedPage = React.useMemo(
    () => selectWebPage(parsed, pageSlug),
    [parsed, pageSlug],
  );

  const resolvedPageSsot = React.useMemo(() => {
    if (!selectedPage) {
      return "";
    }

    return resolveWebInternalLinks(
      selectedPage.raw,
      publicBasePath,
      parsed.webInfo.homePageSlug,
    );
  }, [
    selectedPage,
    publicBasePath,
    parsed.webInfo.homePageSlug,
  ]);

  if (!selectedPage) {
    return (
      <WebPageNotFound
        pageSlug={pageSlug}
        publicBasePath={publicBasePath}
      />
    );
  }

  const design =
    selectedPage.pageType === "none"
      ? null
      : parsed.webInfo.designs[selectedPage.pageType];

  return (
    <>
      {design ? (
        <WebPageDesignHeader
          design={design}
          webTitle={parsed.webInfo.title}
          pages={parsed.pages}
          selectedPage={selectedPage}
          publicBasePath={publicBasePath}
          homePageSlug={parsed.webInfo.homePageSlug}
          logoUrl={headerLogoUrl}
        />
      ) : null}

      <ParariPanelViewer
        content={resolvedPageSsot}
        displayMode="web"
      />

      {design ? (
        <WebCommonFooter
          title={parsed.webInfo.title}
          footer={parsed.webInfo.footer}
          publicBasePath={publicBasePath}
        />
      ) : null}
    </>
  );
}

function WebPageNotFound({
  pageSlug,
  publicBasePath,
}: {
  pageSlug: string | null;
  publicBasePath: string;
}) {
  const homeHref =
    normalizeBasePath(publicBasePath);

  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="mx-auto min-h-screen w-full max-w-[720px] bg-white px-6 py-10 shadow-sm">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
          <div className="text-sm leading-7 text-neutral-600">
            {pageSlug
              ? "指定されたWEBPAGEが見つかりませんでした。"
              : "このWEB作品には表示できるWEBPAGEがありません。"}
          </div>

          {pageSlug && homeHref ? (
            <a
              href={homeHref}
              className="mt-4 inline-flex rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-700"
            >
              HOMEへ戻る
            </a>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function WebPageDesignHeader({
  design,
  webTitle,
  pages,
  selectedPage,
  publicBasePath,
  homePageSlug,
  logoUrl,
}: {
  design: WebPageDesign;
  webTitle: string;
  pages: WebPageSegment[];
  selectedPage: WebPageSegment;
  publicBasePath: string;
  homePageSlug: string;
  logoUrl: string | null;
}) {
  const basePath =
    normalizeBasePath(publicBasePath);

  return (
    <header>
      {design.sectionOrder.map((section) => {
        if (section === "topline") {
          return (
            <WebTopline
              key="topline"
              design={design}
              webTitle={webTitle}
              basePath={basePath}
              homePageSlug={homePageSlug}
              logoUrl={logoUrl}
            />
          );
        }

        if (section === "image") {
          return (
            <WebHeaderImage
              key="image"
              design={design}
            />
          );
        }

        if (section === "menu") {
          return (
            <WebMainMenu
              key="menu"
              design={design}
              pages={pages}
              selectedPage={selectedPage}
              basePath={basePath}
              homePageSlug={homePageSlug}
            />
          );
        }

        return null;
      })}
    </header>
  );
}

function WebTopline({
  design,
  webTitle,
  basePath,
  homePageSlug,
  logoUrl,
}: {
  design: WebPageDesign;
  webTitle: string;
  basePath: string;
  homePageSlug: string;
  logoUrl: string | null;
}) {
  if (design.toplineOrder.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex w-full max-w-[720px] flex-wrap items-center justify-center gap-x-5 gap-y-3 px-5 py-4 sm:justify-start">
        {design.toplineOrder.map((item) => (
          <WebToplineItemView
            key={item}
            item={item}
            design={design}
            webTitle={webTitle}
            basePath={basePath}
            homePageSlug={homePageSlug}
            logoUrl={logoUrl}
          />
        ))}
      </div>
    </div>
  );
}

function WebToplineItemView({
  item,
  design,
  webTitle,
  basePath,
  homePageSlug,
  logoUrl,
}: {
  item: WebToplineItem;
  design: WebPageDesign;
  webTitle: string;
  basePath: string;
  homePageSlug: string;
  logoUrl: string | null;
}) {
  if (item === "logo") {
    if (!logoUrl) {
      return null;
    }

    return (
      <a
        href={basePath || undefined}
        className="inline-flex shrink-0 items-center"
      >
        <img
          src={logoUrl}
          alt=""
          className="max-h-12 max-w-[200px] object-contain"
        />
      </a>
    );
  }

  if (item === "brand") {
    const brandName =
      design.brandName || webTitle || "WEB";

    return (
      <a
        href={basePath || undefined}
        className="text-lg font-bold text-neutral-900 transition hover:text-neutral-600"
      >
        {brandName}
      </a>
    );
  }

  if (item === "catch") {
    if (!design.catchText) {
      return null;
    }

    return (
      <div className="min-w-[160px] flex-1 text-center text-sm leading-6 text-neutral-600 sm:text-left">
        {design.catchText}
      </div>
    );
  }

  if (item === "link1") {
    return (
      <WebToplineLink
        label={design.link1Label}
        rawHref={design.link1Href}
        basePath={basePath}
        homePageSlug={homePageSlug}
      />
    );
  }

  if (item === "link2") {
    return (
      <WebToplineLink
        label={design.link2Label}
        rawHref={design.link2Href}
        basePath={basePath}
        homePageSlug={homePageSlug}
      />
    );
  }

  if (item === "link3") {
    return (
      <WebToplineLink
        label={design.link3Label}
        rawHref={design.link3Href}
        basePath={basePath}
        homePageSlug={homePageSlug}
      />
    );
  }

  if (item === "cta") {
    const href = resolveWebHref(
      design.ctaHref,
      basePath,
      homePageSlug,
    );

    if (!design.ctaLabel || !href) {
      return null;
    }

    return (
      <a
        href={href}
        className="shrink-0 rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-700"
      >
        {design.ctaLabel}
      </a>
    );
  }

  return null;
}

function WebToplineLink({
  label,
  rawHref,
  basePath,
  homePageSlug,
}: {
  label: string;
  rawHref: string;
  basePath: string;
  homePageSlug: string;
}) {
  const href = resolveWebHref(
    rawHref,
    basePath,
    homePageSlug,
  );

  if (!label || !href) {
    return null;
  }

  return (
    <a
      href={href}
      className="shrink-0 text-xs font-bold text-neutral-500 transition hover:text-neutral-950"
    >
      {label}
    </a>
  );
}

function WebHeaderImage({
  design,
}: {
  design: WebPageDesign;
}) {
  const imageUrl =
    String(design.imageUrl ?? "").trim();

  if (!imageUrl) {
    return null;
  }

  const objectFitClass =
    design.imageFit === "contain"
      ? "object-contain"
      : "object-cover";

  return (
    <div className="bg-neutral-100">
      <div className="mx-auto h-[280px] w-full max-w-[720px] overflow-hidden">
        <img
          src={imageUrl}
          alt=""
          className={[
            "h-full w-full",
            objectFitClass,
          ].join(" ")}
        />
      </div>
    </div>
  );
}

function WebMainMenu({
  design,
  pages,
  selectedPage,
  basePath,
  homePageSlug,
}: {
  design: WebPageDesign;
  pages: WebPageSegment[];
  selectedPage: WebPageSegment;
  basePath: string;
  homePageSlug: string;
}) {
  if (!design.menuEnabled) {
    return null;
  }

  const manualLinks = parseMenuLinks(
    design.menuLinks,
    selectedPage,
    basePath,
    homePageSlug,
  );

  const links = mergeWebPageMenuLinks({
    manualLinks,
    pages,
    selectedPage,
    basePath,
    homePageSlug,
  });

  if (links.length === 0) {
    return null;
  }

  const isBar =
    design.menuStyle === "bar";

  const barColorClass =
    bootstrapMenuBarColorClass(
      design.menuColor,
    );

  return (
    <div
      className={[
        "w-full border-b",
        isBar
          ? barColorClass
          : "border-neutral-200 bg-white",
      ].join(" ")}
    >
      <div
        className={[
          "mx-auto flex w-full max-w-[720px] items-center justify-end sm:justify-center",
          isBar
            ? "px-3 py-2"
            : "px-5 py-3",
        ].join(" ")}
      >
        <WebDesktopNavigation
          links={links}
          style={design.menuStyle}
          color={design.menuColor}
        />

        <WebMobileNavigation
          links={links}
        />
      </div>
    </div>
  );
}

function WebDesktopNavigation({
  links,
  style,
  color,
}: {
  links: WebNavigationLink[];
  style: "pill" | "bar";
  color: WebPageDesign["menuColor"];
}) {
  if (style === "bar") {
    return (
      <nav className="hidden w-full flex-wrap items-center justify-center gap-2 sm:flex">
        {links.map((link, index) => (
          <a
            key={`${link.href}-${index}`}
            href={link.href}
            aria-current={
              link.isCurrent
                ? "page"
                : undefined
            }
            onClick={(event) => {
              if (link.isCurrent) {
                event.preventDefault();
              }
            }}
            className={[
              "flex min-h-10 min-w-[120px] max-w-[220px] flex-1 items-center justify-center rounded-md px-4 py-2 text-center text-xs font-bold transition",
              bootstrapMenuButtonClass(
                color,
                link.isCurrent,
              ),
            ].join(" ")}
          > 
            {link.label}
          </a>
        ))}
      </nav>
    );
  }

  return (
    <nav className="hidden flex-wrap items-center justify-center gap-1.5 sm:flex">
      {links.map((link, index) => (
        <a
          key={`${link.href}-${index}`}
          href={link.href}
          aria-current={
            link.isCurrent
              ? "page"
              : undefined
          }
          className={[
            "rounded-full px-3 py-1.5 text-xs font-bold transition",
            link.isCurrent
              ? "bg-neutral-900 text-white"
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
          ].join(" ")}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}

function WebMobileNavigation({
  links,
}: {
  links: WebNavigationLink[];
}) {
  const [isOpen, setIsOpen] =
    React.useState(false);

  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        aria-label={
          isOpen
            ? "メニューを閉じる"
            : "メニューを開く"
        }
        aria-expanded={isOpen}
        onClick={() =>
          setIsOpen((current) => !current)
        }
        className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-xl font-bold text-neutral-800 transition hover:bg-neutral-100"
      >
        {isOpen ? "×" : "☰"}
      </button>

      {isOpen ? (
        <>
          <button
            type="button"
            aria-label="メニューを閉じる"
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-black/10"
          />

          <nav className="absolute right-0 top-12 z-50 min-w-[220px] overflow-hidden rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
            {links.map((link, index) => (
              <a
                key={`${link.href}-${index}-mobile`}
                href={link.href}
                aria-current={
                  link.isCurrent
                    ? "page"
                    : undefined
                }
                onClick={() =>
                  setIsOpen(false)
                }
                className={[
                  "block rounded-xl px-4 py-3 text-sm font-bold transition",
                  link.isCurrent
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-700 hover:bg-neutral-100",
                ].join(" ")}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </>
      ) : null}
    </div>
  );
}

function parseMenuLinks(
  raw: string,
  selectedPage: WebPageSegment,
  basePath: string,
  homePageSlug: string,
): WebNavigationLink[] {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex =
        line.indexOf("|");

      if (separatorIndex < 0) {
        return null;
      }

      const label =
        line.slice(0, separatorIndex).trim();

      const rawHref =
        line.slice(separatorIndex + 1).trim();

      const href = resolveWebHref(
        rawHref,
        basePath,
        homePageSlug,
      );

      if (!label || !href) {
        return null;
      }

      return {
        label,
        href,
        isCurrent: isCurrentWebLink(
          rawHref,
          selectedPage,
          homePageSlug,
        ),
      };
    })
    .filter(
      (
        link,
      ): link is WebNavigationLink =>
        link !== null,
    );
}

function isCurrentWebLink(
  rawHref: string,
  selectedPage: WebPageSegment,
  homePageSlug: string,
): boolean {
  const matched =
    String(rawHref ?? "")
      .trim()
      .match(
        /^page:([A-Za-z0-9_-]+)$/i,
      );

  if (!matched) {
    return false;
  }

  const targetSlug =
    normalizeSlug(matched[1]);

  const selectedSlug =
    normalizeSlug(selectedPage.slug);

  const normalizedHomeSlug =
    normalizeSlug(homePageSlug);

  if (
    selectedPage.isHome &&
    targetSlug === normalizedHomeSlug
  ) {
    return true;
  }

  return targetSlug === selectedSlug;
}

function resolveWebHref(
  rawHref: string,
  basePath: string,
  homePageSlug: string,
): string {
  const value =
    String(rawHref ?? "").trim();

  if (!value) {
    return "";
  }

  const pageMatched = value.match(
    /^page:([A-Za-z0-9_-]+)$/i,
  );

  if (pageMatched) {
    const slug =
      normalizeSlug(pageMatched[1]);

    const normalizedHomeSlug =
      normalizeSlug(homePageSlug);

    if (
      !slug ||
      slug === normalizedHomeSlug
    ) {
      return basePath || "#";
    }

    if (!basePath) {
      return `#${slug}`;
    }

    return `${basePath}/${encodeURIComponent(
      slug,
    )}`;
  }

  if (
    /^(https?:\/\/|mailto:|tel:|#|\/)/i.test(
      value,
    )
  ) {
    return value;
  }

  return value;
}

function WebCommonFooter({
  title,
  footer,
  publicBasePath,
}: {
  title: string;
  footer: string;
  publicBasePath: string;
}) {
  const normalizedFooter =
    String(footer ?? "1")
      .trim()
      .toLowerCase();

  if (normalizedFooter === "none") {
    return null;
  }

  const basePath =
    normalizeBasePath(publicBasePath);

  const currentYear =
    new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2 px-5 py-6 text-center">
        {basePath ? (
          <a
            href={basePath}
            className="text-sm font-bold text-neutral-800 hover:text-neutral-950"
          >
            {title || "WEB"}
          </a>
        ) : (
          <div className="text-sm font-bold text-neutral-800">
            {title || "WEB"}
          </div>
        )}

        <div className="text-[11px] text-neutral-400">
          © {currentYear} {title || "WEB"}
        </div>
      </div>
    </footer>
  );
}

function normalizeBasePath(
  value: string,
): string {
  return String(value ?? "")
    .trim()
    .replace(/\/+$/, "");
}

function normalizeSlug(
  value: string,
): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function bootstrapMenuBarColorClass(
  color: WebPageDesign["menuColor"],
): string {
  switch (color) {
    case "secondary":
      return "border-[#6c757d] bg-[#6c757d]";

    case "success":
      return "border-[#198754] bg-[#198754]";

    case "danger":
      return "border-[#dc3545] bg-[#dc3545]";

    case "warning":
      return "border-[#ffc107] bg-[#ffc107]";

    case "info":
      return "border-[#0dcaf0] bg-[#0dcaf0]";

    case "light":
      return "border-[#dee2e6] bg-[#f8f9fa]";

    case "dark":
      return "border-[#212529] bg-[#212529]";

    case "white":
      return "border-neutral-200 bg-white";

    case "primary":
    default:
      return "border-[#0d6efd] bg-[#0d6efd]";
  }
}

function bootstrapMenuButtonClass(
  color: WebPageDesign["menuColor"],
  isCurrent: boolean,
): string {
  const interactionClass = isCurrent
    ? "cursor-default"
    : "";

  switch (color) {
    case "warning":
    case "info":
    case "light":
    case "white":
      return [
        "text-neutral-900",
        isCurrent
          ? ""
          : "hover:bg-black/10",
        interactionClass,
      ]
        .filter(Boolean)
        .join(" ");

    default:
      return [
        "text-white",
        isCurrent
          ? ""
          : "hover:bg-white/15",
        interactionClass,
      ]
        .filter(Boolean)
        .join(" ");
  }
}

function mergeWebPageMenuLinks({
  manualLinks,
  pages,
  selectedPage,
  basePath,
  homePageSlug,
}: {
  manualLinks: WebNavigationLink[];
  pages: WebPageSegment[];
  selectedPage: WebPageSegment;
  basePath: string;
  homePageSlug: string;
}): WebNavigationLink[] {
  const links = [...manualLinks];

  const registeredHrefs = new Set(
    manualLinks.map((link) =>
      normalizeComparableHref(link.href),
    ),
  );

  const normalizedHomeSlug =
    normalizeSlug(homePageSlug);

  const visiblePages = pages
    .filter((page) => page.showInMenu)
    .slice()
    .sort((left, right) => {
      if (
        left.menuOrder !== null &&
        right.menuOrder !== null
      ) {
        return (
          left.menuOrder -
            right.menuOrder ||
          left.index - right.index
        );
      }

      if (left.menuOrder !== null) {
        return -1;
      }

      if (right.menuOrder !== null) {
        return 1;
      }

      return left.index - right.index;
    });

  for (const page of visiblePages) {
    const slug = normalizeSlug(page.slug);

    if (!slug) {
      continue;
    }

    const isHome =
      page.isHome ||
      slug === normalizedHomeSlug;

    const href = isHome
      ? basePath || "#"
      : basePath
        ? `${basePath}/${encodeURIComponent(
            page.slug,
          )}`
        : `#${slug}`;

    const comparableHref =
      normalizeComparableHref(href);

    if (registeredHrefs.has(comparableHref)) {
      continue;
    }

    registeredHrefs.add(comparableHref);

    links.push({
      label:
        page.menuLabel ||
        page.title ||
        `PAGE ${page.index + 1}`,
      href,
      isCurrent:
        page.index === selectedPage.index,
    });
  }

  return links;
}

function normalizeComparableHref(
  value: string,
): string {
  return String(value ?? "")
    .trim()
    .replace(/\/+$/, "")
    .toLowerCase();
}
