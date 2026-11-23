import "server-only";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classIdPattern } from "@/lib/classes";

export async function classBusinessId(userId: string, value: string | null) {
  if (value !== null && !classIdPattern.test(value)) return null;
  const query = db.from("class_schools").select("id").eq("owner_user_id", userId).eq("tier", "a").is("archived_at", null);
  const result = value ? await query.eq("id", value).maybeSingle() : await query.order("id").limit(2);
  if (result.error) throw result.error;
  if (Array.isArray(result.data)) return result.data.length === 1 ? result.data[0].id : null;
  return result.data?.id ?? null;
}

/**
 * Access to free CLASS A follows the existing STUDIO experience, not paid billing.
 * Legacy creators whose work activated STUDIO before explicit preferences are supported.
 * Pausing STUDIO blocks new teacher-side management.
 */
export async function canManageClassStudio(userId: string, isMonitor = false): Promise<boolean> {
  if (isMonitor) return true;
  const pref = await db.from("user_workspace_preferences")
    .select("studio_enabled,studio_paused").eq("user_id", userId).maybeSingle();
  if (pref.error) throw pref.error;
  if (pref.data?.studio_paused) return false;
  if (pref.data?.studio_enabled) return true;
  const [works, forms, apps, membership, calendars] = await Promise.all([
    db.from("parari_books").select("id").eq("owner",userId)
      .or("is_deleted.is.null,is_deleted.eq.false").limit(1),
    db.from("forms").select("id").eq("owner_user_id",userId).limit(1),
    db.from("applications").select("id").eq("owner_user_id",userId).limit(1),
    db.from("memberships").select("id").eq("owner_user_id",userId).limit(1),
    db.from("calendar_items").select("id").eq("owner_user_id",userId).neq("kind","personal").limit(1),
  ]);
  for (const result of [works,forms,apps,membership,calendars]) if (result.error) throw result.error;
  return [works,forms,apps,membership,calendars].some(result=>Boolean(result.data?.length));
}
