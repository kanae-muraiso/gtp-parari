"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type ConsultantRow = {
  user_id: string;
  display_name: string;
  access_expires_at: string | null;
  created_at: string;
};

type InviteRow = {
  token: string;
  access_days: number;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

export default function CppCompanySupportPage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [consultants, setConsultants] = useState<ConsultantRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [accessDays, setAccessDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setErrorMessage("");

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setLoading(false);
      return;
    }

    const { data: memberRows, error: memberError } = await supabase
      .from("cpp_company_members")
      .select("company_id, role")
      .eq("user_id", authData.user.id)
      .eq("role", "owner")
      .limit(1);

    if (memberError) {
      setErrorMessage(memberError.message);
      setLoading(false);
      return;
    }

    const id = (memberRows ?? [])[0]?.company_id as string | undefined;
    if (!id) {
      setLoading(false);
      return;
    }
    setCompanyId(id);

    const [companyResult, consultantResult, inviteResult] = await Promise.all([
      supabase.from("cpp_companies").select("name").eq("id", id).single<{ name: string }>(),
      supabase.rpc("cpp_list_company_consultants", { p_company_id: id }),
      supabase
        .from("cpp_company_consultant_invites")
        .select("token, access_days, expires_at, accepted_at, revoked_at")
        .eq("company_id", id)
        .order("created_at", { ascending: false }),
    ]);

    const firstError = companyResult.error || consultantResult.error || inviteResult.error;
    if (firstError) {
      setErrorMessage(`サポート情報の取得に失敗しました: ${firstError.message}`);
      setLoading(false);
      return;
    }

    setCompanyName(companyResult.data.name);
    setConsultants((consultantResult.data ?? []) as ConsultantRow[]);
    setInvites((inviteResult.data ?? []) as InviteRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const createInvite = async () => {
    if (!supabase || !companyId) return;
    setCreating(true);
    setMessage("");
    setErrorMessage("");
    const { error } = await supabase.rpc("cpp_create_company_consultant_invite", {
      p_company_id: companyId,
      p_access_days: accessDays,
    });
    setCreating(false);
    if (error) {
      setErrorMessage(`招待リンクを作れませんでした: ${error.message}`);
      return;
    }
    setMessage("コンサルタント用の招待リンクを作成しました。");
    await load();
  };

  const revoke = async (userId: string) => {
    if (!supabase || !companyId) return;
    if (!window.confirm("このコンサルタントの編集アクセスを終了しますか？")) return;
    const { error } = await supabase.rpc("cpp_revoke_company_consultant", {
      p_company_id: companyId,
      p_user_id: userId,
    });
    if (error) {
      setErrorMessage(`アクセス終了に失敗しました: ${error.message}`);
      return;
    }
    setMessage("コンサルタントのアクセスを終了しました。");
    await load();
  };

  const inviteUrl = (token: string) => typeof window === "undefined" ? "" : `${window.location.origin}/cpp/company/support/${token}`;

  if (loading) return <Centered>コンサルタント設定を読み込んでいます…</Centered>;

  if (!companyId) {
    return (
      <Centered>
        <div className="font-bold text-neutral-900">この画面は企業のowner専用です。</div>
        <p className="mt-2 text-sm leading-6 text-neutral-500">CPP COMPANY サポーターの方は担当企業一覧からWORKBOOKへ入ってください。</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/my/cpp/consultant" className="rounded-full bg-neutral-900 px-5 py-3 font-bold text-white">担当企業一覧</Link>
          <Link href="/my/cpp/company" className="rounded-full border border-neutral-300 px-5 py-3 font-bold text-neutral-700">WORKBOOK</Link>
        </div>
      </Centered>
    );
  }

  const usableInvites = invites.filter((row) => !row.accepted_at && !row.revoked_at && new Date(row.expires_at).getTime() > Date.now());

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">CPP COMPANY SUPPORT</div>
            <h1 className="mt-1 text-2xl font-bold text-neutral-950">コンサルタントと一緒に作る</h1>
            <p className="mt-2 text-sm leading-7 text-neutral-600">{companyName} のCOMPANY WORKBOOKに、企業側サポーターを期間限定で招待できます。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/my/cpp/company" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700">← WORKBOOK</Link>
            <Link href="/my/cpp/company/preview" className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white">プレビュー →</Link>
          </div>
        </header>

        {errorMessage ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}
        {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}

        <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-neutral-950">招待リンクを作る</h2>
          <p className="mt-2 text-sm leading-7 text-neutral-600">招待された人はPARARIにログインして受け取ります。企業情報・研究技術・ポジション・募集・資料・ページ構成を一緒に編集できます。公開状態や企業ownerは変更できません。</p>
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="text-xs font-bold text-neutral-600">
              編集できる期間
              <select value={accessDays} onChange={(event) => setAccessDays(Number(event.target.value))} className="mt-2 block rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800">
                <option value={1}>1日</option>
                <option value={7}>7日</option>
                <option value={14}>14日</option>
                <option value={30}>30日</option>
              </select>
            </label>
            <button type="button" onClick={() => void createInvite()} disabled={creating} className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{creating ? "作成中…" : "コンサルタントを招待"}</button>
          </div>

          {usableInvites.length > 0 ? (
            <div className="mt-6 space-y-3 border-t border-neutral-100 pt-6">
              <div className="text-xs font-bold tracking-[0.14em] text-neutral-400">未使用の招待リンク</div>
              {usableInvites.map((row) => {
                const url = inviteUrl(row.token);
                return (
                  <div key={row.token} className="rounded-2xl bg-neutral-50 p-4">
                    <div className="break-all text-xs leading-6 text-neutral-600">{url}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button type="button" onClick={() => void navigator.clipboard.writeText(url).then(() => setMessage("招待リンクをコピーしました。"))} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700">リンクをコピー</button>
                      <span className="text-xs text-neutral-400">受取後 {row.access_days}日間編集可 · 招待期限 {formatDateTime(row.expires_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>

        <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-neutral-950">現在アクセスできるコンサルタント</h2>
          {consultants.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-400">現在、外部サポーターは入っていません。</p>
          ) : (
            <div className="mt-5 space-y-3">
              {consultants.map((row) => (
                <div key={row.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 p-4">
                  <div>
                    <div className="font-bold text-neutral-900">{row.display_name}</div>
                    <div className="mt-1 text-xs text-neutral-400">編集期限 {row.access_expires_at ? formatDateTime(row.access_expires_at) : "設定なし"}</div>
                  </div>
                  <button type="button" onClick={() => void revoke(row.user_id)} className="rounded-full border border-red-200 px-4 py-2 text-xs font-bold text-red-600">アクセス終了</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] bg-neutral-900 p-6 text-white sm:p-8">
          <div className="text-xs font-bold tracking-[0.14em] text-neutral-400">ROLE SEPARATION</div>
          <p className="mt-3 text-sm leading-7 text-neutral-200">ここで招待するのは企業側のCPP COMPANY サポーターです。研究者側のWORKBOOKへの権限は付与しません。同じ採用市場の両側を同じ権限で見る構造にはしていません。</p>
        </section>
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-neutral-50 px-4 py-16"><div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">{children}</div></main>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
