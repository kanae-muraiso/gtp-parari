"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import PageBodyPanelRenderer from "@/components/parari/mvp/PageBodyPanelRenderer";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type CompanyRow = {
  id: string;
  name: string;
  logo_path: string | null;
  industry: string | null;
  headquarters: string | null;
  website_url: string | null;
  tagline: string | null;
  short_description: string | null;
  profile_body: string | null;
  researcher_message: string | null;
};

type RecruitmentRow = {
  id: string;
  title: string;
  employment: string | null;
  location: string | null;
  degree: string | null;
  deadline: string | null;
  summary: string | null;
};

export default function PublishedCppCompanyPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  const supabase = useMemo(() => sharedSupabase, []);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [recruitments, setRecruitments] = useState<RecruitmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) return;
      const [companyResult, recruitmentResult] = await Promise.all([
        supabase
          .from("cpp_companies")
          .select("id, name, logo_path, industry, headquarters, website_url, tagline, short_description, profile_body, researcher_message")
          .eq("id", companyId)
          .eq("visibility", "published")
          .maybeSingle<CompanyRow>(),
        supabase
          .from("cpp_company_recruitments")
          .select("id, title, employment, location, degree, deadline, summary")
          .eq("company_id", companyId)
          .eq("status", "published")
          .order("sort_order", { ascending: true }),
      ]);
      if (!active) return;
      setCompany(companyResult.data ?? null);
      setRecruitments((recruitmentResult.data ?? []) as RecruitmentRow[]);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [companyId, supabase]);

  if (loading) return <CenteredCard>企業プロフィールを読み込んでいます…</CenteredCard>;
  if (!company) return <CenteredCard>この企業プロフィールはまだ公開されていません。</CenteredCard>;

  const logoUrl = company.logo_path && supabase
    ? supabase.storage.from("parari-images").getPublicUrl(company.logo_path).data.publicUrl
    : null;

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/my/cpp/members" className="text-xs font-bold text-neutral-500 hover:text-neutral-900">← 参加メンバー</Link>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-neutral-500 shadow-sm">CPP COMPANY</span>
        </div>

        <header className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-6 sm:grid-cols-[130px_1fr]">
            <div className="aspect-square overflow-hidden rounded-[1.75rem] bg-neutral-100">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-full w-full object-contain p-4" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-bold text-neutral-300">NO LOGO</div>
              )}
            </div>
            <div>
              <div className="text-xs font-black tracking-[0.17em] text-neutral-400">MATCHING PROFILE</div>
              <h1 className="mt-2 text-3xl font-black text-neutral-950">{company.name}</h1>
              {company.tagline ? <p className="mt-3 text-base font-semibold text-neutral-700">{company.tagline}</p> : null}
              <p className="mt-3 text-sm leading-7 text-neutral-600">{[company.industry, company.headquarters].filter(Boolean).join(" · ")}</p>
              {company.short_description ? <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-700">{company.short_description}</p> : null}
              {company.website_url ? <a href={company.website_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-bold underline underline-offset-4">企業サイト</a> : null}
            </div>
          </div>
        </header>

        {company.profile_body ? (
          <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-black text-neutral-950">会社・研究について</h2>
            <div className="mt-5"><PageBodyPanelRenderer bodySsot={company.profile_body} /></div>
          </section>
        ) : null}

        {company.researcher_message ? (
          <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-black text-neutral-950">研究者の方へ</h2>
            <div className="mt-5"><PageBodyPanelRenderer bodySsot={company.researcher_message} /></div>
          </section>
        ) : null}

        <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-black text-neutral-950">募集中のポジション</h2>
          {recruitments.length > 0 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {recruitments.map((recruitment) => (
                <article key={recruitment.id} className="rounded-2xl border border-neutral-200 p-5">
                  <h3 className="font-black text-neutral-950">{recruitment.title}</h3>
                  <p className="mt-2 text-xs leading-6 text-neutral-500">{[recruitment.employment, recruitment.location, recruitment.degree].filter(Boolean).join(" · ")}</p>
                  {recruitment.summary ? <p className="mt-3 text-sm leading-7 text-neutral-700">{recruitment.summary}</p> : null}
                  {recruitment.deadline ? <p className="mt-3 text-xs font-bold text-neutral-500">締切 {recruitment.deadline}</p> : null}
                </article>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-neutral-500">現在公開中の募集はありません。</p>}
        </section>
      </div>
    </main>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-neutral-100 px-4 py-16"><div className="mx-auto max-w-xl rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">{children}</div></main>;
}
