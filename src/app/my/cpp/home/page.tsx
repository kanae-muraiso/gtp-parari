"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CppResearcherEntryStatus from "@/components/parari/cpp/CppResearcherEntryStatus";
import CppSectionNav from "@/components/parari/cpp/CppSectionNav";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type AccessState = {
  displayName: string;
  hasResearcherProfile: boolean;
  hasCompanyProfile: boolean;
  admitted: boolean;
  alumniOnly: boolean;
};

export default function CppHomePage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [adminMode, setAdminMode] = useState(false);
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
      const [profileResult, researcherResult, companyResult, contextResult, participationResult] = await Promise.all([
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
        supabase.rpc("cpp_alumni_participation_status"),
      ]);

      if (!active) return;
      const firstError =
        profileResult.error || researcherResult.error || companyResult.error || contextResult.error || participationResult.error;
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
        alumniOnly: Boolean(participationResult.data?.[0]?.is_alumni && !participationResult.data?.[0]?.is_operator && participationResult.data?.[0]?.choice === "alumni"),
        admitted: !contextResult.error && Boolean((contextResult.data ?? []).length),
      });
    };

    const loadMode = async () => {
      const result = await supabase?.rpc("cpp_mode_status");
      if (active) setAdminMode(result?.data?.[0]?.mode === "admin");
    };
    void loadMode();
    window.addEventListener("cpp-mode-changed", loadMode);
    void load();
    return () => {
      active = false;
      window.removeEventListener("cpp-mode-changed", loadMode);
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
  const settingsLinks = [
    ...(access.hasResearcherProfile ? [{ href: "/my/cpp", label: "プロフィール・名札編集" }] : []),
    ...(access.hasCompanyProfile ? [
      { href: "/my/cpp/company", label: "会社案内・募集要項編集" },
      ...(!access.hasResearcherProfile ? [{ href: "/my/cpp/social-profile", label: "名札編集" }] : []),
    ] : []),
  ];

  return (
    <>
      <CppSectionNav active="home" settingsLinks={settingsLinks} />
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
                  お知らせの確認、参加メンバーの閲覧、CPP LIVEへの参加をここから行えます。
                </p>
              </div>
              <span
                className={`rounded-full px-4 py-2 text-xs font-black ${
                  access.admitted
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {access.alumniOnly ? "同窓会のみ" : access.admitted ? "入室済み" : registered ? "入室準備中" : "未登録"}
              </span>
            </div>

            {adminMode ? <p className="mt-6 text-sm text-neutral-600">管理者用の確認一覧と設定を利用できます。</p> : access.alumniOnly ? (
              <div className="mt-7 rounded-2xl bg-blue-50 p-5 text-sm leading-7 text-blue-950">同窓会の名札とメッセージで交流できます。研究者としても参加する場合は、右上の設定から「CPPでの参加設定」を開いてください。<Link href="/cpp/alumni" className="mt-3 block font-bold underline">同窓会ホームへ</Link></div>
            ) : !registered ? (
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
                {access.hasResearcherProfile ? <CppResearcherEntryStatus /> : "企業会員の利用条件を確認後、BROWSEとLIVEを利用できます。"}
              </div>
            ) : null}
            {settingsLinks.length ? (
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                {settingsLinks.map((item) => (
                  <Link key={item.href} href={item.href} className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-600 hover:bg-neutral-50">{item.label}</Link>
                ))}
              </div>
            ) : null}
          </header>

          {adminMode ? (
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <HomeCard href="/my/cpp/admin/company-codes" eyebrow="COMPANY" title="企業招待コード">
                <ol className="list-decimal space-y-2 pl-5">
                  <li><strong>会社・団体名</strong>を入力（管理用のメモです）。</li>
                  <li><strong>有効期間</strong>を選択（初期設定は30日）。</li>
                  <li><strong>「招待コードを発行する」</strong>を押す。</li>
                  <li><strong>「コードをコピー」</strong>して、企業担当者に伝える。</li>
                </ol>
              </HomeCard>
              <HomeCard href="/my/cpp/admin/research-evidence" eyebrow="RESEARCH" title="研究歴の後日入力者">研究歴がわかるページを後で入力する方の一覧を確認します。</HomeCard>
              <HomeCard href="/my/cpp/admin/announcements" eyebrow="ALUMNI" title="同窓会のお知らせ管理">お知らせの作成・公開と、同窓会の近況の確認ができます。</HomeCard>
              <HomeCard href="/my/cpp/admin/settings" eyebrow="SETTINGS" title="モード利用者の設定">3つのモードを利用できる人を追加・削除します。</HomeCard>
            </div>
          ) : <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <HomeCard href="/my/cpp/announcements" eyebrow="NEWS" title="お知らせ">
              CPPからの連絡や開催情報を確認します。
            </HomeCard>

            <HomeCard href="/my/cpp/members" eyebrow="BROWSE" title="閲覧" disabled={!access.admitted}>
              研究者は参加企業を、企業は参加研究者を閲覧します。
            </HomeCard>

            <HomeCard href="/my/cpp/live" eyebrow="LIVE" title="CPP LIVE" disabled={!access.admitted}>
              LIVE入口を開き、参加人数を確認してから入ります。
            </HomeCard>
          </div>
          }
          <div className="mt-5 text-center">
            <Link href="/my/cpp/manual" className="inline-flex rounded-full border border-neutral-300 px-5 py-2 text-xs font-bold text-neutral-600 hover:bg-white">マニュアル</Link>
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
      <div className="mt-3 text-sm leading-7 text-neutral-600">{children}</div>
      <div className="mt-auto pt-7 text-sm font-black text-neutral-950">
        {disabled ? "入室条件を満たすと利用できます" : "開く →"}
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
