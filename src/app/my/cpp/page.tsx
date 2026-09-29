// src/app/my/cpp/page.tsx
// CPP WORKBOOK v0.2
// 2026-09-14

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import CppSectionNav from "@/components/parari/cpp/CppSectionNav";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import CppProfileBasicsEditor from "@/components/parari/cpp/CppProfileBasicsEditor";
import CppHistoryEditor from "@/components/parari/cpp/CppHistoryEditor";

type Visibility = "draft" | "published";

type ProfileBootstrap = {
  user_id: string;
  public_name: string | null;
  visibility: Visibility;
  published_at: string | null;
};

type PublishProfileCheck = {
  public_name: string | null;
  degree_level: string | null;
  degree_status: string | null;
  degree_institution: string | null;
  degree_date: string | null;
};

type ContactCheck = {
  email: string | null;
  phone: string | null;
  address: string | null;
};

export default function CppWorkbookPage() {
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

    let profile = profileResult.data;
    if (!profile) {
      const { data, error } = await supabase
        .from("cpp_profiles")
        .insert({
          user_id: user.id,
          public_name: parariResult.data?.display_name ?? null,
        })
        .select("user_id, public_name, visibility, published_at")
        .single<ProfileBootstrap>();

      if (error || !data) {
        setErrorMessage(`CPPプロフィール作成に失敗しました: ${error?.message ?? "unknown error"}`);
        setLoading(false);
        return;
      }
      profile = data;
    }

    setVisibility(profile.visibility);
    setPublishedAt(profile.published_at);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const publish = useCallback(async () => {
    if (!supabase || !userId) return;

    setStatusMessage("公開条件を確認しています...");
    setErrorMessage("");

    const [profileResult, contactResult] = await Promise.all([
      supabase
        .from("cpp_profiles")
        .select(
          "public_name, degree_level, degree_status, degree_institution, degree_date",
        )
        .eq("user_id", userId)
        .single<PublishProfileCheck>(),
      supabase
        .from("cpp_private_contacts")
        .select("email, phone, address")
        .eq("user_id", userId)
        .maybeSingle<ContactCheck>(),
    ]);

    const firstError = profileResult.error || contactResult.error;
    if (firstError) {
      setStatusMessage("");
      setErrorMessage(`公開条件の確認に失敗しました: ${firstError.message}`);
      return;
    }

    const profile = profileResult.data;
    const contact = contactResult.data;
    const missing: string[] = [];

    if (!profile.public_name?.trim()) missing.push("氏名");
    if (!contact?.email?.trim()) missing.push("メールアドレス");
    if (!contact?.phone?.trim()) missing.push("電話番号");
    if (!contact?.address?.trim()) missing.push("住所");
    if (!profile.degree_status) missing.push("学位の取得状況");
    if (!profile.degree_level) missing.push("最終学位");
    if (!profile.degree_institution?.trim()) missing.push("学位の取得場所");
    if (!profile.degree_date) missing.push("学位の取得・取得予定日");

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
  }, [supabase, userId]);

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
              完成を待つ必要はありません。書いたところから保存し、途中でも公開できます。
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
              <h2 className="text-lg font-bold text-neutral-950">Preview側でログインしてください</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                このPreviewは parari.app とは別ドメインのため、本番サイトのログイン状態は引き継がれません。
                一度このPreview上でPARARIにログインすると、CPP WORKBOOKを確認できます。
              </p>
              <Link
                href="/login?next=/my/cpp"
                className="mt-5 inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-800"
              >
                Previewでログインする
              </Link>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              <CppProfileBasicsEditor userId={userId} userEmail={userEmail} />
              <CppHistoryEditor userId={userId} />

              <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-neutral-950">公開設定</h2>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">
                      未完成の研究概要や論文リストがあっても公開できます。ただし本人確認に必要な基本情報は公開時に必須です。
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
