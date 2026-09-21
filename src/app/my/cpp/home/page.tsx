"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CppSectionNav from "@/components/parari/cpp/CppSectionNav";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type AccessState = {
  displayName: string;
  hasResearcherProfile: boolean;
  hasCompanyProfile: boolean;
  admitted: boolean;
};

export default function CppHomePage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [access, setAccess] = useState<AccessState | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!supabase) {
        setErrorMessage("PARARIの接続設定を確認できませんでした。");
        setLoggedIn(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) {
        setLoggedIn(false);
        return;
      }

      setLoggedIn(true);
      const user = authData.user;
      const [profileResult, researcherResult, companyResult, contextResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, username")
          .eq("user_id", user.id)
          .maybeSingle<{ display_name: string | null; username: string | null }>(),
        supabase
          .from("cpp_profiles")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle<{ user_id: string }>(),
        supabase
          .from("cpp_company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .in("role", ["owner", "editor", "consultant"])
          .limit(1),
        supabase.rpc("cpp_matching_context"),
      ]);

      if (!active) return;
      const firstError =
        profileResult.error || researcherResult.error || companyResult.error;
      if (firstError) {
        setErrorMessage(`CPPの登録状況を確認できませんでした: ${firstError.message}`);
        return;
      }

      setAccess({
        displayName:
          profileResult.data?.display_name ||
          profileResult.data?.username ||
          user.email ||
          "PARARI USER",
        hasResearcherProfile: Boolean(researcherResult.data),
        hasCompanyProfile: Boolean((companyResult.data ?? []).length),
        admitted: !contextResult.error && Boolean((contextResult.data ?? []).length),
      });
    };

    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  if (loggedIn === null) {
    return <CenteredCard>CPPホームを読み込んでいます…</CenteredCard>;
  }

  if (!loggedIn) {
    return (
      <>
        <CppSectionNav active="home" />
        <CenteredCard>
          <h1 className="text-2xl font-black text-neutral-950">CPPに入室</h1>
          <p className="mt-3 text-sm leading-7 text-neutral-600">
            CPPに登録したPARARIアカウントでログインしてください。
          </p>
          <Link
            href="/login?returnTo=/my/cpp/home"
            className="mt-6 inline-flex rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white"
          >
            ログインして入室する
          </Link>
          <div className="mt-4">
            <Link href="/cpp" className="text-xs font-bold text-neutral-500 hover:text-neutral-950">
              研究者・企業登録はこちら
            </Link>
          </div>
        </CenteredCard>
      </>
    );
  }

  if (errorMessage || !access) {
    return (
      <>
        <CppSectionNav active="home" />
        <CenteredCard>{errorMessage || "CPPの登録状況を確認しています…"}</CenteredCard>
      </>
    );
  }

  const registered = access.hasResearcherProfile || access.hasCompanyProfile;

  return (
    <>
      <CppSectionNav active="home" />
      <main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <header className="rounded-[2.25rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-10">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="text-xs font-black tracking-[0.2em] text-neutral-400">CPP HOME</div>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950 sm:text-4xl">
                  {access.displayName}さんのCPP
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-600">
                  お知らせの確認、プロフィールの編集、参加メンバーの閲覧、CPP LIVEへの参加をここから行えます。
                </p>
              </div>
              <span
                className={`rounded-full px-4 py-2 text-xs font-black ${
                  access.admitted
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {access.admitted ? "入室済み" : registered ? "入室準備中" : "未登録"}
              </span>
            </div>

            {!registered ? (
              <div className="mt-7 rounded-2xl bg-amber-50 p-5 text-sm leading-7 text-amber-950">
                <div className="font-bold">CPPへの登録がまだ完了していません。</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/cpp/try" className="rounded-full bg-neutral-950 px-5 py-2.5 text-xs font-bold text-white">
                    研究者登録
                  </Link>
                  <Link href="/cpp/company/try" className="rounded-full border border-amber-300 bg-white px-5 py-2.5 text-xs font-bold text-amber-950">
                    企業登録
                  </Link>
                </div>
              </div>
            ) : !access.admitted ? (
              <div className="mt-7 rounded-2xl bg-amber-50 p-5 text-sm leading-7 text-amber-950">
                登録内容を準備できます。閲覧とCPP LIVEは、CPP-RまたはCPP-Cの入室許可後に利用できます。
              </div>
            ) : null}
          </header>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <HomeCard href="/my/cpp/announcements" eyebrow="NEWS" title="お知らせ">
              CPPからの連絡や開催情報を確認します。
            </HomeCard>

            {access.hasResearcherProfile ? (
              <HomeCard href="/my/cpp" eyebrow="RESEARCHER" title="研究者プロフィール">
                研究内容、経歴、研究成果を編集・公開します。
              </HomeCard>
            ) : null}

            {access.hasCompanyProfile ? (
              <HomeCard href="/my/cpp/company" eyebrow="COMPANY" title="企業案内">
                会社情報、研究・技術、求める研究者像を編集します。
              </HomeCard>
            ) : null}

            <HomeCard href="/my/cpp/members" eyebrow="BROWSE" title="閲覧" disabled={!access.admitted}>
              研究者は参加企業を、企業は参加研究者を閲覧します。
            </HomeCard>

            <HomeCard href="/my/cpp/manual" eyebrow="GUIDE" title="マニュアル">
              CPPの利用方法とLIVE参加時の流れを確認します。
            </HomeCard>

            <HomeCard href="/my/cpp/live" eyebrow="LIVE" title="CPP LIVE" disabled={!access.admitted}>
              LIVE入口を開き、参加人数を確認してから入ります。
            </HomeCard>
          </div>
        </div>
      </main>
    </>
  );
}

function HomeCard({
  href,
  eyebrow,
  title,
  children,
  disabled = false,
}: {
  href: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const content = (
    <>
      <div className="text-xs font-black tracking-[0.16em] text-neutral-400">{eyebrow}</div>
      <h2 className="mt-3 text-2xl font-black text-neutral-950">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-neutral-600">{children}</p>
      <div className="mt-auto pt-7 text-sm font-black text-neutral-950">
        {disabled ? "入室許可後に利用できます" : "開く →"}
      </div>
    </>
  );

  if (disabled) {
    return (
      <div aria-disabled="true" className="flex min-h-64 flex-col rounded-[2rem] border border-neutral-200 bg-neutral-50 p-7 opacity-65">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex min-h-64 flex-col rounded-[2rem] border border-neutral-200 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {content}
    </Link>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">
        {children}
      </div>
    </main>
  );
}
