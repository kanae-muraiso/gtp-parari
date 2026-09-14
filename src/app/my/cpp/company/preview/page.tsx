"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import PageBodyPanelRenderer from "@/components/parari/mvp/PageBodyPanelRenderer";

type SectionKey = "company" | "research" | "positions" | "recruitments" | "materials";
type DisplayStyle = "standard" | "cards" | "featured" | "compact";
type RecruitmentDisplayMode = "integrated" | "separate" | "hybrid";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  tagline: string | null;
  industry: string | null;
  headquarters: string | null;
  website_url: string | null;
  short_description: string | null;
  recruitment_display_mode: RecruitmentDisplayMode;
  visibility: string;
};

type ContentBlock = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  sort_order: number;
};

type PositionRow = {
  id: string;
  title: string;
  summary: string | null;
  role_body: string | null;
  research_body: string | null;
  ideal_candidate_body: string | null;
  degree_requirement: string | null;
  employment_type: string | null;
  default_location: string | null;
  research_keywords: string[];
  is_active: boolean;
  sort_order: number;
};

type RecruitmentRow = {
  id: string;
  position_id: string | null;
  title: string;
  cycle_label: string | null;
  opens_on: string | null;
  deadline: string | null;
  employment_type: string | null;
  location: string | null;
  degree_requirement: string | null;
  salary_text: string | null;
  positions_count: number | null;
  summary: string | null;
  job_body: string | null;
  qualifications_body: string | null;
  conditions_body: string | null;
  application_url: string | null;
  status: "draft" | "published" | "closed";
  sort_order: number;
};

type MaterialRow = {
  id: string;
  title: string;
  material_type: "pdf" | "link" | "youtube";
  file_path: string | null;
  file_name: string | null;
  external_url: string | null;
  description: string | null;
  sort_order: number;
};

type LayoutRow = {
  company_id: string;
  section_key: SectionKey;
  is_visible: boolean;
  display_style: DisplayStyle;
  sort_order: number;
};

type Loaded = {
  company: CompanyRow;
  blocks: ContentBlock[];
  positions: PositionRow[];
  recruitments: RecruitmentRow[];
  materials: MaterialRow[];
  layout: LayoutRow[];
};

