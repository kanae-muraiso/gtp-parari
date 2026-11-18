import "server-only";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";

// Includes verified primary applicants from older forms as well as guardians.
export async function classGuardianEnrollmentIds(user: string, school?: string) {
  let query = db.from("school_admission_cases").select("enrollment_id")
    .eq("applicant_user_id", user).not("consent_at", "is", null)
    .not("enrollment_id", "is", null);
  if (school) query = query.eq("school_id", school);
  const { data, error } = await query;
  if (error) throw error;
  return [...new Set(data.flatMap(row => row.enrollment_id ? [row.enrollment_id as string] : []))];
}

export type ClassParticipantMember = { id: string; name: string; role: "learner" | "guardian"; startsOn: string | null };

export async function classParticipantMembers(user: string, school: string): Promise<ClassParticipantMember[]> {
  const { data, error } = await db.rpc("class_participant_members", { p_actor: user, p_school: school });
  if (error) throw error;
  return data ?? [];
}
