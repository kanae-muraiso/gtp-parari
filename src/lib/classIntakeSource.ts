import "server-only";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";

const columns = "public_id,school_id,information,kind,route,application_text,payment_mode,payment_url,arrival_text,confirmation_text,booking_weeks,office_duration,office_location,show_class_schedule";

export async function readClassIntakeSource(id: string) {
  const offer = await db.from("school_recruitment_offers").select("id,school_id,name,information,class_ids,enabled").eq("id", id).maybeSingle();
  if (offer.error) throw offer.error;
  if (offer.data && !offer.data.enabled) return null;
  const query = db.from("school_recruitment").select(columns).eq("enabled", true);
  const recruitment = await (offer.data ? query.eq("school_id", offer.data.school_id) : query.eq("public_id", id)).maybeSingle();
  if (recruitment.error) throw recruitment.error;
  return recruitment.data ? { recruitment: recruitment.data, offer: offer.data } : null;
}
