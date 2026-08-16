// apps/tools/parari/src/app/auth/callback/page.tsx
// apps/tools/parari/src/app/auth/callback/page.tsx
// 2026-03-18 JST

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

          /**
           * PART: callback return destination
           * コメント:
           * - returnTo と next の両方を受け取れるようにする
           * - 外部URLへ飛ばされないよう内部パスだけ許可する
           */
          const rawReturnTo =
            url.searchParams.get("returnTo") ||
            url.searchParams.get("next") ||
            "/mypage";

          const returnTo =
            rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")
              ? rawReturnTo
              : "/mypage";

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

          router.replace(returnTo);
      } catch (e) {
        setStatus("認証失敗");
      }
    };

    run();
  }, [router]);

  return (
    <main className="min-h-screen p-6">
      <div className="text-sm opacity-70">{status}</div>
    </main>
  );
}
