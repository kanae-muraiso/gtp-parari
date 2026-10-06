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
  const [billing, profileResult, overrideResult] = await Promise.all([
    getUserBillingByUserId(userId),
    supabaseAdmin
      .from("profiles")
      .select("is_monitor")
      .eq("user_id", userId)
      .maybeSingle<{ is_monitor: boolean | null }>(),
    process.env.VERCEL_ENV === "preview" &&
    process.env.SQUARE_ENVIRONMENT !== "production"
      ? supabaseAdmin
          .from("commerce_test_plan_overrides")
          .select("plan,enabled")
          .eq("user_id", userId)
          .maybeSingle<{
            plan: EffectivePlan;
            enabled: boolean;
          }>()
      : Promise.resolve({
          data: null,
          error: null,
        }),
  ]);

  if (profileResult.error) {
    throw new Error(
      `Failed to load plan access profile: ${profileResult.error.message}`,
    );
  }

  if (overrideResult.error) {
    throw new Error(
      `Failed to load commerce test plan override: ${overrideResult.error.message}`,
    );
  }

  const overridePlan =
    overrideResult.data?.enabled === true
      ? overrideResult.data.plan
      : null;

  const isMonitor =
    overridePlan
      ? false
      : profileResult.data?.is_monitor === true;
  const effectivePlan =
    overridePlan ?? getEffectivePlan(billing);

  return {
    effectivePlan,
    entitlements: getPlanEntitlements(effectivePlan, isMonitor),
    isMonitor,
  };
}
