// src/lib/parari/mvp/pageDocumentTypes.ts
// src/lib/parari/mvp/pageDocumentTypes.ts
// 2026-06-29 15:55 JST
// PART: PAGEINFO main image order
// コメント:
// - PAGEINFO内でPAGE画像を管理する
// - PAGE画像の表示順を textFirst / imageFirst で選べるようにする

export type ParariPageVisibility = "private" | "unlisted" | "public";

export type ParariPageRenderMode =
  | "page-scroll"
  | "page"
  | "book"
  | "plain";

export type ParariMainImageWidth = "full" | "wide" | "normal" | "narrow";

export type ParariMainImageOrder = "textFirst" | "imageFirst";

export type ParariPageDraft = {
  title: string;
  subtitle: string;
  author: string;
  url: string;

  visibility: ParariPageVisibility;
  publishFrom: string;
  publishUntil: string;
  timezone: string;
  renderMode: ParariPageRenderMode;

  time: string;
  place: string;
  topics: string;

  workType: "page";
  physicalPagination: boolean;
  cover: boolean;

  mainImageUrl: string;
  mainImageWidth: ParariMainImageWidth;
  mainImageOrder: ParariMainImageOrder;

  bodySsot: string;
};

export const createEmptyParariPageDraft = (): ParariPageDraft => ({
  title: "",
  subtitle: "",
  author: "",
  url: "",

  visibility: "unlisted",
  publishFrom: "",
  publishUntil: "",
  timezone: "Asia/Tokyo",
  renderMode: "page-scroll",

  time: "",
  place: "",
  topics: "",

  workType: "page",
  physicalPagination: false,
  cover: false,

  mainImageUrl: "",
  mainImageWidth: "full",
  mainImageOrder: "textFirst",

  bodySsot: "[T]\n",
});
