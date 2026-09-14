"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type Identity = {
  userId: string;
  email: string;
  username: string;
  displayName: string;
};

type MembershipRow = {
  company_id: string;
  role: "owner" | "editor";
};

type CodeCheckRow = {
  is_valid: boolean;
  company_name_hint: string | null;
  expires_at: string;
};

type CodeState = "idle" | "checking" | "valid" | "invalid";

export default function CppCompanyTryPage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [membership, setMembership] = useState<MembershipRow | null>(null);
  const [invitationCode, setInvitationCode] = useState("");
  const [codeState, setCodeState] = useState<CodeState>("idle");
  const [codeMessage, setCodeMessage] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [agreeTruth, setAgreeTruth] = useState(false);
  const [agreeInvitation, setAgreeInvitation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!supabase) {
        if (active) {
          setErrorMessage("PARARIの接続設定を確認できませんでした。");
          setLoading(false);
        }
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;

      if (authError || !authData.user) {
        setLoading(false);
        return;
      }

      const user = authData.user;
      const [profileResult, memberResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, display_name")
          .eq("user_id", user.id)
          .maybeSingle<{ username: string | null; display_name: string | null }>(),
        supabase
          .from("cpp_company_members")
          .select("company_id, role")
          .eq("user_id", user.id)
          .in("role", ["owner", "editor"])
          .limit(1),
      ]);

      if (!active) return;
      const firstError = profileResult.error || memberResult.error;
      if (firstError) {
        setErrorMessage(`会社登録状況の確認に失敗しました: ${firstError.message}`);
        setLoading(false);
        return;
      }

      const displayName = profileResult.data?.display_name || profileResult.data?.username || "PARARI USER";
      setIdentity({
        userId: user.id,
        email: user.email ?? "",
        username: profileResult.data?.username || "parari-user",
        displayName,
      });
      setMembership(((memberResult.data ?? [])[0] as MembershipRow | undefined) ?? null);
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const checkCode = async () => {
    if (!supabase || !invitationCode.trim()) return;
    setCodeState("checking");
    setCodeMessage("確認しています…");
    setErrorMessage("");

    const { data, error } = await supabase.rpc("cpp_check_company_registration_code", {
      p_code: invitationCode.trim(),
    });

    if (error) {
      setCodeState("invalid");
      setCodeMessage("招待コードを確認できませんでした。");
      return;
    }

    const row = ((data ?? [])[0] as CodeCheckRow | undefined) ?? null;
    if (!row?.is_valid) {
      setCodeState("invalid");
      setCodeMessage("この招待コードは無効・期限切れ・使用済みのいずれかです。");
      return;
    }

    setCodeState("valid");
    setCodeMessage(`有効な招待コードです。有効期限: ${formatDate(row.expires_at)}`);
    if (!companyName.trim() && row.company_name_hint) setCompanyName(row.company_name_hint);
  };

  const register = async () => {
    if (!supabase || !identity || saving) return;
    const name = companyName.trim();
    const code = invitationCode.trim();
    if (!name || !code || !agreeTruth || !agreeInvitation) return;

    setSaving(true);
    setErrorMessage("");

    const { data, error } = await supabase.rpc("cpp_register_company_with_code", {
      p_code: code,
      p_company_name: name,
    });

    setSaving(false);
    if (error || !data) {
      setErrorMessage(
        error?.message?.includes("Invalid, expired, or already used")
          ? "招待コードが無効、期限切れ、または使用済みです。CPPから発行されたコードをご確認ください。"
          : `企業・団体登録に失敗しました: ${error?.message ?? "unknown error"}`,
      );
      setCodeState("invalid");
      return;
    }

    setMembership({ company_id: data as string, role: "owner" });
  };

  if (loading) return <CenteredCard>PARARIのログイン状態を確認しています…</CenteredCard>;

  if (!identity) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-16">
        <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <div className="text-xs font-bold tracking-[0.2em] text-neutral-400">CPP COMPANY</div>
          <h1 className="mt-3 text-2xl font-bold text-neutral-950">企業・団体登録</h1>
          <p className="mt-4 text-sm leading-7 text-neutral-600">
            CPPの企業・団体登録には、CPPから発行された招待コードとPARARIアカウントが必要です。
          </p>
          <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            招待コードをお持ちでない場合は、先にCPPから案内を受けてください。
          </div>
          <Link href="/login?returnTo=/cpp/company/try" className="mt-7 inline-block rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white">
            PARARIにログインして続ける
          </Link>
          <div className="mt-5">
            <Link href="/cpp" className="text-xs font-semibold text-neutral-500 hover:text-neutral-900">← CPP登録入口へ</Link>
          </div>
        </div>
      </main>
    );
  }

  if (membership) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <Header identity={identity} />
          <section className="rounded-[2rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-9">
            <div className="text-xs font-bold tracking-[0.18em] text-emerald-700">CPP COMPANY</div>
            <h1 className="mt-3 text-2xl font-bold text-neutral-950">企業ページがあります</h1>
            <p className="mt-3 text-sm leading-7 text-neutral-600">
              COMPANY WORKBOOKで、会社情報、研究・技術、求める研究者像、募集情報を編集できます。
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/my/cpp/company" className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white">
                COMPANY WORKBOOKを開く
              </Link>
              <Link href="/my/cpp/company/preview" className="rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-bold text-neutral-800">
                掲載プレビューを見る
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <Header identity={identity} />

        <section className="rounded-[2rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-9">
          <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">CPP COMPANY REGISTRATION</div>
          <h1 className="mt-3 text-2xl font-bold text-neutral-950">企業・団体を登録</h1>
          <p className="mt-3 text-sm leading-7 text-neutral-600">
            CPPから発行された招待コードを入力してください。コードは1回限り有効です。
          </p>

          {errorMessage ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
          ) : null}

          <div className="mt-7 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-neutral-600">CPP招待コード</span>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={invitationCode}
                  onChange={(event) => {
                    setInvitationCode(event.target.value.toUpperCase());
                    setCodeState("idle");
                    setCodeMessage("");
                  }}
                  className={`${inputClassName} font-mono tracking-wider`}
                  placeholder="CPP-XXXX-XXXX"
                  autoCapitalize="characters"
                />
                <button
                  type="button"
                  onClick={() => void checkCode()}
                  disabled={!invitationCode.trim() || codeState === "checking"}
                  className="shrink-0 rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-sm font-bold text-neutral-800 disabled:opacity-40"
                >
                  コードを確認
                </button>
              </div>
              {codeMessage ? (
                <div className={`mt-2 text-xs font-semibold ${codeState === "valid" ? "text-emerald-700" : codeState === "invalid" ? "text-red-600" : "text-neutral-500"}`}>
                  {codeMessage}
                </div>
              ) : null}
            </label>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-neutral-600">会社・団体名</span>
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className={inputClassName}
                placeholder="例）株式会社〇〇研究所"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-neutral-600">担当者</span>
              <input value={identity.displayName} disabled className={`${inputClassName} bg-neutral-50 text-neutral-500`} />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-neutral-600">PARARIメールアドレス</span>
              <input value={identity.email} disabled className={`${inputClassName} bg-neutral-50 text-neutral-500`} />
            </label>
          </div>

          <div className="mt-7 space-y-3 rounded-2xl bg-neutral-50 p-5 text-sm text-neutral-700">
            <Check checked={agreeTruth} onChange={setAgreeTruth}>会社・団体名を含め、虚偽の情報を掲載しません。</Check>
            <Check checked={agreeInvitation} onChange={setAgreeInvitation}>CPPから案内を受けた企業・団体の担当者として登録します。</Check>
          </div>

          <button
            type="button"
            onClick={() => void register()}
            disabled={!companyName.trim() || !invitationCode.trim() || !agreeTruth || !agreeInvitation || saving}
            className="mt-7 rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            {saving ? "登録しています…" : "企業・団体を登録する"}
          </button>
        </section>
      </div>
    </main>
  );
}

function Header({ identity }: { identity: Identity }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <div>
        <div className="text-xs font-bold tracking-[0.2em] text-neutral-400">CPP × PARARI</div>
        <div className="mt-1 text-sm font-semibold text-neutral-700">
          {identity.displayName} <span className="font-normal text-neutral-400">@{identity.username}</span>
        </div>
      </div>
      <Link href="/cpp" className="text-xs font-semibold text-neutral-500 hover:text-neutral-900">CPP登録入口へ</Link>
    </div>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1" />
      <span>{children}</span>
    </label>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">{children}</div>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric" }).format(new Date(value));
}

const inputClassName = "w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600";
