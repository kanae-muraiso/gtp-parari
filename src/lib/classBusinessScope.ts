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
