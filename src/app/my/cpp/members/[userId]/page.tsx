"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import SocialProfileCard from "@/components/parari/matching/SocialProfileCard";
import CppMemberDetailCard from "@/components/parari/cpp/CppMemberDetailCard";
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
  const [detailError, setDetailError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const reset = () => { setProfile(null); setDeepAvailable(false); setLoading(true); setRevision((n) => n + 1); };
    window.addEventListener("cpp-mode-changed", reset);
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") reset();
    });
    return () => { window.removeEventListener("cpp-mode-changed", reset); subscription?.data.subscription.unsubscribe(); };
  }, [supabase]);

  useEffect(() => {
    let active = true;
    setLoading(true); setProfile(null); setDeepAvailable(false); setErrorMessage(""); setDetailError("");

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
        const { data: researcher, error: researcherError } = await supabase
          .from("cpp_profiles")
          .select("user_id")
          .eq("user_id", row.deep_target_id)
          .eq("visibility", "published")
          .maybeSingle<{ user_id: string }>();
        if (active) {
          setDeepAvailable(Boolean(researcher));
          if (researcherError) setDetailError("研究者プロフィールの公開状態を確認できませんでした。再読み込みしてください。");
        }
      } else if (row?.can_view_deep && row.deep_target_id && row.deep_kind === "company") {
        const { data: company, error: companyError } = await supabase
          .from("cpp_companies")
          .select("id")
          .eq("id", row.deep_target_id)
          .eq("visibility", "published")
          .maybeSingle<{ id: string }>();
        if (active) {
          setDeepAvailable(Boolean(company));
          if (companyError) setDetailError("会社案内の公開状態を確認できませんでした。再読み込みしてください。");
        }
      }

      if (active) setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [supabase, userId, revision]);

  if (loading) return <CenteredCard>SOCIAL PROFILEを読み込んでいます…</CenteredCard>;

  if (!profile) {
    return (
      <CenteredCard>
        <h1 className="text-xl font-black text-neutral-950">このプロフィールは表示できません</h1>
        <p className="mt-3 text-sm leading-7">{errorMessage || "公開範囲や閲覧条件を満たしていないため、このメンバーは表示できません。"}</p>
        <Link href="/my/cpp/members" className="mt-6 inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">一覧へ戻る</Link>
      </CenteredCard>
    );
  }

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

        <CppMemberDetailCard kind={profile.deep_kind} canView={profile.can_view_deep} available={deepAvailable} targetId={profile.deep_target_id} error={detailError} />
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
