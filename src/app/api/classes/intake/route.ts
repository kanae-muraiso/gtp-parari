import { readClassIntakeCalendar } from "@/lib/classIntakeCalendarServer";
import { classIntakeTarget } from "@/lib/classIntakeTargets";
import { readSellerDisclosure, sellerDisclosureReady } from "@/lib/parari/sales/sellerDisclosure";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { readClassIntakeSource } from "@/lib/classIntakeSource";
import { classIdPattern, classMeetingUrl } from "@/lib/classes";
import { classAdmissionMail, classDateTime, classNotice } from "@/lib/classAdmissionMail";

import { parseBriefingDesign, renderBriefingMail, validClassEmail } from "@/lib/classBriefingWorkflow";

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
    const showGeneralSchedule = !offer && request.method === "GET" && options.show_class_schedule === true;
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
        id: string; name: string; design?: { monthlyFee?: number; monthlyVisits?: number; booking?: string; walkInFee?: number | null };
      } | null;
      if (product?.design?.walkInFee != null) {
        walkInSchedules.set(product.id, { id: product.id, name: product.name });
      } else {
        targetClasses.push(classIntakeTarget(item, product ? { name: product.name, ...product.design } : null, calendar));
      }
    }
    const offerFields = offer ? { offerName: offer.name, targetClasses, walkInSchedules: [...walkInSchedules.values()] } :
      showGeneralSchedule ? { classSchedules: targetClasses, walkInSchedules: [...walkInSchedules.values()] } : {};
    function submitOffer(input: Record<string, unknown>, name: string, applicant: string, email: string, slot: string | null, phone: string | null) {
      return db.rpc("submit_school_offer", { p_public: options.public_id, p_offer: offer!.id, p_class: input.classId,
        p_slot: slot, p_name: name, p_applicant: applicant, p_email: email, p_information: input.information,
        p_terms: input.terms ?? "", p_phone: phone });
    }
    const versionMatches = (version: unknown) => version === (shared?.version ?? undefined);
    if (request.method === "POST" && options.route === "direct") {
      const input = await request.json().catch(() => null);
      if (!versionMatches(input?.disclosureVersion)) return fail("案内が更新されました。再読み込みして内容をご確認ください。", 409);
      const name = clean(input?.name), applicant = clean(input?.applicant), email = clean(input?.email).toLowerCase();
      if (!name || name.length > 120 || !applicant || applicant.length > 120 || email.length > 254 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || input?.agree !== true ||
          typeof input.information !== "string" || input.information.length > 4000 ||
          typeof input.terms !== "string" || input.terms.length > 8000) return fail("申込内容と同意を確認してください。");
      if (offer && !targetClasses.some(item => item.id === input.classId)) return fail("対象クラスを選んでください。");
      const result = offer ? await submitOffer(input, name, applicant, email, null, null) : await db.rpc("submit_direct_class_application", {
        p_public: options.public_id, p_name: name, p_applicant: applicant, p_email: email, p_information: input.information, p_terms: input.terms,
      });
      const { error } = result;
      const caseId = offer ? result.data?.[0]?.case_id : result.data;
      if (error?.code === "P0002") return missing();
      if (error?.code === "22023") return fail("申込内容が変更されました。再読み込みしてください。", 409);
      if (error) throw error;
      const paymentUrl = options.payment_mode === "advance" ? classMeetingUrl(options.payment_url) : null;
      const confirmation = await classAdmissionMail(email, school.data.name + "の申込確認",
        [options.confirmation_text || "お申し込みを受け付けました。", options.payment_mode === "onsite" ? options.arrival_text : "",
          paymentUrl ? "支払いページ " + paymentUrl : ""].filter(Boolean).join("\n\n"), `class-application-${caseId}`);
      return reply({ ok: true, direct: true, confirmation, paymentUrl,
        arrival: options.payment_mode === "onsite" ? options.arrival_text : null });
    }
    if (options.route === "direct") {
      const setting = await db.from("school_admission_settings").select("terms").eq("school_id", schoolId).maybeSingle();
      if (setting.error) throw setting.error;
      return reply({ ok: true, school: school.data.name, information, kind, ...offerFields, slots: [], direct: true, sharedDisclosure: shared,
        applicationText: options.application_text, terms: setting.data?.terms ?? "" });
    }
    const settings = await db.from("school_admission_settings").select("briefing_design").eq("school_id", schoolId).maybeSingle();
    if (settings.error) throw settings.error;
    const design = parseBriefingDesign(settings.data?.briefing_design);
    const minor = design?.audience === "minor";
    if (request.method === "POST") {
      const input = await request.json().catch(() => null);
      if (!versionMatches(input?.disclosureVersion)) return fail("案内が更新されました。再読み込みして内容をご確認ください。", 409);
      const name = clean(input?.name), applicant = clean(input?.applicant), email = clean(input?.email).toLowerCase();
      if (!name || name.length > 120 || !applicant || applicant.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !classIdPattern.test(clean(input?.slot)) || input?.agree !== true || typeof input?.information !== "string" || input.information.length > 4000) return fail("お名前・メール・日時・同意をご確認ください。");
      const learnerEmail = minor ? clean(input?.learnerEmail).toLowerCase() : "";
      if (learnerEmail && !validClassEmail(learnerEmail)) return fail("受講者のメールアドレスをご確認ください。");
      const phone = clean(input?.phone);
      if (phone && !/^[+0-9()\s-]{7,30}$/.test(phone)) return fail("電話番号をご確認ください。");
      if (offer && !targetClasses.some(item => item.id === input.classId)) return fail("対象クラスを選んでください。");
      const { data, error } = offer ? await submitOffer(input, name, applicant, email, input.slot, phone || null)
        : await db.rpc("book_school_intake", { p_public: options.public_id, p_slot: input.slot, p_name: name,
        p_applicant: applicant, p_email: email, p_agreement: input.information, p_phone: phone || null });
      if (error?.code === "P0002") return missing();
      if (error?.code === "P0001" || error?.code === "22023") return fail("満席、受付期間外、または受付内容が変更されました。再読み込みしてください。", 409);
      if (error) throw error;
      const booking = data[0];
      if (learnerEmail) {
        const update = await db.from("school_admission_cases").update({ learner_email: learnerEmail })
          .eq("school_id", schoolId).eq("id", booking.case_id).eq("applicant_email", email).is("learner_email", null).is("consent_at", null);
        if (update.error) throw update.error;
      }
      const contact = await db.from("school_admission_cases").select("learner_email").eq("school_id", schoolId).eq("id", booking.case_id).single();
      if (contact.error) throw contact.error;
      const recipients = [email, minor ? contact.data.learner_email : null];
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
      const confirmation = design ? await classNotice(recipients, confirmationMail.subject, withDetails(confirmationMail.body), `class-booking-${booking.case_id}`)
        : await classAdmissionMail(email, confirmationMail.subject, text, `class-booking-${booking.case_id}`);
      const remind = Date.parse(booking.starts_at) - 86400000;
      const reminder = remind > Date.now() && remind < Date.now() + 29 * 86400000
        ? design
          ? await classNotice(recipients, reminderMail.subject, withDetails(reminderMail.body), `class-reminder-${booking.case_id}`, new Date(remind).toISOString())
          : await classAdmissionMail(email, reminderMail.subject, text, `class-reminder-${booking.case_id}`, new Date(remind).toISOString())
        : null;
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
    return reply({ ok: true, school: school.data.name, information, kind, ...offerFields, sharedDisclosure: shared, audience: design?.audience, bookingWeeks: options.booking_weeks,
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
