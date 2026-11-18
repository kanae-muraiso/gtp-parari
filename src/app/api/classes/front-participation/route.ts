import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classCalendarToday } from "@/lib/classCalendar";
import { classParticipantMembers } from "@/lib/classCalendarAccess";
import { classIdPattern } from "@/lib/classes";

const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers });
const fail = (message: string, status = 400) => reply({ ok: false, message }, status);

async function authorize(request: NextRequest) {
  const school = request.nextUrl.searchParams.get("school");
  if (!school || !classIdPattern.test(school)) return fail("事業を確認してください。");
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return fail("ログインしてください。", 401);
  const session = await db.auth.getUser(token);
  if (session.error || !session.data.user) return fail("ログインしてください。", 401);
  return { school, user: session.data.user.id };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorize(request);
    if (auth instanceof Response) return auth;
    const { school, user } = auth;
    const members = await classParticipantMembers(user, school);
    const requested = request.nextUrl.searchParams.get("member");
    const selected = requested ? members.find(item => item.id === requested) : members[0];
    if (requested && !selected) return fail("受講者を確認してください。", 404);
    if (!selected) return reply({ ok: true, userId: user, enrolled: false, members: [], memberId: null, fixed: [], visits: [] });
    const result = await db.from("school_enrollments").select("id,class_participation,assignments:school_class_assignments(class_id,self_selected)")
      .eq("school_id", school).eq("id", selected.id).eq("status", "active").single();
    if (result.error) throw result.error;
    const member = result.data;
    const visits = await db.from("school_class_visit_reservations").select("class_id,visit_on,surcharge_yen,surcharge_paid_at,makeup_id")
      .eq("school_id", school).eq("enrollment_id", member.id).gte("visit_on", classCalendarToday());
    if (visits.error) throw visits.error;
    const fixed = member.assignments.filter(item => item.self_selected || member.class_participation !== "flexible").map(item => item.class_id);
    return reply({ ok: true, userId: user, enrolled: true, members, memberId: selected.id, startsOn: selected.startsOn, fixed, visits: visits.data });
  } catch {
    return fail("参加状況を確認できませんでした。", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize(request);
    if (auth instanceof Response) return auth;
    const { school, user } = auth;
    const input = await request.json().catch(() => null);
    const id = input?.classId;
    if (typeof id !== "string" || !classIdPattern.test(id) || !["fixed", "reserve", "cancel"].includes(input.action)) return fail("クラスを確認してください。");
    const day = input.action === "fixed" ? null : input.day;
    if (day !== null && (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day)) return fail("日付を確認してください。");
    if (input.action !== "fixed" && !day) return fail("日付を確認してください。");
    const members = await classParticipantMembers(user, school);
    const requested = request.nextUrl.searchParams.get("member");
    const selected = requested ? members.find(item => item.id === requested) : members[0];
    if (!selected || (day && selected.startsOn && day < selected.startsOn)) return fail("受講者と参加開始日を確認してください。", 404);
    const { error } = await db.rpc("choose_class_member_from_front", {
      p_actor: user, p_member: selected.id, p_school: school, p_class: id, p_day: day, p_cancel: input.action === "cancel",
    });
    if (error?.code === "P0001") return fail("満席か、今月の予約回数の上限に達しています。", 409);
    if (error?.code === "P0002") return fail("入会状態とクラスの公開状態を確認してください。", 404);
    if (error?.code === "P0004") return fail("このクラスはすでに通う枠が登録されています。", 409);
    if (error?.code === "P0005") return fail("同じ時間帯に予約済みのクラスがあります。", 409);
    if (error?.code === "22023") return fail("予約条件を確認してください。入金済みの予約の取消は教室にご連絡ください。", 409);
    if (error) throw error;
    return reply({ ok: true });
  } catch {
    return fail("予約・登録を更新できませんでした。", 500);
  }
}
