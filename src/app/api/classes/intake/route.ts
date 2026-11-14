import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classIdPattern } from "@/lib/classes";
import { classAdmissionMail, classDateTime } from "@/lib/classAdmissionMail";

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (message: string, status = 400) => reply({ ok: false, message }, status);
const missing = () => fail("この募集は現在受け付けていません。", 404);
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";

async function handle(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id || !classIdPattern.test(id)) return missing();
    if (request.method === "POST") {
      const input = await request.json().catch(() => null);
      const name = clean(input?.name), applicant = clean(input?.applicant), email = clean(input?.email).toLowerCase();
      if (!name || name.length > 120 || !applicant || applicant.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !classIdPattern.test(clean(input?.slot)) || input?.agree !== true || typeof input?.information !== "string" || input.information.length > 4000) return fail("お名前・メール・日時・同意をご確認ください。");
      const { data, error } = await db.rpc("book_school_intake", { p_public: id, p_slot: input.slot, p_name: name,
        p_applicant: applicant, p_email: email, p_agreement: input.information });
      if (error?.code === "P0002") return missing();
      if (error?.code === "P0001" || error?.code === "22023") return fail("満席か、受付内容が変更されました。再読み込みしてください。", 409);
      if (error) throw error;
      const booking = data[0];
      const text = `${booking.school_name}の${booking.kind}の日時は、${classDateTime(booking.starts_at)}（日本時間）です。`;
      const confirmation = await classAdmissionMail(email, `${booking.kind}の予約確認`, text, `class-booking-${booking.case_id}`);
      const remind = Date.parse(booking.starts_at) - 86400000;
      const reminder = remind > Date.now() && remind < Date.now() + 29 * 86400000
        ? await classAdmissionMail(email, `${booking.kind}の前日のお知らせ`, text, `class-reminder-${booking.case_id}`, new Date(remind).toISOString())
        : null;
      return reply({ ok: true, confirmation, reminder });
    }
    const recruitment = await db.from("school_recruitment").select("school_id,information,kind").eq("public_id", id).eq("enabled", true).maybeSingle();
    if (recruitment.error) throw recruitment.error;
    if (!recruitment.data) return missing();
    const { school_id: schoolId, information, kind } = recruitment.data;
    const school = await db.from("class_schools").select("name,owner_user_id").eq("id", schoolId).maybeSingle();
    if (school.error) throw school.error;
    if (!school.data) return missing();
    const owner = await db.from("profiles").select("is_monitor").eq("user_id", school.data.owner_user_id).maybeSingle();
    if (owner.error) throw owner.error;
    if (owner.data?.is_monitor !== true) return missing();
    const slots = await db.from("school_recruitment_slots").select("id,starts_at").eq("school_id", schoolId).eq("closed", false).gt("starts_at", new Date().toISOString()).order("starts_at");
    if (slots.error) throw slots.error;
    return reply({ ok: true, school: school.data.name, information, kind, slots: slots.data });
  } catch {
    return fail("受付を処理できませんでした。", 500);
  }
}

export const GET = handle;
export const POST = handle;
