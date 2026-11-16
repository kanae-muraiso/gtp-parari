import "server-only";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import type { ClassEventSettings } from "./classEvents";

export async function activeEventSchool(schoolId: string) {
  const { data, error } = await db.from("class_schools").select("id,name,owner_user_id")
    .eq("id", schoolId).is("archived_at", null).maybeSingle();
  if (error) throw error;
  return data;
}

export async function isClassEventMember(schoolId: string, classIds: string[], userId: string | null) {
  if (!userId) return false;
  const { data, error } = await db.rpc("class_event_member", { p_school: schoolId, p_classes: classIds, p_user: userId });
  if (error) throw error;
  return data === true;
}

export async function canRegisterForClassEvent(
  schoolId: string, event: ClassEventSettings, userId: string | null,
) {
  return event.registration && Date.parse(event.deadline) > Date.now()
    && Boolean(await activeEventSchool(schoolId))
    && (event.audience !== "members" || await isClassEventMember(schoolId, event.classIds, userId));
}
