import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classParticipantMembers } from "@/lib/classCalendarAccess";
import { classIdPattern } from "@/lib/classes";
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
async function handle(request: NextRequest, write: boolean) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    const session = token ? await db.auth.getUser(token) : null;
    const user = session?.data.user;
    if (!user || session?.error) return reply({ ok: false, message: "ログインしてください。" }, 401);
    const school = request.nextUrl.searchParams.get("school");
    if (!school || !classIdPattern.test(school)) return reply({ ok: false, message: "教室を確認してください。" }, 404);
    const members = await classParticipantMembers(user.id, school);
    const memberId = request.nextUrl.searchParams.get("member");
    let member = memberId ? members.find(item => item.id === memberId) : members[0];
    if (write) {
      const input = await request.json().catch(() => null);
      if (!member || !classIdPattern.test(input?.classId ?? "") || typeof input?.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.day) ||
        !Number.isFinite(Date.parse(input.day)) || new Date(input.day).toISOString().slice(0, 10) !== input.day || typeof input.absent !== "boolean" ||
        (member.startsOn && input.day < member.startsOn)) return reply({ ok: false, message: "受講者と開催日を確認してください。" }, 400);
      const result = await db.rpc("report_class_member_absence", { p_actor: user.id, p_school: school, p_member: member.id, p_class: input.classId, p_day: input.day, p_absent: input.absent });
      if (result.error) return reply({ ok: false, message: "欠席連絡を更新できません。開催日をご確認ください。振替予約済みの場合は教室にご連絡ください。" }, 409);
      return reply({ ok: true });
    }
    let owner = false;
    if (!memberId) {
      const [business, profile] = await Promise.all([
        db.from("class_schools").select("id").eq("id", school).eq("owner_user_id", user.id).is("archived_at", null).maybeSingle(),
        db.from("profiles").select("is_monitor").eq("user_id", user.id).maybeSingle(),
      ]);
      if (business.error || profile.error) throw business.error ?? profile.error;
      owner = Boolean(business.data && profile.data?.is_monitor);
      if (owner) member = undefined;
    }
    if (!member && !owner) return reply({ ok: false, message: "教室が見つかりません。" }, 404);
    let query = db.from("school_attendance").select("enrollment_id,class_id,lesson_date,absence_reported,actual").eq("school_id", school);
    if (member) query = query.eq("enrollment_id", member.id);
    const [reports, enrollment, roster] = await Promise.all([
      query.order("lesson_date", { ascending: false }).limit(200),
      member ? db.from("school_enrollments").select("class_participation,assignments:school_class_assignments(class_id,self_selected)").eq("id", member.id).eq("school_id", school).single() : null,
      owner ? db.from("school_enrollments").select("id,name").eq("school_id", school) : null,
    ]);
    if (reports.error || enrollment?.error || roster?.error) throw reports.error ?? enrollment?.error ?? roster?.error;
    return reply({ ok: true, owner, reports: reports.data, roster: roster?.data ?? [],
      reportableClassIds: enrollment?.data.assignments.filter(item => item.self_selected || enrollment.data.class_participation !== "flexible").map(item => item.class_id) ?? [] });
  } catch { return reply({ ok: false, message: "欠席連絡を確認できませんでした。" }, 500); }
}
export const GET = (request: NextRequest) => handle(request, false);
export const POST = (request: NextRequest) => handle(request, true);
