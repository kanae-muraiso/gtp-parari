"use client";

import { applicationFields, applicationFieldIds, type BriefingDesign, type ApplicationField } from "@/lib/classBriefingWorkflow";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState, type FormEvent } from "react";

type Followup = { interview?: boolean; design: Pick<BriefingDesign, "rules" | "schoolLabel" | "audience" | "firstDay">; firstDays: string[]; startTime: string; arrival: string; prefill: Partial<Record<ApplicationField, string>> };
type Invitation = { school: string; terms: string; label: string; startsOn: string | null; deadline: string | null; expiresAt?: string;
  payment: "free" | "advance" | "onsite"; revision: number; agreed: boolean; applicationText?: string; paymentUrl?: string | null; arrival?: string | null; followup?: Followup; confirmation?: boolean };

export default function ClassAdmissionPage() {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [login, setLogin] = useState("");
  const [confirmation, setConfirmation] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void request(undefined, controller.signal).then(setInvitation).catch(cause => {
      if (!controller.signal.aborted) {
        setError(cause.message);
        if (cause.loginRequired) {
          try {
            sessionStorage.setItem("parari:class-invitation", window.location.hash.slice(1));
            setLogin("/login?returnTo=" + encodeURIComponent("/class-admission" + window.location.hash));
          } catch {
            setError("PARARIにログインしてから、元の案内リンクを開いてください。");
          }
        }
      }
    });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invitation) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const result = await request({ agree: true, terms: invitation.terms, revision: invitation.revision,
        fields: Object.fromEntries(form), firstDay: form.get("firstDay") });
      if (invitation.followup) {
        setInvitation({ ...invitation, startsOn: result.startsOn, paymentUrl: result.paymentUrl, arrival: result.arrival });
        setConfirmation(result.confirmation !== false);
      }
      setDone(true);
      if (result.paymentUrl) window.location.assign(result.paymentUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "送信できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto grid max-w-xl gap-4 px-5 py-10">
    {invitation && <>
      <h1 className="text-xl font-bold">{invitation.school}の{invitation.label}手続き</h1>
      <p>{invitation.startsOn && <>開始予定日 {invitation.startsOn} ／ </>}回答期限 {invitation.expiresAt ? new Date(invitation.expiresAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) + "（日本時間）" : invitation.deadline}</p>
      {!invitation.followup &&
      <p>{invitation.payment === "advance" ? "事前払い。支払い方法は教室にご確認ください。" : invitation.payment === "onsite" ? "当日払い" : "初回費用なし"}</p>}
      {invitation.applicationText && <p className="whitespace-pre-wrap">{invitation.applicationText}</p>}
      {invitation.terms && <p className="whitespace-pre-wrap rounded-xl border p-4">{invitation.terms}</p>}
      {done || invitation.agreed ? <p role="status">{invitation.followup
        ? invitation.followup.interview ? "入会申込を受け付けました。初回日程は教室からの案内をお待ちください。" : `お申し込みを受け付けました。初日は ${invitation.startsOn} ${invitation.followup.startTime} です。${confirmation ? "" : "メールを送信できなかったため、日時をお控えください。"}`
        : "同意を受け付けました。教室からの案内をお待ちください。"}</p> :
        <form className="grid gap-3" onSubmit={submit}>
          {invitation.followup && <FollowupFields followup={invitation.followup} />}
          <label><input type="checkbox" required /> 案内{invitation.terms ? "と規約" : ""}を確認し、{invitation.label}を申し込みます</label>
          <button disabled={busy} className="w-fit rounded-lg bg-blue-900 px-4 py-2 text-white">同意して申し込む</button>
        </form>}
      {(done || invitation.agreed) && invitation.followup?.arrival && !invitation.followup.interview && <p>集合場所 {invitation.followup.arrival}</p>}
      {(done || invitation.agreed) && invitation.arrival && <p className="whitespace-pre-wrap">{invitation.arrival}</p>}
      {(done || invitation.agreed) && invitation.paymentUrl && <a className="underline" href={invitation.paymentUrl}>支払いページを開く</a>}
    </>}
    {error && <p role="alert">{error}</p>}
    {login && <a className="w-fit rounded-lg bg-blue-900 px-4 py-2 text-white" href={login}>PARARIに登録・ログイン</a>}
    {!invitation && !error && <p role="status">案内を読み込んでいます…</p>}
  </main>;
}

function FollowupFields({ followup }: { followup: Followup }) {
  const { design, prefill, firstDays, startTime } = followup;
  const contact = design.audience === "minor" ? "guardianEmail" : "email";
  return <>
    {applicationFieldIds.filter(id => design.rules[id] !== "hidden").map(id => <label key={id} className="grid gap-1 text-sm">
      {id === "school" ? design.schoolLabel || applicationFields.school : applicationFields[id]}
      <input className="rounded-lg border p-2" name={id} required={design.rules[id] === "required"} readOnly={id === contact}
        type={/email/i.test(id) ? "email" : /phone/i.test(id) ? "tel" : "text"} maxLength={300} defaultValue={prefill[id] ?? ""} />
    </label>)}
    {!followup.interview && design.firstDay === "choose" && <label className="grid gap-1 text-sm">初回の参加日
      <select name="firstDay" className="rounded-lg border p-2" required defaultValue="">
        <option value="">日付を選ぶ</option>
        {firstDays.map(day => <option key={day} value={day}>{day} {startTime}</option>)}
      </select>
    </label>}
  </>;
}

async function request(body?: object, signal?: AbortSignal): Promise<Invitation> {
  let token = window.location.hash.slice(1);
  if (!token) {
    try {
      token = sessionStorage.getItem("parari:class-invitation") ?? "";
      if (token) {
        window.history.replaceState(null, "", "/class-admission#" + encodeURIComponent(token));
        sessionStorage.removeItem("parari:class-invitation");
      }
    } catch { /* An original invitation link can still be opened after sign-in. */ }
  }
  const session = await supabase?.auth.getSession();
  const accessToken = session?.data.session?.access_token;
  const result = await fetch("/api/classes/admission-invitation", {
    method: body ? "POST" : "GET", cache: "no-store", signal,
    headers: { "X-Class-Invitation": token, ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await result.json();
  if (!result.ok || !data.ok) throw Object.assign(new Error(data.message || "案内を取得できませんでした。"), { loginRequired: data.loginRequired === true });
  return data;
}
