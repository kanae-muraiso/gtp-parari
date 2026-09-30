// src/app/my/cpp/page.tsx
// CPP WORKBOOK v0.2
// 2026-09-14

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import CppSaveBoundary, { useCppSave } from "@/components/parari/cpp/CppSaveBoundary";
import { useCallback, useEffect, useMemo, useState } from "react";
import CppSectionNav from "@/components/parari/cpp/CppSectionNav";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import CppProfileBasicsEditor from "@/components/parari/cpp/CppProfileBasicsEditor";
import CppResearcherEntryStatus from "@/components/parari/cpp/CppResearcherEntryStatus";
import CppResearchEvidenceEditor from "@/components/parari/cpp/CppResearchEvidenceEditor";
import CppHistoryEditor from "@/components/parari/cpp/CppHistoryEditor";

type Visibility = "draft" | "published";

type ProfileBootstrap = {
  user_id: string;
  public_name: string | null;
  visibility: Visibility;
  published_at: string | null;
};

export default function CppWorkbookPage() {
  return <CppSaveBoundary><CppWorkbookContent /></CppSaveBoundary>;
}

function CppWorkbookContent() {
  const { flush } = useCppSave();
  const router = useRouter();
  const supabase = useMemo(() => sharedSupabase, []);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("draft");
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const bootstrap = useCallback(async () => {
    if (!supabase) {
      setErrorMessage("Supabase環境変数がありません。");
      setLoading(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("");
      setLoading(false);
      return;
    }

    setUserId(user.id);
    setUserEmail(user.email ?? null);

    const [profileResult, parariResult] = await Promise.all([
      supabase
        .from("cpp_profiles")
        .select("user_id, public_name, visibility, published_at")
        .eq("user_id", user.id)
        .maybeSingle<ProfileBootstrap>(),
      supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle<{ display_name: string | null }>(),
    ]);

    if (profileResult.error) {
      setErrorMessage(`CPPプロフィール取得に失敗しました: ${profileResult.error.message}`);
      setLoading(false);
      return;
    }

    const profile = profileResult.data;
    if (!profile) {
      router.replace("/cpp/try");
      return;
    }

    setVisibility(profile.visibility);
    setPublishedAt(profile.published_at);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const publish = useCallback(async () => {
    if (!supabase || !userId || !(await flush())) return;

    setStatusMessage("公開条件を確認しています...");
    setErrorMessage("");

    const result = await supabase.rpc("cpp_researcher_registration_status");
    if (result.error || !result.data?.[0]) {
      setStatusMessage("");
      setErrorMessage(`公開条件の確認に失敗しました: ${result.error?.message ?? "ログインを確認してください。"}`);
      return;
    }
    const missing = result.data[0].missing_fields as string[];

    if (missing.length > 0) {
      setStatusMessage("");
      setErrorMessage(`公開するには次を入力してください：${missing.join("、")}`);
      return;
    }

    const nextPublishedAt = new Date().toISOString();
    const { error } = await supabase
      .from("cpp_profiles")
      .update({
        visibility: "published",
        published_at: nextPublishedAt,
        updated_at: nextPublishedAt,
      })
      .eq("user_id", userId);

    if (error) {
      setStatusMessage("");
      setErrorMessage(`公開に失敗しました: ${error.message}`);
      return;
    }

    setVisibility("published");
    setPublishedAt(nextPublishedAt);
    setStatusMessage("公開しました");
  }, [supabase, userId, flush]);

  const returnToDraft = useCallback(async () => {
    if (!supabase || !userId) return;

    setStatusMessage("下書きに戻しています...");
    setErrorMessage("");

    const { error } = await supabase
      .from("cpp_profiles")
      .update({
        visibility: "draft",
        published_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      setStatusMessage("");
      setErrorMessage(`公開設定の変更に失敗しました: ${error.message}`);
      return;
    }

    setVisibility("draft");
    setPublishedAt(null);
    setStatusMessage("下書きに戻しました");
  }, [supabase, userId]);

  return (
    <main className="min-h-screen bg-neutral-50">
      <CppSectionNav />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
              研究者プロフィール
            </h1>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              プロフィールと交流・LIVE用の名札をここで編集します。書きかけでもCPPホームへ戻れます。
            </p>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-5 rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
              CPP WORKBOOKを読み込んでいます...
            </div>
          ) : !userId ? (
            <div className="mt-5 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold text-neutral-950">ログインしてください</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                CPPに登録したPARARIアカウントでログインすると、プロフィールを編集できます。
              </p>
              <Link
                href="/login?next=/my/cpp"
                className="mt-5 inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-800"
              >
                ログインする
              </Link>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              <CppResearcherEntryStatus editing />
              <CppProfileBasicsEditor userId={userId} userEmail={userEmail} />
              <CppResearchEvidenceEditor key={userId} userId={userId} />
              <CppHistoryEditor userId={userId} />

              <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-neutral-950">公開設定</h2>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">
                      公開先は、閲覧条件を満たす企業会員とCPP運営者に限定されます。一般公開はされません。未完成の研究概要や論文リストがあっても公開できます。入室と公開には、氏名・非公開の連絡先・学位情報の必須事項が必要です。
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      visibility === "published"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    {visibility === "published" ? "公開中" : "下書き"}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {visibility === "draft" ? (
                    <button
                      type="button"
                      onClick={() => void publish()}
                      className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-800"
                    >
                      公開する
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void returnToDraft()}
                      className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-neutral-800 hover:bg-neutral-50"
                    >
                      下書きに戻す
                    </button>
                  )}

                  {statusMessage ? (
                    <span className="text-xs font-semibold text-neutral-500">
                      {statusMessage}
                    </span>
                  ) : null}
                </div>

                {publishedAt ? (
                  <p className="mt-3 text-xs text-neutral-400">
                    最終公開: {new Date(publishedAt).toLocaleString("ja-JP")}
                  </p>
                ) : null}
              </section>

              <div className="flex justify-between pb-10 text-sm">
                <Link href="/my/cpp/home" className="text-neutral-500 hover:text-neutral-900">
                  ← CPPホームへ戻る
                </Link>
                <span className="text-neutral-400">CPP WORKBOOK v0.2</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
