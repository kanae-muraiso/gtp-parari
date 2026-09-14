"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import CppProfileBasicsEditor from "@/components/parari/cpp/CppProfileBasicsEditor";
import CppHistoryEditor from "@/components/parari/cpp/CppHistoryEditor";

type Identity = {
  userId: string;
  email: string | null;
  username: string;
  displayName: string;
};

export default function CppStaffWorkbookPage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
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
      const firstError = profileResult.error || cppResult.error;
      if (firstError) {
        setErrorMessage(`CPP WORKBOOKの準備に失敗しました: ${firstError.message}`);
        setLoading(false);
        return;
      }

      setIdentity({
        userId: user.id,
        email: user.email ?? null,
        username: profileResult.data?.username || "parari-user",
        displayName: profileResult.data?.display_name || profileResult.data?.username || "PARARI USER",
      });
      setHasProfile(Boolean(cppResult.data));
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  if (loading) {
    return <CenteredCard>CPP WORKBOOKを読み込んでいます…</CenteredCard>;
  }

  if (!identity) {
    return (
      <CenteredCard>
        <div>PARARIへのログインが必要です。</div>
        <Link href="/login?returnTo=/cpp/try/workbook" className="mt-5 inline-block rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white">
          PARARIにログイン
        </Link>
      </CenteredCard>
    );
  }

  if (!hasProfile) {
    return (
      <CenteredCard>
        <div>先にCPP研究者登録を行ってください。</div>
        <Link href="/cpp/try" className="mt-5 inline-block rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white">
          CPP研究者登録へ
        </Link>
      </CenteredCard>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold tracking-[0.2em] text-neutral-400">CPP × PARARI</div>
            <div className="mt-1 text-sm font-semibold text-neutral-700">
              {identity.displayName} <span className="font-normal text-neutral-400">@{identity.username}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/cpp/try" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700">
              登録入口
            </Link>
            <Link href="/my/cpp/preview" className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white">
              企業から見る →
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-6 max-w-3xl">
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
            <div className="text-xs font-bold tracking-[0.16em] text-emerald-700">STAFF TRIAL</div>
            <h1 className="mt-2 text-2xl font-bold text-neutral-950">CPP WORKBOOK</h1>
            <p className="mt-2 text-sm leading-7 text-neutral-700">
              ここで入力した内容は本物のCPPデータとして保存されます。後日の正式公開にもそのまま使えます。ただし、このスタッフ体験画面からプロフィールを公開することはできません。
            </p>
          </section>

          {errorMessage ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
          ) : null}

          <div className="mt-5 space-y-5">
            <CppProfileBasicsEditor userId={identity.userId} userEmail={identity.email} />
            <CppHistoryEditor userId={identity.userId} />

            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-neutral-950">企業表示を確認</h2>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">保存した内容を、企業側のプロフィール画面として確認できます。</p>
                </div>
                <Link href="/my/cpp/preview" className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">
                  企業から見る
                </Link>
              </div>
            </section>

            <div className="pb-10 text-center text-xs text-neutral-400">CPP WORKBOOK · STAFF TRIAL</div>
          </div>
        </div>
      </div>
    </main>
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
