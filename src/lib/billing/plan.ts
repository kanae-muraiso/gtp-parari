// src/lib/billing/plan.ts
// PARARIの5段階プランと権限のSSOT。
// 画面表示とサーバー側制限は、必ずこの定義を参照する。

export type BillingPlan =
  | "free"
  | "plus"
  | "organizer"
  | "host"
  | "pro";

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

export type ApplicationMode = "lite" | "builder";

export type PlanEntitlements = {
  monthlyPriceUsd: 0 | 3 | 10 | 30 | 100;

  /** nullは無制限 */
  workLimit: number | null;
  publishedWorkLimit: number | null;
  pageLimitPerWork: number | null;
  webWorkLimit: number | null;
  applicationPanelLimit: number | null;
  applicationParticipantLimit: number | null;
  profileCollectionLimit: number | null;
  linkTreeLimit: number | null;
  imageStorageLimitBytes: number | null;

  applicationMode: ApplicationMode;
  canUseLinkTreeBackgroundImage: boolean;
  canUseIntegratedSales: boolean;
  canExportEpub: boolean;
  canCollaborate: boolean;
  canManageForms: boolean;
  canManageCalendar: boolean;
  canManageMembership: boolean;
  canUseGateway: boolean;
};

/** 後方互換。既存コードのlimits参照も同じSSOTへ集約する。 */
export type PlanLimits = PlanEntitlements;

const MEBIBYTE = 1024 * 1024;
const GIBIBYTE = 1024 * MEBIBYTE;

/**
 * 画面表示とStorage RLSで共通利用する、合意済みのプラン境界。
 * 画像容量はバイト単位で保持し、画面ではMB/GBへ整形して表示する。
 */
export const PLAN_ENTITLEMENTS: Record<EffectivePlan, PlanEntitlements> = {
  free: {
    monthlyPriceUsd: 0,
    workLimit: 10,
    publishedWorkLimit: 3,
    pageLimitPerWork: 10,
    webWorkLimit: 1,
    applicationPanelLimit: 1,
    applicationParticipantLimit: 10,
    profileCollectionLimit: 3,
    linkTreeLimit: 3,
    imageStorageLimitBytes: 100 * MEBIBYTE,
    applicationMode: "lite",
    canUseLinkTreeBackgroundImage: false,
    canUseIntegratedSales: false,
    canExportEpub: false,
    canCollaborate: false,
    canManageForms: false,
    canManageCalendar: false,
    canManageMembership: false,
    canUseGateway: false,
  },

  plus: {
    monthlyPriceUsd: 3,
    workLimit: 100,
    publishedWorkLimit: 100,
    pageLimitPerWork: 100,
    webWorkLimit: 3,
    applicationPanelLimit: 1,
    applicationParticipantLimit: 10,
    profileCollectionLimit: null,
    linkTreeLimit: null,
    imageStorageLimitBytes: 1 * GIBIBYTE,
    applicationMode: "lite",
    canUseLinkTreeBackgroundImage: true,
    canUseIntegratedSales: true,
    canExportEpub: true,
    canCollaborate: true,
    canManageForms: false,
    canManageCalendar: false,
    canManageMembership: false,
    canUseGateway: false,
  },

  organizer: {
    monthlyPriceUsd: 10,
    workLimit: 100,
    publishedWorkLimit: 100,
    pageLimitPerWork: 100,
    webWorkLimit: 3,
    applicationPanelLimit: null,
    applicationParticipantLimit: 30,
    profileCollectionLimit: null,
    linkTreeLimit: null,
    imageStorageLimitBytes: 5 * GIBIBYTE,
    applicationMode: "builder",
    canUseLinkTreeBackgroundImage: true,
    canUseIntegratedSales: true,
    canExportEpub: true,
    canCollaborate: true,
    canManageForms: true,
    canManageCalendar: true,
    canManageMembership: false,
    canUseGateway: false,
  },

  host: {
    monthlyPriceUsd: 30,
    workLimit: 100,
    publishedWorkLimit: 100,
    pageLimitPerWork: 100,
    webWorkLimit: 3,
    applicationPanelLimit: null,
    applicationParticipantLimit: null,
    profileCollectionLimit: null,
    linkTreeLimit: null,
    imageStorageLimitBytes: 20 * GIBIBYTE,
    applicationMode: "builder",
    canUseLinkTreeBackgroundImage: true,
    canUseIntegratedSales: true,
    canExportEpub: true,
    canCollaborate: true,
    canManageForms: true,
    canManageCalendar: true,
    canManageMembership: true,
    canUseGateway: true,
  },

  pro: {
    monthlyPriceUsd: 100,
    workLimit: null,
    publishedWorkLimit: null,
    pageLimitPerWork: null,
    webWorkLimit: null,
    applicationPanelLimit: null,
    applicationParticipantLimit: null,
    profileCollectionLimit: null,
    linkTreeLimit: null,
    imageStorageLimitBytes: 50 * GIBIBYTE,
    applicationMode: "builder",
    canUseLinkTreeBackgroundImage: true,
    canUseIntegratedSales: true,
    canExportEpub: true,
    canCollaborate: true,
    canManageForms: true,
    canManageCalendar: true,
    canManageMembership: true,
    canUseGateway: true,
  },
};

/** モニターは検証用途のため、全機能を使え、画像容量も制限しない。 */
const MONITOR_ENTITLEMENTS: PlanEntitlements = {
  ...PLAN_ENTITLEMENTS.pro,
  imageStorageLimitBytes: null,
};

export const PLAN_LIMITS = PLAN_ENTITLEMENTS;

export function isBillableActiveStatus(status: BillingStatus): boolean {
  return status === "active" || status === "trialing";
}

export function isBillingPlan(value: unknown): value is BillingPlan {
  return (
    value === "free" ||
    value === "plus" ||
    value === "organizer" ||
    value === "host" ||
    value === "pro"
  );
}

/** 有料プランでも契約が有効でなければFREEとして扱う。 */
export function getEffectivePlan(
  billing: BillingLike | null | undefined,
): EffectivePlan {
  const plan = billing?.plan ?? "free";

  if (plan === "free") return "free";

  if (isBillingPlan(plan) && isBillableActiveStatus(billing?.billing_status)) {
    return plan;
  }

  return "free";
}

export function getPlanLabel(plan: EffectivePlan): string {
  switch (plan) {
    case "plus":
      return "Plus";
    case "organizer":
      return "Organizer";
    case "host":
      return "Host";
    case "pro":
      return "Pro";
    case "free":
    default:
      return "Free";
  }
}

export function getPlanEntitlements(
  plan: EffectivePlan,
  isMonitor = false,
): PlanEntitlements {
  return isMonitor ? MONITOR_ENTITLEMENTS : PLAN_ENTITLEMENTS[plan];
}

export function getPlanLimits(plan: EffectivePlan): PlanLimits {
  return getPlanEntitlements(plan);
}

/** nullは無制限。現在数が上限以上なら新規追加不可。 */
export function isAtOrOverLimit(
  currentCount: number,
  limit: number | null,
): boolean {
  if (limit === null) return false;
  return currentCount >= limit;
}
