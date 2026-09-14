"use client";

import type { ReactNode } from "react";
import PageBodyPanelRenderer from "@/components/parari/mvp/PageBodyPanelRenderer";
import type {
  CppCompanyDisplayStyle,
  CppCompanyPublicBlock,
  CppCompanyPublicMaterial,
  CppCompanyPublicModel,
  CppCompanyPublicPosition,
  CppCompanyPublicRecruitment,
} from "@/lib/cpp/companyPublicTypes";

type Props = {
  model: CppCompanyPublicModel;
  banner?: ReactNode;
  footerLabel?: string;
  onOpenPdf?: (material: CppCompanyPublicMaterial) => void;
};

export default function CppCompanyPublicRenderer({
  model,
  banner,
  footerLabel = "CPP COMPANY PROFILE",
  onOpenPdf,
}: Props) {
  const { company, blocks, positions, recruitments, materials } = model;
  const companyBlocks = blocks.filter((row) => row.kind !== "research");
  const researchBlocks = blocks.filter((row) => row.kind === "research");
  const visibleLayout = [...model.layout]
    .filter((row) => row.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-5">
        {banner}

        <header className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-6 sm:grid-cols-[150px_1fr] sm:items-start">
            <div className="aspect-square overflow-hidden rounded-[1.75rem] bg-neutral-100">
              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logoUrl} alt={company.name} className="h-full w-full object-contain p-4" />
              ) : (
                <div className="flex h-full items-center justify-center px-4 text-center text-xs font-bold text-neutral-300">COMPANY LOGO</div>
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
              {company.shortDescription ? <p className="mt-5 max-w-3xl text-sm leading-7 text-neutral-700">{company.shortDescription}</p> : null}
              {company.websiteUrl ? (
                <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block text-sm font-semibold text-neutral-700 underline underline-offset-4">
                  会社Webサイト
                </a>
              ) : null}
            </div>
          </div>
        </header>

        {visibleLayout.map((section) => {
          switch (section.sectionKey) {
            case "company":
              return (
                <SectionShell key="company" title="会社紹介" style={section.displayStyle} empty={companyBlocks.length === 0}>
                  <ContentBlockList rows={companyBlocks} style={section.displayStyle} />
                </SectionShell>
              );
            case "research":
              return (
                <SectionShell key="research" title="研究・技術" style={section.displayStyle} empty={researchBlocks.length === 0}>
                  <ContentBlockList rows={researchBlocks} style={section.displayStyle} />
                </SectionShell>
              );
            case "positions":
              return (
                <SectionShell key="positions" title="求める研究者・ポジション" style={section.displayStyle} empty={positions.length === 0}>
                  <PositionList rows={positions} style={section.displayStyle} />
                </SectionShell>
              );
            case "recruitments":
              return (
                <SectionShell key="recruitments" title="募集情報" style={section.displayStyle} empty={recruitments.length === 0}>
                  <RecruitmentList rows={recruitments} mode={company.recruitmentDisplayMode} style={section.displayStyle} />
                </SectionShell>
              );
            case "materials":
              return (
                <SectionShell key="materials" title="資料" style={section.displayStyle} empty={materials.length === 0}>
                  <MaterialList rows={materials} style={section.displayStyle} onOpenPdf={onOpenPdf} />
                </SectionShell>
              );
          }
        })}

        <footer className="pb-8 text-center text-xs text-neutral-400">{footerLabel}</footer>
      </div>
    </main>
  );
}

