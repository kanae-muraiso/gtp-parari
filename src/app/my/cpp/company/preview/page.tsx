"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import CppCompanyPublicRenderer from "@/components/parari/cpp/company/CppCompanyPublicRenderer";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import { layoutFromCppCompanyTemplate } from "@/lib/cpp/companyPageTemplates";
import type { CppCompanyPublicMaterial, CppCompanyPublicModel } from "@/lib/cpp/companyPublicTypes";

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
  presentation_type: string | null;
  recruitment_display_mode: "integrated" | "separate" | "hybrid";
};

type LayoutRow = {
  section_key: "company" | "research" | "positions" | "recruitments" | "materials";
  is_visible: boolean;
  display_style: "standard" | "cards" | "featured" | "compact";
  sort_order: number;
};

export default function CppCompanyPreviewPage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [model, setModel] = useState<CppCompanyPublicModel | null>(null);
  const [memberRole, setMemberRole] = useState<string | null>(null);
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
      .select("company_id, role")
      .eq("user_id", authData.user.id)
      .limit(1);

    if (memberError) {
      setErrorMessage(`企業情報の取得に失敗しました: ${memberError.message}`);
      setLoading(false);
      return;
    }

    const membership = (memberRows ?? [])[0] as { company_id?: string; role?: string } | undefined;
    const companyId = membership?.company_id;
    if (!companyId) {
      setLoading(false);
      return;
    }
    setMemberRole(membership?.role ?? null);

    const [companyResult, blockResult, positionResult, recruitmentResult, materialResult, layoutResult] = await Promise.all([
      supabase
        .from("cpp_companies")
        .select("id, name, slug, logo_path, tagline, industry, headquarters, website_url, short_description, presentation_type, recruitment_display_mode")
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
        .select("section_key, is_visible, display_style, sort_order")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true }),
    ]);

    const firstError = companyResult.error || blockResult.error || positionResult.error || recruitmentResult.error || materialResult.error || layoutResult.error;
    if (firstError) {
      setErrorMessage(`企業ページのプレビュー取得に失敗しました: ${firstError.message}`);
      setLoading(false);
      return;
    }

    const company = companyResult.data;
    const logoUrl = company.logo_path
      ? supabase.storage.from("parari-images").getPublicUrl(company.logo_path).data.publicUrl
      : null;
    const layoutRows = (layoutResult.data ?? []) as LayoutRow[];

    setModel({
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logoUrl,
        tagline: company.tagline,
        industry: company.industry,
        headquarters: company.headquarters,
        websiteUrl: company.website_url,
        shortDescription: company.short_description,
        recruitmentDisplayMode: company.recruitment_display_mode,
      },
      blocks: (blockResult.data ?? []).map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        body: row.body,
        sortOrder: row.sort_order,
      })),
      positions: (positionResult.data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        roleBody: row.role_body,
        researchBody: row.research_body,
        idealCandidateBody: row.ideal_candidate_body,
        degreeRequirement: row.degree_requirement,
        employmentType: row.employment_type,
        defaultLocation: row.default_location,
        researchKeywords: row.research_keywords ?? [],
        isActive: row.is_active,
        sortOrder: row.sort_order,
      })),
      recruitments: (recruitmentResult.data ?? []).map((row) => ({
        id: row.id,
        positionId: row.position_id,
        title: row.title,
        cycleLabel: row.cycle_label,
        opensOn: row.opens_on,
        deadline: row.deadline,
        employmentType: row.employment_type,
        location: row.location,
        degreeRequirement: row.degree_requirement,
        salaryText: row.salary_text,
        positionsCount: row.positions_count,
        summary: row.summary,
        jobBody: row.job_body,
        qualificationsBody: row.qualifications_body,
        conditionsBody: row.conditions_body,
        applicationUrl: row.application_url,
        status: row.status,
        sortOrder: row.sort_order,
      })),
      materials: (materialResult.data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        materialType: row.material_type,
        filePath: row.file_path,
        fileName: row.file_name,
        externalUrl: row.external_url,
        description: row.description,
        sortOrder: row.sort_order,
      })),
      layout: layoutRows.length > 0
        ? layoutRows.map((row) => ({
          sectionKey: row.section_key,
          isVisible: row.is_visible,
          displayStyle: row.display_style,
          sortOrder: row.sort_order,
        }))
        : layoutFromCppCompanyTemplate(company.presentation_type),
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPdf = useCallback(async (row: CppCompanyPublicMaterial) => {
    if (!supabase || !row.filePath) return;
    const { data, error } = await supabase.storage.from("cpp-company-documents").createSignedUrl(row.filePath, 300);
    if (error || !data?.signedUrl) {
      setErrorMessage(`PDFを開けませんでした: ${error?.message ?? "unknown error"}`);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }, [supabase]);

  if (loading) return <CenteredCard>企業ページを読み込んでいます…</CenteredCard>;

  if (!model) {
    return (
      <CenteredCard>
        <div>表示できるCPP企業がありません。</div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/cpp/company/try" className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white">企業・団体登録へ</Link>
          <Link href="/my/cpp/consultant" className="rounded-full border border-neutral-300 px-5 py-3 text-sm font-bold text-neutral-700">担当企業を見る</Link>
        </div>
      </CenteredCard>
    );
  }

  const banner = (
    <>
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-xs font-semibold ${memberRole === "consultant" ? "bg-sky-100 text-sky-900" : "bg-amber-100 text-amber-900"}`}>
        <span>{memberRole === "consultant" ? "CPP COMPANY サポーターとして、この会社の保存済みページを確認しています。" : "CPP企業ページの掲載プレビューです。WORKBOOKに保存済みの内容を表示しています。"}</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void load()} className="rounded-full bg-white px-4 py-2 font-bold text-neutral-900">最新内容を再読込</button>
          <Link href="/my/cpp/company/layout" className="rounded-full bg-white px-4 py-2 font-bold text-neutral-900">ページ構成</Link>
          <Link href="/my/cpp/company" className="rounded-full bg-white px-4 py-2 font-bold text-neutral-900">← WORKBOOK</Link>
        </div>
      </div>
      {errorMessage ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}
    </>
  );

  return <CppCompanyPublicRenderer model={model} banner={banner} footerLabel="CPP COMPANY PROFILE · PREVIEW" onOpenPdf={openPdf} />;
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">{children}</div>
    </main>
  );
}
