"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type ParariIdentity = {
  userId: string;
  email: string;
  username: string;
  displayName: string;
};

export default function CppTryPage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [identity, setIdentity] = useState<ParariIdentity | null>(null);
  const [registered, setRegistered] = useState(false);
  const [name, setName] = useState("");
  const [agreeTruth, setAgreeTruth] = useState(false);
  const [agreePublic, setAgreePublic] = useState(false);
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
      const [profileResult, cppResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, display_name")
          .eq("user_id", user.id)
          .maybeSingle<{ username: string | null; display_name: string | null }>(),
        supabase
          .from("cpp_profiles")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle<{ user_id: string }>(),
      ]);

      if (!active) return;

      if (profileResult.error || cppResult.error) {
        setErrorMessage(
          `登録状況の確認に失敗しました: ${(profileResult.error || cppResult.error)?.message ?? "unknown error"}`,
        );
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
      setName(displayName);
      setRegistered(Boolean(cppResult.data));
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const register = async () => {
    if (!supabase || !identity || saving) return;
    const publicName = name.trim();
    if (!publicName || !agreeTruth || !agreePublic) return;

    setSaving(true);
    setErrorMessage("");

    const { error: profileError } = await supabase.from("cpp_profiles").insert({
      user_id: identity.userId,
      public_name: publicName,
      visibility: "draft",
    });

    if (profileError && profileError.code !== "23505") {
      setSaving(false);
      setErrorMessage(`CPP研究者登録に失敗しました: ${profileError.message}`);
      return;
    }

    const { data: existingContact } = await supabase
      .from("cpp_private_contacts")
      .select("user_id, email")
      .eq("user_id", identity.userId)
      .maybeSingle<{ user_id: string; email: string | null }>();

    if (!existingContact) {
      const { error: contactError } = await supabase.from("cpp_private_contacts").insert({
        user_id: identity.userId,
        email: identity.email || null,
      });
      if (contactError) {
        setSaving(false);
        setErrorMessage(`連絡先の初期登録に失敗しました: ${contactError.message}`);
        return;
      }
    } else if (!existingContact.email && identity.email) {
      await supabase
        .from("cpp_private_contacts")
        .update({ email: identity.email })
        .eq("user_id", identity.userId);
    }

    setRegistered(true);
    setSaving(false);
  };

  if (loading) {
    return <CenteredCard>PARARIのログイン状態を確認しています…</CenteredCard>;
  }

  if (!identity) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-16">
        <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <div className="text-xs font-bold tracking-[0.2em] text-neutral-400">CPP × PARARI</div>
          <h1 className="mt-3 text-2xl font-bold text-neutral-950">CPP研究者登録</h1>
          <p className="mt-4 text-sm leading-7 text-neutral-600">
            CPPはPARARIアカウントを使います。すでにPARARIを利用している方は、そのまま同じアカウントで登録できます。
          </p>
          <Link
            href="/login?returnTo=/cpp/try"
            className="mt-7 inline-block rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white"
          >
            PARARIにログインして続ける
          </Link>
        </div>
      </main>
    );
  }

  if (registered) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <TrialHeader identity={identity} />
          <section className="rounded-[2rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-9">
            <div className="text-xs font-bold tracking-[0.18em] text-emerald-700">CPP RESEARCHER</div>
            <h1 className="mt-3 text-2xl font-bold text-neutral-950">CPP研究者プロフィールがあります</h1>
            <p className="mt-3 text-sm leading-7 text-neutral-600">
              ここから入力を続けるか、現在の内容を「企業から見た画面」で確認できます。入力内容は本物のCPPデータとして保存されています。
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/cpp/try/workbook" className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white">
                CPP WORKBOOKを開く
              </Link>
              <Link href="/my/cpp/preview" className="rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-bold text-neutral-800">
                企業から見る
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
        <TrialHeader identity={identity} />

        <section className="rounded-[2rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-9">
          <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">CPP REGISTRATION</div>
          <h1 className="mt-3 text-2xl font-bold text-neutral-950">CPP研究者として登録</h1>
          <p className="mt-3 text-sm leading-7 text-neutral-600">
            登録後、CPP WORKBOOKで研究内容や経歴を少しずつ作成できます。今日入力した内容はそのまま保存され、正式公開するときにも引き継がれます。
          </p>

          {errorMessage ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-neutral-600">氏名</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClassName}
                placeholder="氏名"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-neutral-600">PARARIメールアドレス</span>
              <input value={identity.email} disabled className={`${inputClassName} bg-neutral-50 text-neutral-500`} />
            </label>
          </div>

          <div className="mt-7 space-y-3 rounded-2xl bg-neutral-50 p-5 text-sm text-neutral-700">
            <Check checked={agreeTruth} onChange={setAgreeTruth}>
              登録内容に虚偽の情報を記載しません。
            </Check>
            <Check checked={agreePublic} onChange={setAgreePublic}>
              公開した項目は企業・一般の閲覧者から見えることを理解しています。メールアドレス・電話番号・住所など、非公開と表示された情報は一般には公開されません。
            </Check>
          </div>

          <button
            type="button"
            onClick={() => void register()}
            disabled={!name.trim() || !agreeTruth || !agreePublic || saving}
            className="mt-7 rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            {saving ? "登録しています…" : "CPP研究者として登録する"}
          </button>
        </section>
      </div>
    </main>
  );
}

function TrialHeader({ identity }: { identity: ParariIdentity }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-1">
      <div>
        <div className="text-xs font-bold tracking-[0.2em] text-neutral-400">CPP × PARARI</div>
        <div className="mt-1 text-sm font-semibold text-neutral-700">
          {identity.displayName} <span className="font-normal text-neutral-400">@{identity.username}</span>
        </div>
      </div>
      <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
        STAFF PREVIEW
      </span>
    </header>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1" />
      <span className="leading-6">{children}</span>
    </label>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">
        {children}
      </div>
    </main>
  );
}

const inputClassName =
  "w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600";
