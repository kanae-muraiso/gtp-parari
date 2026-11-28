import { classDateRuleKey, classDateRulesOverlap, hasDuplicateClassDateRules, matchesClassDateRule, parseClassScheduleRules, type ClassDateRule } from "@/lib/classRecurrence";
import { classGuardianEnrollmentIds, classParticipantMembers } from "@/lib/classCalendarAccess";
import { classBusinessId, canManageClassStudio } from "@/lib/classBusinessScope";
import { classFeatureAccess } from "@/lib/classFeatureAccess";
import { parseClassProduct, type NamedClassProduct } from "@/lib/classProduct";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classMeetingUrl, classIdPattern, type ClassSchool, type SchoolClass } from "@/lib/classes";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const scheduleColumns = "id,product_id,name,starts_on,starts_at,cadence,location,delivery,meeting_url,duration_minutes,fee_override_yen,schedule_rules";
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

async function ownedSchool(userId: string, scope: string | null) {
  const id = await classBusinessId(userId, scope);
  if (!id) return null;
  const { data, error } = await db.from("class_schools")
    .select(`id,name,classes:school_classes(${scheduleColumns})`)
    .eq("id", id).eq("owner_user_id", userId).maybeSingle();
  if (error) throw error;
  return data as ClassSchool | null;
}

async function manage(userId: string, scope: string | null) {
  const school = await ownedSchool(userId, scope);
  if (!school) return reply({ ok: true, userId, school, roster: [], applicationId: null, applications: [] });
  const [roster, admission, applications, products, surcharges, receipts, otherBusinesses] = await Promise.all([
    db.from("school_enrollments").select("id,name,status,user_id,contract_fee_yen,class_participation,assignments:school_class_assignments(class_id)").eq("school_id", school.id).order("joined_at"),
    db.from("school_admission_applications").select("application_id").eq("school_id", school.id).maybeSingle(),
    db.from("applications").select("id,title").eq("owner_user_id", userId)
      .eq("application_type", "SCHOOL").eq("origin", "manual").is("calendar_item_id", null)
      .is("archived_at", null).order("created_at", { ascending: false }),
    db.from("school_class_products").select("id,name,design").eq("school_id", school.id).order("name"),
    db.from("school_class_visit_reservations").select("enrollment_id,class_id,visit_on,surcharge_yen")
      .eq("school_id", school.id).gt("surcharge_yen", 0).is("surcharge_paid_at", null).order("visit_on"),
    db.from("school_class_surcharge_receipts").select("id,enrollment_id,class_id,visit_on,amount_yen,paid_at")
      .eq("school_id", school.id).order("paid_at", { ascending: false }).limit(30),
    db.from("class_schools").select("id,name").eq("owner_user_id", userId).neq("id", school.id).is("archived_at", null).order("name"),
  ]);
  for (const result of [roster, admission, applications, products, surcharges, receipts, otherBusinesses]) if (result.error) throw result.error;
  const names = new Map(products.data.map(item => [item.id, item.name]));
  school.classes = school.classes.map(item => ({ ...item, productName: names.get(item.product_id) }));
  return reply({ ok: true, userId, school, products: products.data.map(({ id, name, design }) => ({ id, name, audience: design.audience, walkInFee: design.walkInFee ?? null, monthlyFee: design.monthlyFee, monthlyVisits: design.monthlyVisits, booking: design.booking, slotDefaults: design.slotDefaults })), surcharges: surcharges.data, receipts: receipts.data, otherBusinesses: otherBusinesses.data, roster: roster.data, applicationId: admission.data?.application_id ?? null, applications: applications.data });
}

