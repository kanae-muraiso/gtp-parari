import { createHash } from "node:crypto";
import { classAdmissionMail } from "@/lib/classAdmissionMail";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classBusinessId, canManageClassStudio } from "@/lib/classBusinessScope";
import { classFeatureAccess } from "@/lib/classFeatureAccess";
import { eligibleClassEventPage } from "@/lib/classEventPage";
import { classIdPattern } from "@/lib/classes";
import { activeEventSchool, isClassEventMember } from "@/lib/classEventAccess";
import { classEventKind, classEventLabels, classEventScheduleText, maxWorkshopSessions, type ClassEvent, type ClassEventSession, type ClassEventSettings } from "@/lib/classEvents";

const columns = "id,title,description,status,class_event_school_id,class_event,definition,payment_method,payment_amount,payment_url,payment_currency,payment_confirmation_required,acceptance_mode,version";
const send = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
const fail = (message: string, status = 400) => send({ ok: false, message }, status);
const missing = () => fail("イベントが見つかりません。", 404);

async function userId(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  return error ? null : data.user?.id ?? null;
}

async function ownBusiness(request: NextRequest, user: string | null) {
  if (!user) return null;
  const scope = request.nextUrl.searchParams.get("business");
  if (!scope) return null;
  const school = await classBusinessId(user, scope);
  if (!school) return null;
  const access = await classFeatureAccess(school,user);
  return access.canManage && await canManageClassStudio(user) ? school : null;
}

