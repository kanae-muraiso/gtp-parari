"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import PageBodyPanelRenderer from "@/components/parari/mvp/PageBodyPanelRenderer";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  industry: string | null;
  headquarters: string | null;
  website_url: string | null;
  short_description: string | null;
  profile_body: string | null;
  researcher_message: string | null;
  visibility: string;
};

type RecruitmentRow = {
  id: string;
  title: string;
  employment_type: string | null;
  location: string | null;
  degree_requirement: string | null;
  salary_text: string | null;
  positions_count: number | null;
  deadline: string | null;
  summary: string | null;
  job_body: string | null;
  qualifications_body: string | null;
  conditions_body: string | null;
  application_url: string | null;
  status: string;
  sort_order: number;
};

type Loaded = {
  company: CompanyRow;
  recruitments: RecruitmentRow[];
};

export default function CppCompanyPreviewPage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
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

    const { data: memberRows, error: memberError } = await supabase
      .from("cpp_company_members")
      .select("company_id")
      .eq("user_id", authData.user.id)
      .limit(1);

    if (memberError) {
      setErrorMessage(`企業情報の取得に失敗しました: ${memberError.message}`);
      setLoading(false);
      return;
    }

    const companyId = (memberRows ?? [])[0]?.company_id as string | undefined;
    if (!companyId) {
      setLoading(false);
      return;
    }

    const [companyResult, recruitmentResult] = await Promise.all([
      supabase
        .from("cpp_companies")
        .select("id, name, slug, logo_path, industry, headquarters, website_url, short_description, profile_body, researcher_message, visibility")
        .eq("id", companyId)
        .single<CompanyRow>(),
      supabase
        .from("cpp_company_recruitments")
        .select("id, title, employment_type, location, degree_requirement, salary_text, positions_count, deadline, summary, job_body, qualifications_body, conditions_body, application_url, status, sort_order")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    const firstError = companyResult.error || recruitmentResult.error;
    if (firstError) {
      setErrorMessage(`企業ページのプレビュー取得に失敗しました: ${firstError.message}`);
      setLoading(false);
      return;
    }

    setLoaded({
      company: companyResult.data,
      recruitments: (recruitmentResult.data ?? []) as RecruitmentRow[],
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <CenteredCard>企業ページを読み込んでいます…</CenteredCard>;

  if (!loaded) {
    return (
      <CenteredCard>
        <div>CPPの企業・団体登録がありません。</div>
        <Link href="/cpp/company/try" className="mt-5 inline-block rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white">企業・団体登録へ</Link>
      </CenteredCard>
    );
  }

  const { company, recruitments } = loaded;
  const logoUrl = company.logo_path
    ? supabase?.storage.from("parari-images").getPublicUrl(company.logo_path).data.publicUrl ?? null
    : null;

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-100 px-4 py-3 text-xs font-semibold text-amber-900">
          <span>CPP企業ページの掲載プレビューです。現在は一般公開されていません。</span>
          <Link href="/my/cpp/company" className="rounded-full bg-white px-4 py-2 font-bold text-neutral-900">← 編集へ戻る</Link>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
        ) : null}

        <header className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-6 sm:grid-cols-[150px_1fr] sm:items-start">
            <div className="aspect-square overflow-hidden rounded-[1.75rem] bg-neutral-100">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={company.name} className="h-full w-full object-contain p-4" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs font-bold text-neutral-300">COMPANY LOGO</div>
              )}
            </div>
            <div>
              <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">CPP COMPANY PROFILE</div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">{company.name}</h1>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-600">
                {company.industry ? <span>{company.industry}</span> : null}
                {company.headquarters ? <span>{company.headquarters}</span> : null}
              </div>
              {company.short_description ? (
                <p className="mt-5 max-w-3xl text-sm leading-7 text-neutral-700">{company.short_description}</p>
              ) : null}
              {company.website_url ? (
                <a href={company.website_url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block text-sm font-semibold text-neutral-700 underline underline-offset-4">
                  会社Webサイト
                </a>
              ) : null}
            </div>
          </div>
        </header>

        <PublicSection title="会社案内">
          {company.profile_body ? <PageBodyPanelRenderer bodySsot={company.profile_body} /> : <Empty>会社案内はまだ入力されていません。</Empty>}
        </PublicSection>

        {company.researcher_message ? (
          <PublicSection title="研究者のみなさんへ">
            <PageBodyPanelRenderer bodySsot={company.researcher_message} />
          </PublicSection>
        ) : null}

        <PublicSection title="募集要項">
          {recruitments.length === 0 ? (
            <Empty>現在掲載予定の募集要項はありません。</Empty>
          ) : (
            <div className="space-y-8">
              {recruitments.map((row, index) => (
                <article key={row.id} className={index === 0 ? "" : "border-t border-neutral-200 pt-8"}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold tracking-[0.14em] text-neutral-400">RECRUITMENT {index + 1}</div>
                      <h3 className="mt-2 text-xl font-bold text-neutral-950">{row.title}</h3>
                    </div>
                    <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-[11px] font-bold text-neutral-600">確認用</span>
                  </div>

                  {row.summary ? <p className="mt-4 text-sm leading-7 text-neutral-700">{row.summary}</p> : null}

                  <dl className="mt-5 grid gap-3 rounded-2xl bg-neutral-50 p-5 text-sm sm:grid-cols-2">
                    <Info label="雇用形態" value={row.employment_type} />
                    <Info label="勤務地" value={row.location} />
                    <Info label="対象学位・条件" value={row.degree_requirement} />
                    <Info label="給与・待遇" value={row.salary_text} />
                    <Info label="募集人数" value={row.positions_count ? `${row.positions_count}名` : null} />
                    <Info label="応募締切" value={row.deadline ? formatDate(row.deadline) : null} />
                  </dl>

                  {row.job_body ? (
                    <Detail title="仕事内容・プロジェクト">
                      <PageBodyPanelRenderer bodySsot={row.job_body} />
                    </Detail>
                  ) : null}

                  {row.qualifications_body ? (
                    <Detail title="応募条件・求める人物">
                      <PageBodyPanelRenderer bodySsot={row.qualifications_body} />
                    </Detail>
                  ) : null}

                  {row.conditions_body ? (
                    <Detail title="勤務条件・その他">
                      <PageBodyPanelRenderer bodySsot={row.conditions_body} />
                    </Detail>
                  ) : null}

                  <div className="mt-6 flex flex-wrap gap-3">
                    {row.application_url ? (
                      <a href={row.application_url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">
                        応募ページへ
                      </a>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-5 py-2.5 text-sm font-bold text-neutral-500">応募受付は準備中</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </PublicSection>

        <footer className="pb-8 text-center text-xs text-neutral-400">CPP COMPANY PROFILE · PREVIEW</footer>
      </div>
    </main>
  );
}

function PublicSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="mb-5 text-xl font-bold text-neutral-950">{title}</h2>
      {children}
    </section>
  );
}

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 border-t border-neutral-200 pt-6">
      <h4 className="mb-4 text-sm font-bold text-neutral-950">{title}</h4>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-bold text-neutral-400">{label}</dt>
      <dd className="mt-1 font-medium text-neutral-800">{value}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-400">{children}</p>;
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">{children}</div>
    </main>
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return [year, month, day].filter(Boolean).join("/");
}
