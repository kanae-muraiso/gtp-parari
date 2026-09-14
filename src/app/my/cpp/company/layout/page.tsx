"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import {
  CPP_COMPANY_PAGE_TEMPLATES,
  CPP_COMPANY_PRESENTATION_TYPES,
  getCppCompanyTemplate,
  layoutFromCppCompanyTemplate,
  type CppCompanyPresentationType,
} from "@/lib/cpp/companyPageTemplates";
import type { CppCompanyDisplayStyle, CppCompanySectionKey, CppRecruitmentDisplayMode } from "@/lib/cpp/companyPublicTypes";

type LayoutRow = {
  company_id: string;
  section_key: CppCompanySectionKey;
  is_visible: boolean;
  display_style: CppCompanyDisplayStyle;
  sort_order: number;
};

type CompanyRow = {
  id: string;
  name: string;
  presentation_type: CppCompanyPresentationType | null;
  recruitment_display_mode: CppRecruitmentDisplayMode;
};

type Counts = Record<CppCompanySectionKey, number>;

const SECTION_META: Record<CppCompanySectionKey, { label: string; description: string }> = {
  company: { label: "会社紹介", description: "会社概要・文化・メッセージ" },
  research: { label: "研究・技術", description: "研究領域・技術・研究課題" },
  positions: { label: "ポジション", description: "継続して求める研究者像" },
  recruitments: { label: "募集", description: "現在募集中の案件" },
  materials: { label: "資料", description: "PDF・動画・外部資料" },
};

const STYLE_LABEL: Record<CppCompanyDisplayStyle, string> = {
  standard: "標準",
  cards: "カード",
  featured: "大きく表示",
  compact: "コンパクト",
};

const MODE_LABEL: Record<CppRecruitmentDisplayMode, string> = {
  integrated: "合体型：会社ページ内に募集詳細まで表示",
  separate: "分離型：募集は独立ページで表示",
  hybrid: "ハイブリッド型：会社ページに要約、詳細は独立ページ",
};

