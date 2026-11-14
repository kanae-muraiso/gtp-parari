import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classIdPattern } from "@/lib/classes";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const send = (body: object, status = 200) => NextResponse.json(body, { status, headers });

async function handle(request: NextRequest, write: boolean) {
  const missing = () => send({ ok: false, message: "この案内は利用できません。教室にお問い合わせください。" }, 404);
  const token = request.headers.get("x-class-invitation");
  if (!token || !classIdPattern.test(token)) return missing();
  try {
    const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return send({ ok: false, message: "モニター用アカウントでログインしてください。" }, 401);
    const { data: { user }, error } = await db.auth.getUser(accessToken);
    if (error || !user) return missing();
    const viewer = await db.from("profiles").select("is_monitor").eq("user_id", user.id).maybeSingle();
    if (viewer.error) throw viewer.error;
    if (viewer.data?.is_monitor !== true) return missing();
    const candidate = await db.from("school_admission_cases")
      .select("id,school_id,starts_on,deadline,payment,consent_at,agreed_terms,revision,briefing,test")
      .eq("invite_token", token).eq("decision", "approved").is("enrollment_id", null).maybeSingle();
    if (candidate.error) throw candidate.error;
    const row = candidate.data;
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    if (!row?.starts_on || !row.deadline || row.deadline < today ||
      !["skip", "done"].includes(row.briefing) || !["skip", "graded"].includes(row.test)) return missing();
    const [setting, school] = await Promise.all([
      db.from("school_admission_settings").select("labels,terms").eq("school_id", row.school_id).maybeSingle(),
      db.from("class_schools").select("name,owner_user_id").eq("id", row.school_id).maybeSingle(),
    ]);
    if (setting.error || school.error) throw setting.error ?? school.error;
    if (!school.data) return missing();
    const terms = setting.data?.terms ?? "";
    const owner = await db.from("profiles").select("is_monitor").eq("user_id", school.data.owner_user_id).maybeSingle();
    if (owner.error) throw owner.error;
    if (owner.data?.is_monitor !== true) return missing();
    if (!write) return send({ ok: true, school: school.data.name, terms, label: setting.data?.labels.admission ?? "入会",
      startsOn: row.starts_on, deadline: row.deadline, payment: row.payment, revision: row.revision,
      agreed: Boolean(row.consent_at && row.agreed_terms === terms) });

    const input = await request.json().catch(() => null);
    if (input?.agree !== true || input.terms !== terms || input.revision !== row.revision) {
      return send({ ok: false, message: "案内が更新されました。再読み込みしてください。" }, 409);
    }
    const result = await db.from("school_admission_cases")
      .update({ consent_at: new Date().toISOString(), agreed_terms: terms, revision: row.revision + 1 })
      .eq("id", row.id).eq("invite_token", token).eq("revision", row.revision).is("enrollment_id", null).select("id").maybeSingle();
    if (result.error) throw result.error;
    return result.data ? send({ ok: true }) : send({ ok: false, message: "案内が更新されました。再読み込みしてください。" }, 409);
  } catch (error) {
    console.error("[class invitation] failed", error instanceof Error ? error.name : "database error");
    return send({ ok: false, message: "案内を取得できませんでした。" }, 500);
  }
}

export const GET = (request: NextRequest) => handle(request, false);
export const POST = (request: NextRequest) => handle(request, true);
