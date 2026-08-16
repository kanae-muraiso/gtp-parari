// src/lib/parariExpiry.ts
// 2026-03-26 JST

/**
 * PART: expiry helpers
 * コメント:
 * - PARARI v0.3 の期限判定共通関数
 * - expires_at が null のときは無期限
 * - expired は DB 保存せず、この関数で毎回判定する
 * - まずは最小実装として「期限切れかどうか」だけを安全に扱う
 */

export type ParariExpiryState = "no-expiry" | "active" | "expired";

/**
 * PART: parseExpiryDate
 * コメント:
 * - 文字列 / Date / null を安全に Date | null に変換
 * - 不正な日付は null 扱い
 */
export function parseExpiryDate(
  value: string | Date | null | undefined,
): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * PART: isExpired
 * コメント:
 * - expiresAt が過去または現在なら true
 * - now はテストや将来の拡張のため引数で差し替え可能
 */
export function isExpired(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  const expiryDate = parseExpiryDate(expiresAt);
  if (!expiryDate) return false;

  return expiryDate.getTime() <= now.getTime();
}

/**
 * PART: getExpiryState
 * コメント:
 * - 無期限 / 有効 / 期限切れ の3状態を返す
 * - UI や一覧制御で使いやすくするための補助関数
 */
export function getExpiryState(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date(),
): ParariExpiryState {
  const expiryDate = parseExpiryDate(expiresAt);
  if (!expiryDate) return "no-expiry";

  return expiryDate.getTime() <= now.getTime() ? "expired" : "active";
}

/**
 * PART: isActiveForCount
 * コメント:
 * - 作品数カウント対象かどうか
 * - v0.3 では「期限切れでないもの」をカウント対象とする
 */
export function isActiveForCount(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return !isExpired(expiresAt, now);
}

/**
 * PART: sortByExpiryForList
 * コメント:
 * - 一覧表示用の最小ソート補助
 * - active / no-expiry を先、expired を後ろに送る
 * - 同じグループ内の細かい並びは既存ロジックを優先できるよう、
 *   この関数は「期限切れかどうか」の差だけを返す
 */
export function sortByExpiryForList<T extends { expires_at?: string | null }>(
  a: T,
  b: T,
  now: Date = new Date(),
): number {
  const aExpired = isExpired(a.expires_at ?? null, now);
  const bExpired = isExpired(b.expires_at ?? null, now);

  if (aExpired === bExpired) return 0;
  if (aExpired) return 1;
  return -1;
}
