"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

type TurnstileClient = {
  render: (container: HTMLElement, settings: {
    sitekey: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
    "timeout-callback": () => void;
    theme: "auto";
  }) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

function turnstileApi(): TurnstileClient | undefined {
  return (window as Window & { turnstile?: TurnstileClient }).turnstile;
}

/**
 * Only a public site key is accepted here. Never expose the Turnstile secret.
 * Supabase Auth validates captchaToken after CAPTCHA is enabled in its dashboard.
 */
export default function LoginTurnstile({
  siteKey,
  onToken,
  resetNonce,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  resetNonce: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const tokenCallback = useRef(onToken);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  tokenCallback.current = onToken;

  useEffect(() => {
    const api = typeof window !== "undefined" ? turnstileApi() : undefined;
    if (!ready || !api || !container.current) return;
    setFailed(false);
    const id = api.render(container.current, {
      sitekey: siteKey,
      theme: "auto",
      callback: (token) => { setFailed(false); tokenCallback.current(token); },
      "expired-callback": () => tokenCallback.current(null),
      "error-callback": () => { tokenCallback.current(null); setFailed(true); },
      "timeout-callback": () => tokenCallback.current(null),
    });
    widget.current = id;
    return () => {
      tokenCallback.current(null);
      widget.current = null;
      api.remove(id);
    };
  }, [ready, siteKey]);

  useEffect(() => {
    if (resetNonce === 0 || !widget.current) return;
    tokenCallback.current(null);
    setFailed(false);
    turnstileApi()?.reset(widget.current);
  }, [resetNonce]);

  return <div className="mt-4 space-y-2" aria-label="BOT対策の確認">
    <Script
      src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      strategy="afterInteractive"
      onReady={() => setReady(true)}
      onError={() => { setFailed(true); onToken(null); }}
    />
    <div ref={container} className="min-h-16" />
    {!ready && <p role="status" className="text-xs text-neutral-600">セキュリティ確認を読み込んでいます…</p>}
    {failed && <p role="alert" className="text-xs text-red-700">
      セキュリティ確認を完了できません。ページを再読み込みしてください。
    </p>}
  </div>;
}
