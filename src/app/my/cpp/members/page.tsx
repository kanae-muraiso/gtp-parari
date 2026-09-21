"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CppSectionNav from "@/components/parari/cpp/CppSectionNav";
import SocialProfileCard from "@/components/parari/matching/SocialProfileCard";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type ContextRow = {
  membership_id: string;
  organization_id: string | null;
  organization_key: string | null;
  view_organization_id: string | null;
  view_organization_key: string | null;
  joined_at: string;
};

type MemberRow = {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  affiliation: string | null;
  role_title: string | null;
  topics: string[] | null;
  intro: string | null;
  joined_at: string;
  organization_key: string;
  social_profile_complete: boolean;
};

type SortMode = "alphabetical" | "newest";

export default function CppMembersPage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [context, setContext] = useState<ContextRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("alphabetical");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!supabase) {
        setErrorMessage("PARARIの接続設定を確認できませんでした。");
        setLoading(false);
        return;
      }

      const { data: authData } = await supabase.auth.getUser();
      if (!active) return;
      if (!authData.user) {
        setLoading(false);
        return;
      }

      const [contextResult, membersResult] = await Promise.all([
        supabase.rpc("cpp_matching_context"),
        supabase.rpc("cpp_matching_visible_members"),
      ]);

      if (!active) return;
      const firstError = contextResult.error || membersResult.error;
      if (firstError) {
        setErrorMessage(`参加メンバーの取得に失敗しました: ${firstError.message}`);
        setLoading(false);
        return;
      }

      setContext(((contextResult.data ?? [])[0] as ContextRow | undefined) ?? null);
      setMembers((membersResult.data ?? []) as MemberRow[]);
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const sortedMembers = useMemo(() => {
    const rows = [...members];
    if (sortMode === "newest") {
      rows.sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime());
    } else {
      rows.sort((a, b) => a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }));
    }
    return rows;
  }, [members, sortMode]);

  if (loading) return <CenteredCard>参加メンバーを読み込んでいます…</CenteredCard>;

  if (!context) {
    return (
      <CenteredCard>
        <div className="text-xs font-black tracking-[0.16em] text-neutral-400">CPP MATCHING</div>
        <h1 className="mt-3 text-xl font-black text-neutral-950">まだCPPへの入室許可がありません</h1>
        <p className="mt-3 text-sm leading-7 text-neutral-600">
          CPP-R または CPP-C のメンバーシップが発行されると、ここに相手側の参加メンバーが表示されます。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/my/cpp/home" className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">CPPホームへ</Link>
          <Link href="/my/cpp/social-profile" className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-neutral-800">SOCIAL PROFILE</Link>
        </div>
      </CenteredCard>
    );
  }

  const counterpartLabel = context.organization_key === "CPP-R" ? "参加企業・企業担当者" : "参加研究者";
  const viewerLabel = context.organization_key === "CPP-R" ? "研究者" : "企業";

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6 sm:py-14">
      <CppSectionNav active="browse" />
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="text-xs font-black tracking-[0.18em] text-neutral-400">CPP MATCHING · BROWSE</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950">{counterpartLabel}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600">
              {viewerLabel}としてCPPに参加しています。BROWSEでは、マッチング相手側のメンバーだけが表示されます。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/my/cpp/social-profile" className="rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700">SOCIAL PROFILE</Link>
            <Link href="/my/cpp/home" className="rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700">CPPホーム</Link>
          </div>
        </header>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{errorMessage}</div>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] border border-neutral-200 bg-white px-5 py-4 shadow-sm">
          <div className="text-sm font-bold text-neutral-800">{sortedMembers.length} 名</div>
          <div className="flex rounded-full bg-neutral-100 p-1">
            <button type="button" onClick={() => setSortMode("alphabetical")} className={`rounded-full px-4 py-2 text-xs font-bold ${sortMode === "alphabetical" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500"}`}>A-Z</button>
            <button type="button" onClick={() => setSortMode("newest")} className={`rounded-full px-4 py-2 text-xs font-bold ${sortMode === "newest" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500"}`}>新着順</button>
          </div>
        </div>

        {sortedMembers.length === 0 ? (
          <div className="mt-6 rounded-[2rem] border border-neutral-200 bg-white p-8 text-center shadow-sm">
            <div className="text-lg font-black text-neutral-950">まだ表示できるメンバーがいません</div>
            <p className="mt-3 text-sm leading-7 text-neutral-500">相手側のCPPメンバーが参加すると、ここにSOCIAL PROFILEが並びます。</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {sortedMembers.map((member) => (
              <Link key={member.user_id} href={`/my/cpp/members/${member.user_id}`} className="block transition hover:-translate-y-0.5">
                <SocialProfileCard
                  displayName={member.display_name}
                  photoUrl={member.photo_url}
                  affiliation={member.affiliation}
                  roleTitle={member.role_title}
                  topics={member.topics}
                  intro={member.intro}
                  compact
                />
                {!member.social_profile_complete ? (
                  <div className="-mt-3 px-5 pb-2 text-[11px] font-bold text-amber-700">SOCIAL PROFILE 作成中</div>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-16">
      <div className="mx-auto max-w-xl rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-neutral-600 shadow-sm">{children}</div>
    </main>
  );
}
