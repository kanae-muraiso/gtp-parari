// src/app/[username]/cpp/page.tsx
// CPP public researcher profile v0.2
// 2026-09-14

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import PageBodyPanelRenderer from "@/components/parari/mvp/PageBodyPanelRenderer";

type ParariProfileRow = {
  user_id: string;
  username: string;
  display_name: string | null;
};

type SectionStates = {
  history?: string;
  research_summaries?: string;
  publications?: string;
  self_appeal?: string;
  [key: string]: unknown;
};

type CppProfileRow = {
  user_id: string;
  public_name: string | null;
  photo_path: string | null;
  degree_level: string | null;
  degree_text: string | null;
  degree_status: string | null;
  degree_institution: string | null;
  degree_date: string | null;
  affiliation: string | null;
  position_title: string | null;
  self_appeal: string | null;
  section_states: SectionStates | null;
  visibility: string;
  published_at: string | null;
};

type ResearchFieldLinkRow = {
  research_field_id: string;
  sort_order: number;
};

type ResearchFieldRow = {
  id: string;
  major_name_ja: string;
  minor_name_ja: string;
  major_sort: number;
  minor_sort: number;
};

type KeywordRow = {
  id: string;
  keyword: string;
  sort_order: number;
};

type ResearchSummaryRow = {
  id: string;
  slot: number;
  title: string | null;
  body: string | null;
  pdf_path: string | null;
  pdf_name: string | null;
  is_in_progress: boolean;
};

type PublicationRow = {
  id: string;
  title: string | null;
  authors: string | null;
  venue: string | null;
  publication_year: number | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  external_url: string | null;
  notes: string | null;
  sort_order: number;
};

type HistoryRow = {
  id: string;
  kind: "education" | "career";
  event_date: string | null;
  event_text: string | null;
  start_year: number | null;
  start_month: number | null;
  organization: string | null;
  division: string | null;
  title: string | null;
  notes: string | null;
  sort_order: number;
};

type LoadedProfile = {
  parari: ParariProfileRow;
  cpp: CppProfileRow;
  researchFields: ResearchFieldRow[];
  keywords: KeywordRow[];
  summaries: ResearchSummaryRow[];
  publications: PublicationRow[];
  history: HistoryRow[];
};

const DEGREE_LABELS: Record<string, string> = {
  doctorate: "博士",
  doctoral_student: "博士",
  masters: "修士",
  masters_student: "修士",
  bachelors: "学士",
  other: "その他",
  none: "学位なし",
};

