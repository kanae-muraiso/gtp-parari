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

type CreatorCompanyRow = {
  id: string;
};

export default function CppCompanyTryPage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [membership, setMembership] = useState<MembershipRow | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [agreeTruth, setAgreeTruth] = useState(false);
  const [agreeReview, setAgreeReview] = useState(false);
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
      const [profileResult, memberResult, ownCompanyResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, display_name")
          .eq("user_id", user.id)
          .maybeSingle<{ username: string | null; display_name: string | null }>(),
        supabase
          .from("cpp_company_members")
          .select("company_id, role")
          .eq("user_id", user.id)
          .limit(1),
        supabase
          .from("cpp_companies")
          .select("id")
          .eq("created_by_user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1),
      ]);

      if (!active) return;
      const firstError = profileResult.error || memberResult.error || ownCompanyResult.error;
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

      let currentMembership = ((memberResult.data ?? [])[0] as MembershipRow | undefined) ?? null;

      // A company row can survive if the creator/member insert fails midway.
      // Repair that partial registration instead of creating a duplicate company.
      if (!currentMembership) {
        const ownCompany = ((ownCompanyResult.data ?? [])[0] as CreatorCompanyRow | undefined) ?? null;
        if (ownCompany) {
          const { error: repairError } = await supabase
            .from("cpp_company_members")
            .upsert(
              {
                company_id: ownCompany.id,
                user_id: user.id,
                role: "owner",
              },
              { onConflict: "company_id,user_id" },
            );

          if (!active) return;
          if (repairError) {
            setErrorMessage(`会社担当者情報の復旧に失敗しました: ${repairError.message}`);
            setLoading(false);
            return;
          }

          currentMembership = { company_id: ownCompany.id, role: "owner" };
        }
      }

      setMembership(currentMembership);
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const register = async () => {
    if (!supabase || !identity || saving) return;
    const name = companyName.trim();
    if (!name || !agreeTruth || !agreeReview) return;

    setSaving(true);
    setErrorMessage("");

    const { data: company, error: companyError } = await supabase
      .from("cpp_companies")
      .insert({
        created_by_user_id: identity.userId,
        name,
        visibility: "draft",
      })
      .select("id")
      .single<{ id: string }>();

    if (companyError || !company) {
      setSaving(false);
      setErrorMessage(`会社登録に失敗しました: ${companyError?.message ?? "unknown error"}`);
      return;
    }

    const { error: memberError } = await supabase.from("cpp_company_members").insert({
      company_id: company.id,
      user_id: identity.userId,
      role: "owner",
    });

    if (memberError) {
      // Avoid leaving an orphan company when the second half of registration fails.
      await supabase.from("cpp_companies").delete().eq("id", company.id);
      setSaving(false);
      setErrorMessage(`会社担当者の登録に失敗しました: ${memberError.message}`);
      return;
    }

    setMembership({ company_id: company.id, role: "owner" });
    setSaving(false);
  };

  if (loading) {
    return <CenteredCard>PARARIのログイン状態を確認しています…</CenteredCard>;
  }

  if (!identity) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-16">
        <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <div className="text-xs font-bold tracking-[0.2em] text-neutral-400">CPP COMPANY</div>
          <h1 className="mt-3 text-2xl font-bold text-neutral-950">企業・団体登録</h1>
          <p className="mt-4 text-sm leading-7 text-neutral-600">
            CPPの企業ページはPARARIアカウントで管理します。すでにPARARIを利用している方は、そのアカウントで続けられます。
          </p>
          <Link href="/login?returnTo=/cpp/company/try" className="mt-7 inline-block rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white">
            PARARIにログインして続ける
          </Link>
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
              会社案内を編集し、募集要項を複数掲載できます。現在はスタッフ確認用で、入力内容は本物のDBに保存されます。
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/my/cpp/company" className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white">
                会社案内・募集要項を編集
              </Link>
              <Link href="/my/cpp/company/preview" className="rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-bold text-neutral-800">
                掲載イメージを見る
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
            登録後、会社案内と募集要項を作成できます。入力した内容は保存され、正式公開時にもそのまま使えます。
          </p>

          {errorMessage ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
          ) : null}

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
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
            <Check checked={agreeReview} onChange={setAgreeReview}>現在は確認期間中で、一般公開にはCPP側の確認を追加する予定であることを理解しました。</Check>
          </div>

          <button
            type="button"
            onClick={() => void register()}
            disabled={!companyName.trim() || !agreeTruth || !agreeReview || saving}
            className="mt-7 rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white disabled:opacity-40"
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
      <Link href="/cpp/try" className="text-xs font-semibold text-neutral-500 hover:text-neutral-900">研究者側を見る</Link>
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

const inputClassName = "w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600";
