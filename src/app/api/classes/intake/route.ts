import { readClassIntakeCalendar } from "@/lib/classIntakeCalendarServer";
import { classIntakeTarget } from "@/lib/classIntakeTargets";
import { readSellerDisclosure, sellerDisclosureReady } from "@/lib/parari/sales/sellerDisclosure";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { readClassIntakeSource } from "@/lib/classIntakeSource";
import { classIdPattern, classMeetingUrl } from "@/lib/classes";
import { classDateTime, classNotice } from "@/lib/classAdmissionMail";

import { classRegistrationMail } from "@/lib/classRegistrationMail";

import { parseBriefingDesign, parseIntakeProfile, renderBriefingMail } from "@/lib/classBriefingWorkflow";

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (message: string, status = 400) => reply({ ok: false, message }, status);
const missing = () => fail("この募集は現在受け付けていません。", 404);
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";

async function handle(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id || !classIdPattern.test(id)) return missing();
    const source = await readClassIntakeSource(id);
    if (!source) return missing();
    const { recruitment, offer } = source;
    const { school_id: schoolId, kind } = recruitment;
    const information = offer?.information ?? recruitment.information;
    const school = await db.from("class_schools").select("name,owner_user_id").eq("id", schoolId).is("archived_at", null).maybeSingle();
    if (school.error) throw school.error;
    if (!school.data) return missing();
    const owner = await db.from("profiles").select("is_monitor").eq("user_id", school.data.owner_user_id).maybeSingle();
    if (owner.error) throw owner.error;
    if (owner.data?.is_monitor !== true) return missing();
    const disclosure = await readSellerDisclosure(school.data.owner_user_id);
    const shared = disclosure && sellerDisclosureReady(disclosure)
      ? { url: "/seller-info?classIntakeId=" + encodeURIComponent(id), version: disclosure.updated_at } : null;
    if (!information.trim() && !shared) return missing();
    const options = recruitment;
    const showGeneralSchedule = !offer;
    const query = db.from("school_classes")
      .select("id,name,starts_on,starts_at,cadence,location,delivery,schedule_rules,fee_override_yen,product:school_class_products(id,name,design)")
      .eq("school_id", schoolId).order("name");
    const [targets, calendar] = await Promise.all([
      offer ? query.in("id", offer.class_ids) : showGeneralSchedule ? query.not("product_id", "is", null) : null,
      request.method === "GET" && (offer || showGeneralSchedule) ? readClassIntakeCalendar(schoolId) : undefined,
    ]);
    if (targets?.error) throw targets.error;
    if (offer && !targets?.data?.length) return missing();
    const targetClasses = [];
    const walkInSchedules = new Map<string, { id: string; name: string }>();
    for (const item of targets?.data ?? []) {
      const product = (Array.isArray(item.product) ? item.product[0] : item.product) as {
        id: string; name: string; design?: { audience?: "adult" | "minor"; monthlyFee?: number; monthlyVisits?: number; booking?: string; walkInFee?: number | null };
      } | null;
      if (product?.design?.walkInFee != null) {
        walkInSchedules.set(product.id, { id: product.id, name: product.name });
      } else {
        targetClasses.push(classIntakeTarget(item, product ? { name: product.name, ...product.design } : null, calendar));
      }
    }
    const offerFields = offer ? { offerName: offer.name, targetClasses, walkInSchedules: [...walkInSchedules.values()] } :
      showGeneralSchedule && targetClasses.length ? { targetClasses, walkInSchedules: [...walkInSchedules.values()] } : {};
    function submitProfile(input: Record<string, unknown>, profile: NonNullable<ReturnType<typeof parseIntakeProfile>>, slot: string | null) {
      return db.rpc("submit_school_intake_profile", { p_public: options.public_id, p_offer: offer?.id ?? null,
        p_class: targetClasses.length ? input.classId : null, p_slot: slot, p_audience: profile.audience,
        p_fields: profile.fields, p_information: input.information, p_terms: input.terms ?? "" });
    }
    const audienceFor = (input: Record<string, unknown>) => targetClasses.find(item => item.id === input.classId)?.audience ?? options.audience;
    const versionMatches = (version: unknown) => version === (shared?.version ?? undefined);
    if (request.method === "POST" && options.route === "direct") {
      const input = await request.json().catch(() => null);
      if (!versionMatches(input?.disclosureVersion)) return fail("案内が更新されました。再読み込みして内容をご確認ください。", 409);
      const profile = input && parseIntakeProfile({ ...input, audience: audienceFor(input) });
      if (!profile || input.agree !== true || typeof input.information !== "string" || input.information.length > 4000 ||
          typeof input.terms !== "string" || input.terms.length > 8000) return fail("必須の連絡先と同意を確認してください。");
      if ((offer || targetClasses.length) && !targetClasses.some(item => item.id === input.classId)) return fail("対象クラスを選んでください。");
      const result = await submitProfile(input, profile, null);
      const { error } = result;
      const caseId = result.data?.[0]?.case_id;
      if (error?.code === "P0002") return missing();
      if (error?.code === "22023") return fail("申込内容が変更されました。再読み込みしてください。", 409);
      if (error) throw error;
      const paymentUrl = options.payment_mode === "advance" ? classMeetingUrl(options.payment_url) : null;
      const confirmation = await classRegistrationMail(schoolId, caseId, request.nextUrl.origin, school.data.name + "の申込確認",
        [options.confirmation_text || "お申し込みを受け付けました。", options.payment_mode === "onsite" ? options.arrival_text : "",
          paymentUrl ? "支払いページ " + paymentUrl : ""].filter(Boolean).join("\n\n"), `class-application-${caseId}`);
      return reply({ ok: true, direct: true, confirmation, paymentUrl,
        arrival: options.payment_mode === "onsite" ? options.arrival_text : null });
    }
    if (options.route === "direct") {
      const setting = await db.from("school_admission_settings").select("terms").eq("school_id", schoolId).maybeSingle();
      if (setting.error) throw setting.error;
      return reply({ ok: true, school: school.data.name, information, kind, ...offerFields, slots: [], direct: true, audience: options.audience, sharedDisclosure: shared,
        applicationText: options.application_text, terms: setting.data?.terms ?? "" });
    }
    const settings = await db.from("school_admission_settings").select("briefing_design").eq("school_id", schoolId).maybeSingle();
    if (settings.error) throw settings.error;
    const design = parseBriefingDesign(settings.data?.briefing_design);
    if (request.method === "POST") {
      const input = await request.json().catch(() => null);
      if (!versionMatches(input?.disclosureVersion)) return fail("案内が更新されました。再読み込みして内容をご確認ください。", 409);
      const profile = input && parseIntakeProfile({ ...input, audience: audienceFor(input) });
      if (!profile || !classIdPattern.test(clean(input.slot)) || input.agree !== true ||
          typeof input.information !== "string" || input.information.length > 4000) return fail("必須の連絡先・日時・同意をご確認ください。");
      if ((offer || targetClasses.length) && !targetClasses.some(item => item.id === input.classId)) return fail("対象クラスを選んでください。");
      const { data, error } = await submitProfile(input, profile, input.slot);
      if (error?.code === "P0002") return missing();
      if (error?.code === "P0001" || error?.code === "22023") return fail("満席、受付期間外、または受付内容が変更されました。再読み込みしてください。", 409);
      if (error) throw error;
      const booking = data[0];
      const recipients = profile.recipients;
      const slot = await db.from("school_recruitment_slots").select("meeting_url,location,duration_minutes,channel").eq("id", input.slot).maybeSingle();
      const meeting = classMeetingUrl(slot.data?.meeting_url);
      const text = `${booking.school_name}の${booking.kind}の日時は、${classDateTime(booking.starts_at)}（日本時間）です。` + [
        slot.data?.channel === "phone" ? "予約日時に、教室からお電話します。" : "",
        slot.data?.location ? "集合場所 " + slot.data.location : "",
        slot.data?.duration_minutes ? "所要時間 " + slot.data.duration_minutes + "分" : "",
        meeting ? "オンライン参加リンク " + meeting : "", options.confirmation_text,
      ].filter(Boolean).map(line => "\n" + line).join("");
      const mailValues = { school: school.data.name, when: classDateTime(booking.starts_at), where: slot.data?.location ?? "" };
      const confirmationMail = renderBriefingMail(design, "briefing", { subject: booking.kind + "の予約確認", body: "" }, mailValues);
      const reminderMail = renderBriefingMail(design, "reminder", { subject: booking.kind + "の前日のお知らせ", body: "" }, mailValues);
      const withDetails = (body: string) => [body, text].filter(Boolean).join("\n\n");
      const confirmation = await classRegistrationMail(schoolId, booking.case_id, request.nextUrl.origin, confirmationMail.subject, withDetails(confirmationMail.body), `class-booking-${booking.case_id}`);
      const remind = Date.parse(booking.starts_at) - 86400000;
      const reminder = remind > Date.now() && remind < Date.now() + 29 * 86400000
        ? await classNotice(recipients, reminderMail.subject, withDetails(reminderMail.body), `class-reminder-${booking.case_id}`, new Date(remind).toISOString()) : null;
      return reply({ ok: true, confirmation, reminder });
    }
    const now = Date.now();
    const [slots, manual] = await Promise.all([
      db.rpc("available_class_recruitment_slots", { p_school: schoolId }),
      db.from("school_recruitment_slots").select("id,duration_minutes,location").eq("school_id", schoolId)
        .eq("generated", false).eq("closed", false).gte("starts_at", new Date(now).toISOString())
        .lte("starts_at", new Date(now + (options.booking_weeks * 7 + 1) * 86400000).toISOString()),
    ]);
    if (slots.error) throw slots.error;
    if (manual.error) throw manual.error;
    const details = new Map(manual.data.map(slot => [slot.id, slot]));
    return reply({ ok: true, school: school.data.name, information, kind, ...offerFields, sharedDisclosure: shared, audience: options.audience, bookingWeeks: options.booking_weeks,
      slots: (slots.data as { id: string; starts_at: string; channel: "onsite" | "phone" }[]).map(slot => {
        const saved = details.get(slot.id);
        return { ...slot, duration_minutes: saved?.duration_minutes ?? options.office_duration,
          location: saved ? saved.location : slot.channel === "onsite" ? options.office_location : null };
      }),
    });
  } catch {
    return fail("受付を処理できませんでした。", 500);
  }
}

export const GET = handle;
export const POST = handle;
