"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type InviteRow = {
  invite_id: string;
  code_last4: string;
  company_name_hint: string | null;
  note: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  used_by_user_id: string | null;
  company_id: string | null;
};

type CreatedInvite = {
  invite_id: string;
  registration_code: string;
  expires_at: string;
};

export default function CppCompanyCodeAdminPage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [note, setNote] = useState("");
  const [validDays, setValidDays] = useState(30);
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(true);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setErrorMessage("");

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc("cpp_list_company_registration_codes");
    if (error) {
      setAuthorized(false);
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setAuthorized(true);
    setRows((data ?? []) as InviteRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const createCode = async () => {
    if (!supabase || saving) return;
    setSaving(true);
    setCreated(null);
    setMessage("");
    setErrorMessage("");

    const { data, error } = await supabase.rpc("cpp_create_company_registration_code", {
      p_company_name_hint: companyName.trim() || null,
      p_valid_days: validDays,
      p_note: note.trim() || null,
    });

    setSaving(false);
    if (error) {
      setErrorMessage(`招待コードを発行できませんでした: ${error.message}`);
      return;
    }

    const row = ((data ?? [])[0] as CreatedInvite | undefined) ?? null;
    if (!row) {
      setErrorMessage("招待コードを発行できませんでした。");
      return;
    }

    setCreated(row);
    setCompanyName("");
    setNote("");
    setMessage("招待コードを発行しました。企業担当者へ安全な方法でお知らせください。");
    await load();
  };

  const revoke = async (inviteId: string) => {
    if (!supabase) return;
    setErrorMessage("");
    const { error } = await supabase.rpc("cpp_revoke_company_registration_code", { p_invite_id: inviteId });
    if (error) {
      setErrorMessage(`招待コードを取り消せませんでした: ${error.message}`);
      return;
    }
    await load();
  };

  const copyCode = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.registration_code);
      setMessage("招待コードをコピーしました。");
    } catch {
      setMessage("招待コードを選択してコピーしてください。");
    }
  };

  if (loading) return <CenteredCard>CPP企業招待コードを読み込んでいます…</CenteredCard>;

  if (!authorized) {
    return (
      <CenteredCard>
        <div className="font-bold text-neutral-900">CPPスタッフ専用ページです。</div>
        <p className="mt-3 text-sm leading-6">企業招待コードを発行する権限がありません。</p>
        <Link href="/cpp" className="mt-5 inline-block text-sm font-bold underline underline-offset-4">CPP入口へ戻る</Link>
      </CenteredCard>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4 rounded-[2rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-9">
          <div>
            <div className="text-xs font-black tracking-[0.18em] text-neutral-400">CPP STAFF</div>
            <h1 className="mt-3 text-3xl font-black text-neutral-950">企業招待コード</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600">
              CPPへの企業・団体登録は、ここで発行したコードを持つ担当者だけが行えます。コードは1回使用すると無効になります。
            </p>
          </div>
          <Link href="/cpp" className="text-xs font-bold text-neutral-500 hover:text-neutral-900">CPP入口へ</Link>
        </header>

        {errorMessage ? <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{errorMessage}</div> : null}
        {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">{message}</div> : null}

        <section className="rounded-[2rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-9">
          <h2 className="text-xl font-black text-neutral-950">新しいコードを発行</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-neutral-600">会社・団体名（管理用メモ）</span>
              <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className={inputClassName} placeholder="例）株式会社〇〇研究所" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-neutral-600">有効期間</span>
              <select value={validDays} onChange={(event) => setValidDays(Number(event.target.value))} className={inputClassName}>
                <option value={7}>7日</option>
                <option value={14}>14日</option>
                <option value={30}>30日</option>
                <option value={60}>60日</option>
                <option value={90}>90日</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-xs font-bold text-neutral-600">メモ（任意）</span>
              <input value={note} onChange={(event) => setNote(event.target.value)} className={inputClassName} placeholder="担当者名、案内日など" />
            </label>
          </div>
          <button type="button" onClick={() => void createCode()} disabled={saving} className="mt-6 rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white disabled:opacity-40">
            {saving ? "発行しています…" : "招待コードを発行する"}
          </button>

          {created ? (
            <div className="mt-7 rounded-[1.75rem] border-2 border-neutral-900 bg-neutral-50 p-6">
              <div className="text-xs font-black tracking-[0.16em] text-neutral-500">NEW INVITATION CODE</div>
              <div className="mt-3 break-all font-mono text-3xl font-black tracking-[0.12em] text-neutral-950">{created.registration_code}</div>
              <div className="mt-2 text-xs text-neutral-500">有効期限 {formatDateTime(created.expires_at)}</div>
              <p className="mt-4 text-xs leading-6 text-neutral-600">安全のため、完全なコードは発行時だけ表示します。必要な場所へ今コピーしてください。</p>
              <button type="button" onClick={() => void copyCode()} className="mt-4 rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-neutral-800">コードをコピー</button>
            </div>
          ) : null}
        </section>

        <section className="rounded-[2rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black text-neutral-950">発行履歴</h2>
            <button type="button" onClick={() => void load()} className="text-xs font-bold text-neutral-500 underline underline-offset-4">再読込</button>
          </div>
          <div className="mt-6 space-y-3">
            {rows.length === 0 ? <div className="rounded-2xl bg-neutral-50 p-5 text-sm text-neutral-500">まだ招待コードはありません。</div> : null}
            {rows.map((row) => {
              const status = getStatus(row);
              return (
                <div key={row.invite_id} className="rounded-2xl border border-neutral-200 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="font-bold text-neutral-950">{row.company_name_hint || "会社名未指定"}</div>
                      <div className="mt-1 text-xs text-neutral-500">コード末尾 ****-{row.code_last4} · 発行 {formatDateTime(row.created_at)}</div>
                      {row.note ? <div className="mt-2 text-sm text-neutral-600">{row.note}</div> : null}
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${status.className}`}>{status.label}</span>
                  </div>
                  <div className="mt-3 text-xs text-neutral-500">有効期限 {formatDateTime(row.expires_at)}</div>
                  {status.key === "active" ? (
                    <button type="button" onClick={() => void revoke(row.invite_id)} className="mt-4 text-xs font-bold text-red-600 underline underline-offset-4">このコードを取り消す</button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function getStatus(row: InviteRow) {
  if (row.used_at) return { key: "used", label: "使用済み", className: "bg-emerald-100 text-emerald-800" };
  if (row.revoked_at) return { key: "revoked", label: "取消済み", className: "bg-red-100 text-red-700" };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { key: "expired", label: "期限切れ", className: "bg-neutral-200 text-neutral-600" };
  return { key: "active", label: "有効", className: "bg-amber-100 text-amber-900" };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-neutral-600 shadow-sm">{children}</div>
    </main>
  );
}

const inputClassName = "w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600";