function regularSlotRules(date: string, cadence: SchoolClass["cadence"], rules?: ClassDateRule[]) {
  const first = new Date(date + "T00:00:00Z");
  const fallback: ClassDateRule = cadence === "weekly" ? { kind: "weekly", weekday: first.getUTCDay() } :
    { kind: "date", date: first.getUTCDate() };
  return { rules: rules?.length ? rules : [fallback], clampsToMonthEnd: !rules?.length && cadence === "monthly" };
}

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser(request);
    if (!user) return fail("ログインが必要です。", 401);
    const scope = request.nextUrl.searchParams.get("business");
    const canManage = await canManageClassStudio(user.id,user.isMonitor);
    if (request.nextUrl.searchParams.get("businesses") === "1") {
      if (!canManage) return fail("STUDIOの利用を開始してください。", 403);
      const { data, error } = await db.from("class_schools").select("id,name,business_type,archived_at").eq("owner_user_id", user.id).eq("tier", "a").order("name");
      if (error) throw error;
      return reply({ ok: true, businesses: data });
    }
    if (request.nextUrl.searchParams.get("home") === "1") {
      const guardianIds = await classGuardianEnrollmentIds(user.id);
      let enrolledQuery = db.from("school_enrollments").select("school:class_schools(id,name,archived_at)").eq("status", "active");
      enrolledQuery = guardianIds.length ? enrolledQuery.or(`user_id.eq.${user.id},id.in.(${guardianIds.join(",")})`) : enrolledQuery.eq("user_id", user.id);
      const [owned, enrolled] = await Promise.all([
        canManage ? db.from("class_schools").select("id,name").eq("owner_user_id", user.id).is("archived_at", null).order("name") : Promise.resolve({ data: [], error: null }),
        enrolledQuery.returns<{ school: { id: string; name: string; archived_at?: string | null } | null }[]>(),
      ]);
      if (owned.error || enrolled.error) throw owned.error ?? enrolled.error;
      return reply({ ok: true, userId: user.id, canManage, owned: owned.data?.[0] ?? null, businesses: owned.data,
        enrolled: [...new Map((enrolled.data ?? []).flatMap(({ school }) => school && !school.archived_at ? [[school.id, { id: school.id, name: school.name }] as const] : [])).values()] });
    }
    if (request.nextUrl.searchParams.get("product") === "1") {
      if (!canManage) return fail("STUDIOの利用を開始してください。", 403);
      const school = await ownedSchool(user.id, scope);
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
    if (id === null) return canManage ? await manage(user.id, scope) : fail("STUDIOの利用を開始してください。", 403);
    if (!classIdPattern.test(id)) return fail("教室が見つかりません。", 404);

    const members = await classParticipantMembers(user.id, id);
    const requestedMember = request.nextUrl.searchParams.get("member");
    const selected = requestedMember ? members.find(member => member.id === requestedMember) : members[0];
    if (requestedMember && !selected) return fail("教室が見つかりません。", 404);
    const { data: school, error } = selected
      ? await db.rpc("read_class_school_member", { p_actor: user.id, p_school: id, p_member: selected.id })
      : canManage ? await db.rpc("read_class_school", { p_school: id, p_user: user.id }) : { data: null, error: null };
    if (error) throw error;
    if (!school) return fail("教室が見つかりません。", 404);
    const visible = school as ClassSchool;
    const [member, products] = await Promise.all([
      db.from("school_enrollments").select("id,class_participation,contract_fee_yen").eq("school_id", id)
        .eq("id", selected?.id ?? "00000000-0000-0000-0000-000000000000").eq("status", "active").maybeSingle(),
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
        db.from("school_class_visit_reservations").select("class_id,visit_on,makeup_id,surcharge_yen,surcharge_paid_at").eq("enrollment_id", member.data.id).gte("visit_on", today),
        db.from("school_class_makeups").select("id,source_class_id,expires_on,missed_on,used:school_class_visit_reservations(visit_on)").eq("enrollment_id", member.data.id).gte("expires_on", today),
      ]);
      if (legacy.error || booked.error || credits.error) throw legacy.error ?? booked.error ?? credits.error;
      const makeups = credits.data.filter(credit => Array.isArray(credit.used) ? !credit.used.length : !credit.used)
        .map(({ used, ...credit }) => credit);
      const productIds = [...new Set(visible.classes.map(item => item.product_id).filter(Boolean))];
      const makeupSlots = (credits.data.length || booked.data.some(visit => visit.makeup_id)) && productIds.length
        ? await db.from("school_classes").select(scheduleColumns).eq("school_id", id).in("product_id", productIds) : null;
      if (makeupSlots?.error) throw makeupSlots.error;
      const baseFee = (item: SchoolClass) => (item.product_id ? groups.get(item.product_id)?.design : legacy.data?.design)?.monthlyFee ?? 0;
      visible.classes = visible.classes.map(item => ({ ...item, baseFee: baseFee(item) }));
      const cleared = (visit: { surcharge_yen: number; surcharge_paid_at: string | null }) =>
        visit.surcharge_yen === 0 || Boolean(visit.surcharge_paid_at);
      const makeupClasses = ((makeupSlots?.data ?? []) as SchoolClass[]).filter(item => !visible.classes.some(assigned => assigned.id === item.id))
        .map(item => ({ ...item, productName: groups.get(item.product_id ?? "")?.name,
          baseFee: baseFee(item), meeting_url: booked.data.some(visit => visit.class_id === item.id && visit.makeup_id && cleared(visit)) ? item.meeting_url : null }));
      const flexible = member.data.class_participation === "flexible";
      const allowances = Object.fromEntries(visible.classes.flatMap(item => {
        const plan = item.product_id ? groups.get(item.product_id)?.design : legacy.data?.design;
        return plan && (item.product_id || plan.classIds?.includes(item.id)) ? [[item.id, plan.monthlyVisits]] : [];
      }));
      if (flexible) visible.classes = visible.classes.map(item =>
        booked.data.some(visit => visit.class_id === item.id && cleared(visit)) ? item : { ...item, meeting_url: null });
      const calendarClasses = [...new Set([...visible.classes, ...makeupClasses].map(item => item.id))];
      const calendar = calendarClasses.length
        ? await db.from("school_class_monthly_schedules").select("class_id,month,days").in("class_id", calendarClasses)
          .gte("month", today.slice(0, 7) + "-01")
          .lte("month", new Date(Date.parse(today) + 63 * 86400000).toISOString().slice(0, 7) + "-01")
        : null;
      if (calendar?.error) throw calendar.error;
      const calendarDays = Object.fromEntries((calendar?.data ?? []).map(row => [row.class_id + ":" + row.month.slice(0, 7), row.days]));
      visits = { flexible, classIds: Object.keys(allowances), monthlyVisits: Object.values(allowances)[0] ?? 0,
        allowances, calendarDays, contractFee: member.data.contract_fee_yen, booked: booked.data, makeups, makeupClasses };
    }
    return reply({ ok: true, userId: user.id, school: visible, visits, members, memberId: selected?.id ?? null, startsOn: selected?.startsOn ?? null });
  } catch (error) {
    console.error("[classes] load failed", error);
    return fail("教室を取得できませんでした。", 500);
  }
}