async function eventList(school: string, publishedOnly: boolean, kind?: string | null) {
  let query = db.from("applications").select(columns).eq("class_event_school_id", school).is("archived_at", null)
    .order("class_event->>startsAt", { ascending: publishedOnly }).limit(100);
  if (kind === "workshop") query = query.not("class_event->sessions", "is", null);
  if (kind === "event") query = query.is("class_event->sessions", null);
  if (publishedOnly) {
    const now = new Date().toISOString();
    query = query.eq("status", "open").or(`class_event->>startsAt.gte.${now},class_event->>lastStartsAt.gte.${now}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

function publicEvent(event: ClassEvent) {
  const { id, title, description, status, class_event, definition, payment_method, payment_amount } = event;
  return { id, title, description, status, class_event: { ...class_event, classIds: [] }, definition,
    payment_method, payment_amount, payment_url: null };
}

async function getEvent(id: string) {
  if (!classIdPattern.test(id)) return null;
  const { data, error } = await db.from("applications").select(columns).eq("id", id)
    .not("class_event_school_id", "is", null).is("archived_at", null).maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const user = await userId(request);
    const id = request.nextUrl.searchParams.get("event");
    const schoolId = request.nextUrl.searchParams.get("school");
    if (schoolId) {
      if (!classIdPattern.test(schoolId) || !user) return missing();
      const school = await activeEventSchool(schoolId);
      if (!school || (school.owner_user_id !== user && !await isClassEventMember(schoolId, [], user))) return missing();
      const events = await eventList(schoolId, true);
      const visible = await Promise.all(events.filter(event => event.class_event.audience !== "public")
        .map(async event => school.owner_user_id === user || await isClassEventMember(schoolId, event.class_event.classIds, user)
          ? publicEvent(event) : null));
      return send({ ok: true, events: visible.filter(Boolean) });
    }
    if (id && !request.nextUrl.searchParams.has("business")) {
      const event = await getEvent(id);
      if (!event || event.status === "draft") return missing();
      const school = await activeEventSchool(event.class_event_school_id);
      if (!school) return missing();
      const owner = school.owner_user_id === user;
      if (event.class_event.audience === "members" && !owner) {
        if (!user) return fail("このイベントを開くにはログインが必要です。", 401);
        if (!await isClassEventMember(school.id, event.class_event.classIds, user)) return missing();
      }
      const entry = user ? await db.from("application_entries").select("id,payment_status").eq("application_id", id)
        .eq("user_id", user).in("status", ["submitted", "confirmed"]).limit(1).maybeSingle() : null;
      if (entry?.error) throw entry.error;
      const binding=await db.from("class_event_pages").select("work_id").eq("event_id",id).maybeSingle();
      if(binding.error)throw binding.error;
      let authoredPage: {id:string;content:string}|null=null;
      if(binding.data?.work_id){
        const work=await db.from("parari_books").select("id,content,visibility,is_public,is_deleted,owner")
          .eq("id",binding.data.work_id).eq("owner",school.owner_user_id).maybeSingle();
        if(work.error)throw work.error;
        if(work.data && !work.data.is_deleted && eligibleClassEventPage(work.data.content,id) &&
          (work.data.visibility==="public" || (work.data.visibility==null&&work.data.is_public===true)))
          authoredPage={id:work.data.id,content:work.data.content};
      }
      return send({ ok: true, event: publicEvent(event), authoredPage, schoolName: school.name, registered: Boolean(entry?.data),
        paymentUrl: entry?.data?.payment_status === "unpaid" ? event.payment_url : null,
        canRegister: event.status === "open" && !owner && event.class_event.registration && Date.parse(event.class_event.deadline) > Date.now() });
    }
    const school = await ownBusiness(request, user);
    if (!school) return missing();
    if (!id) {
      const access = await classFeatureAccess(school,user!);
      return send({ ok: true, canCreateEvents: access.canCreateEvents, classPlan: access.plan,
        events: await eventList(school, false, request.nextUrl.searchParams.get("kind")) });
    }
    const event = await getEvent(id);
    if (!event || event.class_event_school_id !== school) return missing();
    const [eventPage] = await Promise.all([
      db.from("class_event_pages").select("work_id").eq("event_id",id).maybeSingle(),
    ]);
    if (eventPage.error) throw eventPage.error;
    const { data, error } = await db.from("application_entries")
      .select("id,user_id,applicant_name,payment_status,status,class_event_attendance,class_workshop_attendance(session_at,status)")
      .eq("application_id", id).in("status", ["submitted", "confirmed"]).order("created_at");
    if (error) throw error;
    const users = [...new Set(data.flatMap(entry => entry.user_id ? [entry.user_id] : []))];
    const profiles = users.length ? await db.from("profiles").select("user_id,display_name,username").in("user_id", users) : null;
    if (profiles?.error) throw profiles.error;
    const names = new Map(profiles?.data.map(profile => [profile.user_id, profile.display_name || profile.username]));
    return send({ ok: true, event, eventPageId: eventPage.data?.work_id ?? null, entries: data.map(({ user_id, applicant_name, ...entry }) => ({
      ...entry, name: applicant_name || names.get(user_id) || "PARARIユーザー",
    })) });
  } catch (error) {
    console.error("[class events] read failed", error);
    return fail("イベントを取得できませんでした。", 500);
  }
}

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
function parseDate(value: unknown) {
  const local = clean(value, 32);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const time = Date.parse(local + ":00+09:00");
  if (!Number.isFinite(time) || new Date(time + 9 * 3600000).toISOString().slice(0, 16) !== local) return null;
  return new Date(time).toISOString();
}

export async function POST(request: NextRequest) {
  try {
    const user = await userId(request);
    const school = await ownBusiness(request, user);
    if (!school || !user) return missing();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("イベントの内容を確認してください。");
    const access = await classFeatureAccess(school,user);
    if (!access.canManage) return missing();
    if ((body.action === "save" || body.action === "publish" || body.action === "bindPage") &&
        !access.canCreateEvents) return fail("イベント・講習会の新規作成と公開はCLASS Bで利用できます。",403);
    const id = clean(body.id, 36);
    const event = id ? await getEvent(id) : null;
    if (id && (!event || event.class_event_school_id !== school)) return missing();

    if (event && body.action === "bindPage") {
      const workId=body.workId;
      if (typeof workId !== "string" || !classIdPattern.test(workId)) return fail("PARARI PAGEを確認してください。");
      const work=await db.from("parari_books").select("id,owner,content,is_deleted")
        .eq("id",workId).eq("owner",user).maybeSingle();
      if(work.error)throw work.error;
      if(!work.data || work.data.is_deleted || !eligibleClassEventPage(work.data.content,event.id))
        return fail("このイベント用のPARARI PAGEを選んでください。",403);
      const saved=await db.from("class_event_pages").upsert({
        event_id:event.id,work_id:workId,updated_at:new Date().toISOString(),
      },{onConflict:"event_id"});
      if(saved.error)throw saved.error;
      return send({ok:true,id:event.id});
    }
    if (event && ["publish", "close"].includes(body.action)) {
      const publish = body.action === "publish";
      if (!publish && event.status !== "open") return fail("公開中のイベントを選んでください。", 409);
      if (publish && (!Number.isInteger(event.definition.capacity) || Number(event.definition.capacity) < 1 || Number(event.definition.capacity) > 50)) return fail("CLASS Bの定員を1〜50人に設定してください。", 409);
      if (publish && Date.parse(event.class_event.startsAt) <= Date.now()) return fail("開催日時を未来に設定してください。");
      if (publish && event.class_event.registration && Date.parse(event.class_event.deadline) <= Date.now()) return fail("申込締切を未来に設定してください。");
      const { error } = await db.from("applications").update({ status: publish ? "open" : "closed" })
        .eq("id", id).eq("class_event_school_id", school);
      if (error) throw error;
      return send({ ok: true, id });
    }

    if (event && body.action === "notifyGuardians") {
      if (event.status !== "open" || event.class_event.audience === "public" ||
        Date.parse(event.class_event.startsAt) <= Date.now()) return fail("在籍者向けの開催前イベントを公開してください。");
      const { data, error } = await db.from("school_admission_cases")
        .select("applicant_email,applicant_user_id,application_fields,learner_email")
        .eq("school_id", school).not("enrollment_id", "is", null).not("applicant_user_id", "is", null)
        .not("consent_at", "is", null).limit(1000);
      if (error) throw error;
      const guardianCases = data.filter(row => row.applicant_email && row.application_fields?.guardianEmail === row.applicant_email);
      const recipients = new Set<string>();
      const text = [event.title, ...classEventScheduleText(event.class_event), new URL("/class-event/" + id, request.nextUrl.origin).href].join("\n");
      for (const row of guardianCases) {
        if (recipients.has(row.applicant_email) ||
          !await isClassEventMember(school, event.class_event.classIds, row.applicant_user_id)) continue;
        recipients.add(row.applicant_email);
        if (row.learner_email) recipients.add(row.learner_email);
      }
      const emails = [...recipients];
      let sent = 0;
      for (let index = 0; index < emails.length; index += 8) {
        const results = await Promise.all(emails.slice(index, index + 8).map(email => classAdmissionMail(email,
          classEventLabels[classEventKind(event.class_event)] + "のご案内 · " + event.title, text, "class-event-" + id + "-" + createHash("sha256").update(email).digest("hex"))));
        sent += results.filter(Boolean).length;
      }
      return send({ ok: true, id, notice: emails.length ? `保護者への案内 ${sent}/${emails.length}件を送信しました。` : "案内先の保護者メールアドレスが登録されていません。" });
    }

    if (event && body.action === "entry") {
      const entry = clean(body.entryId, 36);
      if (!classIdPattern.test(entry)) return fail("参加者を選択してください。");
      if (event.class_event.sessions && body.change !== "paid") {
        const session = event.class_event.sessions.find(item => item.startsAt === body.sessionAt);
        const status = body.change;
        if (!session || (status !== "present" && status !== "absent" && status !== "clear")) {
          return fail("開催回と出欠を選択してください。");
        }
        const { data, error } = await db.from("application_entries").select("id")
          .eq("id", entry).eq("application_id", id).in("status", ["submitted", "confirmed"]).maybeSingle();
        if (error) throw error;
        if (!data) return fail("参加者が見つかりません。", 404);
        const attendance = db.from("class_workshop_attendance");
        const result = status === "clear"
          ? await attendance.delete().eq("entry_id", entry).eq("session_at", session.startsAt)
          : await attendance.upsert({ entry_id: entry, session_at: session.startsAt, status });
        if (result.error) throw result.error;
        return send({ ok: true, id });
      }
      const change = body.change === "paid" && event.payment_method !== "none" ? { payment_status: "paid", status: "confirmed", payment_confirmed_at: new Date().toISOString() }
        : body.change === "present" || body.change === "absent" || body.change === "clear"
          ? { class_event_attendance: body.change === "clear" ? null : body.change } : null;
      if (!change) return fail("変更内容を選択してください。");
      let query = db.from("application_entries").update(change).eq("id", entry).eq("application_id", id)
        .in("status", ["submitted", "confirmed"]);
      if (body.change === "paid") query = query.eq("payment_status", "unpaid");
      const { error } = await query;
      if (error) throw error;
      return send({ ok: true, id });
    }

    if (event && body.action === "add") {
      const memberId = clean(body.memberId, 36);
      if (!classIdPattern.test(memberId) || event.status === "draft") return fail("参加者を選んでください。");
      const { data: member, error: memberError } = await db.from("school_enrollments").select("id,name,user_id")
        .eq("school_id", school).eq("status", "active").eq("id", memberId).maybeSingle();
      if (memberError) throw memberError;
      if (!member) return fail("在籍者が見つかりません。", 404);
      if (event.class_event.classIds.length) {
        const { data, error } = await db.from("school_class_assignments").select("class_id").eq("school_id", school)
          .eq("enrollment_id", member.id).in("class_id", event.class_event.classIds).limit(1);
        if (error) throw error;
        if (!data.length) return fail("このイベントの対象クラスに所属していません。");
      }
      const { error } = await db.rpc("create_application_entry_atomic", {
        p_application_id: id, p_application_version: event.version,
        p_application_snapshot: { ...event, class_event_staff: true, class_event_enrollment: member.id }, p_answers: {},
        p_capacity_limit: event.definition.capacity, p_user_id: member.user_id,
        p_applicant_name: member.name, p_applicant_email: null,
        p_calendar_occurrence_id: null, p_form_submission_id: null,
      });
      if (error?.code === "23505") return fail("すでに登録されています。", 409);
      if (error?.message.includes("application_capacity_reached")) return fail("定員に達しています。", 409);
      if (error) throw error;
      return send({ ok: true, id });
    }

    if (body.action !== "save" || (event && event.status !== "draft")) return fail("下書きで内容を設定できます。", 409);
    const title = clean(body.title, 120);
    const description = clean(body.description, 4000);
    const kind = body.kind ?? "event";
    if ((kind !== "event" && kind !== "workshop") || (event && kind !== classEventKind(event.class_event))) {
      return fail("開催の種類を確認してください。");
    }
    let sessions: ClassEventSession[] | undefined;
    if (kind === "workshop") {
      if (!Array.isArray(body.sessions) || body.sessions.length < 1 || body.sessions.length > maxWorkshopSessions) {
        return fail(`開催日程を1〜${maxWorkshopSessions}回分入力してください。`);
      }
      sessions = [];
      for (const row of body.sessions) {
        const startsAt = parseDate(row?.startsAt);
        const location = clean(row?.location, 200);
        if (!startsAt || !location) return fail("すべての回の日時と場所を入力してください。");
        sessions.push({ startsAt, location });
      }
      sessions.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      if (new Set(sessions.map(row => row.startsAt)).size !== sessions.length) return fail("同じ開始日時が重複しています。");
    }
    const location = sessions?.[0]?.location ?? clean(body.location, 200);
    const startsAt = sessions?.[0]?.startsAt ?? parseDate(body.startsAt);
    const registration = kind === "workshop" || body.registration === true;
    const deadline = registration && body.deadline ? parseDate(body.deadline) : startsAt;
    const audience = body.audience;
    if (!title || !location || !startsAt || !deadline || deadline > startsAt ||
      (audience !== "members" && audience !== "public" && audience !== "mixed")) return fail("イベント名、日時、場所、対象、申込締切を確認してください。");
    const classIds: string[] = audience !== "public" && Array.isArray(body.classIds)
      ? [...new Set<string>(body.classIds.filter((value: unknown): value is string => typeof value === "string"))] : [];
    if (classIds.length > 100 || classIds.some(value => !classIdPattern.test(value))) return fail("対象クラスを確認してください。");
    if (classIds.length) {
      const { count, error } = await db.from("school_classes").select("id", { count: "exact", head: true }).eq("school_id", school).in("id", classIds);
      if (error) throw error;
      if (count !== classIds.length) return fail("この事業のクラスを選んでください。");
    }
    const capacity = body.capacity === "" || body.capacity == null ? 50 : Number(body.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) return fail("CLASS Bの定員は1〜50人で入力してください。");
    const payment = body.payment;
    if (payment !== "none" && payment !== "on_site" && payment !== "payment_link") return fail("支払方法を選択してください。");
    if (!registration && payment === "payment_link") return fail("決済リンクを使う場合は申込を受け付けてください。");
    const amount = payment === "none" ? null : Number(body.amount);
    if (amount !== null && (!Number.isInteger(amount) || amount < 1 || amount > 10000000)) return fail("参加費を入力してください。");
    const url = payment === "payment_link" ? clean(body.paymentUrl, 2048) : null;
    if (url !== null) {
      const parsed = URL.parse(url);
      if (!parsed || parsed.protocol !== "https:" || parsed.username || parsed.password) return fail("HTTPSの決済URLを入力してください。");
    }
    const settings: ClassEventSettings = { startsAt, location, audience, classIds, registration, deadline,
      ...(sessions ? { sessions, lastStartsAt: sessions.at(-1)?.startsAt } : {}) };
    const payload = { owner_user_id: user, origin: "manual", application_type: "EVENT", status: "draft", acceptance_mode: "instant",
      title, description, class_event_school_id: school, class_event: settings, definition: { mode: "lite", fields: [], blocks: [], capacity },
      payment_method: payment, payment_amount: amount, payment_url: url, payment_currency: "JPY",
      payment_confirmation_required: payment !== "none" };
    const result = event
      ? await db.from("applications").update(payload).eq("id", id).eq("status", "draft").select("id").maybeSingle()
      : await db.from("applications").insert(payload).select("id").single();
    if (result.error) throw result.error;
    if (!result.data) return fail("イベントの状態が変わりました。再読み込みしてください。", 409);
    return send({ ok: true, id: result.data.id });
  } catch (error) {
    console.error("[class events] update failed", error);
    return fail("イベントを更新できませんでした。", 500);
  }
}
