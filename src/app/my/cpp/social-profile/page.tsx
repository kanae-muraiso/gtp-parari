"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import SocialProfileCard from "@/components/parari/matching/SocialProfileCard";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type SocialProfileRow = {
  user_id: string;
  display_name: string | null;
  photo_url: string | null;
  affiliation: string | null;
  role_title: string | null;
  topics: string[] | null;
  intro: string | null;
};

type ParariProfileRow = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type CppProfileRow = {
  affiliation: string | null;
  position_title: string | null;
};

const inputClassName =
  "w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-700";

export default function CppSocialProfilePage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [affiliation, setAffiliation] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [topicsText, setTopicsText] = useState("");
  const [intro, setIntro] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);\n  const [returnTo, setReturnTo] = useState<string | null>(null);
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
    setUserId(user.id);

    const [socialResult, parariResult, cppResult] = await Promise.all([
      supabase
        .from("parari_social_profiles")
        .select("user_id, display_name, photo_url, affiliation, role_title, topics, intro")
        .eq("user_id", user.id)
        .maybeSingle<SocialProfileRow>(),
      supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle<ParariProfileRow>(),
      supabase
        .from("cpp_profiles")
        .select("affiliation, position_title")
        .eq("user_id", user.id)
        .maybeSingle<CppProfileRow>(),
    ]);

    const firstError = socialResult.error || parariResult.error || cppResult.error;
    if (firstError) {
      setErrorMessage(`SOCIAL PROFILEの読み込みに失敗しました: ${firstError.message}`);
      setLoading(false);
      return;
    }

    let companyName = "";
    if (!socialResult.data?.affiliation && !cppResult.data?.affiliation) {
      const { data: memberships } = await supabase
        .from("cpp_company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .in("role", ["owner", "editor", "consultant"])
        .limit(1);
      const companyId = (memberships?.[0] as { company_id?: string } | undefined)?.company_id;
      if (companyId) {
        const { data: company } = await supabase
          .from("cpp_companies")
          .select("name")
          .eq("id", companyId)
          .maybeSingle<{ name: string }>();
        companyName = company?.name ?? "";
      }
    }

    const parari = parariResult.data;
    const social = socialResult.data;
    setDisplayName(social?.display_name || parari?.display_name || parari?.username || "");
    setPhotoUrl(social?.photo_url || parari?.avatar_url || null);
    setAffiliation(social?.affiliation || cppResult.data?.affiliation || companyName || "");
    setRoleTitle(social?.role_title || cppResult.data?.position_title || "");
    setTopicsText((social?.topics ?? []).join("、"));
    setIntro(social?.intro || "");
    setSaved(Boolean(social));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const topics = useMemo(
    () =>
      topicsText
        .split(/[、,\n]/)
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .slice(0, 6),
    [topicsText],
  );

  const save = async () => {
    if (!supabase || !userId || saving) return;
    if (!displayName.trim()) {
      setErrorMessage("表示名を入力してください。");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase.from("parari_social_profiles").upsert(
      {
        user_id: userId,
        display_name: displayName.trim(),
        photo_url: photoUrl,
        affiliation: affiliation.trim() || null,
        role_title: roleTitle.trim() || null,
        topics,
        intro: intro.trim() || null,
      },
      { onConflict: "user_id" },
    );

    setSaving(false);
    if (error) {
      setErrorMessage(`保存に失敗しました: ${error.message}`);
      return;
    }
    setSaved(true);
  };

  if (loading) {
    return <CenteredCard>SOCIAL PROFILEを読み込んでいます…</CenteredCard>;
  }

  if (!userId) {
    return (
      <CenteredCard>
        <div className="font-bold text-neutral-950">PARARIへのログインが必要です。</div>
        <Link href="/login?returnTo=/my/cpp/social-profile" className="mt-5 inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white">
          ログインする
        </Link>
      </CenteredCard>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-black tracking-[0.18em] text-neutral-400">PARARI MATCHING · SOCIAL PROFILE</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950">みんなに見える名札</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600">
              詳しい研究者プロフィールや企業プロフィールとは別です。CPPの中で人と出会うときに、研究者同士・企業担当者同士を含め、まず全員に見える最小限のプロフィールです。
            </p>
          </div>
          <Link href={returnTo || "/my/cpp/home"} className="text-xs font-bold text-neutral-500 hover:text-neutral-900">{returnTo ? "CPP同窓会一覧へ戻る" : "CPPホームへ戻る"}</Link>
        </header>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{errorMessage}</div>
        ) : null}

        <div className="mt-7 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black tracking-[0.14em] text-neutral-400">EDIT</div>
                <h2 className="mt-2 text-xl font-black text-neutral-950">SOCIAL PROFILE</h2>
              </div>
              {saved ? <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">保存済み</span> : null}
            </div>

            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-neutral-600">表示名</span>
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={inputClassName} placeholder="山田 花子" />
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-neutral-600">所属</span>
                  <input value={affiliation} onChange={(event) => setAffiliation(event.target.value)} className={inputClassName} placeholder="京都大学 / ○○株式会社" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-neutral-600">立場・職種</span>
                  <input value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} className={inputClassName} placeholder="博士研究員 / 創薬研究" />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-neutral-600">分野・話題（最大6個）</span>
                <input value={topicsText} onChange={(event) => setTopicsText(event.target.value)} className={inputClassName} placeholder="免疫学、single-cell、抗体医薬" />
                <span className="mt-2 block text-xs leading-5 text-neutral-400">「、」またはカンマで区切ります。</span>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-neutral-600">ひとこと自己紹介</span>
                <textarea value={intro} onChange={(event) => setIntro(event.target.value.slice(0, 220))} rows={4} className={`${inputClassName} resize-none`} placeholder="今どんなことをしている人なのか、話しかけるきっかけになる程度に。" />
                <span className="mt-2 block text-right text-xs text-neutral-400">{intro.length}/220</span>
              </label>

              <div className="rounded-2xl bg-neutral-50 p-4 text-xs leading-6 text-neutral-500">
                写真は現在のPARARIプロフィール写真を使います。写真アップロードはこの骨組みを確認してから追加できます。
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => void save()} disabled={saving || !displayName.trim()} className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white disabled:opacity-40">
                  {saving ? "保存しています…" : "SOCIAL PROFILEを保存"}
                </button>
                {saved && returnTo ? (
                  <Link href={returnTo} className="rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-bold text-neutral-800">
                    CPP同窓会一覧を見る →
                  </Link>
                ) : null}
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 px-1 text-xs font-black tracking-[0.14em] text-neutral-400">PREVIEW</div>
            <SocialProfileCard
              displayName={displayName || "名前未設定"}
              photoUrl={photoUrl}
              affiliation={affiliation}
              roleTitle={roleTitle}
              topics={topics}
              intro={intro}
            />
            <p className="mt-4 px-2 text-xs leading-6 text-neutral-500">
              このカードを、次の工程で「参加メンバー一覧」と「LIVEのドットをクリックした時」の共通表示として使います。
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">
        {children}
      </div>
    </main>
  );
}
