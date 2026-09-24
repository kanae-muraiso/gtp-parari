"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import SocialProfileCard from "@/components/parari/matching/SocialProfileCard";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type AlumniRow = {
  user_id: string;
  participation_year: number;
  participation_location: string;
  cpp_memory: string;
  created_at: string;
};

type SocialProfileRow = {
  user_id: string;
  display_name: string | null;
  photo_url: string | null;
  affiliation: string | null;
  role_title: string | null;
  topics: string[] | null;
  intro: string | null;
};

type AlumniMember = {
  alumni: AlumniRow;
  social: SocialProfileRow | null;
};

export default function CppAlumniMembersPage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAlumni, setIsAlumni] = useState(false);
  const [members, setMembers] = useState<AlumniMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    if (!supabase) {
      setErrorMessage("PARARIの接続設定を確認できませんでした。");
      setLoading(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setLoading(false);
      return;
    }

    const user = authData.user;
    setUserId(user.id);

    const { data: ownAlumni, error: ownError } = await supabase
      .from("cpp_alumni")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle<{ user_id: string }>();

    if (ownError) {
      setErrorMessage(
        `CPP同窓会の登録状況を確認できませんでした: ${ownError.message}`,
      );
      setLoading(false);
      return;
    }

    if (!ownAlumni) {
      setLoading(false);
      return;
    }

    setIsAlumni(true);

    const { data: alumniRows, error: alumniError } = await supabase
      .from("cpp_alumni")
      .select(
        "user_id, participation_year, participation_location, cpp_memory, created_at",
      )
      .order("created_at", { ascending: false });

    if (alumniError) {
      setErrorMessage(
        `CPP同窓会の登録者を読み込めませんでした: ${alumniError.message}`,
      );
      setLoading(false);
      return;
    }

    const alumni = (alumniRows ?? []) as AlumniRow[];
    const userIds = alumni.map((row) => row.user_id);

    let socialRows: SocialProfileRow[] = [];

    if (userIds.length > 0) {
      const { data, error } = await supabase
        .from("parari_social_profiles")
        .select(
          "user_id, display_name, photo_url, affiliation, role_title, topics, intro",
        )
        .in("user_id", userIds);

      if (error) {
        setErrorMessage(
          `SOCIAL PROFILEを読み込めませんでした: ${error.message}`,
        );
        setLoading(false);
        return;
      }

      socialRows = (data ?? []) as SocialProfileRow[];
    }

    const socialByUserId = new Map(
      socialRows.map((profile) => [profile.user_id, profile]),
    );

    setMembers(
      alumni.map((row) => ({
        alumni: row,
        social: socialByUserId.get(row.user_id) ?? null,
      })),
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <CenteredCard>CPP ALUMNIを読み込んでいます…</CenteredCard>;
  }

  if (!userId) {
    return (
      <CenteredCard>
        <div className="font-bold text-neutral-950">PARARIへのログインが必要です。</div>
        <Link
          href="/login?returnTo=/cpp/alumni/members"
          className="mt-5 inline-flex rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white"
        >
          ログインする
        </Link>
      </CenteredCard>
    );
  }

  if (!isAlumni) {
    return (
      <CenteredCard>
        <div className="text-xs font-black tracking-[0.16em] text-neutral-400">
          CPP ALUMNI
        </div>
        <h1 className="mt-3 text-2xl font-black text-neutral-950">
          登録すると参加者を見ることができます
        </h1>
        <p className="mt-3 leading-7">
          CPPに参加した年・開催地と短い思い出を登録すると、ほかの登録者の現在のプロフィールを閲覧できます。
        </p>
        <Link
          href="/cpp/alumni"
          className="mt-6 inline-flex rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white"
        >
          CPP同窓会に登録する
        </Link>
      </CenteredCard>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="text-xs font-black tracking-[0.18em] text-neutral-400">
              CPP ALUMNI
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950 sm:text-4xl">
              CPPで出会った人たちは、今。
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-600">
              現在 {members.length}名が登録しています。まずは新しく登録した方から順に表示しています。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/cpp/alumni"
              className="rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700"
            >
              自分の同窓会登録を編集
            </Link>
            <Link
              href="/my/cpp/social-profile?returnTo=/cpp/alumni/members"
              className="rounded-full bg-neutral-950 px-4 py-2.5 text-xs font-bold text-white"
            >
              SOCIAL PROFILEを編集
            </Link>
          </div>
        </header>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {members.length > 0 ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {members.map(({ alumni, social }) => (
              <section key={alumni.user_id} className="space-y-3">
                <SocialProfileCard
                  displayName={social?.display_name || "CPP参加者"}
                  photoUrl={social?.photo_url}
                  affiliation={social?.affiliation}
                  roleTitle={social?.role_title}
                  topics={social?.topics}
                  intro={social?.intro}
                />

                <div className="rounded-[1.75rem] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-black text-white">
                      CPP {alumni.participation_year}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700">
                      {alumni.participation_location}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-neutral-700">
                    {alumni.cpp_memory}
                  </p>
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm leading-7 text-neutral-500 shadow-sm">
            まだ登録者がいません。
          </div>
        )}
      </div>
    </main>
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