function SectionShell({ title, style, empty, children }: { title: string; style: CppCompanyDisplayStyle; empty: boolean; children: ReactNode }) {
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

function ContentBlockList({ rows, style }: { rows: CppCompanyPublicBlock[]; style: CppCompanyDisplayStyle }) {
  const wrapperClass = style === "cards" ? "grid gap-4 md:grid-cols-2" : "space-y-7";
  return (
    <div className={wrapperClass}>
      {rows.map((row) => (
        <article key={row.id} className={style === "cards" ? "rounded-2xl border border-neutral-200 bg-neutral-50 p-5" : ""}>
          <h3 className={style === "featured" ? "text-2xl font-bold text-neutral-950" : "text-lg font-bold text-neutral-950"}>{row.title}</h3>
          {row.body ? <div className="mt-4"><PageBodyPanelRenderer bodySsot={row.body} /></div> : <Empty>本文はまだ入力されていません。</Empty>}
        </article>
      ))}
    </div>
  );
}

function PositionList({ rows, style }: { rows: CppCompanyPublicPosition[]; style: CppCompanyDisplayStyle }) {
  const visibleRows = rows.filter((row) => row.isActive);
  const wrapperClass = style === "cards" ? "grid gap-4 md:grid-cols-2" : "space-y-8";
  if (visibleRows.length === 0) return <Empty>現在表示するポジションはありません。</Empty>;

  return (
    <div className={wrapperClass}>
      {visibleRows.map((row) => (
        <article key={row.id} className={style === "cards" ? "rounded-2xl border border-neutral-200 bg-neutral-50 p-5" : "border-b border-neutral-100 pb-7 last:border-b-0 last:pb-0"}>
          <h3 className={style === "featured" ? "text-2xl font-bold text-neutral-950" : "text-xl font-bold text-neutral-950"}>{row.title}</h3>
          {row.summary ? <p className="mt-3 text-sm leading-7 text-neutral-700">{row.summary}</p> : null}
          {row.researchKeywords.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {row.researchKeywords.map((keyword) => <span key={keyword} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 ring-1 ring-neutral-200">{keyword}</span>)}
            </div>
          ) : null}
          <dl className="mt-5 grid gap-3 rounded-2xl bg-white p-4 text-sm sm:grid-cols-2">
            <Info label="対象学位・条件" value={row.degreeRequirement} />
            <Info label="雇用形態" value={row.employmentType} />
            <Info label="主な勤務地" value={row.defaultLocation} />
          </dl>
          {row.roleBody ? <Detail title="このポジションで担うこと" body={row.roleBody} /> : null}
          {row.researchBody ? <Detail title="研究・技術とのつながり" body={row.researchBody} /> : null}
          {row.idealCandidateBody ? <Detail title="こんな研究者と出会いたい" body={row.idealCandidateBody} /> : null}
        </article>
      ))}
    </div>
  );
}

function RecruitmentList({ rows, mode, style }: { rows: CppCompanyPublicRecruitment[]; mode: "integrated" | "separate" | "hybrid"; style: CppCompanyDisplayStyle }) {
  const visibleRows = rows.filter((row) => row.status !== "closed");
  if (visibleRows.length === 0) return <Empty>現在表示する募集はありません。</Empty>;

  return (
    <div className={style === "cards" ? "grid gap-4 md:grid-cols-2" : "space-y-7"}>
      {visibleRows.map((row) => {
        const showFull = mode === "integrated";
        return (
          <article key={row.id} className={style === "cards" ? "rounded-2xl border border-neutral-200 bg-neutral-50 p-5" : "border-b border-neutral-100 pb-7 last:border-b-0 last:pb-0"}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                {row.cycleLabel ? <div className="text-xs font-bold tracking-[0.12em] text-neutral-400">{row.cycleLabel}</div> : null}
                <h3 className={style === "featured" ? "mt-1 text-2xl font-bold text-neutral-950" : "mt-1 text-xl font-bold text-neutral-950"}>{row.title}</h3>
              </div>
              <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-[11px] font-bold text-neutral-500">
                {mode === "integrated" ? "ページ内表示" : mode === "hybrid" ? "要約＋詳細ページ" : "独立ページ"}
              </span>
            </div>
            {row.summary ? <p className="mt-4 text-sm leading-7 text-neutral-700">{row.summary}</p> : null}
            <dl className="mt-5 grid gap-3 rounded-2xl bg-neutral-50 p-5 text-sm sm:grid-cols-2">
              <Info label="雇用形態" value={row.employmentType} />
              <Info label="勤務地" value={row.location} />
              <Info label="対象学位・条件" value={row.degreeRequirement} />
              <Info label="給与・待遇" value={row.salaryText} />
              <Info label="募集人数" value={row.positionsCount ? `${row.positionsCount}名` : null} />
              <Info label="応募開始" value={formatDate(row.opensOn)} />
              <Info label="応募締切" value={formatDate(row.deadline)} />
            </dl>
            {showFull ? (
              <>
                {row.jobBody ? <Detail title="仕事内容・プロジェクト" body={row.jobBody} /> : null}
                {row.qualificationsBody ? <Detail title="応募条件・求める人物" body={row.qualificationsBody} /> : null}
                {row.conditionsBody ? <Detail title="勤務条件・その他" body={row.conditionsBody} /> : null}
              </>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 px-4 py-3 text-xs leading-6 text-neutral-500">
                {mode === "hybrid" ? "公開時は会社ページにこの要約を表示し、詳しい募集内容は独立した募集ページで表示します。" : "公開時は会社ページには募集への入口だけを表示し、募集内容は独立したページで表示します。"}
              </div>
            )}
            {row.applicationUrl ? (
              <a href={row.applicationUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">応募ページへ</a>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function MaterialList({ rows, style, onOpenPdf }: { rows: CppCompanyPublicMaterial[]; style: CppCompanyDisplayStyle; onOpenPdf?: (row: CppCompanyPublicMaterial) => void }) {
  return (
    <div className={style === "cards" ? "grid gap-4 md:grid-cols-2" : "space-y-4"}>
      {rows.map((row) => (
        <article key={row.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">{row.materialType}</div>
          <h3 className="mt-2 text-base font-bold text-neutral-950">{row.title}</h3>
          {row.description ? <p className="mt-2 text-sm leading-6 text-neutral-600">{row.description}</p> : null}
          <div className="mt-4">
            {row.materialType === "pdf" && row.filePath && onOpenPdf ? (
              <button type="button" onClick={() => onOpenPdf(row)} className="text-sm font-bold text-neutral-800 underline underline-offset-4">PDFを開く</button>
            ) : row.externalUrl ? (
              <a href={row.externalUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-neutral-800 underline underline-offset-4">資料を開く</a>
            ) : (
              <span className="text-xs font-semibold text-neutral-400">サンプル資料</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function Detail({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-6 border-t border-neutral-200 pt-6">
      <h4 className="mb-4 text-sm font-bold text-neutral-950">{title}</h4>
      <PageBodyPanelRenderer bodySsot={body} />
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

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-neutral-400">{children}</p>;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  return [year, month, day].filter(Boolean).join("/");
}
