"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import SocialProfileCard from "@/components/parari/matching/SocialProfileCard";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type SocialProfileRow = {
  display_name: string | null;
  photo_url: string | null;
  affiliation: string | null;
  role_title: string | null;
  topics: string[] | null;
  intro: string | null;
};

export default function CppSocialProfileViewPage() {
  const params = useParams<{ userId: string }>();
  const supabase = useMemo(() => sharedSupabase, []);
  const [profile, setProfile] = useState<SocialProfileRow | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
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
        setLoggedIn(false);
        setLoading(false);
        return;
      }
      setLoggedIn(true);

      const { data, error } = await supabase
        .from("parari_social_profiles")
        .select("display_name, photo_url, affiliation, role_title, topics, intro")
        .eq("user_id", params.userId)
        .maybeSingle<SocialProfileRow>();

      if (!active) return;
      if (error) setErrorMessage(`SOCIAL PROFILEを表示できませんでした: ${error.message}`);
      else setProfile(data);
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [params.userId, supabase]);

  if (loading) return <Shell>SOCIAL PROFILEを読み込んでいます…</Shell>;

  if (loggedIn === false) {
    return (
      <Shell>
        <div className="font-bold text-neutral-950">このプロフィールはPARARI参加者向けです。</div>
        <Link href={`/login?returnTo=/cpp/social/${params.userId}`} className="mt-5 inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">
          ログインして見る
        </Link>
      </Shell>
    );
  }

  if (!profile) {
    return (
      <Shell>
        <div className="font-bold text-neutral-950">SOCIAL PROFILEはまだ作成されていません。</div>
        {errorMessage ? <div className="mt-3 text-sm text-red-600">{errorMessage}</div> : null}
      </Shell>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-xl">
        <div className="mb-4 flex items-center justify-between gap-3 px-1">
          <div className="text-xs font-black tracking-[0.18em] text-neutral-400">PARARI MATCHING</div>
          <Link href="/cpp" className="text-xs font-bold text-neutral-500">CPPへ</Link>
        </div>
        <SocialProfileCard
          displayName={profile.display_name || "名前未設定"}
          photoUrl={profile.photo_url}
          affiliation={profile.affiliation}
          roleTitle={profile.role_title}
          topics={profile.topics}
          intro={profile.intro}
        />
      </div>
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">
        {children}
      </div>
    </main>
  );
}
