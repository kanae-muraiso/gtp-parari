// apps/tools/parari/src/app/login/page.tsx
// apps/tools/parari/src/app/login/page.tsx
// 2026-05-30 JST

"use client";

/**
 * PART: Login page with anti-repeat-send UX
 * コメント:
 * - マジックリンク送信後は「確認待ち画面」に切り替える
 * - 送信直後の再送事故を防ぐため cooldown を入れる
 * - email rate limit exceeded を起こしにくくする
 * - メールアドレスを修正したい場合は入力画面へ戻れる
 * - 既ログインなら login 画面を見せず /mypage へ送る
 */

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const RESEND_COOLDOWN_SEC = 60;

export default function LoginPage() {
    const router = useRouter();


    /**
     * PART: getReturnTo
     * コメント:
     * - returnTo と next の両方を受け取れるようにする
     * - APPLICATIONパネル側が /login?next=... で送ってきても元ページへ戻れる
     * - 外部URLへ飛ばされないよう、内部パスだけ許可する
     */
    function getReturnTo() {
      if (typeof window === "undefined") return "/mypage";

      const params = new URLSearchParams(window.location.search);
      const raw = params.get("returnTo") || params.get("next") || "/mypage";

      if (!raw.startsWith("/") || raw.startsWith("//")) {
        return "/mypage";
      }

      return raw;
    }

  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<string>("");
  const [isSending, setIsSending] = React.useState(false);

  /**
   * PART: auth check ready
   * コメント:
   * - 既ログイン判定が終わるまで login UI を出さない
   * - チラつき防止
   */
  const [authChecked, setAuthChecked] = React.useState(false);

  /**
   * PART: sent state
   * コメント:
   * - true になったら入力フォームではなく確認待ち画面を表示する
   */
  const [hasSent, setHasSent] = React.useState(false);

  /**
   * PART: cooldown
   * コメント:
   * - 再送可能になるまでの残り秒数
   */
  const [cooldown, setCooldown] = React.useState(0);

  /**
   * PART: existing session guard
   * コメント:
   * - 既にログイン済みなら /mypage に送る
   * - login タブを後で開いても不要なログイン画面を見せない
   */
  React.useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

        if (!error && data.session) {
            router.replace(getReturnTo());
          return;
        }

      setAuthChecked(true);
    };

    void check();

    return () => {
      mounted = false;
    };
  }, [router]);

  React.useEffect(() => {
    if (cooldown <= 0) return;

    const timer = window.setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  /**
   * PART: send magic link
   * コメント:
   * - 成功後は確認待ち画面へ切り替える
   * - cooldown 中は再送しない
   */
  const sendMagicLink = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;
    if (isSending) return;
    if (cooldown > 0) return;

    setIsSending(true);
    setStatus("送信中…");

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(getReturnTo())}`,
      },
    });

    if (error) {
      setStatus("送信失敗: " + error.message);
      setIsSending(false);
      return;
    }

    setHasSent(true);
    setCooldown(RESEND_COOLDOWN_SEC);
    setStatus("ログイン用メールを送信しました。受信箱をご確認ください。");
    setIsSending(false);
  };

  /**
   * PART: form submit
   * コメント:
   * - Enter / Return で送信
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await sendMagicLink();
  };

  /**
   * PART: edit email
   * コメント:
   * - メールアドレスを修正したい場合に入力画面へ戻す
   */
  const handleEditEmail = () => {
    setHasSent(false);
    setStatus("");
    setCooldown(0);
  };

  const canSubmit = email.trim().length > 0 && !isSending && cooldown === 0;
  const maskedEmail = email.trim();

  /**
   * PART: auth loading
   * コメント:
   * - 既ログイン判定中は何も見せず、チラつきを防ぐ
   */
  if (!authChecked) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
        <div className="rounded-2xl border p-6 text-sm opacity-70">
          確認中…
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="rounded-2xl border p-6">
        <div className="text-lg font-semibold">PARARI</div>

        {!hasSent ? (
          <>
                     <div className="mt-2 space-y-2 text-sm leading-6 opacity-75">
                       <p>
                         PARARIでは、パスワードを使わずにメールアドレスでログインします。
                       </p>
                       <p>
                         入力したメールアドレスにログイン用リンクを送ります。
                         メールアドレスは、あなたの本棚・あとで読む・参加BOOKを保存するために使います。
                       </p>
                       <p>
                         メールアドレスが公開されることはありません。
                       </p>
                     </div>

            <form onSubmit={handleSubmit}>
              <label className="mt-5 block text-xs opacity-70">Email</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
              />

              <button
                type="submit"
                className="mt-4 w-full rounded-xl bg-black px-3 py-2 text-sm text-white disabled:opacity-40"
                disabled={!canSubmit}
              >
                {isSending ? "送信中…" : "ログイン用メールを送る"}
              </button>
            </form>

            <div className="mt-3 text-xs opacity-60">
              ボタンを押すと、ログイン用リンクをメールで送信します。
            </div>

            {status ? <div className="mt-3 text-xs opacity-70">{status}</div> : null}
          </>
        ) : (
          <>
            <div className="mt-2 text-base font-medium">メールを送信しました</div>

            <div className="mt-3 break-all text-sm opacity-80">
              {maskedEmail}
            </div>

             <div className="mt-4 space-y-2 text-sm leading-6 opacity-80">
               <p>
                 受信箱を開いて、ログイン用リンクをクリックしてください。
               </p>
               <p>
                 リンクを開くと、PARARIにログインできます。
                 新しいタブで開くことがあります。
               </p>
               <p>
                 ログイン後は、この画面は閉じても大丈夫です。
               </p>
               <p>
                 見つからない場合は、迷惑メールフォルダもご確認ください。
               </p>
             </div>
            <button
              type="button"
              onClick={sendMagicLink}
              className="mt-5 w-full rounded-xl bg-black px-3 py-2 text-sm text-white disabled:opacity-40"
              disabled={isSending || cooldown > 0}
            >
              {isSending
                ? "再送中…"
                : cooldown > 0
                  ? `再送は ${cooldown} 秒後`
                  : "もう一度送る"}
            </button>

            <button
              type="button"
              onClick={handleEditEmail}
              className="mt-3 w-full rounded-xl border px-3 py-2 text-sm"
              disabled={isSending}
            >
              メールアドレスを修正する
            </button>

            {status ? <div className="mt-3 text-xs opacity-70">{status}</div> : null}
          </>
        )}
      </div>
    </main>
  );
}
