"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import PageBodyPanelRenderer from "@/components/parari/mvp/PageBodyPanelRenderer";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type ProfileRow = {
  user_id: string;
  public_name: string | null;
  photo_path: string | null;
  affiliation: string | null;
  position_title: string | null;
  degree_level: string | null;
  degree_text: string | null;
  self_appeal: string | null;
};

type KeywordRow = { id: string; keyword: string };
type SummaryRow = { id: string; slot: number; title: string | null; body: string | null; is_in_progress: boolean };

export default function PublishedCppResearcherPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const supabase = useMemo(() => sharedSupabase, []);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) return;
      const [profileResult, keywordsResult, summariesResult] = await Promise.all([
        supabase
          .from("cpp_profiles")
          .select("user_id, public_name, photo_path, affiliation, position_title, degree_level, degree_text, self_appeal")
          .eq("user_id", userId)
          .eq("visibility", "published")
          .maybeSingle<ProfileRow>(),
        supabase
          .from("cpp_profile_keywords")
          .select("id, keyword")
          .eq("user_id", userId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("cpp_research_summaries")
          .select("id, slot, title, body, is_in_progress")
          .eq("user_id", userId)
          .order("slot", { ascending: true }),
      ]);
      if (!active) return;
      setProfile(profileResult.data ?? null);
      setKeywords((keywordsResult.data ?? []) as KeywordRow[]);
      setSummaries((summariesResult.data ?? []) as SummaryRow[]);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [supabase, userId]);

  if (loading) return <CenteredCard>研究者プロフィールを読み込んでいます…</CenteredCard>;
  if (!profile) return <CenteredCard>この研究者プロフィールはまだ公開されていません。</CenteredCard>;

  const photoUrl = profile.photo_path && supabase
    ? supabase.storage.from("parari-images").getPublicUrl(profile.photo_path).data.publicUrl
    : null;

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/my/cpp/members" className="text-xs font-bold text-neutral-500 hover:text-neutral-900">← 参加メンバー</Link>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-neutral-500 shadow-sm">CPP RESEARCHER</span>
        </div>

        <header className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-6 sm:grid-cols-[130px_1fr]">
            <div className="aspect-square overflow-hidden rounded-[1.75rem] bg-neutral-100">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-bold text-neutral-300">NO PHOTO</div>
              )}
            </div>
            <div>
              <div className="text-xs font-black tracking-[0.17em] text-neutral-400">MATCHING PROFILE</div>
              <h1 className="mt-2 text-3xl font-black text-neutral-950">{profile.public_name || "氏名未設定"}</h1>
              <p className="mt-3 text-sm leading-7 text-neutral-600">{[profile.affiliation, profile.position_title].filter(Boolean).join(" · ")}</p>
              {(profile.degree_text || profile.degree_level) ? <p className="mt-1 text-sm text-neutral-500">{profile.degree_text || profile.degree_level}</p> : null}
              {keywords.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {keywords.map((item) => <span key={item.id} className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700">{item.keyword}</span>)}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-black text-neutral-950">研究概要</h2>
          {summaries.length > 0 ? (
            <div className="mt-5 space-y-7">
              {summaries.map((summary) => (
                <article key={summary.id} className="border-t border-neutral-100 pt-5 first:border-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-neutral-950">{summary.title || `研究概要 ${summary.slot}`}</h3>
                    {summary.is_in_progress ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">作成中</span> : null}
                  </div>
                  {summary.body ? <div className="mt-4"><PageBodyPanelRenderer bodySsot={summary.body} /></div> : null}
                </article>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-neutral-500">研究概要はまだ登録されていません。</p>}
        </section>

        <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-black text-neutral-950">自己アピール</h2>
          {profile.self_appeal ? <div className="mt-5"><PageBodyPanelRenderer bodySsot={profile.self_appeal} /></div> : <p className="mt-4 text-sm text-neutral-500">まだ登録されていません。</p>}
        </section>
      </div>
    </main>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-neutral-100 px-4 py-16"><div className="mx-auto max-w-xl rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">{children}</div></main>;
}
