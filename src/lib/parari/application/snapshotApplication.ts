// apps/tools/parari/src/lib/parari/application/snapshotApplication.ts
// 2026-06-25 JST
// PART: APPLICATION snapshot helper
// コメント:
// - 申込時点の重要事項を固定保存する
// - 募集内容が後から変更されても、応募者控えはこのsnapshotを見る

type SnapshotSource = {
  title?: unknown;
  important?: {
    datetimePlace?: unknown;
    pricePayment?: unknown;
    cancellation?: unknown;
    afterApplication?: unknown;
    safety?: unknown;
    organizerContact?: unknown;
  } | null;
};

export type ApplicationSnapshot = {
  title: string;
  datetimePlace: string;
  pricePayment: string;
  cancellation: string;
  afterApplication: string;
  safety: string | null;
  organizerContact: string | null;
  snapshotCreatedAt: string;
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

export function snapshotApplication(source: SnapshotSource): ApplicationSnapshot {
  const important = source.important ?? {};

  return {
    title: cleanText(source.title),
    datetimePlace: cleanText(important.datetimePlace),
    pricePayment: cleanText(important.pricePayment),
    cancellation: cleanText(important.cancellation),
    afterApplication: cleanText(important.afterApplication),
    safety: cleanText(important.safety) || null,
    organizerContact: cleanText(important.organizerContact) || null,
    snapshotCreatedAt: new Date().toISOString(),
  };
}
