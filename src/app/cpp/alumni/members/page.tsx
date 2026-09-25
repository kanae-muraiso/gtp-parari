"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type AlumniRow = {
  user_id: string;
  participation_year: number | null;
  participation_location: string | null;
  cpp_memory: string;
  created_at: string;
};

type ParticipationRow = {
  user_id: string;
  participation_year: number;
  participation_location: string;
  sort_order: number;
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
  participations: ParticipationRow[];
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
    let participationRows: ParticipationRow[] = [];

    if (userIds.length > 0) {
      const [socialResult, participationResult] = await Promise.all([
        supabase
          .from("parari_social_profiles")
          .select(
            "user_id, display_name, photo_url, affiliation, role_title, topics, intro",
          )
          .in("user_id", userIds),
        supabase
          .from("cpp_alumni_participations")
          .select(
            "user_id, participation_year, participation_location, sort_order",
          )
          .in("user_id", userIds)
          .order("sort_order", { ascending: true }),
      ]);

      const firstError = socialResult.error || participationResult.error;
      if (firstError) {
        setErrorMessage(
          `同窓会プロフィールを読み込めませんでした: ${firstError.message}`,
        );
        setLoading(false);
        return;
      }

      socialRows = (socialResult.data ?? []) as SocialProfileRow[];
      participationRows = (participationResult.data ?? []) as ParticipationRow[];
    }

    const socialByUserId = new Map(
      socialRows.map((profile) => [profile.user_id, profile]),
    );

    const participationsByUserId = new Map<string, ParticipationRow[]>();
    participationRows.forEach((participation) => {
      const current = participationsByUserId.get(participation.user_id) ?? [];
      current.push(participation);
      participationsByUserId.set(participation.user_id, current);
    });

    setMembers(
      alumni.map((row) => {
        const storedParticipations =
          participationsByUserId.get(row.user_id) ?? [];

        const fallbackParticipations =
          storedParticipations.length === 0 &&
          row.participation_year &&
          row.participation_location
            ? [
                {
                  user_id: row.user_id,
                  participation_year: row.participation_year,
                  participation_location: row.participation_location,
                  sort_order: 0,
                },
              ]
            : [];

        return {
          alumni: row,
          social: socialByUserId.get(row.user_id) ?? null,
          participations:
            storedParticipations.length > 0
              ? storedParticipations
              : fallbackParticipations,
        };
      }),
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
          href="/cpp/alumni?edit=1"
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
              href="/cpp/alumni?edit=1"
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
            {members.map(({ alumni, social, participations }) => (
              <AlumniMemberCard
                key={alumni.user_id}
                alumni={alumni}
                social={social}
                participations={participations}
              />
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

function AlumniMemberCard({
  alumni,
  social,
  participations,
}: AlumniMember) {
  const displayName = social?.display_name || "CPP参加者";
  const topics = (social?.topics ?? []).filter(Boolean).slice(0, 6);

  return (
    <article className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-sm">
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-neutral-100 sm:h-20 sm:w-20">
            {social?.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={social.photo_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-black text-neutral-400">
                {displayName.trim().slice(0, 1) || "?"}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs font-black tracking-[0.15em] text-neutral-400">
              CPP ALUMNI
            </div>
            <h2 className="mt-1 text-xl font-black text-neutral-950 sm:text-2xl">
              {displayName}
            </h2>
            {social?.affiliation || social?.role_title ? (
              <p className="mt-1 text-sm leading-6 text-neutral-600">
                {[social?.affiliation, social?.role_title]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        </div>

        {topics.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {topics.map((topic) => (
              <span
                key={topic}
                className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700"
              >
                {topic}
              </span>
            ))}
          </div>
        ) : null}

        {social?.intro ? (
          <p className="mt-4 text-sm leading-7 text-neutral-700">
            {social.intro}
          </p>
        ) : null}
      </div>

      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="text-xs font-black tracking-[0.14em] text-neutral-400">
          CPP HISTORY
        </div>

        {participations.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {participations.map((participation) => (
              <span
                key={`${participation.participation_year}-${participation.participation_location}`}
                className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-black text-white"
              >
                {participation.participation_year} ·{" "}
                {participation.participation_location}
              </span>
            ))}
          </div>
        ) : null}

        <AlumniMemory text={alumni.cpp_memory} />
      </div>
    </article>
  );
}

function AlumniMemory({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = text.length > 320;
  const visibleText =
    shouldCollapse && !expanded
      ? `${text.slice(0, 320)}…`
      : text;

  return (
    <div className="mt-4">
      <p className="whitespace-pre-wrap text-sm leading-7 text-neutral-700">
        {visibleText}
      </p>
      {shouldCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-3 text-xs font-bold text-neutral-500 hover:text-neutral-950"
        >
          {expanded ? "閉じる" : "続きを読む"}
        </button>
      ) : null}
    </div>
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