export default function PublicCppProfilePage() {
  const params = useParams();
  const username = typeof params?.username === "string" ? params.username : "";
  const supabase = useMemo(() => sharedSupabase, []);

  const [profile, setProfile] = useState<LoadedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pdfOpening, setPdfOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !username) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setNotFound(false);

    const { data: parariData, error: parariError } = await supabase
      .from("profiles")
      .select("user_id, username, display_name")
      .eq("username", username)
      .maybeSingle<ParariProfileRow>();

    if (parariError) {
      setErrorMessage(`プロフィールの取得に失敗しました: ${parariError.message}`);
      setLoading(false);
      return;
    }

    if (!parariData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const { data: cppData, error: cppError } = await supabase
      .from("cpp_profiles")
      .select(
        "user_id, public_name, photo_path, degree_level, degree_text, degree_status, degree_institution, degree_date, affiliation, position_title, self_appeal, section_states, visibility, published_at",
      )
      .eq("user_id", parariData.user_id)
      .eq("visibility", "published")
      .maybeSingle<CppProfileRow>();

    if (cppError) {
      setErrorMessage(`CPPプロフィールの取得に失敗しました: ${cppError.message}`);
      setLoading(false);
      return;
    }

    if (!cppData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const [fieldLinksResult, keywordsResult, summariesResult, publicationsResult, historyResult] =
      await Promise.all([
        supabase
          .from("cpp_profile_research_fields")
          .select("research_field_id, sort_order")
          .eq("user_id", parariData.user_id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("cpp_profile_keywords")
          .select("id, keyword, sort_order")
          .eq("user_id", parariData.user_id)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("cpp_research_summaries")
          .select("id, slot, title, body, pdf_path, pdf_name, is_in_progress")
          .eq("user_id", parariData.user_id)
          .order("slot", { ascending: true }),
        supabase
          .from("cpp_publications")
          .select(
            "id, title, authors, venue, publication_year, volume, issue, pages, doi, external_url, notes, sort_order",
          )
          .eq("user_id", parariData.user_id)
          .order("sort_order", { ascending: true })
          .order("publication_year", { ascending: false, nullsFirst: false }),
        supabase
          .from("cpp_profile_history")
          .select(
            "id, kind, event_date, event_text, start_year, start_month, organization, division, title, notes, sort_order",
          )
          .eq("user_id", parariData.user_id)
          .order("kind", { ascending: true })
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);

    const firstError =
      fieldLinksResult.error ||
      keywordsResult.error ||
      summariesResult.error ||
      publicationsResult.error ||
      historyResult.error;

    if (firstError) {
      setErrorMessage(`CPPプロフィール詳細の取得に失敗しました: ${firstError.message}`);
      setLoading(false);
      return;
    }

    const fieldLinks = (fieldLinksResult.data ?? []) as ResearchFieldLinkRow[];
    let researchFields: ResearchFieldRow[] = [];

    if (fieldLinks.length > 0) {
      const fieldIds = fieldLinks.map((row) => row.research_field_id);
      const { data: fieldRows, error: fieldsError } = await supabase
        .from("cpp_research_fields")
        .select("id, major_name_ja, minor_name_ja, major_sort, minor_sort")
        .in("id", fieldIds);

      if (fieldsError) {
        setErrorMessage(`研究分野の取得に失敗しました: ${fieldsError.message}`);
        setLoading(false);
        return;
      }

      const byId = new Map(
        ((fieldRows ?? []) as ResearchFieldRow[]).map((row) => [row.id, row]),
      );
      researchFields = fieldLinks
        .map((link) => byId.get(link.research_field_id))
        .filter((row): row is ResearchFieldRow => Boolean(row));
    }

    setProfile({
      parari: parariData,
      cpp: cppData,
      researchFields,
      keywords: (keywordsResult.data ?? []) as KeywordRow[],
      summaries: (summariesResult.data ?? []) as ResearchSummaryRow[],
      publications: (publicationsResult.data ?? []) as PublicationRow[],
      history: (historyResult.data ?? []) as HistoryRow[],
    });
    setLoading(false);
  }, [supabase, username]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPdf = useCallback(
    async (summary: ResearchSummaryRow) => {
      if (!supabase || !summary.pdf_path) return;
      setPdfOpening(summary.id);
      setErrorMessage("");

      const { data, error } = await supabase.storage
        .from("cpp-documents")
        .createSignedUrl(summary.pdf_path, 60 * 10);

      setPdfOpening(null);
      if (error || !data?.signedUrl) {
        setErrorMessage(`研究資料を開けませんでした: ${error?.message ?? "unknown error"}`);
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    },
    [supabase],
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
          研究者プロフィールを読み込んでいます...
        </div>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-16">
        <div className="mx-auto max-w-2xl rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-neutral-900">CPPプロフィールは公開されていません</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            URLが違うか、この研究者プロフィールは現在下書きです。
          </p>
          <Link
            href={`/${username}`}
            className="mt-6 inline-block text-sm font-semibold text-neutral-700 underline underline-offset-4"
          >
            PARARIプロフィールへ
          </Link>
        </div>
      </main>
    );
  }

  const { cpp, parari, researchFields, keywords, summaries, publications, history } = profile;
  const publicName = cpp.public_name || parari.display_name || parari.username;
  const photoUrl =
    supabase && cpp.photo_path
      ? supabase.storage.from("parari-images").getPublicUrl(cpp.photo_path).data.publicUrl
      : null;
  const education = history.filter((row) => row.kind === "education");
  const career = history.filter((row) => row.kind === "career");
  const publicationInProgress = cpp.section_states?.publications !== "ready";
  const selfAppealInProgress = cpp.section_states?.self_appeal !== "ready";

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6 sm:py-12">
      <article className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-6 sm:grid-cols-[160px_1fr] sm:items-start">
            <div className="aspect-square overflow-hidden rounded-[2rem] bg-neutral-100">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt={publicName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-neutral-400">
                  NO PHOTO
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
                CPP RESEARCHER PROFILE
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
                {publicName}
              </h1>

              <div className="mt-4 space-y-1 text-sm leading-6 text-neutral-600">
                {cpp.affiliation ? <div>{cpp.affiliation}</div> : null}
                {cpp.position_title ? <div>{cpp.position_title}</div> : null}
                <DegreeLine profile={cpp} />
              </div>

              {researchFields.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {researchFields.map((field) => (
                    <span
                      key={field.id}
                      className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      {field.minor_name_ja}
                    </span>
                  ))}
                </div>
              ) : null}

              {keywords.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {keywords.map((item) => (
                    <span
                      key={item.id}
                      className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700"
                    >
                      {item.keyword}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <PublicSection title="研究概要">
          {summaries.length > 0 ? (
            <div className="space-y-6">
              {summaries.map((summary, index) => (
                <div key={summary.id} className={index === 0 ? "" : "border-t border-neutral-200 pt-6"}>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-lg font-bold text-neutral-950">
                      {summary.title || `研究概要 ${summary.slot}`}
                    </div>
                    {summary.is_in_progress ? <InProgressBadge /> : null}
                  </div>

                  {summary.body ? (
                    <div className="mt-4">
                      <PageBodyPanelRenderer bodySsot={summary.body} />
                    </div>
                  ) : summary.is_in_progress ? (
                    <p className="mt-3 text-sm text-neutral-400">現在、研究概要を作成中です。</p>
                  ) : null}

                  {summary.pdf_path ? (
                    <button
                      type="button"
                      onClick={() => void openPdf(summary)}
                      disabled={pdfOpening === summary.id}
                      className="mt-4 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      {pdfOpening === summary.id
                        ? "研究資料を開いています..."
                        : `${summary.pdf_name || "研究資料.pdf"}を見る`}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">研究概要はまだ登録されていません。</p>
          )}
        </PublicSection>

        <PublicSection title="研究成果・論文" inProgress={publicationInProgress}>
          {publications.length > 0 ? (
            <ol className="space-y-5">
              {publications.map((publication) => (
                <li key={publication.id} className="text-sm leading-7 text-neutral-700">
                  <div className="font-semibold text-neutral-950">
                    {publication.title || "（タイトル未入力）"}
                  </div>
                  {publication.authors ? <div className="mt-1">{publication.authors}</div> : null}
                  <div className="mt-1 text-neutral-500">
                    {[publication.venue, publication.publication_year].filter(Boolean).join(" · ")}
                    {formatVolumeIssuePages(publication)}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {publication.doi ? <span className="text-neutral-500">DOI: {publication.doi}</span> : null}
                    {publication.external_url ? (
                      <a
                        href={publication.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-neutral-700 underline underline-offset-4"
                      >
                        外部リンク
                      </a>
                    ) : null}
                  </div>
                  {publication.notes ? (
                    <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-neutral-500">
                      {publication.notes}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : publicationInProgress ? (
            <p className="text-sm text-neutral-400">現在、研究成果・論文リストを作成中です。</p>
          ) : (
            <p className="text-sm text-neutral-400">研究成果・論文は登録されていません。</p>
          )}
        </PublicSection>

        <PublicSection title="学歴・職歴">
          <div className="grid gap-8 md:grid-cols-2">
            <HistoryList title="学歴" rows={education} />
            <HistoryList title="職歴" rows={career} />
          </div>
        </PublicSection>

        <PublicSection title="自己アピール" inProgress={selfAppealInProgress}>
          {cpp.self_appeal ? (
            <PageBodyPanelRenderer bodySsot={cpp.self_appeal} />
          ) : selfAppealInProgress ? (
            <p className="text-sm text-neutral-400">現在、自己アピールを作成中です。</p>
          ) : (
            <p className="text-sm text-neutral-400">自己アピールはまだ登録されていません。</p>
          )}
        </PublicSection>

        <footer className="flex flex-wrap items-center justify-between gap-3 pb-8 text-xs text-neutral-400">
          <Link href={`/${parari.username}`} className="hover:text-neutral-700">
            ← {parari.display_name || parari.username} のPARARIへ
          </Link>
          {cpp.published_at ? (
            <span>公開 {new Date(cpp.published_at).toLocaleDateString("ja-JP")}</span>
          ) : null}
        </footer>
      </article>
    </main>
  );
}

function PublicSection({
  title,
  inProgress = false,
  children,
}: {
  title: string;
  inProgress?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold text-neutral-950">{title}</h2>
        {inProgress ? <InProgressBadge /> : null}
      </div>
      {children}
    </section>
  );
}

function InProgressBadge() {
  return (
    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
      作成中
    </span>
  );
}

function DegreeLine({ profile }: { profile: CppProfileRow }) {
  const degree = profile.degree_text ||
    (profile.degree_level ? DEGREE_LABELS[profile.degree_level] ?? profile.degree_level : "");
  const institution = profile.degree_institution ?? "";
  const date = profile.degree_date ? formatDate(profile.degree_date) : "";
  const status = profile.degree_status === "expected" ? "取得予定" : profile.degree_status === "obtained" ? "取得" : "";
  const detail = [institution, date ? `${date} ${status}`.trim() : status]
    .filter(Boolean)
    .join(" · ");

  if (!degree && !detail) return null;

  return (
    <div>
      <span className="font-semibold text-neutral-800">{degree}</span>
      {detail ? <span> · {detail}</span> : null}
    </div>
  );
}

function HistoryList({ title, rows }: { title: string; rows: HistoryRow[] }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
      {rows.length > 0 ? (
        <ol className="mt-4 space-y-4">
          {rows.map((row) => {
            const text = row.event_text || legacyEventText(row) || "（内容未入力）";
            const date = row.event_date ? formatDate(row.event_date) : legacyHistoryDate(row);
            return (
              <li key={row.id} className="grid grid-cols-[100px_1fr] gap-3 text-sm leading-6 text-neutral-700">
                <div className="text-xs font-semibold text-neutral-400">{date || "日付未入力"}</div>
                <div>{text}</div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-neutral-400">まだ登録されていません。</p>
      )}
    </div>
  );
}

function legacyEventText(row: HistoryRow): string {
  return [row.organization, row.division, row.title, row.notes]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function legacyHistoryDate(row: HistoryRow): string {
  if (!row.start_year) return "";
  return row.start_month ? `${row.start_year}/${String(row.start_month).padStart(2, "0")}` : String(row.start_year);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year) return value;
  if (!month) return year;
  if (!day) return `${year}/${month}`;
  return `${year}/${month}/${day}`;
}

function formatVolumeIssuePages(publication: PublicationRow) {
  const pieces: string[] = [];
  if (publication.volume) pieces.push(`Vol. ${publication.volume}`);
  if (publication.issue) pieces.push(`No. ${publication.issue}`);
  if (publication.pages) pieces.push(`pp. ${publication.pages}`);
  return pieces.length > 0 ? ` · ${pieces.join(" · ")}` : "";
}
