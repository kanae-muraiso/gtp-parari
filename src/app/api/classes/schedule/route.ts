import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classBusinessId, canManageClassStudio } from "@/lib/classBusinessScope";
import { classParticipantMembers } from "@/lib/classCalendarAccess";
import { classIdPattern } from "@/lib/classes";
import { calendarMonthPattern, classCalendarDays, generateClassDays, shiftCalendarMonth,
  type ClassMonthSchedule, type LearnerCalendarEntry } from "@/lib/classCalendar";

const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers });
const fail = (message: string, status = 400) => reply({ ok: false, message }, status);
const missing = () => fail("開催予定が見つかりません。", 404);
const classColumns = "id,name,starts_on,starts_at,cadence,location,product_id,schedule_rules";
const reservedDayMessage = "予約済みの開催日は外せません。対象の予約を確認してください。";
const monthColumns = "days,confirmed,revision";

async function actor(request: NextRequest, requireMonitor = false) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return !requireMonitor || await canManageClassStudio(data.user.id) ? data.user.id : null;
}

async function ownedClass(request: NextRequest, user: string, classId: string | null) {
  const scope = request.nextUrl.searchParams.get("business");
  if (!classId || !classIdPattern.test(classId) || !scope) return null;
  const school = await classBusinessId(user, scope);
  if (!school) return null;
  const { data, error } = await db.from("school_classes").select(classColumns).eq("school_id", school).eq("id", classId).maybeSingle();
  if (error) throw error;
  return data;
}

async function learnerCalendar(school: string, user: string, month: string, selected: string | null, monitor: boolean) {
  const { data: business, error: businessError } = await db.from("class_schools").select("owner_user_id")
    .eq("id", school).is("archived_at", null).maybeSingle();
  if (businessError) throw businessError;
  if (!business) return missing();
  const owner = monitor && business.owner_user_id === user;
  const allowed = await classParticipantMembers(user, school);
  if (selected && !allowed.some(member => member.id === selected)) return missing();
  const selectedIds = selected ? [selected] : allowed.map(member => member.id);
  if (!owner && !selectedIds.length) return missing();
  const [enrollments, classes] = await Promise.all([
    selectedIds.length ? db.from("school_enrollments").select("id,name,class_participation,participation_mode,assignments:school_class_assignments(class_id,self_selected)")
      .eq("school_id", school).in("id", selectedIds).eq("status", "active") : null,
    db.from("school_classes").select(classColumns).eq("school_id", school),
  ]);
  if (enrollments?.error || classes.error) throw enrollments?.error ?? classes.error;
  const members = enrollments?.data ?? [];
  const rangeStart = month + "-01";
  const rangeEnd = shiftCalendarMonth(month, 1) + "-01";
  const ids = classes.data.map(row => row.id);
  const [schedules, visits, credits, attendance] = await Promise.all([
    ids.length ? db.from("school_class_monthly_schedules").select("class_id,days,confirmed").in("class_id", ids).eq("month", rangeStart) : null,
    members.length ? db.from("school_class_visit_reservations").select("enrollment_id,class_id,visit_on,makeup_id,surcharge_yen,surcharge_paid_at")
      .eq("school_id", school).in("enrollment_id", members.map(row => row.id)).gte("visit_on", rangeStart).lt("visit_on", rangeEnd) : null,
    members.length ? db.from("school_class_makeups").select("enrollment_id,source_class_id,missed_on,used:school_class_visit_reservations(visit_on)")
      .eq("school_id", school).in("enrollment_id", members.map(row => row.id)).gte("missed_on", rangeStart).lt("missed_on", rangeEnd) : null,
    members.length ? db.from("school_attendance").select("enrollment_id,class_id,lesson_date,absence_reported")
      .eq("school_id", school).in("enrollment_id", members.map(row => row.id)).gte("lesson_date", rangeStart).lt("lesson_date", rangeEnd) : null,
  ]);
  if (attendance?.error) throw attendance.error;
  if (schedules?.error || visits?.error || credits?.error) throw schedules?.error ?? visits?.error ?? credits?.error;
  const byClass = new Map(schedules?.data.map(row => [row.class_id, row]));
  const entries: LearnerCalendarEntry[] = [];
  function add(item: typeof classes.data[number], day: string, label: string, learner?: string) {
    entries.push({ day, title: (learner ? learner + " · " : "") + item.name, time: item.starts_at.slice(0, 5), location: item.location, label });
  }
  if (owner && !members.length) {
    for (const item of classes.data) {
      const schedule = byClass.get(item.id);
      for (const day of schedule?.days ?? generateClassDays(item, month, false)) add(item, day, schedule?.confirmed ? "確定" : "予定");
    }
  }
  for (const member of members) {
    const assigned = new Set(member.assignments.map(row => row.class_id));
    const selfSelected = new Set(member.assignments.filter(row => row.self_selected).map(row => row.class_id));
    const groupAssigned = classes.data.some(item => assigned.has(item.id) && item.product_id);
    const displayName = members.length > 1 ? member.name : undefined;
    for (const item of classes.data) {
      const schedule = byClass.get(item.id);
      const fixed = selfSelected.has(item.id) || (member.class_participation !== "flexible" &&
        (assigned.has(item.id) || (member.participation_mode === "open" && !groupAssigned && !item.product_id)));
      const booked = (visits?.data ?? []).filter(row => row.enrollment_id === member.id && row.class_id === item.id);
      const byDay = new Map(booked.map(row => [row.visit_on, row]));
      const dates = new Set([...(fixed ? schedule?.days ?? generateClassDays(item, month, false) : []), ...byDay.keys()]);
      for (const day of dates) {
        const startsOn = allowed.find(item => item.id === member.id)?.startsOn;
        if (startsOn && day < startsOn) continue;
        const reservation = byDay.get(day);
        const missed = credits?.data.find(row => row.enrollment_id === member.id && row.source_class_id === item.id && row.missed_on === day);
        const label = reservation ? (reservation.surcharge_yen > 0 && !reservation.surcharge_paid_at ? "差額入金待ち"
          : reservation.makeup_id ? "振替予約" : "予約済み") : missed ? (Array.isArray(missed.used) ? missed.used.length > 0 : Boolean(missed.used)) ? "振替済み" : "欠席・振替対象" : attendance?.data.some(row => row.enrollment_id === member.id && row.class_id === item.id && row.lesson_date === day && row.absence_reported) ? "欠席連絡済み" : schedule?.confirmed ? "確定" : "予定";
        add(item, day, label, displayName);
      }
    }
  }
  entries.sort((a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time));
  return reply({ ok: true, entries });
}

