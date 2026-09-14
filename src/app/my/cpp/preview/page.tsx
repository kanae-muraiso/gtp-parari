"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import PageBodyPanelRenderer from "@/components/parari/mvp/PageBodyPanelRenderer";

type CppProfile = {
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
  visibility: string;
};

type FieldLink = { research_field_id: string; sort_order: number };
type FieldMaster = { id: string; minor_name_ja: string };
type Keyword = { id: string; keyword: string; sort_order: number };
type Summary = {
  id: string;
  slot: number;
  title: string | null;
  body: string | null;
  pdf_path: string | null;
  pdf_name: string | null;
  is_in_progress: boolean;
};
type Publication = {
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
type History = {
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

type Loaded = {
  profile: CppProfile;
  username: string;
  fields: FieldMaster[];
  keywords: Keyword[];
  summaries: Summary[];
  publications: Publication[];
  history: History[];
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

export default function CppCompanyPreviewPage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [pdfOpening, setPdfOpening] = useState<string | null>(null);

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
    const [profileResult, parariResult, linksResult, keywordsResult, summariesResult, publicationsResult, historyResult] = await Promise.all([
      supabase
        .from("cpp_profiles")
        .select("user_id, public_name, photo_path, degree_level, degree_text, degree_status, degree_institution, degree_date, affiliation, position_title, self_appeal, visibility")
        .eq("user_id", user.id)
        .maybeSingle<CppProfile>(),
      supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .maybeSingle<{ username: string | null }>(),
      supabase
        .from("cpp_profile_research_fields")
        .select("research_field_id, sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("cpp_profile_keywords")
        .select("id, keyword, sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("cpp_research_summaries")
        .select("id, slot, title, body, pdf_path, pdf_name, is_in_progress")
        .eq("user_id", user.id)
        .order("slot", { ascending: true }),
      supabase
        .from("cpp_publications")
        .select("id, title, authors, venue, publication_year, volume, issue, pages, doi, external_url, notes, sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("cpp_profile_history")
        .select("id, kind, event_date, event_text, start_year, start_month, organization, division, title, notes, sort_order")
        .eq("user_id", user.id)
        .order("kind", { ascending: true })
        .order("event_date", { ascending: true, nullsFirst: false })
        .order("sort_order", { ascending: true }),
    ]);

    const firstError =
      profileResult.error ||
      parariResult.error ||
      linksResult.error ||
      keywordsResult.error ||
      summariesResult.error ||
      publicationsResult.error ||
      historyResult.error;

    if (firstError) {
      setErrorMessage(`企業表示プレビューの取得に失敗しました: ${firstError.message}`);
      setLoading(false);
      return;
    }

    if (!profileResult.data) {
      setLoading(false);
      return;
    }

    const links = (linksResult.data ?? []) as FieldLink[];
    let fields: FieldMaster[] = [];
    if (links.length > 0) {
      const ids = links.map((row) => row.research_field_id);
      const { data: masterRows, error: masterError } = await supabase
        .from("cpp_research_fields")
        .select("id, minor_name_ja")
        .in("id", ids);

      if (masterError) {
        setErrorMessage(`研究分野の取得に失敗しました: ${masterError.message}`);
        setLoading(false);
        return;
      }

      const byId = new Map(((masterRows ?? []) as FieldMaster[]).map((row) => [row.id, row]));
      fields = links
        .map((row) => byId.get(row.research_field_id))
        .filter((row): row is FieldMaster => Boolean(row));
    }

    setLoaded({
      profile: profileResult.data,
      username: parariResult.data?.username || "parari-user",
      fields,
      keywords: (keywordsResult.data ?? []) as Keyword[],
      summaries: (summariesResult.data ?? []) as Summary[],
      publications: (publicationsResult.data ?? []) as Publication[],
      history: (historyResult.data ?? []) as History[],
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPdf = useCallback(async (summary: Summary) => {
    if (!supabase || !summary.pdf_path) return;
    setPdfOpening(summary.id);
    const { data, error } = await supabase.storage.from("cpp-documents").createSignedUrl(summary.pdf_path, 600);
    setPdfOpening(null);
    if (error || !data?.signedUrl) {
      setErrorMessage(`研究資料を開けませんでした: ${error?.message ?? "unknown error"}`);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }, [supabase]);

  if (loading) {
    return <CenteredCard>企業表示プレビューを読み込んでいます…</CenteredCard>;
  }

  if (!loaded) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-16">
        <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-neutral-950">CPP研究者プロフィールがありません</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">先にCPP研究者登録を行ってください。</p>
          <Link href="/cpp/try" className="mt-6 inline-block rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white">CPP登録へ</Link>
        </div>
      </main>
    );
  }

  const { profile, fields, keywords, summaries, publications, history } = loaded;
  const photoUrl =
    supabase && profile.photo_path
      ? supabase.storage.from("parari-images").getPublicUrl(profile.photo_path).data.publicUrl
      : null;
  const education = history.filter((row) => row.kind === "education");
  const career = history.filter((row) => row.kind === "career");

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-100 px-4 py-3 text-xs font-semibold text-amber-900">
          <span>企業表示プレビューです。下書きでも本人だけが確認できます。一般には公開されていません。</span>
          <Link href="/my/cpp" className="rounded-full bg-white px-4 py-2 font-bold text-neutral-900">← WORKBOOKへ戻る</Link>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <article className="space-y-6">
            <header className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="grid gap-6 sm:grid-cols-[150px_1fr]">
                <div className="aspect-square overflow-hidden rounded-[1.75rem] bg-neutral-100">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl} alt={profile.public_name || "CPP researcher"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm font-semibold text-neutral-300">NO PHOTO</div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">CPP RESEARCHER PROFILE</div>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950">{profile.public_name || "氏名未入力"}</h1>
                  <div className="mt-4 space-y-1 text-sm leading-6 text-neutral-600">
                    {profile.affiliation ? <div>{profile.affiliation}</div> : null}
                    {profile.position_title ? <div>{profile.position_title}</div> : null}
                    <DegreeLine profile={profile} />
                  </div>
                  {fields.length > 0 ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {fields.map((field) => <span key={field.id} className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white">{field.minor_name_ja}</span>)}
                    </div>
                  ) : null}
                  {keywords.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {keywords.map((item) => <span key={item.id} className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700">{item.keyword}</span>)}
                    </div>
                  ) : null}
                </div>
              </div>
            </header>

            <PublicSection title="研究概要">
              {summaries.length > 0 ? (
                <div className="space-y-6">
                  {summaries.map((summary, index) => (
                    <div key={summary.id} className={index === 0 ? "" : "border-t border-neutral-200 pt-6"}>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-neutral-950">{summary.title || `研究概要 ${summary.slot}`}</h3>
                        {summary.is_in_progress ? <Badge>作成中</Badge> : null}
                      </div>
                      {summary.body ? <div className="mt-4"><PageBodyPanelRenderer bodySsot={summary.body} /></div> : null}
                      {summary.pdf_path ? (
                        <button type="button" onClick={() => void openPdf(summary)} disabled={pdfOpening === summary.id} className="mt-4 rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-50">
                          {pdfOpening === summary.id ? "開いています…" : `${summary.pdf_name || "研究資料.pdf"}を見る`}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : <EmptyText>研究概要はまだ登録されていません。</EmptyText>}
            </PublicSection>

            <PublicSection title="研究成果・論文">
              {publications.length > 0 ? (
                <ol className="space-y-5">
                  {publications.map((publication) => (
                    <li key={publication.id} className="text-sm leading-7 text-neutral-700">
                      <div className="font-semibold text-neutral-950">{publication.title || "（タイトル未入力）"}</div>
                      {publication.authors ? <div>{publication.authors}</div> : null}
                      <div className="text-neutral-500">{[publication.venue, publication.publication_year].filter(Boolean).join(" · ")}{formatVolumeIssuePages(publication)}</div>
                      {publication.doi ? <div className="text-xs text-neutral-500">DOI: {publication.doi}</div> : null}
                      {publication.external_url ? <a href={publication.external_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline underline-offset-4">外部リンク</a> : null}
                    </li>
                  ))}
                </ol>
              ) : <EmptyText>研究成果・論文はまだ登録されていません。</EmptyText>}
            </PublicSection>

            <PublicSection title="学歴・職歴">
              <div className="grid gap-8 md:grid-cols-2">
                <HistoryList title="学歴" rows={education} />
                <HistoryList title="職歴" rows={career} />
              </div>
            </PublicSection>

            <PublicSection title="自己アピール">
              {profile.self_appeal ? <PageBodyPanelRenderer bodySsot={profile.self_appeal} /> : <EmptyText>自己アピールはまだ登録されていません。</EmptyText>}
            </PublicSection>
          </article>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold tracking-[0.14em] text-neutral-400">COMPANY ACTION</div>
              <h2 className="mt-2 text-base font-bold text-neutral-950">企業からはこう見えます</h2>
              <p className="mt-2 text-xs leading-6 text-neutral-500">候補保存・メッセージ機能はまだ動きません。</p>
              <button type="button" disabled className="mt-5 w-full rounded-full bg-neutral-900 px-4 py-3 text-sm font-bold text-white opacity-50">候補に保存</button>
              <button type="button" disabled className="mt-2 w-full rounded-full border border-neutral-300 bg-white px-4 py-3 text-sm font-bold text-neutral-800 opacity-50">メッセージを送る</button>
            </div>
            <div className="rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-bold text-neutral-950">非公開情報</div>
              <p className="mt-2 text-xs leading-6 text-neutral-500">メールアドレス・電話番号・住所は企業表示にも出しません。</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function DegreeLine({ profile }: { profile: CppProfile }) {
  const degree = profile.degree_text || (profile.degree_level ? DEGREE_LABELS[profile.degree_level] ?? profile.degree_level : "");
  const institution = profile.degree_institution || "";
  const date = profile.degree_date ? formatDate(profile.degree_date) : "";
  const status = profile.degree_status === "expected" ? "取得予定" : profile.degree_status === "obtained" ? "取得" : "";
  const detail = [institution, date ? `${date} ${status}`.trim() : status].filter(Boolean).join(" · ");
  if (!degree && !detail) return null;
  return <div><span className="font-semibold text-neutral-800">{degree}</span>{detail ? <span> · {detail}</span> : null}</div>;
}

function PublicSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="mb-5 text-xl font-bold text-neutral-950">{title}</h2>{children}</section>;
}

function HistoryList({ title, rows }: { title: string; rows: History[] }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
      {rows.length > 0 ? (
        <ol className="mt-4 space-y-4">
          {rows.map((row) => (
            <li key={row.id} className="grid grid-cols-[100px_1fr] gap-3 text-sm leading-6 text-neutral-700">
              <div className="text-xs font-semibold text-neutral-400">{row.event_date ? formatDate(row.event_date) : legacyHistoryDate(row) || "日付未入力"}</div>
              <div>{row.event_text || legacyEventText(row) || "（内容未入力）"}</div>
            </li>
          ))}
        </ol>
      ) : <EmptyText>まだ登録されていません。</EmptyText>}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">{children}</span>;
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-400">{children}</p>;
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-neutral-50 px-4 py-16"><div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">{children}</div></main>;
}

function legacyEventText(row: History) {
  return [row.organization, row.division, row.title, row.notes].map((value) => String(value ?? "").trim()).filter(Boolean).join(" ");
}

function legacyHistoryDate(row: History) {
  if (!row.start_year) return "";
  return row.start_month ? `${row.start_year}/${String(row.start_month).padStart(2, "0")}` : String(row.start_year);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return [year, month, day].filter(Boolean).join("/");
}

function formatVolumeIssuePages(publication: Publication) {
  const pieces: string[] = [];
  if (publication.volume) pieces.push(`Vol. ${publication.volume}`);
  if (publication.issue) pieces.push(`No. ${publication.issue}`);
  if (publication.pages) pieces.push(`pp. ${publication.pages}`);
  return pieces.length > 0 ? ` · ${pieces.join(" · ")}` : "";
}
