// src/lib/billing/plan.ts
// 2026-07-11 JST
//
// PARARIのFree / Plus / Pro判定と利用上限を一元管理する。
// 制限値は画面表示とサーバー側制限処理の両方から利用する。

export type BillingPlan = "free" | "plus" | "pro";

export type BillingStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | string
  | null
  | undefined;

export type EffectivePlan = BillingPlan;

export type BillingLike = {
  plan?: BillingPlan | string | null;
  billing_status?: BillingStatus;
};

export type PlanLimits = {
  /** 作成できる作品数 */
  workLimit: number | null;

  /** 公開状態にできる作品数 */
  publishedWorkLimit: number | null;

  /** 1作品に作成できるページ数 */
  pageLimitPerWork: number | null;

  /** 作成できるAPPLICATION数 */
  applicationPanelLimit: number | null;

  /** 1つのAPPLICATIONで受付できる参加者数 */
  applicationParticipantLimit: number | null;

  profileCollectionLimit: number | null;
  linkTreeLimit: number | null;
  canUseLinkTreeBackgroundImage: boolean;
};

/**
 * PARARI上で有料プランとして扱うStripeステータス。
 */
export function isBillableActiveStatus(
  status: BillingStatus,
): boolean {
  return status === "active" || status === "trialing";
}

/**
 * DB上のplanとbilling_statusから、実際に適用するプランを返す。
 * Plus / Proでも有効な契約状態でなければFreeとして扱う。
 */
export function getEffectivePlan(
  billing: BillingLike | null | undefined,
): EffectivePlan {
  const plan = billing?.plan ?? "free";
  const status = billing?.billing_status ?? "none";

  if (plan === "plus" && isBillableActiveStatus(status)) {
    return "plus";
  }

  if (plan === "pro" && isBillableActiveStatus(status)) {
    return "pro";
  }

  return "free";
}

export function getPlanLabel(plan: EffectivePlan): string {
  switch (plan) {
    case "plus":
      return "Plus";
    case "pro":
      return "Pro";
    case "free":
    default:
      return "Free";
  }
}

/**
 * 2026-07-11確定仕様
 *
 * Free
 * - 作品作成：10
 * - 公開作品：3
 * - 1作品：10ページ
 *
 * Plus
 * - 作品作成：100
 * - 公開作品：100
 * - 1作品：100ページ
 */
export const PLAN_LIMITS: Record<EffectivePlan, PlanLimits> = {
  free: {
    workLimit: 10,
    publishedWorkLimit: 3,
    pageLimitPerWork: 10,
    applicationPanelLimit: 1,
    applicationParticipantLimit: 10,
    profileCollectionLimit: 3,
    linkTreeLimit: 3,
    canUseLinkTreeBackgroundImage: false,
  },

  plus: {
    workLimit: 100,
    publishedWorkLimit: 100,
    pageLimitPerWork: 100,
    applicationPanelLimit: null,
    applicationParticipantLimit: 30,
    profileCollectionLimit: null,
    linkTreeLimit: null,
    canUseLinkTreeBackgroundImage: true,
  },

  // Proは現時点では申込を提供しない。
  pro: {
    workLimit: null,
    publishedWorkLimit: null,
    pageLimitPerWork: null,
    applicationPanelLimit: null,
    applicationParticipantLimit: null,
    profileCollectionLimit: null,
    linkTreeLimit: null,
    canUseLinkTreeBackgroundImage: true,
  },
};

export function getPlanLimits(plan: EffectivePlan): PlanLimits {
  return PLAN_LIMITS[plan];
}

/**
 * nullは無制限。
 * 現在数が上限以上なら、新規追加不可。
 */
export function isAtOrOverLimit(
  currentCount: number,
  limit: number | null,
): boolean {
  if (limit === null) return false;
  return currentCount >= limit;
}
