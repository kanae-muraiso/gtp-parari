// apps/tools/parari/src/lib/i18n.ts
// 2026-02-28 23:50 JST

export type Locale = "ja" | "en" | "zh" | "ko";

type Dict = Record<string, string>;

const JA: Dict = {
  save: "保存",
  publish: "公開",
  new: "新規",
  open: "開く",
  refresh: "更新",
  share: "共有",
  copy: "コピー",
  prev: "前へ",
  next: "次へ",
  toc: "目次",
  noPage: "[PAGE] がまだありません。",
  publicYes: "公開",
  publicNo: "非公開",
};

const EN: Dict = {
  save: "Save",
  publish: "Publish",
  new: "New",
  open: "Open",
  refresh: "Refresh",
  share: "Share",
  copy: "Copy",
  prev: "Prev",
  next: "Next",
  toc: "Contents",
  noPage: "No [PAGE] found.",
  publicYes: "PUBLIC",
  publicNo: "PRIVATE",
};

const ZH: Dict = {
  save: "保存",
  publish: "发布",
  new: "新建",
  open: "打开",
  refresh: "刷新",
  share: "分享",
  copy: "复制",
  prev: "上一页",
  next: "下一页",
  toc: "目录",
  noPage: "尚未找到 [PAGE]",
  publicYes: "公开",
  publicNo: "私密",
};

const KO: Dict = {
  save: "저장",
  publish: "게시",
  new: "새로 만들기",
  open: "열기",
  refresh: "새로고침",
  share: "공유",
  copy: "복사",
  prev: "이전",
  next: "다음",
  toc: "목차",
  noPage: "[PAGE]가 아직 없습니다.",
  publicYes: "공개",
  publicNo: "비공개",
};

const DICTS: Record<Locale, Dict> = {
  ja: JA,
  en: EN,
  zh: ZH,
  ko: KO,
};

export function t(locale: Locale, key: string) {
  return DICTS[locale]?.[key] ?? DICTS["en"][key] ?? key;
}
