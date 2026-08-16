// apps/tools/parari/src/components/AuthBox.tsx
// 2026-02-28 13:30 JST

"use client";

import React from "react";
import { supabase } from "../lib/supabaseClient";

export default function AuthBox() {
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<string>("");
  const [userEmail, setUserEmail] = React.useState<string>("");

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? "");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? "");
    });

    return () => sub.subscription.unsubscribe();
  }, []);

    // AuthBox.tsx 内：signIn 関数の中

    const signIn = async () => {
      setStatus("送信中…");
      const redirectTo =
        typeof window === "undefined"
          ? undefined
          : `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });

      setStatus(error ? `失敗: ${error.message}` : "メールを確認してください（ログインリンク送信済み）");
    };

  const signOut = async () => {
    await supabase.auth.signOut();
    setStatus("サインアウトしました");
  };

  return (
    <div className="rounded-xl border p-3">
      <div className="text-sm font-semibold mb-2">ログイン</div>
      {userEmail ? (
        <div className="flex items-center gap-2">
          <div className="text-sm opacity-80">{userEmail}</div>
          <button className="rounded-lg border px-3 py-1 text-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            className="w-[320px] rounded-lg border px-3 py-1 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
          />
          <button className="rounded-lg border px-3 py-1 text-sm" onClick={signIn}>
            Send link
          </button>
        </div>
      )}
      {status ? <div className="mt-2 text-xs opacity-70">{status}</div> : null}
    </div>
  );
}
