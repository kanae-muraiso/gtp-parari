"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState, type FormEvent } from "react";

type Invitation = { school: string; terms: string; label: string; startsOn: string; deadline: string;
  payment: "free" | "advance" | "onsite"; revision: number; agreed: boolean };

export default function ClassAdmissionPage() {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void request(undefined, controller.signal).then(setInvitation).catch(cause => {
      if (!controller.signal.aborted) setError(cause.message);
    });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invitation) return;
    setBusy(true);
    setError("");
    try {
      await request({ agree: true, terms: invitation.terms, revision: invitation.revision });
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "送信できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto grid max-w-xl gap-4 px-5 py-10">
    {invitation && <>
      <h1 className="text-xl font-bold">{invitation.school}の{invitation.label}手続き</h1>
      <p>開始予定日 {invitation.startsOn} ／ 回答期限 {invitation.deadline}</p>
      <p>{invitation.payment === "advance" ? "事前払い。支払い方法は教室にご確認ください。" : invitation.payment === "onsite" ? "当日払い" : "初回費用なし"}</p>
      {invitation.terms && <p className="whitespace-pre-wrap rounded-xl border p-4">{invitation.terms}</p>}
      {done || invitation.agreed ? <p role="status">同意を受け付けました。教室からの案内をお待ちください。</p> :
        <form className="grid gap-3" onSubmit={submit}>
          <label><input type="checkbox" required /> 案内{invitation.terms ? "と規約" : ""}を確認し、{invitation.label}を申し込みます</label>
          <button disabled={busy} className="w-fit rounded-lg bg-blue-900 px-4 py-2 text-white">同意して申し込む</button>
        </form>}
    </>}
    {error && <p role="alert">{error}</p>}
    {!invitation && !error && <p role="status">案内を読み込んでいます…</p>}
  </main>;
}

async function request(body?: object, signal?: AbortSignal): Promise<Invitation> {
  const token = window.location.hash.slice(1);
  const session = await supabase?.auth.getSession();
  const accessToken = session?.data.session?.access_token;
  const result = await fetch("/api/classes/admission-invitation", {
    method: body ? "POST" : "GET", cache: "no-store", signal,
    headers: { "X-Class-Invitation": token, ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await result.json();
  if (!result.ok || !data.ok) throw new Error(data.message || "案内を取得できませんでした。");
  return data;
}
