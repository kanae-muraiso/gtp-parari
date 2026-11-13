// Writer package maker — design-time catalogue, independent of billing entitlements.
// Never use this browser-editable configuration as authorization for APIs or sales.
export type WriterTier = "A" | "B" | "C";
export type WriterSurface = "editor" | "works" | "reader" | "sales" | "studio";
export type WriterKind = "panel" | "feature" | "connection";
export type WriterImplementation = "ready" | "partial" | "planned";

export type WriterPart = {
  id: string;
  label: string;
  description: string;
  kind: WriterKind;
  implementation: WriterImplementation;
  surfaces: readonly WriterSurface[];
  required?: boolean;
};

export type WriterPackage = {
  name: string;
  concept: string;
  parts: string[];
  placements: Record<string, WriterSurface[]>;
};

export type WriterPackageDraft = {
  version: 1;
  packages: Record<WriterTier, WriterPackage>;
};

export const WRITER_TIERS: WriterTier[] = ["A", "B", "C"];
export const WRITER_SURFACES: Record<WriterSurface, string> = {
  editor: "作品編集・追加メニュー",
  works: "作品リスト・詳細",
  reader: "読者向け表示",
  sales: "公開・販売設定",
  studio: "STUDIOメニュー",
};
export const WRITER_KINDS: Record<WriterKind, string> = {
  panel: "作品パネル",
  feature: "作品・運営機能",
  connection: "外部接続",
};
export const WRITER_IMPLEMENTATION: Record<WriterImplementation, string> = {
  ready: "実装あり",
  partial: "一部実装",
  planned: "将来候補",
};

export const WRITER_PARTS: WriterPart[] = [
  { id: "TEXT", label: "文章", description: "リッチテキスト入力・文章の編集", kind: "panel", implementation: "ready", surfaces: ["editor", "reader"], required: true },
  { id: "IMAGE", label: "画像", description: "画像とキャプション", kind: "panel", implementation: "ready", surfaces: ["editor", "reader"] },
  { id: "LIST", label: "リスト", description: "箇条書きや手順", kind: "panel", implementation: "ready", surfaces: ["editor", "reader"] },
  { id: "TABLE", label: "表", description: "表組み", kind: "panel", implementation: "ready", surfaces: ["editor", "reader"] },
  { id: "NOTICE", label: "お知らせ", description: "見出し付きの案内・強調枠", kind: "panel", implementation: "ready", surfaces: ["editor", "reader"] },
  { id: "ACCORDION", label: "開閉", description: "折りたたみ表示", kind: "panel", implementation: "ready", surfaces: ["editor", "reader"] },
  { id: "BUTTON", label: "ボタン", description: "申込や外部リンクへの誘導", kind: "panel", implementation: "ready", surfaces: ["editor", "reader"] },
  { id: "LINKS", label: "リンク集", description: "複数のリンクをまとめて配置", kind: "panel", implementation: "ready", surfaces: ["editor", "reader"] },
  { id: "YOUTUBE", label: "YouTube", description: "YouTube動画の埋め込み", kind: "panel", implementation: "ready", surfaces: ["editor", "reader"] },
  { id: "INSTAGRAM", label: "Instagram", description: "Instagram投稿の埋め込み", kind: "panel", implementation: "ready", surfaces: ["editor", "reader"] },
  { id: "AUDIO", label: "音声", description: "音声URLを再生", kind: "panel", implementation: "ready", surfaces: ["editor", "reader"] },
  { id: "QA", label: "小テスト", description: "選択・記述問題と答え合わせ", kind: "panel", implementation: "ready", surfaces: ["editor", "reader"] },
  { id: "CAROUSEL", label: "カルーセル", description: "カードを横並びに表示", kind: "panel", implementation: "ready", surfaces: ["editor", "reader"] },
  { id: "MARKDOWN", label: "コード挿入", description: "Markdown・HTML。現行は設定ONで表示", kind: "panel", implementation: "ready", surfaces: ["editor"] },
  { id: "BOOK", label: "BOOK・章・節", description: "作品の構造・章立て", kind: "feature", implementation: "ready", surfaces: ["editor"], required: true },
  { id: "WORKS", label: "作品リスト", description: "作品を作成・整理・管理", kind: "feature", implementation: "ready", surfaces: ["works", "studio"], required: true },
  { id: "PUBLISH", label: "公開・URL共有", description: "非公開・限定公開・公開と表示URL", kind: "feature", implementation: "ready", surfaces: ["works", "reader"], required: true },
  { id: "READER", label: "閲覧環境", description: "文字サイズ・書体・語注など", kind: "feature", implementation: "ready", surfaces: ["reader"] },
  { id: "LIBRARY", label: "書棚・作者とのつながり", description: "作品の保存・ファン登録", kind: "feature", implementation: "ready", surfaces: ["reader"] },
  { id: "EPUB", label: "EPUB3出力", description: "Kindle等に向けた電子書籍出力", kind: "feature", implementation: "partial", surfaces: ["works"] },
  { id: "COLLABORATION", label: "共同編集", description: "共同編集者の管理", kind: "feature", implementation: "partial", surfaces: ["works"] },
  { id: "SALES", label: "作品販売", description: "有料作品の設定と購入導線", kind: "feature", implementation: "ready", surfaces: ["works", "sales"] },
  { id: "APPLICATION", label: "簡易申込", description: "作品内に申込窓口を設置", kind: "feature", implementation: "ready", surfaces: ["editor", "reader"] },
  { id: "FORM", label: "自由フォーム", description: "複雑な回答フォーム", kind: "feature", implementation: "partial", surfaces: ["editor", "reader"] },
  { id: "CALENDAR", label: "日程・予約", description: "開催予定と申込を扱う", kind: "feature", implementation: "partial", surfaces: ["editor", "reader", "studio"] },
  { id: "MEMBERSHIP", label: "会員管理", description: "会員制コンテンツと募集", kind: "feature", implementation: "partial", surfaces: ["editor", "reader", "studio"] },
  { id: "SQUARE", label: "Square決済連携", description: "販売者のSquareアカウント接続", kind: "connection", implementation: "ready", surfaces: ["sales"] },
  { id: "EXTERNAL", label: "外部URLリンク", description: "Webサイトへのリンク。BUTTONやLINKSで利用", kind: "connection", implementation: "ready", surfaces: ["editor", "reader"] },
  { id: "LINE", label: "LINEへの共有・通知", description: "外部LINEへの通知連携は今後の検討対象", kind: "connection", implementation: "planned", surfaces: ["studio"] },
];