function parseFee(value: unknown): number | null | false {
  if (value == null || value === "") return null;
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value))) return false;
  const amount = Number(value);
  return Number.isInteger(amount) && amount >= 0 && amount <= 1000000 ? amount : false;
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
    const scope = request.nextUrl.searchParams.get("business");
    const body = await request.json().catch(() => null);
    if (body?.action === "visit") {
      if (![body.schoolId, body.classId].every(value => typeof value === "string" && classIdPattern.test(value)) ||
        typeof body.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.day) ||
        !Number.isFinite(Date.parse(body.day)) || new Date(body.day).toISOString().slice(0, 10) !== body.day) return fail("参加日を確認してください。");
      const members = await classParticipantMembers(user.id, body.schoolId);
      const member = body.memberId ? members.find(item => item.id === body.memberId) : members[0];
      if (!member || (member.startsOn && body.day < member.startsOn)) return fail("参加日と受講者を確認してください。", 404);
      const args = { p_actor: user.id, p_member: member.id, p_school: body.schoolId, p_class: body.classId, p_day: body.day };
      if (body.makeupId && (typeof body.makeupId !== "string" || !classIdPattern.test(body.makeupId))) return fail("振替を確認してください。");
      const expected = body.expectedSurcharge ?? 0;
      if (!Number.isInteger(expected) || expected < 0 || expected > 1000000) return fail("差額を確認してください。");
      const { error } = body.cancel === true
        ? await db.rpc("manage_class_member_visit", { ...args, p_cancel: true })
        : await db.rpc("reserve_priced_member_class_visit", { ...args, p_makeup: body.makeupId ?? null, p_expected: expected });
      if (error?.code === "P0003") return fail("料金が更新されました。再読み込みして差額をご確認ください。", 409);
      if (error?.code === "P0001") return fail("定員または月の受講回数の上限に達しています。", 409);
      if (error?.code === "22023" || error?.code === "P0002") return fail("この開催回は操作できません。", 409);
      if (error) throw error;
      return reply({ ok: true });
    }
    if (!await canManageClassStudio(user.id,user.isMonitor)) return fail("STUDIOの利用を開始してください。", 403);
    const name = clean(body?.name);
    if (body?.action === "archiveBusiness" || body?.action === "restoreBusiness") {
      if (typeof body.id !== "string" || !classIdPattern.test(body.id)) return fail("事業を確認してください。");
      const { error } = await db.rpc("set_class_business_archived", {
        p_owner: user.id, p_school: body.id, p_archived: body.action === "archiveBusiness",
      });
      if (error?.code === "P0002") return fail("事業が見つかりません。", 404);
      if (error) throw error;
      return reply({ ok: true });
    }
    if (body?.action === "createBusiness") {
      if (!name || name.length > 120 || !["school", "studio", "other"].includes(body.businessType) ||
        typeof body.id !== "string" || !classIdPattern.test(body.id)) return fail("事業名と形態を確認してください。");
      const { error } = await db.from("class_schools").upsert({ id: body.id, name, owner_user_id: user.id,
        business_type: body.businessType }, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
      const business = await classBusinessId(user.id, body.id);
      return business ? reply({ ok: true, id: business }) : fail("事業を登録できませんでした。");
    }
    if (body?.action === "renameBusiness") {
      const expected = clean(body.expectedName);
      if (!scope || !name || name.length > 120 || !expected) return fail("事業名を確認してください。");
      const school = await classBusinessId(user.id, scope);
      if (!school) return fail("事業が見つかりません。", 404);
      const { data, error } = await db.from("class_schools").update({ name })
        .eq("id", school).eq("owner_user_id", user.id).eq("name", expected).is("archived_at", null).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return fail("事業名が変更されています。再読み込みしてください。", 409);
      return await manage(user.id, scope);
    }
    if (body?.action === "create" || body?.action === "schedule") {
      if(body.action==="create" && !user.isMonitor) {
        const access = scope ? await classFeatureAccess(scope,user.id) : null;
        if(!access?.canManage) return fail("事業を確認してください。",404);
        if(access.plan!=="b") {
          const owned = await db.from("class_schools").select("id").eq("owner_user_id",user.id);
          if(owned.error)throw owned.error;
          if(owned.data.length) {
            const count = await db.from("school_classes").select("id",{count:"exact",head:true})
              .in("school_id",owned.data.map(item=>item.id));
            if(count.error)throw count.error;
            if((count.count??0)>=1)return fail("CLASS Aではクラスは1件までです。",403);
          }
        }
      }
      const date = clean(body.date);
      const time = clean(body.time);
      const location = clean(body.location);
      if (!name || name.length > 120 || location.length > 200 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
          !["weekly", "monthly"].includes(body.cadence)) return fail("開催枠の名前・初回日時・頻度を確認してください。");

      const duration = body.duration === undefined ? 60 : Number(body.duration);
      if (!Number.isInteger(duration) || duration < 5 || duration > 480) return fail("授業の所要時間を確認してください。");
      const delivery = body.delivery ?? "onsite";
      const meeting = delivery === "onsite" ? null : classMeetingUrl(body.meetingUrl);
      if (!["onsite", "online", "hybrid"].includes(delivery) ||
          (delivery !== "onsite" && !meeting) || (delivery === "hybrid" && !location)) {
        return fail("開催方法に応じた会場とHTTPS参加リンクを入力してください。");
      }
      const school = await ownedSchool(user.id, scope);
      const classId = clean(body.classId);
      if (!classIdPattern.test(classId) || (body.action === "schedule" && !school?.classes.some(item => item.id === classId))) {
        return fail("クラスを確認してください。");
      }
      if (!school && scope !== null) return fail("事業を選択してください。", 404);
      const schoolName = school?.name ?? clean(body.schoolName);
      if (!schoolName || schoolName.length > 120) return fail("事業名を確認してください。");
      const fee = parseFee(body.feeOverride);
      if (fee === false) return fail("開催枠の料金を確認してください。");
      const { error } = await db.rpc("save_school_priced_slot", {
        p_owner: user.id, p_school: school?.id ?? null, p_class: classId, p_new: body.action === "create",
        p_school_name: schoolName, p_class_name: name, p_starts_on: date, p_starts_at: time, p_cadence: body.cadence,
        p_location: delivery === "online" ? null : location || null, p_delivery: delivery, p_meeting_url: meeting, p_duration: duration, p_product: body.productId || null, p_fee: fee,
      });
      if (error) throw error;
      return await manage(user.id, scope);
    }

    const school = await ownedSchool(user.id, scope);
    if (!school) return fail("教室が見つかりません。", 404);
    if (body?.action === "saveSlotRows") {
      if(!user.isMonitor && Array.isArray(body.rows) && body.rows.some((row: {new?: boolean})=>row?.new===true)){
        const access=await classFeatureAccess(school.id,user.id);
        if(access.plan!=="b"){
          const count=await db.from("school_classes").select("id",{count:"exact",head:true}).eq("school_id",school.id);
          if(count.error)throw count.error;
          if((count.count??0)>=1)return fail("CLASS Aではクラスは1件までです。",403);
        }
      }
      if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 12) return fail("開催枠を確認してください。");
      const byId = new Map(school.classes.map(item => [item.id, item]));
      const ids = new Set<string>();
      const normalized = [];
      for (const [index, row] of body.rows.entries()) {
        const id = clean(row?.id), date = clean(row?.date), time = clean(row?.time);
        const current = byId.get(id);
        const name = clean(row?.name);
        const location = clean(row?.location);
        const duration = Number(row?.duration);
        const fee = parseFee(row?.feeOverride);
        const rules = parseClassScheduleRules(row?.rules);
        const parentSlotId = current ? current.schedule_rules?.parentSlotId : row?.rules?.parentSlotId;
        const delivery = row?.delivery;
        const meetingUrl = delivery === "onsite" ? null : classMeetingUrl(row?.meetingUrl);
        const isNew = row?.new === true;
        const productId = isNew ? clean(row?.productId) : null;
        const parsedDate = new Date(date + "T00:00:00Z");
        if (!classIdPattern.test(id) || ids.has(id) || (isNew ? !classIdPattern.test(productId ?? "") : !current) ||
          (parentSlotId !== undefined && (typeof parentSlotId !== "string" || !classIdPattern.test(parentSlotId) || parentSlotId === id)) ||
          !name || name.length > 120 || location.length > 200 || !rules || (isNew && !rules.rules.length) || fee === false ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) ||
          parsedDate.toISOString().slice(0, 10) !== date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
          !Number.isInteger(duration) || duration < 5 || duration > 480 || !["onsite", "online", "hybrid"].includes(delivery) ||
          (delivery !== "onsite" && !meetingUrl) || (delivery === "hybrid" && !location)) {
          return fail(`${index + 1}行目の名前・日時・会場・費用を確認してください。`);
        }
        if (hasDuplicateClassDateRules(rules.rules)) {
          return fail("同じ頻度が複数あります。頻度を変更するか、重複した頻度を削除してください。");
        }
        if ((isNew || date !== current?.starts_on) && rules.rules.length && !rules.rules.some(rule => matchesClassDateRule(rule, date))) {
          return fail(`${index + 1}行目の初回日を、設定した頻度に合う日にしてください。`);
        }
        ids.add(id);
        normalized.push({ id, name, date, time, delivery, duration, meetingUrl, fee, rules: { ...rules, parentSlotId }, productId, new: isNew,
          location: delivery === "online" ? null : location || null,
          cadence: rules.rules.length ? (rules.rules[0].kind === "weekly" ? "weekly" : "monthly") : current?.cadence ?? "weekly" });
      }
      const submitted = new Map(normalized.map(row => [row.id, row]));
      for (const row of normalized) {
        const parentId = row.rules.parentSlotId;
        if (parentId && row.new) {
          const submittedParent = submitted.get(parentId);
          const savedParent = byId.get(parentId);
          const parentProduct = savedParent ? savedParent.product_id : submittedParent?.productId;
          if (parentProduct !== row.productId || submittedParent?.rules.parentSlotId || savedParent?.schedule_rules?.parentSlotId) {
            return fail("追加先の開催枠と商品を確認してください。");
          }
        }
      }
      const schedules = school.classes.filter(item => !submitted.has(item.id)).map(item => ({
        group: item.schedule_rules?.parentSlotId ?? item.id, time: item.starts_at.slice(0, 5),
        ...regularSlotRules(item.starts_on, item.cadence, item.schedule_rules?.rules), changed: false,
      }));
      for (const row of normalized) {
        const group = row.rules.parentSlotId ?? row.id;
        const schedule = regularSlotRules(row.date, row.cadence, row.rules.rules);
        const previous = byId.get(row.id);
        const previousSchedule = previous && regularSlotRules(previous.starts_on, previous.cadence, previous.schedule_rules?.rules);
        const changed = !previous || !previousSchedule || previous.starts_at.slice(0, 5) !== row.time ||
          previousSchedule.clampsToMonthEnd !== schedule.clampsToMonthEnd ||
          previousSchedule.rules.map(classDateRuleKey).sort().join() !== schedule.rules.map(classDateRuleKey).sort().join();
        if (schedules.some(other => other.group === group && other.time === row.time && (other.changed || changed) &&
          other.rules.some(first => schedule.rules.some(second =>
            classDateRulesOverlap(first, second, other.clampsToMonthEnd, schedule.clampsToMonthEnd))))) {
          return fail("同じ条件の頻度があります。追加した行の日時を変更してください。");
        }
        schedules.push({ group, time: row.time, ...schedule, changed });
      }
      const { error } = await db.rpc("save_class_slot_rows", { p_owner: user.id, p_school: school.id, p_rows: normalized });
      if (error?.code === "P0001") return fail("予約が入っている開催日は変更できません。", 409);
      if (error?.code === "22023" || error?.code === "P0002") return fail("事業・商品・開催枠を確認して再読み込みしてください。", 409);
      if (error) throw error;
      return await manage(user.id, scope);
    }
    if (body?.action === "saveScheduleRules") {
      const rules = parseClassScheduleRules(body.rules);
      const item = school.classes.find(item => item.id === body.classId);
      if (!rules || !item) return fail("開催ルールを確認してください。");
      if (hasDuplicateClassDateRules(rules.rules)) return fail("同じ頻度が複数あります。");
      const { error } = await db.rpc("save_class_schedule_rules", {
        p_owner: user.id, p_school: school.id, p_class: body.classId, p_rules: { ...rules, parentSlotId: item.schedule_rules?.parentSlotId },
      });
      if (error?.code === "P0001") return fail("予約が入っている開催日はルールから外せません。", 409);
      if (error) throw error;
      return await manage(user.id, scope);
    }
    if (body?.action === "moveSlot") {
      if (![body.destination, body.classId].every(value => typeof value === "string" && classIdPattern.test(value))) return fail("移動先と開催枠を確認してください。");
      const { error } = await db.rpc("move_unassigned_school_slot", { p_owner: user.id, p_source: school.id, p_destination: body.destination, p_class: body.classId });
      if (error?.code === "22023") return fail("商品・名簿・募集・予約に紐づいている開催枠は移動できません。", 409);
      if (error?.code === "P0002") return fail("開催枠または移動先の事業を確認してください。", 404);
      if (error) throw error;
      return await manage(user.id, scope);
    }
    if (body?.action === "confirmSurcharge") {
      const ids = [body.memberId, body.classId];
      if (!ids.every(value => typeof value === "string" && classIdPattern.test(value)) ||
        typeof body.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.day)) return fail("入金を記録する予約を確認してください。");
      const { error } = await db.rpc("confirm_class_visit_surcharge", { p_owner: user.id, p_school: school.id,
        p_member: body.memberId, p_class: body.classId, p_day: body.day });
      if (error?.code === "P0002" || error?.code === "22023") return fail("差額のある予約が見つかりません。", 409);
      if (error) throw error;
      return await manage(user.id, scope);
    }
    if (body?.action === "saveContentProduct") {
      const id = clean(body.productId);
      if(!user.isMonitor) {
        const access=await classFeatureAccess(school.id,user.id);
        if(access.plan!=="b") {
          const existing=await db.from("school_class_products").select("id").eq("school_id",school.id);
          if(existing.error)throw existing.error;
          if(existing.data.length && !existing.data.some(item=>item.id===id))
            return fail("CLASS Aではコースは1件までです。",403);
        }
      }
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
      return await manage(user.id, scope);
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
      const fee = parseFee(body.contractFee);
      if (fee === false) return fail("契約時の料金を確認してください。");
      const { data, error } = await db.from("school_enrollments").update({ name, status: body.status,
        ...(body.contractFee !== undefined ? { contract_fee_yen: fee } : {}) })
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
    return await manage(user.id, scope);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "P0010") return fail("CLASS Aではクラスは1件までです。",403);
    if (code === "P0011") return fail("CLASS Aでは在籍者は10人までです。",403);
    if (code === "P0012") return fail("CLASS Bの契約クラス数の上限に達しています。追加クラス枠をご契約ください。",403);
    if (code === "P0013") return fail("このクラスは30人の定員に達しています。別の開催枠を選択してください。",409);
    if (code === "23505") return fail("すでに同じ情報が登録されています。再読み込みしてください。", 409);
    if (code === "P0002") return fail("指定した教室または継続クラスの受付が見つかりません。", 404);
    if (code === "22007" || code === "22008") return fail("初回日時を確認してください。");
    console.error("[classes] save failed", error);
    return fail("教室の情報を保存できませんでした。", 500);
  }
}
