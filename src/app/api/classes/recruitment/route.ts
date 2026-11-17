import { readClassIntakeCalendar } from "@/lib/classIntakeCalendarServer";
import { classBusinessId } from "@/lib/classBusinessScope";
import { readSellerDisclosure, sellerDisclosureReady } from "@/lib/parari/sales/sellerDisclosure";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classIdPattern, classMeetingUrl } from "@/lib/classes";

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
const fail = (message: string, status = 400) => reply({ ok: false, message }, status);

async function handle(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return fail("ログインしてください。", 401);
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return fail("ログインしてください。", 401);
    const businessId = await classBusinessId(user.id, request.nextUrl.searchParams.get("business"));
    if (!businessId) return fail("事業を選択してください。", 404);
    const [profile, school] = await Promise.all([
      db.from("profiles").select("is_monitor").eq("user_id", user.id).maybeSingle(),
      db.from("class_schools").select("id,name").eq("id", businessId).eq("owner_user_id", user.id).maybeSingle(),
    ]);
    if (profile.error || school.error) throw profile.error ?? school.error;
    if (profile.data?.is_monitor !== true || !school.data) return fail("教室が見つかりません。", 404);
    const id = school.data.id;

    if (request.method === "GET") {
      if (request.nextUrl.searchParams.get("previewSchedule") === "1") {
        return reply({ ok: true, calendar: await readClassIntakeCalendar(id) });
      }
      const month = request.nextUrl.searchParams.get("month");
      if (month !== null) {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.startsWith("0000")) return fail("表示する月をご確認ください。");
        const first = Date.parse(month + "-01T00:00:00Z");
        const starts = Array.from({ length: 5 }, (_, index) =>
          new Date(first + index * 7 * 86400000).toISOString().slice(0, 10)).filter(start => start.startsWith(month));
        const results = await Promise.all(starts.map(start =>
          db.rpc("class_recruitment_calendar", { p_school: id, p_start: start })));
        const error = results.find(result => result.error)?.error;
        if (error) throw error;
        const events = new Map(results.flatMap(result => result.data ?? []).map(event =>
          [JSON.stringify([event.starts_at, event.ends_at, event.kind, event.label]), event]));
        return reply({ ok: true, events: [...events.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at)) });
      }
      const week = request.nextUrl.searchParams.get("week");
      if (week !== null) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || !Number.isFinite(Date.parse(week)) ||
          new Date(week).toISOString().slice(0, 10) !== week) return fail("表示する週をご確認ください。");
        const result = await db.rpc("class_recruitment_calendar", { p_school: id, p_start: week });
        if (result.error) throw result.error;
        return reply({ ok: true, events: result.data });
      }
      const [recruitment, slots, blocks, available, disclosure, offers] = await Promise.all([
        db.from("school_recruitment").select("public_id,enabled,information,kind,route,application_text,payment_mode,payment_url,arrival_text,confirmation_text,booking_weeks,office_hours,office_duration,office_location,show_class_schedule").eq("school_id", id).maybeSingle(),
        db.from("school_recruitment_slots").select("id,starts_at,capacity,closed,meeting_url,location,duration_minutes,generated").eq("school_id", id).order("starts_at", { ascending: true }),
        db.from("school_recruitment_blocks").select("id,starts_at,ends_at").eq("school_id", id).order("starts_at"),
        db.rpc("available_class_recruitment_slots", { p_school: id }),
        readSellerDisclosure(user.id),
        db.from("school_recruitment_offers").select("id,name,information,class_ids,enabled").eq("school_id", id).order("name"),
      ]);
      if (blocks.error || available.error || offers.error) throw blocks.error ?? available.error ?? offers.error;
      if (recruitment.error || slots.error) throw recruitment.error ?? slots.error;
      return reply({ ok: true, school: school.data.name, recruitment: recruitment.data, slots: slots.data, blocks: blocks.data, available: available.data, sharedDisclosure: sellerDisclosureReady(disclosure), offers: offers.data });
    }

    const input = await request.json().catch(() => null);
    if (input?.action === "offer") {
      const name = typeof input.name === "string" ? input.name.trim() : "";
      const information = typeof input.information === "string" ? input.information.trim() : "";
      const ids: string[] = Array.isArray(input.classIds) ? [...new Set<string>(input.classIds)] : [];
      if (typeof input.id !== "string" || !classIdPattern.test(input.id) || !name || name.length > 120 || information.length > 4000 ||
        !ids.length || !ids.every(value => typeof value === "string" && classIdPattern.test(value))) return fail("募集名と対象クラスを確認してください。");
      const [classes, base] = await Promise.all([
        db.from("school_classes").select("id").eq("school_id", id).in("id", ids),
        db.from("school_recruitment").select("enabled").eq("school_id", id).maybeSingle(),
      ]);
      if (classes.error || base.error) throw classes.error ?? base.error;
      if (!base.data || classes.data.length !== ids.length) return fail("教室の募集設定と対象クラスを確認してください。");
      if (input.enabled === true && (!base.data.enabled ||
        (!information && !sellerDisclosureReady(await readSellerDisclosure(user.id))))) {
        return fail("教室の受付を公開し、募集案内または公開済みの共通表記をご用意ください。");
      }
      const existing = await db.from("school_recruitment_offers").select("school_id").eq("id", input.id).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data && existing.data.school_id !== id) return fail("募集を確認してください。", 404);
      const offer = { name, information, class_ids: ids, enabled: input.enabled === true };
      const result = existing.data
        ? await db.from("school_recruitment_offers").update(offer).eq("id", input.id).eq("school_id", id)
        : await db.from("school_recruitment_offers").insert({ ...offer, id: input.id, school_id: id });
      if (result.error) throw result.error;
    } else if (input?.action === "settings") {
      const information = typeof input.information === "string" ? input.information.trim() : "";
      if (information.length > 4000 || !["説明会", "体験", "見学"].includes(input.kind)) return fail("受付の種類と、個人情報の取り扱いを含む案内を入力してください。");
      if (!information && !sellerDisclosureReady(await readSellerDisclosure(user.id))) {
        return fail("共通の販売者情報を公開するか、この募集の案内・個人情報の取り扱いを入力してください。");
      }
      const text = (key: string) => typeof input[key] === "string" ? input[key].trim() : "";
      const route = input.route ?? "briefing";
      const weeks = input.bookingWeeks ?? 4;
      if (!Number.isInteger(weeks) || weeks < 1 || weeks > 4) return fail("予約受付期間は1〜4週間です。");
      const payment = input.paymentMode ?? "free";
      const paymentUrl = payment === "advance" ? classMeetingUrl(input.paymentUrl) : null;
      if (!["briefing", "direct"].includes(route) || !["free", "advance", "onsite"].includes(payment) ||
          (payment === "advance" && !paymentUrl) || (payment === "onsite" && !text("arrivalText")) ||
          ["applicationText", "arrivalText", "confirmationText"].some(key => text(key).length > 4000)) {
        return fail("支払いURL、集合案内、申込書の設定をご確認ください。");
      }
      const result = await db.from("school_recruitment").upsert({ school_id: id, information, kind: input.kind, route, booking_weeks: weeks,
        ...(typeof input.showClassSchedule === "boolean" ? { show_class_schedule: input.showClassSchedule } : {}),
        application_text: text("applicationText"), payment_mode: payment, payment_url: paymentUrl,
        arrival_text: text("arrivalText"), confirmation_text: text("confirmationText") });
      if (result.error) throw result.error;
    } else if (input?.action === "hours") {
      const hours = input.hours;
      const duration = input.duration;
      const location = typeof input.location === "string" ? input.location.trim() : "";
      const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
      if (!Array.isArray(hours) || hours.length > 42 || !Number.isInteger(duration) || duration < 5 || duration > 480 ||
        location.length > 300 || hours.some(row => !row || !Number.isInteger(row.weekday) || row.weekday < 0 || row.weekday > 6 ||
          !["onsite", "phone"].includes(row.channel) || !time.test(row.starts) || !time.test(row.ends) || row.starts >= row.ends)) {
        return fail("受付時間と所要時間を確認してください。");
      }
      const minutes = (value: string) => Number(value.slice(0, 2))*60 + Number(value.slice(3));
      if (hours.some((row, index) => minutes(row.ends) - minutes(row.starts) < duration || hours.some((other, otherIndex) =>
        otherIndex < index && other.weekday === row.weekday && other.channel === row.channel && row.starts < other.ends && row.ends > other.starts))) {
        return fail("受付時間帯の重なりや、所要時間より短い時間帯を修正してください。");
      }
      const result = await db.from("school_recruitment").update({ office_hours: hours.map(({ weekday, channel, starts, ends }) => ({ weekday, channel, starts, ends })),
        office_duration: duration, office_location: location || null }).eq("school_id", id).select("school_id").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return fail("先に募集を保存してください。");
    } else if (input?.action === "publish" || input?.action === "unpublish") {
      const draft = await db.from("school_recruitment").select("route,information").eq("school_id", id).maybeSingle();
      if (draft.error) throw draft.error;
      if (!draft.data) return fail("先に募集設定を保存してください。");
      if (input.action === "publish" && !draft.data.information.trim() && !sellerDisclosureReady(await readSellerDisclosure(user.id))) {
        return fail("公開前に、共通の販売者情報を公開するか募集の案内を入力してください。");
      }
      if (input.action === "publish" && draft.data.route === "briefing") {
        const slots = await db.rpc("available_class_recruitment_slots", { p_school: id });
        if (slots.error) throw slots.error;
        if (!slots.data?.length) return fail("公開前に、受付中の予約枠を追加してください。");
      }
      const result = await db.from("school_recruitment").update({ enabled: input.action === "publish" })
        .eq("school_id", id).select("public_id").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return fail("先に募集設定を保存してください。");
    } else if (input?.action === "block" || input?.action === "unblock") {
      if (typeof input.id !== "string" || !classIdPattern.test(input.id)) return fail("予約不可の指定を確認してください。");
      if (input.action === "block") {
        const starts = typeof input.startsAt === "string" ? Date.parse(input.startsAt) : NaN;
        const ends = typeof input.endsAt === "string" ? Date.parse(input.endsAt) : NaN;
        if (!Number.isFinite(starts) || !Number.isFinite(ends) || ends <= starts || ends <= Date.now()) {
          return fail("予約不可の開始と終了をご確認ください。");
        }
        const result = await db.from("school_recruitment_blocks").upsert({
          school_id: id, id: input.id, starts_at: new Date(starts).toISOString(), ends_at: new Date(ends).toISOString(),
        }, { onConflict: "id", ignoreDuplicates: true });
        if (result.error) throw result.error;
      } else {
        const result = await db.from("school_recruitment_blocks").delete().eq("school_id", id).eq("id", input.id);
        if (result.error) throw result.error;
      }
    } else if (input?.action === "slot") {
      if (typeof input.id !== "string" || !classIdPattern.test(input.id) || typeof input.startsAt !== "string" ||
        !Number.isFinite(Date.parse(input.startsAt)) || Date.parse(input.startsAt) <= Date.now() ||
        !Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 100) return fail("日時と定員を確認してください。");
      if (Date.parse(input.startsAt) % 1800000 !== 0) return fail("開始時刻は毎時00分または30分を選んでください。");
      const duration = input.duration ?? 60;
      const location = typeof input.location === "string" ? input.location.trim() : "";
      if (!Number.isInteger(duration) || duration < 5 || duration > 480 || location.length > 300) return fail("会場と所要時間を確認してください。");
      const meeting = classMeetingUrl(input.meetingUrl);
      if (input.meetingUrl && !meeting) return fail("HTTPSの参加リンクを入力してください。");
      const result = await db.from("school_recruitment_slots").upsert({
        school_id: id, id: input.id, starts_at: input.startsAt, capacity: input.capacity, meeting_url: meeting, location: location || null, duration_minutes: duration,
      }, { onConflict: "id", ignoreDuplicates: true });
      if (result.error) throw result.error;
    } else if (input?.action === "close" && typeof input.id === "string" && classIdPattern.test(input.id)) {
      const result = await db.from("school_recruitment_slots").update({ closed: true }).eq("id", input.id).eq("school_id", id);
      if (result.error) throw result.error;
    } else return fail("操作を確認してください。");
    return reply({ ok: true });
  } catch {
    return fail("募集設定を処理できませんでした。", 500);
  }
}

export const GET = handle;
export const POST = handle;
