"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import CppRichContentEditor from "@/components/parari/cpp/CppRichContentEditor";

type TabKey = "company" | "research" | "positions" | "recruitments" | "materials";
type ContentKind = "company" | "research" | "culture" | "challenge" | "message" | "custom";
type SaveState = "idle" | "saving" | "saved" | "error";
type RecruitmentDisplayMode = "integrated" | "separate" | "hybrid";

type CompanyRow = {
  id: string;
  created_by_user_id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  tagline: string | null;
  industry: string | null;
  headquarters: string | null;
  website_url: string | null;
  short_description: string | null;
  presentation_type: string | null;
  recruitment_display_mode: RecruitmentDisplayMode;
  visibility: "draft" | "published";
};

type ContentBlock = {
  id: string;
  company_id: string;
  created_by_user_id: string;
  kind: ContentKind;
  title: string;
  body: string | null;
  sort_order: number;
  saveState?: SaveState;
  saveMessage?: string;
};

type PositionRow = {
  id: string;
  company_id: string;
  created_by_user_id: string;
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
  saveState?: SaveState;
  saveMessage?: string;
};

type RecruitmentRow = {
  id: string;
  company_id: string;
  created_by_user_id: string;
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
  saveState?: SaveState;
  saveMessage?: string;
};

type MaterialRow = {
  id: string;
  company_id: string;
  created_by_user_id: string;
  title: string;
  material_type: "pdf" | "link" | "youtube";
  file_path: string | null;
  file_name: string | null;
  external_url: string | null;
  description: string | null;
  sort_order: number;
  saveState?: SaveState;
  saveMessage?: string;
};

type ResearchFieldRow = {
  id: string;
  major_name_ja: string;
  minor_name_ja: string;
  major_sort: number;
  minor_sort: number;
};

type PositionFieldLink = {
  position_id: string;
  research_field_id: string;
};

type Identity = { userId: string; displayName: string };
type FieldPickerState = { major: string; candidateId: string };

const TABS: Array<{ key: TabKey; label: string; description: string }> = [
  { key: "company", label: "会社情報", description: "会社そのものの情報" },
  { key: "research", label: "研究・技術", description: "研究領域や技術を蓄積" },
  { key: "positions", label: "ポジション", description: "継続して求める研究者像" },
  { key: "recruitments", label: "募集", description: "年度・人数・締切など" },
  { key: "materials", label: "資料", description: "PDF・動画・外部資料" },
];

const PRESENTATION_TYPES = [
  ["position_first", "募集ポジション型"],
  ["researcher_first", "求める研究者型"],
  ["research_first", "研究・技術型"],
  ["culture_first", "会社・文化型"],
  ["challenge_first", "ベンチャー・挑戦型"],
] as const;

const BLOCK_KIND_LABEL: Record<ContentKind, string> = {
  company: "会社紹介",
  research: "研究・技術",
  culture: "文化・働き方",
  challenge: "挑戦・ストーリー",
  message: "研究者へのメッセージ",
  custom: "その他",
};

const DISPLAY_MODE_LABEL: Record<RecruitmentDisplayMode, string> = {
  integrated: "合体型：会社ページの中に募集詳細を表示",
  separate: "分離型：募集ごとに独立したページを表示",
  hybrid: "ハイブリッド型：会社ページに要約、詳細は募集ページ",
};