export default function CppCompanyLayoutPage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [rows, setRows] = useState<LayoutRow[]>([]);
  const [counts, setCounts] = useState<Counts>({ company: 0, research: 0, positions: 0, recruitments: 0, materials: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const queryTemplateApplied = useRef(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setErrorMessage("");

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
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

    const [companyResult, layoutResult, blockResult, positionResult, recruitmentResult, materialResult] = await Promise.all([
      supabase.from("cpp_companies").select("id, name, presentation_type, recruitment_display_mode").eq("id", companyId).single<CompanyRow>(),
      supabase.from("cpp_company_page_sections").select("company_id, section_key, is_visible, display_style, sort_order").eq("company_id", companyId).order("sort_order", { ascending: true }),
      supabase.from("cpp_company_content_blocks").select("id, kind").eq("company_id", companyId),
      supabase.from("cpp_company_positions").select("id").eq("company_id", companyId),
      supabase.from("cpp_company_recruitments").select("id, status").eq("company_id", companyId),
      supabase.from("cpp_company_materials").select("id").eq("company_id", companyId),
    ]);

    const firstError = companyResult.error || layoutResult.error || blockResult.error || positionResult.error || recruitmentResult.error || materialResult.error;
    if (firstError) {
      setErrorMessage(`ページ構成の取得に失敗しました: ${firstError.message}`);
      setLoading(false);
      return;
    }

    const loadedCompany = companyResult.data;
    const loadedLayout = (layoutResult.data ?? []) as LayoutRow[];
    const initialLayout = loadedLayout.length > 0
      ? loadedLayout
      : layoutFromCppCompanyTemplate(loadedCompany.presentation_type).map((row) => ({
        company_id: companyId,
        section_key: row.sectionKey,
        is_visible: row.isVisible,
        display_style: row.displayStyle,
        sort_order: row.sortOrder,
      }));
    const blocks = (blockResult.data ?? []) as Array<{ id: string; kind: string }>;

    setCompany(loadedCompany);
    setRows(initialLayout);
    setCounts({
      company: blocks.filter((row) => row.kind !== "research").length,
      research: blocks.filter((row) => row.kind === "research").length,
      positions: (positionResult.data ?? []).length,
      recruitments: (recruitmentResult.data ?? []).filter((row: { status?: string }) => row.status !== "closed").length,
      materials: (materialResult.data ?? []).length,
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!company || rows.length === 0 || queryTemplateApplied.current || typeof window === "undefined") return;
    queryTemplateApplied.current = true;
    const requested = new URLSearchParams(window.location.search).get("template");
    if (!requested || !(requested in CPP_COMPANY_PAGE_TEMPLATES)) return;
    const type = requested as CppCompanyPresentationType;
    const template = CPP_COMPANY_PAGE_TEMPLATES[type];
    setCompany((current) => current ? { ...current, presentation_type: type, recruitment_display_mode: template.recruitmentDisplayMode } : current);
    setRows(layoutFromCppCompanyTemplate(type).map((row) => ({
      company_id: company.id,
      section_key: row.sectionKey,
      is_visible: row.isVisible,
      display_style: row.displayStyle,
      sort_order: row.sortOrder,
    })));
    setMessage(`「${template.label}」を読み込みました。保存すると確定します。`);
  }, [company, rows.length]);

  const patchRow = (key: CppCompanySectionKey, patch: Partial<LayoutRow>) => {
    setRows((current) => current.map((row) => row.section_key === key ? { ...row, ...patch } : row));
    setMessage("");
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    setRows((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((row, sort_order) => ({ ...row, sort_order }));
    });
    setMessage("");
  };

  const applyTemplate = (type: CppCompanyPresentationType) => {
    if (!company) return;
    const template = CPP_COMPANY_PAGE_TEMPLATES[type];
    setCompany({ ...company, presentation_type: type, recruitment_display_mode: template.recruitmentDisplayMode });
    setRows(layoutFromCppCompanyTemplate(type).map((row) => ({
      company_id: company.id,
      section_key: row.sectionKey,
      is_visible: row.isVisible,
      display_style: row.displayStyle,
      sort_order: row.sortOrder,
    })));
    setMessage(`「${template.label}」の構成を反映しました。保存すると確定します。`);
  };

  const save = async () => {
    if (!supabase || !company) return;
    setSaving(true);
    setErrorMessage("");
    setMessage("保存中…");

    const normalized = rows.map((row, sort_order) => ({
      company_id: company.id,
      section_key: row.section_key,
      is_visible: row.is_visible,
      display_style: row.display_style,
      sort_order,
    }));

    const [layoutResult, companyResult] = await Promise.all([
      supabase.from("cpp_company_page_sections").upsert(normalized, { onConflict: "company_id,section_key" }),
      supabase.from("cpp_companies").update({
        presentation_type: company.presentation_type,
        recruitment_display_mode: company.recruitment_display_mode,
      }).eq("id", company.id),
    ]);

    setSaving(false);
    const firstError = layoutResult.error || companyResult.error;
    if (firstError) {
      setMessage("");
      setErrorMessage(`ページ構成の保存に失敗しました: ${firstError.message}`);
      return;
    }
    setRows(normalized as LayoutRow[]);
    setMessage("ページ構成を保存しました。プレビューにも同じ構成が反映されます。");
  };

  if (loading) return <Centered>ページ構成を読み込んでいます…</Centered>;

  if (!company) {
    return (
      <Centered>
        <div>表示できるCPP企業がありません。</div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/cpp/company/try" className="rounded-full bg-neutral-900 px-5 py-3 font-bold text-white">企業登録へ</Link>
          <Link href="/my/cpp/consultant" className="rounded-full border border-neutral-300 px-5 py-3 font-bold text-neutral-700">担当企業を見る</Link>
        </div>
      </Centered>
    );
  }

  const selectedTemplate = getCppCompanyTemplate(company.presentation_type);

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold tracking-[0.2em] text-neutral-400">CPP COMPANY WORKBOOK</div>
            <h1 className="mt-1 text-2xl font-bold text-neutral-950">ページ構成</h1>
            <p className="mt-2 text-sm leading-6 text-neutral-600">入力済みの情報はそのままに、公開ページで何を先に見せるかを決めます。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/my/cpp/company" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700">← WORKBOOK</Link>
            <Link href="/my/cpp/company/support" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700">コンサルタント</Link>
            <Link href="/my/cpp/company/preview" className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white">掲載プレビュー →</Link>
          </div>
        </header>

        {errorMessage ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-5">
            <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold text-neutral-950">1. 5つのひな形から始める</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">ひな形は固定デザインではありません。選んだ後で、順番・表示・スタイルを自由に変えられます。</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {CPP_COMPANY_PRESENTATION_TYPES.map((type) => {
                  const template = CPP_COMPANY_PAGE_TEMPLATES[type];
                  const selected = company.presentation_type === type;
                  return (
                    <button key={type} type="button" onClick={() => applyTemplate(type)} className={`rounded-2xl border p-5 text-left transition ${selected ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white hover:bg-neutral-50"}`}>
                      <div className="text-sm font-bold">{template.label}</div>
                      <div className={`mt-1 text-xs font-semibold ${selected ? "text-neutral-300" : "text-neutral-500"}`}>{template.shortLabel}</div>
                      <p className={`mt-3 text-xs leading-6 ${selected ? "text-neutral-300" : "text-neutral-500"}`}>{template.description}</p>
                      <div className={`mt-3 text-[11px] leading-5 ${selected ? "text-neutral-400" : "text-neutral-400"}`}>{template.sections.filter((section) => section.visible).map((section) => SECTION_META[section.key].label).join(" → ")}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold text-neutral-950">2. 並び順と見せ方を調整</h2>
              <div className="mt-5 space-y-3">
                {rows.map((row, index) => {
                  const meta = SECTION_META[row.section_key];
                  return (
                    <div key={row.section_key} className={`rounded-2xl border p-4 ${row.is_visible ? "border-neutral-200 bg-white" : "border-neutral-200 bg-neutral-50 opacity-70"}`}>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex gap-1">
                          <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded-lg border border-neutral-200 px-2 py-1 text-xs disabled:opacity-30">↑</button>
                          <button type="button" onClick={() => move(index, 1)} disabled={index === rows.length - 1} className="rounded-lg border border-neutral-200 px-2 py-1 text-xs disabled:opacity-30">↓</button>
                        </div>
                        <div className="min-w-[180px] flex-1">
                          <div className="font-bold text-neutral-900">{meta.label}</div>
                          <div className="mt-1 text-xs text-neutral-400">{meta.description} · {counts[row.section_key]}件</div>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                          <input type="checkbox" checked={row.is_visible} onChange={(event) => patchRow(row.section_key, { is_visible: event.target.checked })} />表示
                        </label>
                        <select value={row.display_style} onChange={(event) => patchRow(row.section_key, { display_style: event.target.value as CppCompanyDisplayStyle })} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700">
                          {(Object.keys(STYLE_LABEL) as CppCompanyDisplayStyle[]).map((style) => <option key={style} value={style}>{STYLE_LABEL[style]}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold text-neutral-950">3. 募集の見せ方</h2>
              <div className="mt-4 space-y-2">
                {(Object.keys(MODE_LABEL) as CppRecruitmentDisplayMode[]).map((mode) => (
                  <label key={mode} className={`flex cursor-pointer gap-3 rounded-2xl border p-4 ${company.recruitment_display_mode === mode ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"}`}>
                    <input type="radio" name="recruitment-mode" checked={company.recruitment_display_mode === mode} onChange={() => setCompany({ ...company, recruitment_display_mode: mode })} />
                    <span className="text-sm font-semibold text-neutral-800">{MODE_LABEL[mode]}</span>
                  </label>
                ))}
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void save()} disabled={saving} className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? "保存中…" : "ページ構成を保存"}</button>
              {message ? <span className="text-sm font-semibold text-neutral-600">{message}</span> : null}
            </div>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">CURRENT TEMPLATE</div>
              <h2 className="mt-2 text-xl font-bold text-neutral-950">{selectedTemplate.label}</h2>
              <p className="mt-3 text-sm leading-7 text-neutral-600">{selectedTemplate.recommendedFor}</p>
              <div className="mt-6 space-y-2">
                {rows.filter((row) => row.is_visible).sort((a, b) => a.sort_order - b.sort_order).map((row, index) => (
                  <div key={row.section_key} className="flex items-center gap-3 rounded-xl bg-neutral-50 px-4 py-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-bold text-white">{index + 1}</span>
                    <div className="flex-1 text-sm font-bold text-neutral-800">{SECTION_META[row.section_key].label}</div>
                    <div className="text-[10px] font-semibold text-neutral-400">{STYLE_LABEL[row.display_style]}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl bg-neutral-900 p-5 text-white">
                <div className="text-xs font-bold text-neutral-400">PREVIEW</div>
                <p className="mt-2 text-sm leading-6 text-neutral-300">保存後、実際のCOMPANY WORKBOOKの内容をこの構成で確認できます。</p>
                <Link href="/my/cpp/company/preview" className="mt-4 inline-block rounded-full bg-white px-4 py-2 text-xs font-bold text-neutral-900">掲載プレビューを見る →</Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">{children}</div>
    </main>
  );
}
