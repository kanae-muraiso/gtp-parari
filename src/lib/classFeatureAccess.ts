import "server-only";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";

/**
 * CLASS B must NOT be inferred from WRITERS or APPLICATION billing.
 * Until a verified CLASS B checkout/webhook exists, no end user is granted B.
 * Existing monitor owners may exercise the feature for verification only.
 */
export async function classFeatureAccess(schoolId: string, userId: string) {
  const [school, profile, entitlement] = await Promise.all([
    db.from("class_schools").select("id,owner_user_id").eq("id",schoolId).is("archived_at",null).maybeSingle(),
    db.from("profiles").select("is_monitor").eq("user_id",userId).maybeSingle(),
    db.from("class_feature_plans").select("plan,active_until").eq("school_id",schoolId).maybeSingle(),
  ]);
  if (school.error||profile.error||entitlement.error) throw school.error??profile.error??entitlement.error;
  if (!school.data || school.data.owner_user_id !== userId) return { canManage: false, canCreateEvents: false, plan: "a" as const };
  const active = entitlement.data?.plan === "b" &&
    (!entitlement.data.active_until || Date.parse(entitlement.data.active_until)>Date.now());
  return { canManage: true, canCreateEvents: Boolean(profile.data?.is_monitor || active), plan: (active?"b":"a") as "a"|"b" };
}