export default function CppCompanyWorkbook() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [activeTab, setActiveTab] = useState<TabKey>("company");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [recruitments, setRecruitments] = useState<RecruitmentRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [researchFields, setResearchFields] = useState<ResearchFieldRow[]>([]);
  const [positionFieldIds, setPositionFieldIds] = useState<Record<string, string[]>>({});
  const [fieldPickers, setFieldPickers] = useState<Record<string, FieldPickerState>>({});
  const [loading, setLoading] = useState(true);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyMessage, setCompanyMessage] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [materialUploadingId, setMaterialUploadingId] = useState<string | null>(null);
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

    const user = authData.user;
    const [profileResult, memberResult] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle<{ display_name: string | null }>(),
      supabase.from("cpp_company_members").select("company_id").eq("user_id", user.id).limit(1),
    ]);

    const authReadError = profileResult.error || memberResult.error;
    if (authReadError) {
      setErrorMessage(`企業情報の取得に失敗しました: ${authReadError.message}`);
      setLoading(false);
      return;
    }

    setIdentity({ userId: user.id, displayName: profileResult.data?.display_name || "PARARI USER" });
    const companyId = (memberResult.data ?? [])[0]?.company_id as string | undefined;
    if (!companyId) {
      setLoading(false);
      return;
    }

    const [companyResult, blockResult, positionResult, recruitmentResult, materialResult, fieldsResult] = await Promise.all([
      supabase
        .from("cpp_companies")
        .select("id, created_by_user_id, name, slug, logo_path, tagline, industry, headquarters, website_url, short_description, presentation_type, recruitment_display_mode, visibility")
        .eq("id", companyId)
        .single<CompanyRow>(),
      supabase
        .from("cpp_company_content_blocks")
        .select("id, company_id, created_by_user_id, kind, title, body, sort_order")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("cpp_company_positions")
        .select("id, company_id, created_by_user_id, title, summary, role_body, research_body, ideal_candidate_body, degree_requirement, employment_type, default_location, research_keywords, is_active, sort_order")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("cpp_company_recruitments")
        .select("id, company_id, created_by_user_id, position_id, title, cycle_label, opens_on, deadline, employment_type, location, degree_requirement, salary_text, positions_count, summary, job_body, qualifications_body, conditions_body, application_url, status, sort_order")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("cpp_company_materials")
        .select("id, company_id, created_by_user_id, title, material_type, file_path, file_name, external_url, description, sort_order")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("cpp_research_fields")
        .select("id, major_name_ja, minor_name_ja, major_sort, minor_sort")
        .order("major_sort", { ascending: true })
        .order("minor_sort", { ascending: true }),
    ]);

    const detailError = companyResult.error || blockResult.error || positionResult.error || recruitmentResult.error || materialResult.error || fieldsResult.error;
    if (detailError) {
      setErrorMessage(`COMPANY WORKBOOKの取得に失敗しました: ${detailError.message}`);
      setLoading(false);
      return;
    }

    const loadedPositions = (positionResult.data ?? []) as PositionRow[];
    let links: PositionFieldLink[] = [];
    if (loadedPositions.length > 0) {
      const { data, error } = await supabase
        .from("cpp_company_position_research_fields")
        .select("position_id, research_field_id")
        .in("position_id", loadedPositions.map((row) => row.id));
      if (error) {
        setErrorMessage(`ポジション研究分野の取得に失敗しました: ${error.message}`);
        setLoading(false);
        return;
      }
      links = (data ?? []) as PositionFieldLink[];
    }

    const fieldMap: Record<string, string[]> = {};
    for (const row of links) fieldMap[row.position_id] = [...(fieldMap[row.position_id] ?? []), row.research_field_id];

    setCompany(companyResult.data);
    setBlocks((blockResult.data ?? []) as ContentBlock[]);
    setPositions(loadedPositions);
    setRecruitments((recruitmentResult.data ?? []) as RecruitmentRow[]);
    setMaterials((materialResult.data ?? []) as MaterialRow[]);
    setResearchFields((fieldsResult.data ?? []) as ResearchFieldRow[]);
    setPositionFieldIds(fieldMap);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <CenteredCard>CPP COMPANY WORKBOOKを読み込んでいます…</CenteredCard>;

  if (!identity) {
    return (
      <CenteredCard>
        <div>PARARIへのログインが必要です。</div>
        <Link href="/login?returnTo=/my/cpp/company" className="mt-5 inline-block rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white">PARARIにログイン</Link>
      </CenteredCard>
    );
  }

  if (!company) {
    return (
      <CenteredCard>
        <div>CPPの企業・団体登録がまだありません。</div>
        <Link href="/cpp/company/try" className="mt-5 inline-block rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white">企業・団体登録へ</Link>
      </CenteredCard>
    );
  }

  const patchCompany = (patch: Partial<CompanyRow>) => {
    setCompany((current) => (current ? { ...current, ...patch } : current));
    setCompanyMessage("");
  };

  const saveCompany = async () => {
    if (!supabase || !company) return;
    if (!company.name.trim()) {
      setErrorMessage("会社・団体名を入力してください。");
      return;
    }
    setCompanySaving(true);
    setCompanyMessage("保存中…");
    const { error } = await supabase.from("cpp_companies").update({
      name: company.name.trim(),
      tagline: cleanText(company.tagline),
      industry: cleanText(company.industry),
      headquarters: cleanText(company.headquarters),
      website_url: cleanText(company.website_url),
      short_description: cleanText(company.short_description),
      presentation_type: cleanText(company.presentation_type),
      recruitment_display_mode: company.recruitment_display_mode,
    }).eq("id", company.id);
    setCompanySaving(false);
    if (error) {
      setCompanyMessage("");
      setErrorMessage(`会社情報の保存に失敗しました: ${error.message}`);
      return;
    }
    setCompanyMessage("保存しました");
  };

  const uploadLogo = async (file: File) => {
    if (!supabase || !identity || !company) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("ロゴには画像ファイルを選択してください。");
      return;
    }
    setLogoUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${identity.userId}/cpp-company/${company.id}/logo-${Date.now()}.${ext}`;
    const oldPath = company.logo_path;
    const { error: uploadError } = await supabase.storage.from("parari-images").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setLogoUploading(false);
      setErrorMessage(`ロゴのアップロードに失敗しました: ${uploadError.message}`);
      return;
    }
    const { error } = await supabase.from("cpp_companies").update({ logo_path: path }).eq("id", company.id);
    if (error) {
      await supabase.storage.from("parari-images").remove([path]);
      setLogoUploading(false);
      setErrorMessage(`ロゴ情報の保存に失敗しました: ${error.message}`);
      return;
    }
    if (oldPath) await supabase.storage.from("parari-images").remove([oldPath]);
    patchCompany({ logo_path: path });
    setLogoUploading(false);
    setCompanyMessage("ロゴを保存しました");
  };

  const addBlock = async (kind: ContentKind) => {
    if (!supabase || !identity || !company) return;
    const sameKind = blocks.filter((row) => row.kind === kind);
    const nextSort = blocks.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
    const { data, error } = await supabase.from("cpp_company_content_blocks").insert({
      company_id: company.id,
      created_by_user_id: identity.userId,
      kind,
      title: sameKind.length ? `${BLOCK_KIND_LABEL[kind]} ${sameKind.length + 1}` : BLOCK_KIND_LABEL[kind],
      sort_order: nextSort,
    }).select("id, company_id, created_by_user_id, kind, title, body, sort_order").single<ContentBlock>();
    if (error || !data) {
      setErrorMessage(`セクションの追加に失敗しました: ${error?.message ?? "unknown error"}`);
      return;
    }
    setBlocks((current) => [...current, { ...data, saveState: "saved", saveMessage: "追加しました" }]);
  };

  const saveBlock = async (row: ContentBlock) => {
    if (!supabase) return;
    setBlocks((current) => current.map((item) => item.id === row.id ? { ...item, saveState: "saving", saveMessage: "保存中…" } : item));
    const { error } = await supabase.from("cpp_company_content_blocks").update({ title: row.title.trim() || BLOCK_KIND_LABEL[row.kind], body: cleanRich(row.body), kind: row.kind }).eq("id", row.id);
    setBlocks((current) => current.map((item) => item.id === row.id ? { ...item, saveState: error ? "error" : "saved", saveMessage: error ? error.message : "保存しました" } : item));
  };

  const deleteBlock = async (row: ContentBlock) => {
    if (!supabase) return;
    const { error } = await supabase.from("cpp_company_content_blocks").delete().eq("id", row.id);
    if (error) {
      setErrorMessage(`セクションの削除に失敗しました: ${error.message}`);
      return;
    }
    setBlocks((current) => current.filter((item) => item.id !== row.id));
  };

  const addPosition = async () => {
    if (!supabase || !identity || !company) return;
    const nextSort = positions.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
    const { data, error } = await supabase.from("cpp_company_positions").insert({
      company_id: company.id,
      created_by_user_id: identity.userId,
      title: "新しいポジション",
      sort_order: nextSort,
    }).select("id, company_id, created_by_user_id, title, summary, role_body, research_body, ideal_candidate_body, degree_requirement, employment_type, default_location, research_keywords, is_active, sort_order").single<PositionRow>();
    if (error || !data) {
      setErrorMessage(`ポジションの追加に失敗しました: ${error?.message ?? "unknown error"}`);
      return;
    }
    setPositions((current) => [...current, { ...data, saveState: "saved", saveMessage: "追加しました" }]);
    setPositionFieldIds((current) => ({ ...current, [data.id]: [] }));
  };

  const savePosition = async (row: PositionRow) => {
    if (!supabase) return;
    setPositions((current) => current.map((item) => item.id === row.id ? { ...item, saveState: "saving", saveMessage: "保存中…" } : item));
    const { error } = await supabase.from("cpp_company_positions").update({
      title: row.title.trim() || "ポジション",
      summary: cleanText(row.summary),
      role_body: cleanRich(row.role_body),
      research_body: cleanRich(row.research_body),
      ideal_candidate_body: cleanRich(row.ideal_candidate_body),
      degree_requirement: cleanText(row.degree_requirement),
      employment_type: cleanText(row.employment_type),
      default_location: cleanText(row.default_location),
      research_keywords: row.research_keywords,
      is_active: row.is_active,
    }).eq("id", row.id);
    setPositions((current) => current.map((item) => item.id === row.id ? { ...item, saveState: error ? "error" : "saved", saveMessage: error ? error.message : "保存しました" } : item));
  };

  const deletePosition = async (row: PositionRow) => {
    if (!supabase) return;
    const { error } = await supabase.from("cpp_company_positions").delete().eq("id", row.id);
    if (error) {
      setErrorMessage(`ポジションの削除に失敗しました: ${error.message}`);
      return;
    }
    setPositions((current) => current.filter((item) => item.id !== row.id));
    setPositionFieldIds((current) => {
      const next = { ...current };
      delete next[row.id];
      return next;
    });
  };

  const addPositionField = async (positionId: string) => {
    if (!supabase) return;
    const candidateId = fieldPickers[positionId]?.candidateId;
    if (!candidateId || (positionFieldIds[positionId] ?? []).includes(candidateId)) return;
    const { error } = await supabase.from("cpp_company_position_research_fields").insert({ position_id: positionId, research_field_id: candidateId, sort_order: (positionFieldIds[positionId] ?? []).length });
    if (error) {
      setErrorMessage(`研究分野の追加に失敗しました: ${error.message}`);
      return;
    }
    setPositionFieldIds((current) => ({ ...current, [positionId]: [...(current[positionId] ?? []), candidateId] }));
    setFieldPickers((current) => ({ ...current, [positionId]: { ...(current[positionId] ?? { major: "" }), candidateId: "" } }));
  };

  const removePositionField = async (positionId: string, fieldId: string) => {
    if (!supabase) return;
    const { error } = await supabase.from("cpp_company_position_research_fields").delete().eq("position_id", positionId).eq("research_field_id", fieldId);
    if (error) {
      setErrorMessage(`研究分野の削除に失敗しました: ${error.message}`);
      return;
    }
    setPositionFieldIds((current) => ({ ...current, [positionId]: (current[positionId] ?? []).filter((id) => id !== fieldId) }));
  };

  const addRecruitment = async () => {
    if (!supabase || !identity || !company) return;
    const nextSort = recruitments.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
    const { data, error } = await supabase.from("cpp_company_recruitments").insert({
      company_id: company.id,
      created_by_user_id: identity.userId,
      title: "新しい募集",
      status: "draft",
      sort_order: nextSort,
    }).select("id, company_id, created_by_user_id, position_id, title, cycle_label, opens_on, deadline, employment_type, location, degree_requirement, salary_text, positions_count, summary, job_body, qualifications_body, conditions_body, application_url, status, sort_order").single<RecruitmentRow>();
    if (error || !data) {
      setErrorMessage(`募集の追加に失敗しました: ${error?.message ?? "unknown error"}`);
      return;
    }
    setRecruitments((current) => [...current, { ...data, saveState: "saved", saveMessage: "追加しました" }]);
  };

  const saveRecruitment = async (row: RecruitmentRow) => {
    if (!supabase) return;
    setRecruitments((current) => current.map((item) => item.id === row.id ? { ...item, saveState: "saving", saveMessage: "保存中…" } : item));
    const { error } = await supabase.from("cpp_company_recruitments").update({
      position_id: row.position_id || null,
      title: row.title.trim() || "募集",
      cycle_label: cleanText(row.cycle_label),
      opens_on: row.opens_on || null,
      deadline: row.deadline || null,
      employment_type: cleanText(row.employment_type),
      location: cleanText(row.location),
      degree_requirement: cleanText(row.degree_requirement),
      salary_text: cleanText(row.salary_text),
      positions_count: row.positions_count || null,
      summary: cleanText(row.summary),
      job_body: cleanRich(row.job_body),
      qualifications_body: cleanRich(row.qualifications_body),
      conditions_body: cleanRich(row.conditions_body),
      application_url: cleanText(row.application_url),
      status: row.status,
    }).eq("id", row.id);
    setRecruitments((current) => current.map((item) => item.id === row.id ? { ...item, saveState: error ? "error" : "saved", saveMessage: error ? error.message : "保存しました" } : item));
  };

  const deleteRecruitment = async (row: RecruitmentRow) => {
    if (!supabase) return;
    const { error } = await supabase.from("cpp_company_recruitments").delete().eq("id", row.id);
    if (error) {
      setErrorMessage(`募集の削除に失敗しました: ${error.message}`);
      return;
    }
    setRecruitments((current) => current.filter((item) => item.id !== row.id));
  };

  const addMaterial = async (type: MaterialRow["material_type"]) => {
    if (!supabase || !identity || !company) return;
    const nextSort = materials.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
    const { data, error } = await supabase.from("cpp_company_materials").insert({
      company_id: company.id,
      created_by_user_id: identity.userId,
      title: type === "pdf" ? "会社説明資料" : type === "youtube" ? "紹介動画" : "参考リンク",
      material_type: type,
      sort_order: nextSort,
    }).select("id, company_id, created_by_user_id, title, material_type, file_path, file_name, external_url, description, sort_order").single<MaterialRow>();
    if (error || !data) {
      setErrorMessage(`資料の追加に失敗しました: ${error?.message ?? "unknown error"}`);
      return;
    }
    setMaterials((current) => [...current, { ...data, saveState: "saved", saveMessage: "追加しました" }]);
  };

  const saveMaterial = async (row: MaterialRow) => {
    if (!supabase) return;
    setMaterials((current) => current.map((item) => item.id === row.id ? { ...item, saveState: "saving", saveMessage: "保存中…" } : item));
    const { error } = await supabase.from("cpp_company_materials").update({
      title: row.title.trim() || "資料",
      external_url: cleanText(row.external_url),
      description: cleanText(row.description),
    }).eq("id", row.id);
    setMaterials((current) => current.map((item) => item.id === row.id ? { ...item, saveState: error ? "error" : "saved", saveMessage: error ? error.message : "保存しました" } : item));
  };

  const uploadMaterialPdf = async (row: MaterialRow, file: File) => {
    if (!supabase || !company || file.type !== "application/pdf") {
      setErrorMessage("PDFファイルを選択してください。");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage("PDFは20MB以下にしてください。");
      return;
    }
    setMaterialUploadingId(row.id);
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
    const path = `${company.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("cpp-company-documents").upload(path, file, { contentType: "application/pdf", upsert: false });
    if (uploadError) {
      setMaterialUploadingId(null);
      setErrorMessage(`PDFのアップロードに失敗しました: ${uploadError.message}`);
      return;
    }
    const oldPath = row.file_path;
    const { error } = await supabase.from("cpp_company_materials").update({ file_path: path, file_name: file.name }).eq("id", row.id);
    if (error) {
      await supabase.storage.from("cpp-company-documents").remove([path]);
      setMaterialUploadingId(null);
      setErrorMessage(`PDF情報の保存に失敗しました: ${error.message}`);
      return;
    }
    if (oldPath) await supabase.storage.from("cpp-company-documents").remove([oldPath]);
    setMaterials((current) => current.map((item) => item.id === row.id ? { ...item, file_path: path, file_name: file.name, saveState: "saved", saveMessage: "PDFを保存しました" } : item));
    setMaterialUploadingId(null);
  };

  const openMaterialPdf = async (row: MaterialRow) => {
    if (!supabase || !row.file_path) return;
    const { data, error } = await supabase.storage.from("cpp-company-documents").createSignedUrl(row.file_path, 300);
    if (error || !data?.signedUrl) {
      setErrorMessage(`PDFを開けませんでした: ${error?.message ?? "unknown error"}`);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const deleteMaterial = async (row: MaterialRow) => {
    if (!supabase) return;
    const { error } = await supabase.from("cpp_company_materials").delete().eq("id", row.id);
    if (error) {
      setErrorMessage(`資料の削除に失敗しました: ${error.message}`);
      return;
    }
    if (row.file_path) await supabase.storage.from("cpp-company-documents").remove([row.file_path]);
    setMaterials((current) => current.filter((item) => item.id !== row.id));
  };

  const logoUrl = company.logo_path ? supabase?.storage.from("parari-images").getPublicUrl(company.logo_path).data.publicUrl ?? null : null;
  const companyBlocks = blocks.filter((row) => row.kind !== "research");
  const researchBlocks = blocks.filter((row) => row.kind === "research");

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold tracking-[0.2em] text-neutral-400">CPP COMPANY WORKBOOK</div>
            <h1 className="mt-1 text-2xl font-bold text-neutral-950">{company.name}</h1>
            <p className="mt-1 text-xs text-neutral-500">会社の博士採用情報を、毎年使える資産として蓄積します。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/cpp/company/examples" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700">完成見本</Link>
            <Link href="/my/cpp/company/preview" className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white">掲載プレビュー →</Link>
          </div>
        </div>

        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          入力内容は本物のDBに保存されます。現在は確認期間中のため、ここから一般公開はしません。
        </div>

        {errorMessage ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

        <nav className="grid gap-2 rounded-3xl border border-neutral-200 bg-white p-2 shadow-sm sm:grid-cols-5">
          {TABS.map((tab) => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`rounded-2xl px-4 py-3 text-left transition ${activeTab === tab.key ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"}`}>
              <div className="text-sm font-bold">{tab.label}</div>
              <div className={`mt-1 text-[11px] leading-4 ${activeTab === tab.key ? "text-neutral-300" : "text-neutral-400"}`}>{tab.description}</div>
            </button>
          ))}
        </nav>

        {activeTab === "company" ? (
          <div className="space-y-5">
            <Card title="会社の基本情報" description="ここは毎年書き直す場所ではありません。会社の基礎情報として残ります。" aside={companyMessage}>
              <div className="grid gap-6 md:grid-cols-[170px_1fr]">
                <div>
                  <div className="aspect-square overflow-hidden rounded-3xl bg-neutral-100">
                    {logoUrl ? <img src={logoUrl} alt={company.name} className="h-full w-full object-contain p-4" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-neutral-300">COMPANY LOGO</div>}
                  </div>
                  <label className="mt-3 block cursor-pointer rounded-full border border-neutral-300 bg-white px-3 py-2 text-center text-xs font-bold text-neutral-700">
                    {logoUploading ? "アップロード中…" : "ロゴを変更"}
                    <input type="file" accept="image/*" disabled={logoUploading} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadLogo(file); event.currentTarget.value = ""; }} />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="会社・団体名" className="sm:col-span-2"><input value={company.name} onChange={(e) => patchCompany({ name: e.target.value })} className={inputClass} /></Field>
                  <Field label="タグライン" className="sm:col-span-2"><input value={company.tagline ?? ""} onChange={(e) => patchCompany({ tagline: e.target.value })} className={inputClass} placeholder="例）研究で、まだない未来をつくる。" /></Field>
                  <Field label="業種"><input value={company.industry ?? ""} onChange={(e) => patchCompany({ industry: e.target.value })} className={inputClass} /></Field>
                  <Field label="本社・主な所在地"><input value={company.headquarters ?? ""} onChange={(e) => patchCompany({ headquarters: e.target.value })} className={inputClass} /></Field>
                  <Field label="Webサイト" className="sm:col-span-2"><input value={company.website_url ?? ""} onChange={(e) => patchCompany({ website_url: e.target.value })} className={inputClass} placeholder="https://..." /></Field>
                  <Field label="短い紹介" className="sm:col-span-2"><textarea value={company.short_description ?? ""} onChange={(e) => patchCompany({ short_description: e.target.value })} className={`${inputClass} min-h-24`} /></Field>
                  <Field label="会社案内の出発点"><select value={company.presentation_type ?? ""} onChange={(e) => patchCompany({ presentation_type: e.target.value || null })} className={inputClass}><option value="">未選択</option>{PRESENTATION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                  <div className="flex items-end"><button type="button" onClick={() => void saveCompany()} disabled={companySaving} className={primaryButton}>{companySaving ? "保存中…" : "会社情報を保存"}</button></div>
                </div>
              </div>
            </Card>

            <Card title="会社を伝えるセクション" description="会社紹介、文化、挑戦、研究者へのメッセージなどを自由に追加できます。">
              <div className="mb-5 flex flex-wrap gap-2">
                {(["company", "culture", "challenge", "message", "custom"] as ContentKind[]).map((kind) => <button key={kind} type="button" onClick={() => void addBlock(kind)} className={secondaryButton}>＋ {BLOCK_KIND_LABEL[kind]}</button>)}
              </div>
              <BlockList rows={companyBlocks} setRows={setBlocks} onSave={saveBlock} onDelete={deleteBlock} />
            </Card>
          </div>
        ) : null}

        {activeTab === "research" ? (
          <Card title="研究・技術" description="会社の研究領域、コア技術、解いている課題を蓄積します。募集がなくても残る会社の研究資産です。">
            <button type="button" onClick={() => void addBlock("research")} className={`${secondaryButton} mb-5`}>＋ 研究・技術セクションを追加</button>
            <BlockList rows={researchBlocks} setRows={setBlocks} onSave={saveBlock} onDelete={deleteBlock} />
          </Card>
        ) : null}

        {activeTab === "positions" ? (
          <Card title="ポジション台帳" description="『抗体創薬研究者』『データサイエンティスト』など、毎年の募集とは分けて継続的に保存します。">
            <button type="button" onClick={() => void addPosition()} className={`${primaryButton} mb-5`}>＋ ポジションを追加</button>
            <div className="space-y-5">
              {positions.length === 0 ? <Empty>まだポジションがありません。</Empty> : positions.map((row) => {
                const selectedIds = positionFieldIds[row.id] ?? [];
                const picker = fieldPickers[row.id] ?? { major: "", candidateId: "" };
                const majors = unique(researchFields.map((field) => field.major_name_ja));
                const minors = researchFields.filter((field) => field.major_name_ja === picker.major && !selectedIds.includes(field.id));
                return (
                  <article key={row.id} className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="ポジション名" className="sm:col-span-2"><input value={row.title} onChange={(e) => patchPosition(setPositions, row.id, { title: e.target.value })} className={inputClass} /></Field>
                      <Field label="短い説明" className="sm:col-span-2"><textarea value={row.summary ?? ""} onChange={(e) => patchPosition(setPositions, row.id, { summary: e.target.value })} className={`${inputClass} min-h-20`} /></Field>
                      <Field label="対象学位・条件"><input value={row.degree_requirement ?? ""} onChange={(e) => patchPosition(setPositions, row.id, { degree_requirement: e.target.value })} className={inputClass} /></Field>
                      <Field label="雇用形態"><input value={row.employment_type ?? ""} onChange={(e) => patchPosition(setPositions, row.id, { employment_type: e.target.value })} className={inputClass} /></Field>
                      <Field label="主な勤務地"><input value={row.default_location ?? ""} onChange={(e) => patchPosition(setPositions, row.id, { default_location: e.target.value })} className={inputClass} /></Field>
                      <Field label="キーワード（カンマ区切り）"><input value={row.research_keywords.join(", ")} onChange={(e) => patchPosition(setPositions, row.id, { research_keywords: e.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} className={inputClass} /></Field>
                    </div>

                    <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4">
                      <div className="text-xs font-bold text-neutral-600">研究分野（JREC-IN分類）</div>
                      <div className="mt-3 flex flex-wrap gap-2">{selectedIds.map((id) => { const field = researchFields.find((item) => item.id === id); return field ? <button key={id} type="button" onClick={() => void removePositionField(row.id, id)} className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700">{field.minor_name_ja} ×</button> : null; })}</div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <select value={picker.major} onChange={(e) => setFieldPickers((current) => ({ ...current, [row.id]: { major: e.target.value, candidateId: "" } }))} className={inputClass}><option value="">大分類</option>{majors.map((major) => <option key={major}>{major}</option>)}</select>
                        <select value={picker.candidateId} onChange={(e) => setFieldPickers((current) => ({ ...current, [row.id]: { ...picker, candidateId: e.target.value } }))} className={inputClass}><option value="">小分類</option>{minors.map((field) => <option key={field.id} value={field.id}>{field.minor_name_ja}</option>)}</select>
                        <button type="button" onClick={() => void addPositionField(row.id)} className={secondaryButton}>追加</button>
                      </div>
                    </div>

                    <RichField label="このポジションの役割" value={row.role_body} onChange={(value) => patchPosition(setPositions, row.id, { role_body: value })} />
                    <RichField label="研究内容・取り組む課題" value={row.research_body} onChange={(value) => patchPosition(setPositions, row.id, { research_body: value })} />
                    <RichField label="こんな研究者に来てほしい" value={row.ideal_candidate_body} onChange={(value) => patchPosition(setPositions, row.id, { ideal_candidate_body: value })} />

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-neutral-700"><input type="checkbox" checked={row.is_active} onChange={(e) => patchPosition(setPositions, row.id, { is_active: e.target.checked })} /> 現在も使うポジション</label>
                      <button type="button" onClick={() => void savePosition(row)} className={primaryButton}>保存</button>
                      <button type="button" onClick={() => void deletePosition(row)} className={dangerButton}>削除</button>
                      <SaveMessage row={row} />
                    </div>
                  </article>
                );
              })}
            </div>
          </Card>
        ) : null}

        {activeTab === "recruitments" ? (
          <div className="space-y-5">
            <Card title="募集の見せ方" description="募集データは1つだけ保存し、会社ページでの見せ方を切り替えます。">
              <div className="grid gap-3 lg:grid-cols-3">
                {(Object.keys(DISPLAY_MODE_LABEL) as RecruitmentDisplayMode[]).map((mode) => (
                  <button key={mode} type="button" onClick={() => patchCompany({ recruitment_display_mode: mode })} className={`rounded-2xl border p-4 text-left text-sm leading-6 ${company.recruitment_display_mode === mode ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700"}`}>
                    <div className="font-bold">{mode === "integrated" ? "合体型" : mode === "separate" ? "分離型" : "ハイブリッド型"}</div>
                    <div className={`mt-1 text-xs ${company.recruitment_display_mode === mode ? "text-neutral-300" : "text-neutral-500"}`}>{DISPLAY_MODE_LABEL[mode]}</div>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => void saveCompany()} className={`${primaryButton} mt-4`}>表示方式を保存</button>
            </Card>

            <Card title="募集案件" description="ポジション台帳を元に、年度・人数・締切などその時だけの情報を記録します。終了後も履歴として残せます。">
              <button type="button" onClick={() => void addRecruitment()} className={`${primaryButton} mb-5`}>＋ 募集を追加</button>
              <div className="space-y-5">
                {recruitments.length === 0 ? <Empty>まだ募集案件がありません。</Empty> : recruitments.map((row) => (
                  <article key={row.id} className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="募集タイトル" className="sm:col-span-2"><input value={row.title} onChange={(e) => patchRecruitment(setRecruitments, row.id, { title: e.target.value })} className={inputClass} /></Field>
                      <Field label="元にするポジション"><select value={row.position_id ?? ""} onChange={(e) => patchRecruitment(setRecruitments, row.id, { position_id: e.target.value || null })} className={inputClass}><option value="">ポジションに紐づけない</option>{positions.map((position) => <option key={position.id} value={position.id}>{position.title}</option>)}</select></Field>
                      <Field label="募集年度・名称"><input value={row.cycle_label ?? ""} onChange={(e) => patchRecruitment(setRecruitments, row.id, { cycle_label: e.target.value })} className={inputClass} placeholder="例）2027年度研究職募集" /></Field>
                      <Field label="募集開始日"><input type="date" value={row.opens_on ?? ""} onChange={(e) => patchRecruitment(setRecruitments, row.id, { opens_on: e.target.value || null })} className={inputClass} /></Field>
                      <Field label="応募締切"><input type="date" value={row.deadline ?? ""} onChange={(e) => patchRecruitment(setRecruitments, row.id, { deadline: e.target.value || null })} className={inputClass} /></Field>
                      <Field label="雇用形態"><input value={row.employment_type ?? ""} onChange={(e) => patchRecruitment(setRecruitments, row.id, { employment_type: e.target.value })} className={inputClass} /></Field>
                      <Field label="勤務地"><input value={row.location ?? ""} onChange={(e) => patchRecruitment(setRecruitments, row.id, { location: e.target.value })} className={inputClass} /></Field>
                      <Field label="対象学位・条件"><input value={row.degree_requirement ?? ""} onChange={(e) => patchRecruitment(setRecruitments, row.id, { degree_requirement: e.target.value })} className={inputClass} /></Field>
                      <Field label="給与・待遇"><input value={row.salary_text ?? ""} onChange={(e) => patchRecruitment(setRecruitments, row.id, { salary_text: e.target.value })} className={inputClass} /></Field>
                      <Field label="募集人数"><input type="number" min={1} value={row.positions_count ?? ""} onChange={(e) => patchRecruitment(setRecruitments, row.id, { positions_count: e.target.value ? Number(e.target.value) : null })} className={inputClass} /></Field>
                      <Field label="状態"><select value={row.status} onChange={(e) => patchRecruitment(setRecruitments, row.id, { status: e.target.value as RecruitmentRow["status"] })} className={inputClass}><option value="draft">準備中</option><option value="published">募集中</option><option value="closed">募集終了</option></select></Field>
                      <Field label="短い概要" className="sm:col-span-2"><textarea value={row.summary ?? ""} onChange={(e) => patchRecruitment(setRecruitments, row.id, { summary: e.target.value })} className={`${inputClass} min-h-20`} /></Field>
                    </div>
                    <RichField label="仕事内容・プロジェクト" value={row.job_body} onChange={(value) => patchRecruitment(setRecruitments, row.id, { job_body: value })} />
                    <RichField label="応募条件・求める人物" value={row.qualifications_body} onChange={(value) => patchRecruitment(setRecruitments, row.id, { qualifications_body: value })} />
                    <RichField label="勤務条件・その他" value={row.conditions_body} onChange={(value) => patchRecruitment(setRecruitments, row.id, { conditions_body: value })} />
                    <Field label="外部応募URL" className="mt-5"><input value={row.application_url ?? ""} onChange={(e) => patchRecruitment(setRecruitments, row.id, { application_url: e.target.value })} className={inputClass} placeholder="https://..." /></Field>
                    <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void saveRecruitment(row)} className={primaryButton}>保存</button><button type="button" onClick={() => void deleteRecruitment(row)} className={dangerButton}>削除</button><SaveMessage row={row} /></div>
                  </article>
                ))}
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === "materials" ? (
          <Card title="資料ライブラリ" description="PDFを単なる添付ではなく、会社を伝える主要コンテンツとして保存できます。YouTubeや外部資料も同じ場所で管理します。">
            <div className="mb-5 flex flex-wrap gap-2"><button type="button" onClick={() => void addMaterial("pdf")} className={primaryButton}>＋ PDF</button><button type="button" onClick={() => void addMaterial("youtube")} className={secondaryButton}>＋ YouTube</button><button type="button" onClick={() => void addMaterial("link")} className={secondaryButton}>＋ 外部リンク</button></div>
            <div className="space-y-4">
              {materials.length === 0 ? <Empty>まだ資料がありません。</Empty> : materials.map((row) => (
                <article key={row.id} className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="資料名" className="sm:col-span-2"><input value={row.title} onChange={(e) => patchMaterial(setMaterials, row.id, { title: e.target.value })} className={inputClass} /></Field>
                    {row.material_type === "pdf" ? <div className="sm:col-span-2"><div className="text-xs font-semibold text-neutral-600">PDF</div><div className="mt-2 flex flex-wrap items-center gap-3"><label className={secondaryButton}>{materialUploadingId === row.id ? "アップロード中…" : row.file_path ? "PDFを差し替え" : "PDFを選択"}<input type="file" accept="application/pdf" disabled={materialUploadingId === row.id} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMaterialPdf(row, file); event.currentTarget.value = ""; }} /></label>{row.file_name ? <span className="text-xs text-neutral-500">{row.file_name}</span> : null}{row.file_path ? <button type="button" onClick={() => void openMaterialPdf(row)} className={secondaryButton}>PDFを見る</button> : null}</div></div> : <Field label={row.material_type === "youtube" ? "YouTube URL" : "URL"} className="sm:col-span-2"><input value={row.external_url ?? ""} onChange={(e) => patchMaterial(setMaterials, row.id, { external_url: e.target.value })} className={inputClass} placeholder="https://..." /></Field>}
                    <Field label="説明" className="sm:col-span-2"><textarea value={row.description ?? ""} onChange={(e) => patchMaterial(setMaterials, row.id, { description: e.target.value })} className={`${inputClass} min-h-20`} /></Field>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3"><span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-neutral-500">{row.material_type.toUpperCase()}</span><button type="button" onClick={() => void saveMaterial(row)} className={primaryButton}>保存</button><button type="button" onClick={() => void deleteMaterial(row)} className={dangerButton}>削除</button><SaveMessage row={row} /></div>
                </article>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </main>
  );
}

function BlockList({ rows, setRows, onSave, onDelete }: { rows: ContentBlock[]; setRows: React.Dispatch<React.SetStateAction<ContentBlock[]>>; onSave: (row: ContentBlock) => Promise<void>; onDelete: (row: ContentBlock) => Promise<void> }) {
  if (rows.length === 0) return <Empty>まだセクションがありません。</Empty>;
  return <div className="space-y-5">{rows.map((row) => <article key={row.id} className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6"><div className="grid gap-3 sm:grid-cols-[180px_1fr]"><select value={row.kind} onChange={(e) => patchBlock(setRows, row.id, { kind: e.target.value as ContentKind })} className={inputClass}>{Object.entries(BLOCK_KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input value={row.title} onChange={(e) => patchBlock(setRows, row.id, { title: e.target.value })} className={inputClass} /></div><div className="mt-4"><CppRichContentEditor value={row.body ?? ""} onChange={(value) => patchBlock(setRows, row.id, { body: value })} placeholder="会社について研究者に伝えたい内容を書いてください。" /></div><div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void onSave(row)} className={primaryButton}>保存</button><button type="button" onClick={() => void onDelete(row)} className={dangerButton}>削除</button><SaveMessage row={row} /></div></article>)}</div>;
}

function RichField({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string) => void }) {
  return <div className="mt-5"><div className="mb-2 text-xs font-semibold text-neutral-600">{label}</div><CppRichContentEditor value={value ?? ""} onChange={onChange} /></div>;
}

function Card({ title, description, aside, children }: { title: string; description?: string; aside?: string; children: ReactNode }) {
  return <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8"><div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-neutral-950">{title}</h2>{description ? <p className="mt-1 text-xs leading-5 text-neutral-500">{description}</p> : null}</div>{aside ? <div className="text-xs font-semibold text-neutral-500">{aside}</div> : null}</div>{children}</section>;
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-xs font-semibold text-neutral-600">{label}</span>{children}</label>;
}

function Empty({ children }: { children: ReactNode }) { return <p className="rounded-2xl bg-neutral-50 p-5 text-sm text-neutral-400">{children}</p>; }
function CenteredCard({ children }: { children: ReactNode }) { return <main className="min-h-screen bg-neutral-50 px-4 py-16"><div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">{children}</div></main>; }
function SaveMessage({ row }: { row: { saveState?: SaveState; saveMessage?: string } }) { return row.saveMessage ? <span className={`text-xs ${row.saveState === "error" ? "text-red-600" : "text-neutral-500"}`}>{row.saveMessage}</span> : null; }

function patchBlock(setter: React.Dispatch<React.SetStateAction<ContentBlock[]>>, id: string, patch: Partial<ContentBlock>) { setter((current) => current.map((row) => row.id === id ? { ...row, ...patch, saveState: "idle", saveMessage: undefined } : row)); }
function patchPosition(setter: React.Dispatch<React.SetStateAction<PositionRow[]>>, id: string, patch: Partial<PositionRow>) { setter((current) => current.map((row) => row.id === id ? { ...row, ...patch, saveState: "idle", saveMessage: undefined } : row)); }
function patchRecruitment(setter: React.Dispatch<React.SetStateAction<RecruitmentRow[]>>, id: string, patch: Partial<RecruitmentRow>) { setter((current) => current.map((row) => row.id === id ? { ...row, ...patch, saveState: "idle", saveMessage: undefined } : row)); }
function patchMaterial(setter: React.Dispatch<React.SetStateAction<MaterialRow[]>>, id: string, patch: Partial<MaterialRow>) { setter((current) => current.map((row) => row.id === id ? { ...row, ...patch, saveState: "idle", saveMessage: undefined } : row)); }
function unique(values: string[]) { return Array.from(new Set(values)); }
function cleanText(value: string | null | undefined) { const trimmed = value?.trim(); return trimmed ? trimmed : null; }
function cleanRich(value: string | null | undefined) { const trimmed = value?.trim(); return trimmed && trimmed !== "[T]\n\u200B" ? trimmed : null; }

const inputClass = "w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600";
const primaryButton = "inline-flex cursor-pointer items-center justify-center rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40";
const secondaryButton = "inline-flex cursor-pointer items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700";
const dangerButton = "inline-flex cursor-pointer items-center justify-center rounded-full border border-red-200 bg-white px-4 py-2.5 text-xs font-bold text-red-600";
