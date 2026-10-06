import "server-only";

import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import {
  getEffectivePlan,
  getPlanEntitlements,
  type EffectivePlan,
  type PlanEntitlements,
} from "@/lib/billing/plan";
import { getUserBillingByUserId } from "@/lib/billing/supabaseBilling";

export type UserPlanAccess = {
  effectivePlan: EffectivePlan;
  entitlements: PlanEntitlements;
  isMonitor: boolean;
};

/**
 * サーバー側のプラン判定SSOT。
 * モニターは検証期間中、全機能・無制限として扱う。
 */
export async function getUserPlanAccess(
  userId: string,
): Promise<UserPlanAccess> {
  const [billing, profileResult] = await Promise.all([
    getUserBillingByUserId(userId),
    supabaseAdmin
      .from("profiles")
      .select("is_monitor")
      .eq("user_id", userId)
      .maybeSingle<{ is_monitor: boolean | null }>(),
  ]);

  if (profileResult.error) {
    throw new Error(
      `Failed to load plan access profile: ${profileResult.error.message}`,
    );
  }

  const isMonitor = profileResult.data?.is_monitor === true;
  const effectivePlan = getEffectivePlan(billing);

  return {
    effectivePlan,
    entitlements: getPlanEntitlements(effectivePlan, isMonitor),
    isMonitor,
  };
}
