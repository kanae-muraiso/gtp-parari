// src/app/auth/callback/page.tsx
// 2026/09/15 JST

"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = React.useState("認証中…");

  React.useEffect(() => {
    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        // returnTo / next が明示されている場合は、その導線を優先する。
        // 通常ログインは / に戻し、起動画面設定をそこで解決する。
        const rawReturnTo =
          url.searchParams.get("returnTo") ||
          url.searchParams.get("next") ||
          "/";

        const returnTo =
          rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")
            ? rawReturnTo
            : "/";

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setStatus("認証失敗: " + error.message);
            return;
          }
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) {
          setStatus("認証失敗: " + error.message);
          return;
        }

        if (!data.session) {
          setStatus("セッションが見つかりません（リンク期限切れの可能性）");
          return;
        }

        // Magic Linkでメール所有が確認された後にだけ、
        // 同じメールで申し込まれたゲストAPPLICATIONをこのユーザーへ紐付ける。
        // claimに失敗してもログイン自体は成功させる。
        setStatus("過去の参加履歴を確認しています…");

        try {
          const claimResponse = await fetch(
            "/api/application/claim-guest",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${data.session.access_token}`,
              },
            },
          );

          if (!claimResponse.ok) {
            const claimResult = await claimResponse
              .json()
              .catch(() => null);

            console.warn(
              "guest application claim did not complete",
              claimResult,
            );
          }
        } catch (claimError) {
          console.warn(
            "guest application claim failed",
            claimError,
          );
        }

        router.replace(returnTo);
      } catch (e) {
        setStatus("認証失敗");
      }
    };

    void run();
  }, [router]);

  return (
    <main className="min-h-screen p-6">
      <div className="text-sm opacity-70">{status}</div>
    </main>
  );
}
