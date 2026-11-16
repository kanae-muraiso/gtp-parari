import { parseClassProduct, type NamedClassProduct } from "@/lib/classProduct";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classMeetingUrl, classIdPattern, type ClassSchool, type SchoolClass } from "@/lib/classes";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const scheduleColumns = "id,product_id,name,starts_on,starts_at,cadence,location,delivery,meeting_url,duration_minutes";
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
  const [roster, admission, applications, products] = await Promise.all([
    db.from("school_enrollments").select("id,name,status,user_id,class_participation,assignments:school_class_assignments(class_id)").eq("school_id", school.id).order("joined_at"),
    db.from("school_admission_applications").select("application_id").eq("school_id", school.id).maybeSingle(),
    db.from("applications").select("id,title").eq("owner_user_id", userId)
      .eq("application_type", "SCHOOL").eq("origin", "manual").is("calendar_item_id", null)
      .is("archived_at", null).order("created_at", { ascending: false }),
    db.from("school_class_products").select("id,name").eq("school_id", school.id).order("name"),
  ]);
  for (const result of [roster, admission, applications, products]) if (result.error) throw result.error;
  const names = new Map(products.data.map(item => [item.id, item.name]));
  school.classes = school.classes.map(item => ({ ...item, productName: names.get(item.product_id) }));
  return reply({ ok: true, userId, school, products: products.data, roster: roster.data, applicationId: admission.data?.application_id ?? null, applications: applications.data });
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
    if (request.nextUrl.searchParams.get("product") === "1") {
      const school = await ownedSchool(user.id);
      if (!school) return fail("教室が見つかりません。", 404);
      const result = await db.from("school_class_product_designs").select("design").eq("school_id", school.id).maybeSingle();
      if (result.error) {
        console.error("[classes] product load failed", result.error.code);
        return fail("商品設定を取得できませんでした。", 500);
      }
      const products = await db.from("school_class_products").select("id,name,design").eq("school_id", school.id).order("name");
      if (products.error) throw products.error;
      return reply({ ok: true, design: result.data?.design ?? null, products: products.data.map(product => ({
        ...product, design: { ...product.design, classIds: school.classes.filter(item => item.product_id === product.id).map(item => item.id) },
      })) });
    }
    const id = request.nextUrl.searchParams.get("school");
    if (id === null) return await manage(user.id);
    if (!classIdPattern.test(id)) return fail("教室が見つかりません。", 404);

    const { data: school, error } = await db.rpc("read_class_school", { p_school: id, p_user: user.id });
    if (error) throw error;
    if (!school) return fail("教室が見つかりません。", 404);
    const visible = school as ClassSchool;
    const [member, products] = await Promise.all([
      db.from("school_enrollments").select("id,class_participation").eq("school_id", id)
        .eq("user_id", user.id).eq("status", "active").maybeSingle(),
      db.from("school_class_products").select("id,name,design").eq("school_id", id),
    ]);
    if (member.error || products.error) throw member.error ?? products.error;
    const groups = new Map((products.data as NamedClassProduct[]).map(product => [product.id, product]));
    visible.classes = visible.classes.map(item => ({ ...item, productName: groups.get(item.product_id ?? "")?.name }));
    let visits = null;
    if (member.data) {
      const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
      const [legacy, booked, credits] = await Promise.all([
        db.from("school_class_product_designs").select("design").eq("school_id", id).maybeSingle(),
        db.from("school_class_visit_reservations").select("class_id,visit_on,makeup_id").eq("enrollment_id", member.data.id).gte("visit_on", today),
        db.from("school_class_makeups").select("id,source_class_id,expires_on,missed_on,used:school_class_visit_reservations(visit_on)").eq("enrollment_id", member.data.id).gte("expires_on", today),
      ]);
      if (legacy.error || booked.error || credits.error) throw legacy.error ?? booked.error ?? credits.error;
      const makeups = credits.data.filter(credit => Array.isArray(credit.used) ? !credit.used.length : !credit.used)
        .map(({ used, ...credit }) => credit);
      const productIds = [...new Set(visible.classes.map(item => item.product_id).filter(Boolean))];
      const makeupSlots = (credits.data.length || booked.data.some(visit => visit.makeup_id)) && productIds.length
        ? await db.from("school_classes").select(scheduleColumns).eq("school_id", id).in("product_id", productIds) : null;
      if (makeupSlots?.error) throw makeupSlots.error;
      const makeupClasses = ((makeupSlots?.data ?? []) as SchoolClass[]).filter(item => !visible.classes.some(assigned => assigned.id === item.id))
        .map(item => ({ ...item, productName: groups.get(item.product_id ?? "")?.name,
          meeting_url: booked.data.some(visit => visit.class_id === item.id && visit.makeup_id) ? item.meeting_url : null }));
      const flexible = member.data.class_participation === "flexible";
      const allowances = Object.fromEntries(visible.classes.flatMap(item => {
        const plan = item.product_id ? groups.get(item.product_id)?.design : legacy.data?.design;
        return plan && (item.product_id || plan.classIds?.includes(item.id)) ? [[item.id, plan.monthlyVisits]] : [];
      }));
      if (flexible) visible.classes = visible.classes.map(item =>
        booked.data.some(visit => visit.class_id === item.id) ? item : { ...item, meeting_url: null });
      visits = { flexible, classIds: Object.keys(allowances), monthlyVisits: Object.values(allowances)[0] ?? 0,
        allowances, booked: booked.data, makeups, makeupClasses };
    }
    return reply({ ok: true, userId: user.id, school: visible, visits });
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
    const body = await request.json().catch(() => null);
    if (body?.action === "visit") {
      if (![body.schoolId, body.classId].every(value => typeof value === "string" && classIdPattern.test(value)) ||
        typeof body.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.day) ||
        !Number.isFinite(Date.parse(body.day)) || new Date(body.day).toISOString().slice(0, 10) !== body.day) return fail("参加日を確認してください。");
      const args = { p_user: user.id, p_school: body.schoolId, p_class: body.classId, p_day: body.day };
      if (body.makeupId && (typeof body.makeupId !== "string" || !classIdPattern.test(body.makeupId))) return fail("振替を確認してください。");
      const { error } = body.makeupId && body.cancel !== true
        ? await db.rpc("reserve_school_class_makeup", { ...args, p_makeup: body.makeupId })
        : await db.rpc("manage_class_visit", { ...args, p_cancel: body.cancel === true });
      if (error?.code === "P0001") return fail("定員または月の受講回数の上限に達しています。", 409);
      if (error?.code === "22023" || error?.code === "P0002") return fail("この開催回は操作できません。", 409);
      if (error) throw error;
      return reply({ ok: true });
    }
    if (!user.isMonitor) return fail("教室が見つかりません。", 404);
    const name = clean(body?.name);
    if (body?.action === "create" || body?.action === "schedule") {
      const schoolName = clean(body.schoolName);
      const date = clean(body.date);
      const time = clean(body.time);
      const location = clean(body.location);
      if (!name || name.length > 120 || !schoolName || schoolName.length > 120 || location.length > 200 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
          !["weekly", "monthly"].includes(body.cadence)) return fail("教室名・クラス名・初回日時・頻度を確認してください。");

      const duration = body.duration === undefined ? 60 : Number(body.duration);
      if (!Number.isInteger(duration) || duration < 5 || duration > 480) return fail("授業の所要時間を確認してください。");
      const delivery = body.delivery ?? "onsite";
      const meeting = delivery === "onsite" ? null : classMeetingUrl(body.meetingUrl);
      if (!["onsite", "online", "hybrid"].includes(delivery) ||
          (delivery !== "onsite" && !meeting) || (delivery === "hybrid" && !location)) {
        return fail("開催方法に応じた会場とHTTPS参加リンクを入力してください。");
      }
      const school = await ownedSchool(user.id);
      const classId = clean(body.classId);
      if (!classIdPattern.test(classId) || (body.action === "schedule" && !school?.classes.some(item => item.id === classId))) {
        return fail("クラスを確認してください。");
      }
      const { error } = await db.rpc("save_school_content_slot", {
        p_owner: user.id, p_school: school?.id ?? null, p_class: classId, p_new: body.action === "create",
        p_school_name: schoolName, p_class_name: name, p_starts_on: date, p_starts_at: time, p_cadence: body.cadence,
        p_location: delivery === "online" ? null : location || null, p_delivery: delivery, p_meeting_url: meeting, p_duration: duration, p_product: body.productId || null,
      });
      if (error) throw error;
      return await manage(user.id);
    }

    const school = await ownedSchool(user.id);
    if (!school) return fail("教室が見つかりません。", 404);
    if (body?.action === "saveContentProduct") {
      const id = clean(body.productId);
      const design = parseClassProduct(body.design, new Set(school.classes.filter(item => !item.product_id || item.product_id === id).map(item => item.id)), true);
      if (!classIdPattern.test(id) || !name || name.length > 120 || !design) return fail("商品名・開催枠・受講条件を確認してください。");
      const { error } = await db.rpc("save_school_content_product", { p_owner: user.id, p_school: school.id,
        p_product: id, p_name: name, p_design: design, p_classes: design.classIds });
      if (error?.code === "22023") return fail("同じ受講者が通う開催枠は、まとめて同じ商品に入れてください。在籍・予約がある開催枠を外す場合は先に整理してください。", 409);
      if (error) throw error;
      return reply({ ok: true, design });
    }
    if (body?.action === "grantMakeup") {
      const member = clean(body.memberId), target = clean(body.classId), day = clean(body.day);
      if (![member, target].every(value => classIdPattern.test(value)) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return fail("欠席した開催枠と日付を確認してください。");
      const { error } = await db.rpc("grant_school_class_makeup", { p_owner: user.id, p_school: school.id, p_member: member, p_class: target, p_day: day });
      if (error?.code === "22023" || error?.code === "P0002") return fail("固定の開催枠で、振替期限内の欠席日を指定してください。");
      if (error) throw error;
    } else if (body?.action === "saveProduct") {
      const design = parseClassProduct(body.design, new Set(school.classes.map(item => item.id)));
      if (!design) return fail("対象クラス・定員・受講回数・料金を確認してください。");
      const { error } = await db.from("school_class_product_designs").upsert({ school_id: school.id, design });
      if (error) throw error;
      return reply({ ok: true, design });
    }
    if (body?.action === "add") {
      const memberId = clean(body.memberId);
      if (!name || name.length > 120 || !classIdPattern.test(memberId)) {
        return fail("受講者の名前を確認してください。");
      }
      const account = await accountByUsername(body.username);
      if (account === false) return fail("そのユーザー名のPARARIアカウントが見つかりません。", 404);
      const args = { p_owner: user.id, p_school: school.id, p_member: memberId, p_name: name, p_user: account };
      const classId = clean(body.classId);
      if (classId && !school.classes.some(item => item.id === classId)) return fail("開催枠を確認してください。");
      const { error } = classId ? await db.rpc("add_school_slot_member", { ...args, p_class: classId }) : await db.rpc("add_class_a_member", args);
      if (error?.code === "22023") return fail("すでに別の商品に所属しています。名簿で参加先を確認してください。", 409);
      if (error) throw error;
    } else if (body?.action === "participation") {
      const memberId = clean(body.memberId);
      const ids = Array.isArray(body.classIds) ? [...new Set(body.classIds)] : [];
      if (!classIdPattern.test(memberId) || !ids.length || !ids.every(id => school.classes.some(item => item.id === id)) ||
        !["fixed", "multiple", "flexible"].includes(body.mode) || (body.mode === "fixed" && ids.length !== 1)) {
        return fail("参加方法と対象クラスを確認してください。");
      }
      const { error } = await db.rpc("set_school_member_classes", {
        p_owner: user.id, p_school: school.id, p_member: memberId, p_classes: ids, p_mode: body.mode,
      });
      if (error?.code === "22023") return fail("同じ商品の開催枠を選んでください。");
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
    if (code === "23505") return fail("すでに同じ情報が登録されています。再読み込みしてください。", 409);
    if (code === "P0002") return fail("指定した教室または継続クラスの受付が見つかりません。", 404);
    if (code === "22007" || code === "22008") return fail("初回日時を確認してください。");
    console.error("[classes] save failed", error);
    return fail("教室の情報を保存できませんでした。", 500);
  }
}