const DEFAULT_PARTS: Record<WriterTier, string[]> = {
  A: ["TEXT", "IMAGE", "LIST", "TABLE", "NOTICE", "ACCORDION", "BUTTON", "LINKS", "YOUTUBE", "INSTAGRAM", "AUDIO", "BOOK", "WORKS", "PUBLISH", "READER", "LIBRARY", "APPLICATION", "EXTERNAL"],
  B: ["TEXT", "IMAGE", "LIST", "TABLE", "NOTICE", "ACCORDION", "BUTTON", "LINKS", "YOUTUBE", "INSTAGRAM", "AUDIO", "BOOK", "WORKS", "PUBLISH", "READER", "LIBRARY", "APPLICATION", "EXTERNAL", "QA", "EPUB", "COLLABORATION", "SALES", "SQUARE"],
  C: WRITER_PARTS.filter((part) => part.implementation !== "planned").map((part) => part.id),
};

export function createDefaultWriterDraft(): WriterPackageDraft {
  const meta: Record<WriterTier, [string, string]> = {
    A: ["WRITERS A", "気軽に書いて、作品を公開する"],
    B: ["WRITERS B", "出版と販売まで進める"],
    C: ["WRITERS C", "より高度な制作・運営を行う（検討用）"],
  };
  const packages = {} as Record<WriterTier, WriterPackage>;
  for (const tier of WRITER_TIERS) {
    const parts = DEFAULT_PARTS[tier];
    packages[tier] = {
      name: meta[tier][0],
      concept: meta[tier][1],
      parts: [...parts],
      placements: Object.fromEntries(WRITER_PARTS.filter((part) => parts.includes(part.id)).map((part) => [part.id, [...part.surfaces]])),
    };
  }
  return { version: 1, packages };
}

// An imported file is untrusted. Keep only known parts/surfaces and required items.
// This normalizes the draft for UI use; it does NOT grant runtime entitlements.
export function normalizeWriterDraft(value: unknown): WriterPackageDraft {
  const defaults = createDefaultWriterDraft();
  if (!value || typeof value !== "object") return defaults;
  const source = value as { version?: unknown; packages?: unknown };
  if (source.version !== 1 || !source.packages || typeof source.packages !== "object") return defaults;
  const rawPackages = source.packages as Record<string, unknown>;
  for (const tier of WRITER_TIERS) {
    const raw = rawPackages[tier];
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Partial<WriterPackage>;
    const known = Array.isArray(candidate.parts) ? candidate.parts.filter((id): id is string => typeof id === "string" && WRITER_PARTS.some((part) => part.id === id)) : defaults.packages[tier].parts;
    const selected = Array.from(new Set([...known, ...WRITER_PARTS.filter((part) => part.required).map((part) => part.id)]));
    const placements: Record<string, WriterSurface[]> = {};
    for (const id of selected) {
      const definition = WRITER_PARTS.find((part) => part.id === id)!;
      const rawSurfaces = candidate.placements && typeof candidate.placements === "object" ? candidate.placements[id] : null;
      const allowed = Array.isArray(rawSurfaces) ? rawSurfaces.filter((surface): surface is WriterSurface => definition.surfaces.some((allowedSurface) => allowedSurface === surface)) : [...definition.surfaces];
      placements[id] = Array.from(new Set(allowed));
    }
    defaults.packages[tier] = {
      name: typeof candidate.name === "string" ? candidate.name.slice(0, 80) : defaults.packages[tier].name,
      concept: typeof candidate.concept === "string" ? candidate.concept.slice(0, 240) : defaults.packages[tier].concept,
      parts: selected,
      placements,
    };
  }
  return defaults;
}
