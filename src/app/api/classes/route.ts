import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classIdPattern, type ClassSchool } from "@/lib/classes";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const scheduleColumns = "id,name,starts_on,starts_at,cadence,location";
const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers });
const fail = (message: string, status = 400) => reply({ ok: false, message }, status);

async function currentUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const profile = await db.from("profiles").select("is_monitor").eq("user_id", data.user.id).maybeSingle();
  if (profile.error) throw profile.error;
  return { ...data.user, isMonitor: profile.data?.is_monitor === true };
}

async function ownedSchool(userId: string) {
  const { data, error } = await db.from("class_schools")
    .select(`id,name,classes:school_classes(${scheduleColumns})`)
    .eq("owner_user_id", userId).eq("tier", "a").maybeSingle();
  if (error) throw error;
  return data as ClassSchool | null;
}

async function manage(userId: string) {
  const school = await ownedSchool(userId);
  if (!school) return reply({ ok: true, userId, school, roster: [], applicationId: null, applications: [] });
  const [roster, admission, applications] = await Promise.all([
    db.from("school_enrollments").select("id,name,status,user_id").eq("school_id", school.id).order("joined_at"),
    db.from("school_admission_applications").select("application_id").eq("school_id", school.id).maybeSingle(),
    db.from("applications").select("id,title").eq("owner_user_id", userId)
      .eq("application_type", "SCHOOL").eq("origin", "manual").is("calendar_item_id", null)
      .is("archived_at", null).order("created_at", { ascending: false }),
  ]);
  for (const result of [roster, admission, applications]) if (result.error) throw result.error;
  return reply({ ok: true, userId, school, roster: roster.data, applicationId: admission.data?.application_id ?? null, applications: applications.data });
}

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser(request);
    if (!user) return fail("ログインが必要です。", 401);
    if (!user.isMonitor) return fail("教室が見つかりません。", 404);
    if (request.nextUrl.searchParams.get("home") === "1") {
      const [owned, enrolled] = await Promise.all([
        db.from("class_schools").select("id,name").eq("owner_user_id", user.id).maybeSingle(),
        db.from("school_enrollments").select("school:class_schools(id,name)")
          .eq("user_id", user.id).eq("status", "active")
          .returns<{ school: { id: string; name: string } | null }[]>(),
      ]);
      if (owned.error || enrolled.error) throw owned.error ?? enrolled.error;
      return reply({ ok: true, userId: user.id, owned: owned.data,
        enrolled: (enrolled.data ?? []).flatMap(({ school }) => school ? [school] : []) });
    }
    const id = request.nextUrl.searchParams.get("school");
    if (id === null) return await manage(user.id);
    if (!classIdPattern.test(id)) return fail("教室が見つかりません。", 404);

    const { data: school, error } = await db.rpc("read_class_school", { p_school: id, p_user: user.id });
    if (error) throw error;
    if (!school) return fail("教室が見つかりません。", 404);
    return reply({ ok: true, userId: user.id, school });
  } catch (error) {
    console.error("[classes] load failed", error);
    return fail("教室を取得できませんでした。", 500);
  }
}

const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";

async function accountByUsername(value: unknown) {
  const username = clean(value).replace(/^@/, "");
  if (!username) return null;
  if (username.length > 120) return false;
  const { data, error } = await db.from("profiles").select("user_id").eq("username", username).maybeSingle();
  if (error) throw error;
  return data?.user_id || false;
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser(request);
    if (!user) return fail("ログインが必要です。", 401);
    if (!user.isMonitor) return fail("教室が見つかりません。", 404);
    const body = await request.json().catch(() => null);
    const name = clean(body?.name);
    if (body?.action === "create" || body?.action === "schedule") {
      const schoolName = clean(body.schoolName);
      const date = clean(body.date);
      const time = clean(body.time);
      const location = clean(body.location);
      if (!name || name.length > 120 || !schoolName || schoolName.length > 120 || location.length > 200 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
          !["weekly", "monthly"].includes(body.cadence)) return fail("教室名・クラス名・初回日時・頻度を確認してください。");

      if (body.action === "create") {
        const { error } = await db.rpc("create_class_a", {
          p_owner: user.id, p_school_name: schoolName, p_class_name: name, p_starts_on: date,
          p_starts_at: time, p_cadence: body.cadence, p_location: location || null,
        });
        if (error) throw error;
      } else {
        const school = await ownedSchool(user.id);
        if (!school) return fail("教室が見つかりません。", 404);
        const { error } = await db.rpc("update_class_a_schedule", {
          p_owner: user.id, p_school: school.id, p_school_name: schoolName, p_class_name: name,
          p_starts_on: date, p_starts_at: time, p_cadence: body.cadence, p_location: location || null,
        });
        if (error) throw error;
      }
      return await manage(user.id);
    }

    const school = await ownedSchool(user.id);
    if (!school) return fail("教室が見つかりません。", 404);
    if (body?.action === "add") {
      const memberId = clean(body.memberId);
      if (!name || name.length > 120 || !classIdPattern.test(memberId)) {
        return fail("受講者の名前を確認してください。");
      }
      const account = await accountByUsername(body.username);
      if (account === false) return fail("そのユーザー名のPARARIアカウントが見つかりません。", 404);
      const { error } = await db.rpc("add_class_a_member", {
        p_owner: user.id, p_school: school.id, p_member: memberId, p_name: name, p_user: account,
      });
      if (error) throw error;
    } else if (body?.action === "member") {
      const memberId = clean(body.memberId);
      if (!classIdPattern.test(memberId) || !name || name.length > 120 || !["active", "ended"].includes(body.status)) {
        return fail("受講者情報を確認してください。");
      }
      const { data, error } = await db.from("school_enrollments").update({ name, status: body.status })
        .eq("school_id", school.id).eq("id", memberId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return fail("受講者が見つかりません。", 404);
    } else if (body?.action === "link") {
      const memberId = clean(body.memberId);
      if (!classIdPattern.test(memberId)) return fail("受講者を選んでください。");
      const account = await accountByUsername(body.username);
      if (!account) return fail("そのユーザー名のPARARIアカウントが見つかりません。", 404);
      const { data, error } = await db.from("school_enrollments").update({ user_id: account })
        .eq("school_id", school.id).eq("id", memberId).is("user_id", null).select("id").maybeSingle();
      if (error?.code === "23505") return fail("このアカウントはすでに教室の名簿にあります。", 409);
      if (error) throw error;
      if (!data) return fail("未連携の受講者が見つかりません。", 404);
    } else if (body?.action === "admission") {
      const id = body.applicationId;
      if (id !== null && (typeof id !== "string" || !classIdPattern.test(id))) return fail("入会申込を選んでください。");
      const { error } = await db.rpc("set_class_a_admission", {
        p_owner: user.id, p_school: school.id, p_application: id,
      });
      if (error) throw error;
    } else {
      return fail("操作を確認してください。");
    }
    return await manage(user.id);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "23505") return fail("CLASS Aでは教室と定期クラスを1つ開設できます。", 409);
    if (code === "P0002") return fail("指定した教室または継続クラスの受付が見つかりません。", 404);
    if (code === "22007" || code === "22008") return fail("初回日時を確認してください。");
    console.error("[classes] save failed", error);
    return fail("教室の情報を保存できませんでした。", 500);
  }
}
