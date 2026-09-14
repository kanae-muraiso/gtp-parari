"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import CppRichContentEditor from "@/components/parari/cpp/CppRichContentEditor";

type CompanyRow = {
  id: string;
  created_by_user_id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  industry: string | null;
  headquarters: string | null;
  website_url: string | null;
  short_description: string | null;
  profile_body: string | null;
  researcher_message: string | null;
  visibility: "draft" | "published";
  published_at: string | null;
};

type RecruitmentRow = {
  id: string;
  company_id: string;
  created_by_user_id: string;
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
  status: "draft" | "published" | "closed";
  sort_order: number;
};

type LocalRecruitment = RecruitmentRow & {
  saveState?: "idle" | "saving" | "saved" | "error";
  saveMessage?: string;
};

type Identity = {
  userId: string;
  email: string | null;
  displayName: string;
};

export default function CppCompanyEditorPage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [recruitments, setRecruitments] = useState<LocalRecruitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyMessage, setCompanyMessage] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
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
    const [profileResult, memberResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle<{ display_name: string | null }>(),
      supabase
        .from("cpp_company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1),
    ]);

    const firstError = profileResult.error || memberResult.error;
    if (firstError) {
      setErrorMessage(`企業情報の取得に失敗しました: ${firstError.message}`);
      setLoading(false);
      return;
    }

    setIdentity({
      userId: user.id,
      email: user.email ?? null,
      displayName: profileResult.data?.display_name || "PARARI USER",
    });

    const companyId = (memberResult.data ?? [])[0]?.company_id as string | undefined;
    if (!companyId) {
      setLoading(false);
      return;
    }

    const [companyResult, recruitmentResult] = await Promise.all([
      supabase
        .from("cpp_companies")
        .select("id, created_by_user_id, name, slug, logo_path, industry, headquarters, website_url, short_description, profile_body, researcher_message, visibility, published_at")
        .eq("id", companyId)
        .single<CompanyRow>(),
      supabase
        .from("cpp_company_recruitments")
        .select("id, company_id, created_by_user_id, title, employment_type, location, degree_requirement, salary_text, positions_count, deadline, summary, job_body, qualifications_body, conditions_body, application_url, status, sort_order")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    const detailError = companyResult.error || recruitmentResult.error;
    if (detailError) {
      setErrorMessage(`企業情報の取得に失敗しました: ${detailError.message}`);
      setLoading(false);
      return;
    }

    setCompany(companyResult.data);
    setRecruitments((recruitmentResult.data ?? []) as RecruitmentRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

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
    setErrorMessage("");

    const { error } = await supabase
      .from("cpp_companies")
      .update({
        name: company.name.trim(),
        industry: cleanText(company.industry),
        headquarters: cleanText(company.headquarters),
        website_url: cleanText(company.website_url),
        short_description: cleanText(company.short_description),
        profile_body: cleanRich(company.profile_body),
        researcher_message: cleanRich(company.researcher_message),
      })
      .eq("id", company.id);

    setCompanySaving(false);
    if (error) {
      setCompanyMessage("");
      setErrorMessage(`会社案内の保存に失敗しました: ${error.message}`);
      return;
    }
    setCompanyMessage("保存しました");
  };

  const uploadLogo = async (file: File) => {
    if (!supabase || !company || !identity) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("ロゴには画像ファイルを選択してください。");
      return;
    }

    setLogoUploading(true);
    setErrorMessage("");
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${identity.userId}/cpp-company/${company.id}/logo-${Date.now()}.${ext}`;
    const oldPath = company.logo_path;

    const { error: uploadError } = await supabase.storage.from("parari-images").upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadError) {
      setLogoUploading(false);
      setErrorMessage(`ロゴのアップロードに失敗しました: ${uploadError.message}`);
      return;
    }

    const { error: updateError } = await supabase.from("cpp_companies").update({ logo_path: path }).eq("id", company.id);
    if (updateError) {
      await supabase.storage.from("parari-images").remove([path]);
      setLogoUploading(false);
      setErrorMessage(`ロゴ情報の保存に失敗しました: ${updateError.message}`);
      return;
    }

    if (oldPath) await supabase.storage.from("parari-images").remove([oldPath]);
    patchCompany({ logo_path: path });
    setLogoUploading(false);
    setCompanyMessage("ロゴを保存しました");
  };

  const addRecruitment = async () => {
    if (!supabase || !company || !identity) return;
    const nextSort = recruitments.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
    const { data, error } = await supabase
      .from("cpp_company_recruitments")
      .insert({
        company_id: company.id,
        created_by_user_id: identity.userId,
        title: "新しい募集要項",
        status: "draft",
        sort_order: nextSort,
      })
      .select("id, company_id, created_by_user_id, title, employment_type, location, degree_requirement, salary_text, positions_count, deadline, summary, job_body, qualifications_body, conditions_body, application_url, status, sort_order")
      .single<RecruitmentRow>();

    if (error || !data) {
      setErrorMessage(`募集要項の追加に失敗しました: ${error?.message ?? "unknown error"}`);
      return;
    }
    setRecruitments((current) => [...current, { ...data, saveState: "saved", saveMessage: "追加しました" }]);
  };

  const patchRecruitment = (id: string, patch: Partial<RecruitmentRow>) => {
    setRecruitments((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch, saveState: "idle", saveMessage: undefined } : row)),
    );
  };

  const saveRecruitment = async (row: LocalRecruitment) => {
    if (!supabase) return;
    if (!row.title.trim()) {
      setErrorMessage("募集要項のタイトルを入力してください。");
      return;
    }

    setRecruitments((current) =>
      current.map((item) => (item.id === row.id ? { ...item, saveState: "saving", saveMessage: "保存中…" } : item)),
    );
    setErrorMessage("");

    const { error } = await supabase
      .from("cpp_company_recruitments")
      .update({
        title: row.title.trim(),
        employment_type: cleanText(row.employment_type),
        location: cleanText(row.location),
        degree_requirement: cleanText(row.degree_requirement),
        salary_text: cleanText(row.salary_text),
        positions_count: row.positions_count || null,
        deadline: row.deadline || null,
        summary: cleanText(row.summary),
        job_body: cleanRich(row.job_body),
        qualifications_body: cleanRich(row.qualifications_body),
        conditions_body: cleanRich(row.conditions_body),
        application_url: cleanText(row.application_url),
      })
      .eq("id", row.id);

    setRecruitments((current) =>
      current.map((item) =>
        item.id === row.id
          ? {
              ...item,
              saveState: error ? "error" : "saved",
              saveMessage: error ? error.message : "保存しました",
            }
          : item,
      ),
    );
  };

  const deleteRecruitment = async (row: LocalRecruitment) => {
    if (!supabase) return;
    const previous = recruitments;
    setRecruitments((current) => current.filter((item) => item.id !== row.id));
    const { error } = await supabase.from("cpp_company_recruitments").delete().eq("id", row.id);
    if (error) {
      setRecruitments(previous);
      setErrorMessage(`募集要項の削除に失敗しました: ${error.message}`);
    }
  };

  if (loading) return <CenteredCard>会社案内を読み込んでいます…</CenteredCard>;

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

  const logoUrl = company.logo_path
    ? supabase?.storage.from("parari-images").getPublicUrl(company.logo_path).data.publicUrl ?? null
    : null;

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold tracking-[0.2em] text-neutral-400">CPP COMPANY</div>
            <h1 className="mt-1 text-2xl font-bold text-neutral-950">会社案内・募集要項</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/cpp/company/try" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700">登録入口</Link>
            <Link href="/my/cpp/company/preview" className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white">掲載イメージを見る →</Link>
          </div>
        </div>

        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          入力内容は本物のDBに保存されます。現在は確認期間中のため、この画面から一般公開はしません。
        </section>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
        ) : null}

        <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-neutral-950">会社案内</h2>
              <p className="mt-1 text-xs leading-5 text-neutral-500">会社そのものを研究者に知ってもらうためのページです。</p>
            </div>
            <div className="text-xs font-semibold text-neutral-500">{companyMessage}</div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-[160px_1fr]">
            <div>
              <div className="aspect-square overflow-hidden rounded-3xl bg-neutral-100">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={company.name} className="h-full w-full object-contain p-4" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs font-bold text-neutral-300">COMPANY LOGO</div>
                )}
              </div>
              <label className="mt-3 block cursor-pointer rounded-full border border-neutral-300 bg-white px-3 py-2 text-center text-xs font-bold text-neutral-700">
                {logoUploading ? "アップロード中…" : "ロゴを変更"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={logoUploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadLogo(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="会社・団体名" value={company.name} onChange={(value) => patchCompany({ name: value })} wide />
              <Field label="業種" value={company.industry ?? ""} onChange={(value) => patchCompany({ industry: value })} placeholder="例）バイオ・医薬品" />
              <Field label="所在地" value={company.headquarters ?? ""} onChange={(value) => patchCompany({ headquarters: value })} placeholder="例）東京都千代田区" />
              <Field label="Webサイト" value={company.website_url ?? ""} onChange={(value) => patchCompany({ website_url: value })} placeholder="https://..." />
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-neutral-600">短い紹介</span>
                <textarea
                  value={company.short_description ?? ""}
                  onChange={(event) => patchCompany({ short_description: event.target.value })}
                  className={`${inputClassName} min-h-24`}
                  placeholder="研究者が一覧で最初に読む、2〜3行程度の紹介"
                />
              </label>
            </div>
          </div>

          <div className="mt-7 space-y-5">
            <div>
              <div className="mb-2 text-sm font-bold text-neutral-900">会社案内</div>
              <CppRichContentEditor
                value={company.profile_body ?? ""}
                onChange={(value) => patchCompany({ profile_body: value })}
                placeholder="事業内容、技術、研究開発、組織の特徴などを自由に紹介してください。"
              />
            </div>
            <div>
              <div className="mb-2 text-sm font-bold text-neutral-900">研究者へのメッセージ</div>
              <CppRichContentEditor
                value={company.researcher_message ?? ""}
                onChange={(value) => patchCompany({ researcher_message: value })}
                placeholder="博士・研究者にどんなことを期待しているのか、自由に書いてください。"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void saveCompany()}
            disabled={companySaving}
            className="mt-6 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            {companySaving ? "保存中…" : "会社案内を保存"}
          </button>
        </section>

        <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-neutral-950">募集要項</h2>
              <p className="mt-1 text-xs leading-5 text-neutral-500">1社で複数の募集を作成できます。応募受付は後でPARARI APPLICATIONにつなげます。</p>
            </div>
            <button type="button" onClick={() => void addRecruitment()} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-800">
              ＋募集要項を追加
            </button>
          </div>

          {recruitments.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-400">まだ募集要項はありません。</div>
          ) : (
            <div className="mt-6 space-y-6">
              {recruitments.map((row, index) => (
                <RecruitmentCard
                  key={row.id}
                  row={row}
                  index={index}
                  onPatch={patchRecruitment}
                  onSave={saveRecruitment}
                  onDelete={deleteRecruitment}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function RecruitmentCard({
  row,
  index,
  onPatch,
  onSave,
  onDelete,
}: {
  row: LocalRecruitment;
  index: number;
  onPatch: (id: string, patch: Partial<RecruitmentRow>) => void;
  onSave: (row: LocalRecruitment) => Promise<void>;
  onDelete: (row: LocalRecruitment) => Promise<void>;
}) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">{index + 1}</span>
          <div className="text-sm font-bold text-neutral-900">{row.title || "募集要項"}</div>
        </div>
        <div className="flex items-center gap-3">
          {row.saveMessage ? <span className={`text-xs font-semibold ${row.saveState === "error" ? "text-red-600" : "text-neutral-500"}`}>{row.saveMessage}</span> : null}
          <button
            type="button"
            onClick={() => {
              if (window.confirm("この募集要項を削除しますか？")) void onDelete(row);
            }}
            className="text-xs font-bold text-neutral-400 hover:text-red-600"
          >
            削除
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="募集タイトル" value={row.title} onChange={(value) => onPatch(row.id, { title: value })} wide />
        <Field label="雇用形態" value={row.employment_type ?? ""} onChange={(value) => onPatch(row.id, { employment_type: value })} placeholder="例）正社員 / 任期付研究員" />
        <Field label="勤務地" value={row.location ?? ""} onChange={(value) => onPatch(row.id, { location: value })} placeholder="例）京都市 / リモート可" />
        <Field label="対象学位・条件" value={row.degree_requirement ?? ""} onChange={(value) => onPatch(row.id, { degree_requirement: value })} placeholder="例）博士取得者・取得予定者" />
        <Field label="給与・待遇" value={row.salary_text ?? ""} onChange={(value) => onPatch(row.id, { salary_text: value })} placeholder="例）年俸600〜800万円" />
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-neutral-600">募集人数</span>
          <input
            type="number"
            min={1}
            value={row.positions_count ?? ""}
            onChange={(event) => onPatch(row.id, { positions_count: event.target.value ? Number(event.target.value) : null })}
            className={inputClassName}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-neutral-600">応募締切</span>
          <input type="date" value={row.deadline ?? ""} onChange={(event) => onPatch(row.id, { deadline: event.target.value || null })} className={inputClassName} />
        </label>
        <Field label="外部応募URL（任意）" value={row.application_url ?? ""} onChange={(value) => onPatch(row.id, { application_url: value })} placeholder="https://..." />
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-xs font-semibold text-neutral-600">一覧用の短い説明</span>
          <textarea
            value={row.summary ?? ""}
            onChange={(event) => onPatch(row.id, { summary: event.target.value })}
            className={`${inputClassName} min-h-24`}
            placeholder="どんな研究者を、何のために募集するのかを短く説明します。"
          />
        </label>
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <div className="mb-2 text-sm font-bold text-neutral-900">仕事内容・プロジェクト</div>
          <CppRichContentEditor value={row.job_body ?? ""} onChange={(value) => onPatch(row.id, { job_body: value })} placeholder="担当する研究・技術・プロジェクトを詳しく説明してください。" />
        </div>
        <div>
          <div className="mb-2 text-sm font-bold text-neutral-900">応募条件・求める人物</div>
          <CppRichContentEditor value={row.qualifications_body ?? ""} onChange={(value) => onPatch(row.id, { qualifications_body: value })} placeholder="必須条件、歓迎条件、専門性、人物像などを書いてください。" />
        </div>
        <div>
          <div className="mb-2 text-sm font-bold text-neutral-900">勤務条件・その他</div>
          <CppRichContentEditor value={row.conditions_body ?? ""} onChange={(value) => onPatch(row.id, { conditions_body: value })} placeholder="勤務時間、休日、研究環境、福利厚生などを自由に書いてください。" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => void onSave(row)}
        disabled={row.saveState === "saving"}
        className="mt-6 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
      >
        {row.saveState === "saving" ? "保存中…" : "募集要項を保存"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-2 block text-xs font-semibold text-neutral-600">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={inputClassName} />
    </label>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">{children}</div>
    </main>
  );
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function cleanRich(value: string | null | undefined): string | null {
  const source = String(value ?? "");
  return source.replace(/\u200B|\uFEFF/g, "").trim() ? source : null;
}

const inputClassName = "w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600";