const DEFAULT_LAYOUT: Array<Pick<LayoutRow, "section_key" | "is_visible" | "display_style" | "sort_order">> = [
  { section_key: "company", is_visible: true, display_style: "standard", sort_order: 0 },
  { section_key: "research", is_visible: true, display_style: "standard", sort_order: 1 },
  { section_key: "positions", is_visible: true, display_style: "standard", sort_order: 2 },
  { section_key: "recruitments", is_visible: true, display_style: "standard", sort_order: 3 },
  { section_key: "materials", is_visible: true, display_style: "standard", sort_order: 4 },
];

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

    setLoading(true);
    setErrorMessage("");

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

    const [companyResult, blockResult, positionResult, recruitmentResult, materialResult, layoutResult] = await Promise.all([
      supabase
        .from("cpp_companies")
        .select("id, name, slug, logo_path, tagline, industry, headquarters, website_url, short_description, recruitment_display_mode, visibility")
        .eq("id", companyId)
        .single<CompanyRow>(),
      supabase
        .from("cpp_company_content_blocks")
        .select("id, kind, title, body, sort_order")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("cpp_company_positions")
        .select("id, title, summary, role_body, research_body, ideal_candidate_body, degree_requirement, employment_type, default_location, research_keywords, is_active, sort_order")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("cpp_company_recruitments")
        .select("id, position_id, title, cycle_label, opens_on, deadline, employment_type, location, degree_requirement, salary_text, positions_count, summary, job_body, qualifications_body, conditions_body, application_url, status, sort_order")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("cpp_company_materials")
        .select("id, title, material_type, file_path, file_name, external_url, description, sort_order")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("cpp_company_page_sections")
        .select("company_id, section_key, is_visible, display_style, sort_order")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true }),
    ]);

    const firstError = companyResult.error || blockResult.error || positionResult.error || recruitmentResult.error || materialResult.error || layoutResult.error;
    if (firstError) {
      setErrorMessage(`企業ページのプレビュー取得に失敗しました: ${firstError.message}`);
      setLoading(false);
      return;
    }

    const rawLayout = (layoutResult.data ?? []) as LayoutRow[];
    const layout = rawLayout.length > 0
      ? rawLayout
      : DEFAULT_LAYOUT.map((row) => ({ ...row, company_id: companyId }));

    setLoaded({
      company: companyResult.data,
      blocks: (blockResult.data ?? []) as ContentBlock[],
      positions: (positionResult.data ?? []) as PositionRow[],
      recruitments: (recruitmentResult.data ?? []) as RecruitmentRow[],
      materials: (materialResult.data ?? []) as MaterialRow[],
      layout,
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPdf = useCallback(async (row: MaterialRow) => {
    if (!supabase || !row.file_path) return;
    const { data, error } = await supabase.storage.from("cpp-company-documents").createSignedUrl(row.file_path, 300);
    if (error || !data?.signedUrl) {
      setErrorMessage(`PDFを開けませんでした: ${error?.message ?? "unknown error"}`);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }, [supabase]);

  if (loading) return <CenteredCard>企業ページを読み込んでいます…</CenteredCard>;

  if (!loaded) {
    return (
      <CenteredCard>
        <div>CPPの企業・団体登録がありません。</div>
        <Link href="/cpp/company/try" className="mt-5 inline-block rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white">企業・団体登録へ</Link>
      </CenteredCard>
    );
  }

  const { company, blocks, positions, recruitments, materials, layout } = loaded;
  const logoUrl = company.logo_path
    ? supabase?.storage.from("parari-images").getPublicUrl(company.logo_path).data.publicUrl ?? null
    : null;

  const companyBlocks = blocks.filter((row) => row.kind !== "research");
  const researchBlocks = blocks.filter((row) => row.kind === "research");
  const visibleLayout = layout.filter((row) => row.is_visible).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-100 px-4 py-3 text-xs font-semibold text-amber-900">
          <span>CPP企業ページの掲載プレビューです。WORKBOOKに保存済みの内容を表示しています。</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} className="rounded-full bg-white px-4 py-2 font-bold text-neutral-900">最新内容を再読込</button>
            <Link href="/my/cpp/company" className="rounded-full bg-white px-4 py-2 font-bold text-neutral-900">← 編集へ戻る</Link>
          </div>
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
              {company.tagline ? <p className="mt-3 text-lg font-semibold leading-8 text-neutral-700">{company.tagline}</p> : null}
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-600">
                {company.industry ? <span>{company.industry}</span> : null}
                {company.headquarters ? <span>{company.headquarters}</span> : null}
              </div>
              {company.short_description ? <p className="mt-5 max-w-3xl text-sm leading-7 text-neutral-700">{company.short_description}</p> : null}
              {company.website_url ? (
                <a href={company.website_url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block text-sm font-semibold text-neutral-700 underline underline-offset-4">会社Webサイト</a>
              ) : null}
            </div>
          </div>
        </header>

        {visibleLayout.map((section) => {
          switch (section.section_key) {
            case "company":
              return (
                <SectionShell key="company" title="会社紹介" style={section.display_style} empty={companyBlocks.length === 0}>
                  <ContentBlockList rows={companyBlocks} style={section.display_style} />
                </SectionShell>
              );
            case "research":
              return (
                <SectionShell key="research" title="研究・技術" style={section.display_style} empty={researchBlocks.length === 0}>
                  <ContentBlockList rows={researchBlocks} style={section.display_style} />
                </SectionShell>
              );
            case "positions":
              return (
                <SectionShell key="positions" title="求める研究者・ポジション" style={section.display_style} empty={positions.length === 0}>
                  <PositionList rows={positions} style={section.display_style} />
                </SectionShell>
              );
            case "recruitments":
              return (
                <SectionShell key="recruitments" title="募集情報" style={section.display_style} empty={recruitments.length === 0}>
                  <RecruitmentList rows={recruitments} mode={company.recruitment_display_mode} style={section.display_style} />
                </SectionShell>
              );
            case "materials":
              return (
                <SectionShell key="materials" title="資料" style={section.display_style} empty={materials.length === 0}>
                  <MaterialList rows={materials} style={section.display_style} onOpenPdf={openPdf} />
                </SectionShell>
              );
          }
        })}

        <footer className="pb-8 text-center text-xs text-neutral-400">CPP COMPANY PROFILE · PREVIEW</footer>
      </div>
    </main>
  );
}

function SectionShell({ title, style, empty, children }: { title: string; style: DisplayStyle; empty: boolean; children: React.ReactNode }) {
  const shellClass = style === "featured"
    ? "rounded-[2.25rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-10"
    : style === "compact"
      ? "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
      : "rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8";
  return (
    <section className={shellClass}>
      <h2 className={style === "featured" ? "mb-7 text-2xl font-bold text-neutral-950 sm:text-3xl" : "mb-5 text-xl font-bold text-neutral-950"}>{title}</h2>
      {empty ? <Empty>まだ内容が入力されていません。</Empty> : children}
    </section>
  );
}

function ContentBlockList({ rows, style }: { rows: ContentBlock[]; style: DisplayStyle }) {
  const wrapper = style === "cards" ? "grid gap-4 md:grid-cols-2" : "space-y-7";
  return (
    <div className={wrapper}>
      {rows.map((row) => (
        <article key={row.id} className={style === "cards" ? "rounded-2xl border border-neutral-200 bg-neutral-50 p-5" : ""}>
          <h3 className="text-lg font-bold text-neutral-900">{row.title}</h3>
          <div className="mt-4">{row.body ? <PageBodyPanelRenderer bodySsot={row.body} /> : <Empty>本文はまだありません。</Empty>}</div>
        </article>
      ))}
    </div>
  );
}

function PositionList({ rows, style }: { rows: PositionRow[]; style: DisplayStyle }) {
  const wrapper = style === "cards" ? "grid gap-4 md:grid-cols-2" : "space-y-7";
  return (
    <div className={wrapper}>
      {rows.map((row) => (
        <article key={row.id} className={style === "cards" ? "rounded-2xl border border-neutral-200 bg-neutral-50 p-5" : "rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6"}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-lg font-bold text-neutral-950">{row.title}</h3>
            {!row.is_active ? <span className="rounded-full bg-neutral-200 px-3 py-1 text-[11px] font-bold text-neutral-500">現在休止</span> : null}
          </div>
          {row.summary ? <p className="mt-3 text-sm leading-7 text-neutral-700">{row.summary}</p> : null}
          {(row.degree_requirement || row.employment_type || row.default_location) ? (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <Info label="対象学位・条件" value={row.degree_requirement} />
              <Info label="雇用形態" value={row.employment_type} />
              <Info label="主な勤務地" value={row.default_location} />
            </dl>
          ) : null}
          {row.research_keywords.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{row.research_keywords.map((keyword) => <span key={keyword} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-600">{keyword}</span>)}</div> : null}
          {row.role_body ? <Detail title="このポジションの役割"><PageBodyPanelRenderer bodySsot={row.role_body} /></Detail> : null}
          {row.research_body ? <Detail title="研究内容・取り組む課題"><PageBodyPanelRenderer bodySsot={row.research_body} /></Detail> : null}
          {row.ideal_candidate_body ? <Detail title="こんな研究者に来てほしい"><PageBodyPanelRenderer bodySsot={row.ideal_candidate_body} /></Detail> : null}
        </article>
      ))}
    </div>
  );
}

function RecruitmentList({ rows, mode, style }: { rows: RecruitmentRow[]; mode: RecruitmentDisplayMode; style: DisplayStyle }) {
  const wrapper = style === "cards" || mode !== "integrated" ? "grid gap-4 md:grid-cols-2" : "space-y-8";
  return (
    <div className={wrapper}>
      {rows.map((row) => {
        const showDetail = mode === "integrated";
        return (
          <article key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                {row.cycle_label ? <div className="text-xs font-bold tracking-[0.12em] text-neutral-400">{row.cycle_label}</div> : null}
                <h3 className="mt-1 text-lg font-bold text-neutral-950">{row.title}</h3>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-neutral-600">{row.status === "published" ? "募集中" : row.status === "closed" ? "募集終了" : "準備中"}</span>
            </div>
            {row.summary ? <p className="mt-4 text-sm leading-7 text-neutral-700">{row.summary}</p> : null}
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <Info label="雇用形態" value={row.employment_type} />
              <Info label="勤務地" value={row.location} />
              <Info label="対象学位・条件" value={row.degree_requirement} />
              <Info label="給与・待遇" value={row.salary_text} />
              <Info label="募集人数" value={row.positions_count ? `${row.positions_count}名` : null} />
              <Info label="応募締切" value={row.deadline ? formatDate(row.deadline) : null} />
            </dl>
            {showDetail && row.job_body ? <Detail title="仕事内容・プロジェクト"><PageBodyPanelRenderer bodySsot={row.job_body} /></Detail> : null}
            {showDetail && row.qualifications_body ? <Detail title="応募条件・求める人物"><PageBodyPanelRenderer bodySsot={row.qualifications_body} /></Detail> : null}
            {showDetail && row.conditions_body ? <Detail title="勤務条件・その他"><PageBodyPanelRenderer bodySsot={row.conditions_body} /></Detail> : null}
            {mode !== "integrated" ? <div className="mt-5 rounded-xl bg-white px-4 py-3 text-xs font-semibold text-neutral-500">{mode === "separate" ? "詳細は独立した募集ページで表示します。" : "会社ページでは要約を表示し、詳細は募集ページへ分離します。"}</div> : null}
            {row.application_url ? <a href={row.application_url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">応募ページへ</a> : null}
          </article>
        );
      })}
    </div>
  );
}

function MaterialList({ rows, style, onOpenPdf }: { rows: MaterialRow[]; style: DisplayStyle; onOpenPdf: (row: MaterialRow) => void }) {
  const wrapper = style === "cards" ? "grid gap-4 md:grid-cols-2" : "space-y-4";
  return (
    <div className={wrapper}>
      {rows.map((row) => (
        <article key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
          <div className="text-[11px] font-bold tracking-[0.12em] text-neutral-400">{row.material_type.toUpperCase()}</div>
          <h3 className="mt-1 font-bold text-neutral-900">{row.title}</h3>
          {row.description ? <p className="mt-3 text-sm leading-6 text-neutral-600">{row.description}</p> : null}
          <div className="mt-4">
            {row.material_type === "pdf" && row.file_path ? <button type="button" onClick={() => onOpenPdf(row)} className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white">PDFを見る</button> : null}
            {row.material_type !== "pdf" && row.external_url ? <a href={row.external_url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white">開く</a> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-6 border-t border-neutral-200 pt-6"><h4 className="mb-4 text-sm font-bold text-neutral-950">{title}</h4>{children}</div>;
}

function Info({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return <div><dt className="text-xs font-bold text-neutral-400">{label}</dt><dd className="mt-1 font-medium text-neutral-800">{value}</dd></div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-400">{children}</p>;
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-neutral-50 px-4 py-16"><div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">{children}</div></main>;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return [year, month, day].filter(Boolean).join("/");
}
