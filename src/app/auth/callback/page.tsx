"use client";
// 2026-10-14 JST / PART: Recover invalid links without using an unrelated existing session.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { callbackLinkError, expiredLinkMessage, failedLinkMessage, loginHref, loginReturnTo } from "@/lib/auth/loginLinks";

type Outcome = { returnTo: string; error: string | null };

export default function AuthCallbackPage() {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // Strict Mode may repeat the effect; authenticate and claim only once per mount.
  const pending = useRef<Promise<Outcome> | null>(null);

  useEffect(() => {
    let active = true;
    if (!pending.current) pending.current = (async (): Promise<Outcome> => {
      const url = new URL(window.location.href);
      const returnTo = loginReturnTo(url.searchParams.get("returnTo") || url.searchParams.get("next"), "/");
      const fail = (error: string): Outcome => ({ returnTo, error });
      // Supabase preserves an existing session when a link fails. Check the
      // callback error first so that session cannot complete this login attempt.
      const linkError = callbackLinkError(url);
      if (linkError) return fail(linkError);
      if (!supabase) return fail(failedLinkMessage);
      try {
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) return fail(error.code === "otp_expired" ? expiredLinkMessage : failedLinkMessage);
        }
        const { data, error } = await supabase.auth.getSession();
        if (error) return fail(error.code === "otp_expired" ? expiredLinkMessage : failedLinkMessage);
        if (!data.session) return fail(expiredLinkMessage);

        // Preserve APPLICATION guest-claim behavior. A claim outage must not
        // block a valid login, and tokens/provider errors must not enter logs.
        try {
          await fetch("/api/application/claim-guest", {
            method: "POST",
            headers: { Authorization: `Bearer ${data.session.access_token}` },
            signal: AbortSignal.timeout(10000),
          });
        } catch { /* A claim failure does not invalidate the authenticated session. */ }
        return { returnTo, error: null };
      } catch { return fail(failedLinkMessage); }
    })();
    void pending.current.then(result => {
      if (!active) return;
      if (result.error) setOutcome(result);
      else router.replace(result.returnTo);
    });
    return () => { active = false; };
  }, [router]);

  return <main className="mx-auto min-h-screen max-w-md space-y-4 p-6">
    {outcome?.error ? <>
      <h1 className="text-lg font-semibold">ログインリンクを確認してください</h1>
      <p role="alert" className="text-sm leading-6">{outcome.error}</p>
      <Link href={loginHref(outcome.returnTo, true)} className="inline-block rounded-xl bg-black px-4 py-3 text-sm text-white">ログインメールを送り直す</Link>
      <p className="text-sm leading-6 text-neutral-600">新しいメールのリンクでログインした後、そのブラウザーで操作を続けてください。</p>
    </> : <p role="status" className="text-sm opacity-70">認証中…</p>}
  </main>;
}
