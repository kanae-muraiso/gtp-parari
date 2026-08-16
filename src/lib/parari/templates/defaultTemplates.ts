// src/lib/parari/templates/defaultTemplates.ts
// PART: PARARI default templates
// コメント:
// - 新規作成はテンプレートを作品としてインストールする
// - MVPでは Page基本 / Book基本 / テンプレート入口 の土台を提供する

export type ParariTemplateKind = "page" | "book" | "web";

export type ParariTemplate = {
  id: string;
  kind: ParariTemplateKind;
  title: string;
  description: string;
  initialTitle: string;
  ssot: string;
};

export const defaultParariTemplates: ParariTemplate[] = [
  {
    id: "page-basic",
    kind: "page",
    title: "Page作品を作る",
    description: "1枚のPAGE作品を作ります。",
    initialTitle: "新しいPAGE",
    ssot: `[PAGE]
title: 新しいPAGE
mainImage:

[T]
本文を書いてください。
`,
  },
  {
    id: "book-basic",
    kind: "book",
    title: "Book作品を作る",
    description: "表紙・扉・目次つきのBOOK作品を作ります。",
    initialTitle: "新しいBOOK",
    ssot: `[BOOK]
title: 新しいBOOK
subtitle:
author:
coverImage:
cover: true
titlePage: true
toc: true
workType: book
renderMode: page
defaultReadingMode: paged
physicalPagination: true

[CHAPTER] はじめに
number: 1
title: はじめに
subtitle:
mainImage:
showInToc: true

[PAGE] 最初のページ
title: 最初のページ
mainImage:

[T]
本文を書いてください。
`,
  },
  
  {
    id: "web-basic",
    kind: "web",
    title: "Web作品を作る",
    description: "複数のWEBPAGEを持つホームページを作ります。",
    initialTitle: "新しいWEB",
    ssot: `[WEB]
  title: 新しいWEB
  workType: web
  visibility: unlisted
  homePageSlug: home
  headerTopLayout: one-line
  headerTagline:
  headerAuxLinks:
  headerCtaLabel:
  headerCtaHref:
  headerImageLayout: none
  headerImageUrl:
  headerImageTitleMode: page
  headerMenu: main
  brandMode: logo
  brandSize: medium
  brandAlign: center
  footer: 1

  [WEBPAGE] HOME
  pageType: top
  title: HOME
  slug: home
  isHome: true
  menuLabel: HOME
  showInMenu: true
  menuOrder: 0

  [T]
  ホームページの内容を書いてください。
  [/WEBPAGE]
  `,
  },
  
  {
    id: "blank-basic",
    kind: "page",
    title: "白紙から作る",
    description:
      "テキストパネルだけの作品から自由に組み立てます。上級者向けです。",
    initialTitle: "無題の作品",
    ssot: `[T]
  テキストパネルだけの作品です
  `,
  },
  
];

export function getDefaultParariTemplate(
  templateId: string,
): ParariTemplate | null {
  return (
    defaultParariTemplates.find((template) => template.id === templateId) ??
    null
  );
}
