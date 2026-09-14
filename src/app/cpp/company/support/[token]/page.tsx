"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

export default function CppCompanySupportInvitePage() {
  const params = useParams<{ token: string }>();
  const supabase = useMemo(() => sharedSupabase, []);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState<{ company_name: string; access_expires_at: string | null } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => setLoggedIn(Boolean(data.user)));
  }, [supabase]);

  const accept = async () => {
    if (!supabase) return;
    setAccepting(true);
    setErrorMessage("");
    const { data, error } = await supabase.rpc("cpp_accept_company_consultant_invite", { p_token: params.token });
    setAccepting(false);
    if (error) {
      setErrorMessage(`招待を受け取れませんでした: ${humanizeError(error.message)}`);
      return;
    }
    const row = (data ?? [])[0] as { company_name?: string; access_expires_at?: string | null } | undefined;
    setAccepted({ company_name: row?.company_name ?? "担当企業", access_expires_at: row?.access_expires_at ?? null });
  };

  if (loggedIn === null) return <Centered>PARARIのログイン状態を確認しています…</Centered>;

  if (!loggedIn) {
    const returnTo = `/cpp/company/support/${params.token}`;
    return (
      <Centered>
        <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">CPP COMPANY SUPPORT</div>
        <h1 className="mt-2 text-xl font-bold text-neutral-950">企業サポートへの招待</h1>
        <p className="mt-3 text-sm leading-7 text-neutral-600">この招待を受け取るにはPARARIへのログインが必要です。</p>
        <Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="mt-6 inline-block rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white">PARARIにログイン</Link>
      </Centered>
    );
  }

  if (accepted) {
    return (
      <Centered>
        <div className="text-xs font-bold tracking-[0.16em] text-sky-500">INVITATION ACCEPTED</div>
        <h1 className="mt-2 text-xl font-bold text-neutral-950">{accepted.company_name} のサポートに参加しました</h1>
        <p className="mt-3 text-sm leading-7 text-neutral-600">企業担当者と同じCOMPANY WORKBOOKを編集できます。公開状態や企業ownerは変更できません。</p>
        {accepted.access_expires_at ? <div className="mt-4 text-xs font-semibold text-neutral-400">編集期限 {formatDateTime(accepted.access_expires_at)}</div> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/my/cpp/company" className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white">WORKBOOKを開く →</Link>
          <Link href="/my/cpp/consultant" className="rounded-full border border-neutral-300 px-5 py-3 text-sm font-bold text-neutral-700">担当企業一覧</Link>
        </div>
      </Centered>
    );
  }

  return (
    <Centered>
      <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">CPP COMPANY SUPPORT</div>
      <h1 className="mt-2 text-xl font-bold text-neutral-950">企業ページ作成サポートに参加</h1>
      <p className="mt-3 text-sm leading-7 text-neutral-600">招待を受け取ると、招待元企業のCOMPANY WORKBOOKを一定期間共同編集できます。これは企業側支援専用の権限です。</p>
      {errorMessage ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}
      <button type="button" onClick={() => void accept()} disabled={accepting} className="mt-6 rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{accepting ? "受取中…" : "招待を受け取る"}</button>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-neutral-50 px-4 py-16"><div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">{children}</div></main>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function humanizeError(message: string) {
  if (message.includes("expired")) return "この招待リンクは期限切れです。";
  if (message.includes("already used")) return "この招待リンクはすでに使用されています。";
  if (message.includes("revoked")) return "この招待は取り消されています。";
  if (message.includes("not found")) return "招待リンクを確認できませんでした。";
  return message;
}
