import "server-only";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";

const columns = "public_id,school_id,information,kind,route,application_text,payment_mode,payment_url,arrival_text,confirmation_text,booking_weeks,office_duration,office_location,show_class_schedule,audience";

export async function readClassIntakeSource(id: string) {
  const offer = await db.from("school_recruitment_offers").select("id,school_id,name,information,class_ids,enabled,route_override,audience_override").eq("id", id).maybeSingle();
  if (offer.error) throw offer.error;
  if (offer.data && !offer.data.enabled) return null;
  const query = db.from("school_recruitment").select(columns).eq("enabled", true);
  const recruitment = await (offer.data ? query.eq("school_id", offer.data.school_id) : query.eq("public_id", id)).maybeSingle();
  if (recruitment.error) throw recruitment.error;
  let audience = offer.data?.audience_override ?? recruitment.data?.audience;
  if (recruitment.data && !audience) {
    const setting = await db.from("school_admission_settings").select("briefing_design").eq("school_id", recruitment.data.school_id).maybeSingle();
    if (setting.error) throw setting.error;
    audience = setting.data?.briefing_design?.audience === "minor" ? "minor" : "adult";
  }
  return recruitment.data ? { recruitment: { ...recruitment.data, audience, route: offer.data?.route_override ?? recruitment.data.route }, offer: offer.data ? { ...offer.data, information: offer.data.information?.trim() ? offer.data.information : recruitment.data.information } : null } : null;
}