export async function GET(request: NextRequest) {
  try {
    const user = await actor(request);
    if (!user) return missing();
    const query = request.nextUrl.searchParams;
    const month = query.get("month") ?? "";
    if (!calendarMonthPattern.test(month)) return fail("表示する月を選択してください。");
    const school = query.get("school");
    if (school && classIdPattern.test(school)) return await learnerCalendar(school, user, month, query.get("member"), Boolean(await actor(request, true)));
    if (!await actor(request, true)) return missing();
    const item = await ownedClass(request, user, query.get("class"));
    if (!item) return missing();
    const { data, error } = await db.from("school_class_monthly_schedules").select(monthColumns)
      .eq("class_id", item.id).eq("month", month + "-01").maybeSingle();
    if (error) throw error;
    return reply({ ok: true, schedule: data as ClassMonthSchedule | null });
  } catch (error) {
    console.error("[class calendar]", error);
    return fail("開催予定を取得できませんでした。", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await actor(request, true);
    if (!user) return missing();
    const item = await ownedClass(request, user, request.nextUrl.searchParams.get("class"));
    if (!item) return missing();
    const body = await request.json().catch(() => null);
    if (!body || typeof body.month !== "string" || !calendarMonthPattern.test(body.month)) return fail("対象月を選択してください。");
    const month = body.month + "-01";
    const table = () => db.from("school_class_monthly_schedules");
    if (body.action === "generate") {
      const months = Array.from({ length: 12 }, (_, index) => shiftCalendarMonth(body.month, index));
      if (months.some(value => !calendarMonthPattern.test(value))) return fail("対象年を確認してください。");
      const saved = await table().select("month").eq("class_id", item.id).in("month", months.map(value => value + "-01"));
      if (saved.error) throw saved.error;
      const existing = new Set(saved.data.map(row => row.month));
      const missingMonths = months.filter(value => !existing.has(value + "-01"));
      if (!missingMonths.length) return reply({ ok: true, created: 0 });
      const { data, error } = await table().upsert(missingMonths.map(value => ({
        class_id: item.id, month: value + "-01", days: generateClassDays(item, value, body.skipFifth === true),
      })), { onConflict: "class_id,month", ignoreDuplicates: true }).select("month");
      if (error?.message.includes("class_calendar_reserved_day")) return fail(reservedDayMessage, 409);
      if (error) throw error;
      return reply({ ok: true, created: data.length });
    }
    if (body.action !== "save" || !Array.isArray(body.days) || body.days.length > 31 ||
      typeof body.confirmed !== "boolean" || (body.revision !== null && !Number.isInteger(body.revision))) return fail("予定の内容を確認してください。");
    const allowed = new Set(classCalendarDays(body.month).filter(day => day >= item.starts_on));
    if (body.days.some((day: unknown) => typeof day !== "string" || !allowed.has(day))) return fail("初回日以降の対象月の日付を選んでください。");
    const days = [...new Set<string>(body.days)].sort();
    const result = body.revision === null
      ? await table().upsert({ class_id: item.id, month, days, confirmed: body.confirmed }, { onConflict: "class_id,month", ignoreDuplicates: true }).select(monthColumns).maybeSingle()
      : await table().update({ days, confirmed: body.confirmed, revision: body.revision + 1 })
        .eq("class_id", item.id).eq("month", month).eq("revision", body.revision).select(monthColumns).maybeSingle();
    if (result.error?.message.includes("class_calendar_reserved_day")) return fail(reservedDayMessage, 409);
    if (result.error) throw result.error;
    if (!result.data) return fail("他の画面で予定が変更されました。再読み込みしてください。", 409);
    return reply({ ok: true, schedule: result.data });
  } catch (error) {
    console.error("[class calendar]", error);
    return fail("開催予定を保存できませんでした。", 500);
  }
}
