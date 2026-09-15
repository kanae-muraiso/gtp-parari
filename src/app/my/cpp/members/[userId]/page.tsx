"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import SocialProfileCard from "@/components/parari/matching/SocialProfileCard";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type MemberProfile = {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  affiliation: string | null;
  role_title: string | null;
  topics: string[] | null;
  intro: string | null;
  organization_key: string;
  joined_at: string;
  can_view_deep: boolean;
  deep_kind: "researcher" | "company" | null;
  deep_target_id: string | null;
};

export default function CppMemberProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const supabase = useMemo(() => sharedSupabase, []);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [deepAvailable, setDeepAvailable] = useState(false);
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

      const { data, error } = await supabase.rpc("cpp_matching_member_social_profile", {
        p_target_user_id: userId,
      });

      if (!active) return;
      if (error) {
        setErrorMessage(`SOCIAL PROFILEの取得に失敗しました: ${error.message}`);
        setLoading(false);
        return;
      }

      const row = ((data ?? [])[0] as MemberProfile | undefined) ?? null;
      setProfile(row);

      if (row?.can_view_deep && row.deep_target_id && row.deep_kind === "researcher") {
        const { data: researcher } = await supabase
          .from("cpp_profiles")
          .select("user_id")
          .eq("user_id", row.deep_target_id)
          .eq("visibility", "published")
          .maybeSingle<{ user_id: string }>();
        if (active) setDeepAvailable(Boolean(researcher));
      } else if (row?.can_view_deep && row.deep_target_id && row.deep_kind === "company") {
        const { data: company } = await supabase
          .from("cpp_companies")
          .select("id")
          .eq("id", row.deep_target_id)
          .eq("visibility", "published")
          .maybeSingle<{ id: string }>();
        if (active) setDeepAvailable(Boolean(company));
      }

      if (active) setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [supabase, userId]);

  if (loading) return <CenteredCard>SOCIAL PROFILEを読み込んでいます…</CenteredCard>;

  if (!profile) {
    return (
      <CenteredCard>
        <h1 className="text-xl font-black text-neutral-950">このプロフィールは表示できません</h1>
        <p className="mt-3 text-sm leading-7">同じCPPに所属するメンバーだけがSOCIAL PROFILEを閲覧できます。</p>
        <Link href="/my/cpp/members" className="mt-6 inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">一覧へ戻る</Link>
      </CenteredCard>
    );
  }

  const deepHref =
    profile.deep_kind === "researcher" && profile.deep_target_id
      ? `/cpp/researcher/${profile.deep_target_id}`
      : profile.deep_kind === "company" && profile.deep_target_id
        ? `/cpp/company/${profile.deep_target_id}`
        : null;

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Link href="/my/cpp/members" className="text-xs font-bold text-neutral-500 hover:text-neutral-900">← 参加メンバー</Link>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-neutral-500 shadow-sm">
            {profile.organization_key === "CPP-R" ? "RESEARCHER" : "COMPANY"}
          </span>
        </div>

        {errorMessage ? <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{errorMessage}</div> : null}

        <SocialProfileCard
          displayName={profile.display_name}
          photoUrl={profile.photo_url}
          affiliation={profile.affiliation}
          roleTitle={profile.role_title}
          topics={profile.topics}
          intro={profile.intro}
        />

        <section className="mt-5 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-7">
          {profile.can_view_deep ? (
            <>
              <div className="text-xs font-black tracking-[0.15em] text-neutral-400">MATCHING PROFILE</div>
              <h2 className="mt-2 text-xl font-black text-neutral-950">詳しいプロフィール</h2>
              <p className="mt-3 text-sm leading-7 text-neutral-600">
                あなたの閲覧許可グループに所属する相手です。公開済みの詳細プロフィールを閲覧できます。
              </p>
              {deepAvailable && deepHref ? (
                <Link href={deepHref} className="mt-5 inline-flex rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white">
                  詳しいプロフィールを見る →
                </Link>
              ) : (
                <div className="mt-5 rounded-2xl bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-500">詳細プロフィールはまだ公開されていません。</div>
              )}
            </>
          ) : (
            <>
              <div className="text-xs font-black tracking-[0.15em] text-neutral-400">SOCIAL ONLY</div>
              <p className="mt-2 text-sm leading-7 text-neutral-600">
                同じ側のメンバーなので、ここでは社交用プロフィールだけが表示されます。
              </p>
            </>
          )}
        </section>
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
