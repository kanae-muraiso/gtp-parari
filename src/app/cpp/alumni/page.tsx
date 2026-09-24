"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type AlumniRow = {
  user_id: string;
  participation_year: number | null;
  participation_location: string | null;
  cpp_memory: string;
  created_at: string;
  updated_at: string;
};

type ParticipationRow = {
  participation_year: number;
  participation_location: string;
  sort_order: number;
};

type ParticipationInput = {
  year: string;
  location: string;
};

type SocialProfileRow = {
  user_id: string;
  display_name: string | null;
  photo_url: string | null;
  affiliation: string | null;
  role_title: string | null;
  topics: string[] | null;
  intro: string | null;
};

type CppProfileRow = {
  public_name: string | null;
  affiliation: string | null;
  position_title: string | null;
};

type ParariProfileRow = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

const inputClassName =
  "w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-700";

const currentYear = new Date().getFullYear();
const yearOptions = Array.from(
  { length: Math.max(1, currentYear - 2004) },
  (_, index) => currentYear - index,
);

const emptyParticipation = (): ParticipationInput => ({
  year: "",
  location: "",
});

export default function CppAlumniPage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [participations, setParticipations] = useState<ParticipationInput[]>([
    emptyParticipation(),
  ]);
  const [cppMemory, setCppMemory] = useState("");
  const [socialProfile, setSocialProfile] = useState<SocialProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
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
    setEmail(user.email ?? "");

    const [
      alumniResult,
      participationResult,
      socialResult,
      cppResult,
      parariResult,
    ] = await Promise.all([
      supabase
        .from("cpp_alumni")
        .select(
          "user_id, participation_year, participation_location, cpp_memory, created_at, updated_at",
        )
        .eq("user_id", user.id)
        .maybeSingle<AlumniRow>(),
      supabase
        .from("cpp_alumni_participations")
        .select("participation_year, participation_location, sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true })
        .returns<ParticipationRow[]>(),
      supabase
        .from("parari_social_profiles")
        .select(
          "user_id, display_name, photo_url, affiliation, role_title, topics, intro",
        )
        .eq("user_id", user.id)
        .maybeSingle<SocialProfileRow>(),
      supabase
        .from("cpp_profiles")
        .select("public_name, affiliation, position_title")
        .eq("user_id", user.id)
        .maybeSingle<CppProfileRow>(),
      supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle<ParariProfileRow>(),
    ]);

    const firstError =
      alumniResult.error ||
      participationResult.error ||
      socialResult.error ||
      cppResult.error ||
      parariResult.error;

    if (firstError) {
      setErrorMessage(
        `CPP同窓会の登録情報を読み込めませんでした: ${firstError.message}`,
      );
      setLoading(false);
      return;
    }

    const social = socialResult.data;
    const cpp = cppResult.data;
    const parari = parariResult.data;
    const alumni = alumniResult.data;

    setSocialProfile(social ?? null);
    setDisplayName(
      social?.display_name ||
        cpp?.public_name ||
        parari?.display_name ||
        parari?.username ||
        "",
    );
    setAffiliation(social?.affiliation || cpp?.affiliation || "");
    setRoleTitle(social?.role_title || cpp?.position_title || "");

    if ((participationResult.data ?? []).length > 0) {
      setParticipations(
        (participationResult.data ?? []).map((item) => ({
          year: String(item.participation_year),
          location: item.participation_location,
        })),
      );
    } else if (alumni?.participation_year && alumni.participation_location) {
      setParticipations([
        {
          year: String(alumni.participation_year),
          location: alumni.participation_location,
        },
      ]);
    }

    if (alumni) {
      setCppMemory(alumni.cpp_memory);
      setRegistered(true);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateParticipation = (
    index: number,
    key: keyof ParticipationInput,
    value: string,
  ) => {
    setParticipations((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  };

  const addParticipation = () => {
    setParticipations((current) => [...current, emptyParticipation()]);
  };

  const removeParticipation = (index: number) => {
    setParticipations((current) =>
      current.length <= 1
        ? current
        : current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const save = async () => {
    if (!supabase || !userId || saving) return;

    const normalizedName = displayName.trim();
    const normalizedAffiliation = affiliation.trim();
    const normalizedRoleTitle = roleTitle.trim();
    const normalizedMemory = cppMemory.trim();

    const normalizedParticipations = participations.map((item) => ({
      year: Number(item.year),
      location: item.location.trim(),
    }));

    if (!normalizedName) {
      setErrorMessage("お名前を入力してください。");
      return;
    }

    for (const [index, participation] of normalizedParticipations.entries()) {
      if (
        !Number.isInteger(participation.year) ||
        participation.year < 2005 ||
        participation.year > currentYear
      ) {
        setErrorMessage(`参加歴 ${index + 1} の年を選んでください。`);
        return;
      }

      if (!participation.location) {
        setErrorMessage(`参加歴 ${index + 1} の開催地を入力してください。`);
        return;
      }
    }

    const participationKeys = normalizedParticipations.map(
      (item) => `${item.year}::${item.location.toLocaleLowerCase("ja-JP")}`,
    );
    if (new Set(participationKeys).size !== participationKeys.length) {
      setErrorMessage("同じ年・開催地の参加歴が重複しています。");
      return;
    }

    if (!normalizedMemory) {
      setErrorMessage("CPPで印象に残っていること、当時の感想・その後につながったことを入力してください。");
      return;
    }
    if (normalizedMemory.length > 2000) {
      setErrorMessage("当時の感想は2000字以内で入力してください。");
      return;
    }

    setSaving(true);
    setJustSaved(false);
    setErrorMessage("");

    const now = new Date().toISOString();

    const { error: socialError } = await supabase
      .from("parari_social_profiles")
      .upsert(
        {
          user_id: userId,
          display_name: normalizedName,
          photo_url: socialProfile?.photo_url ?? null,
          affiliation: normalizedAffiliation || null,
          role_title: normalizedRoleTitle || null,
          topics: socialProfile?.topics ?? [],
          intro: socialProfile?.intro ?? null,
          updated_at: now,
        },
        { onConflict: "user_id" },
      );

    if (socialError) {
      setSaving(false);
      setErrorMessage(
        `公開プロフィールを保存できませんでした: ${socialError.message}`,
      );
      return;
    }

    const firstParticipation = normalizedParticipations[0];

    const { error: alumniError } = await supabase.from("cpp_alumni").upsert(
      {
        user_id: userId,
        participation_year: firstParticipation.year,
        participation_location: firstParticipation.location,
        cpp_memory: normalizedMemory,
        updated_at: now,
      },
      { onConflict: "user_id" },
    );

    if (alumniError) {
      setSaving(false);
      setErrorMessage(
        `CPP同窓会への登録に失敗しました: ${alumniError.message}`,
      );
      return;
    }

    const { error: participationError } = await supabase.rpc(
      "cpp_alumni_replace_participations",
      {
        p_participations: normalizedParticipations.map((item) => ({
          participation_year: item.year,
          participation_location: item.location,
        })),
      },
    );

    setSaving(false);

    if (participationError) {
      setErrorMessage(
        `CPP参加歴を保存できませんでした: ${participationError.message}`,
      );
      return;
    }

    setSocialProfile((current) => ({
      user_id: userId,
      display_name: normalizedName,
      photo_url: current?.photo_url ?? null,
      affiliation: normalizedAffiliation || null,
      role_title: normalizedRoleTitle || null,
      topics: current?.topics ?? [],
      intro: current?.intro ?? null,
    }));
    setRegistered(true);
    setJustSaved(true);
  };

  if (loading) {
    return <CenteredCard>CPP同窓会の登録情報を読み込んでいます…</CenteredCard>;
  }

  if (!userId) {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-16">
        <div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <div className="text-xs font-black tracking-[0.18em] text-neutral-400">
            CPP ALUMNI × PARARI
          </div>
          <h1 className="mt-3 text-3xl font-black text-neutral-950">
            CPP同窓会
          </h1>
          <p className="mt-4 text-sm leading-7 text-neutral-600">
            CPP同窓会はPARARIアカウントを使って登録します。すでにPARARIを利用している方は、同じアカウントでそのまま続けられます。
          </p>
          <Link
            href="/login?returnTo=/cpp/alumni"
            className="mt-7 inline-flex rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white"
          >
            PARARIにログインして登録する
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <header className="rounded-[2.25rem] border border-neutral-200 bg-white p-7 shadow-sm sm:p-9">
          <div className="text-xs font-black tracking-[0.18em] text-neutral-400">
            CPP ALUMNI
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950">
            {registered ? "CPP同窓会 登録内容" : "CPP同窓会に登録"}
          </h1>
          <p className="mt-4 text-sm leading-7 text-neutral-600">
            CPPに参加した皆さんが、今どこで何をしているのかをもう一度つなぐための登録です。複数回参加した方は、すべての参加歴を登録できます。
          </p>

          {registered ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/cpp/alumni/members"
                className="rounded-full bg-neutral-950 px-5 py-2.5 text-xs font-bold text-white"
              >
                登録者を見る →
              </Link>
              <Link
                href="/my/cpp/social-profile?returnTo=/cpp/alumni/members"
                className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-xs font-bold text-neutral-700"
              >
                SOCIAL PROFILEを編集
              </Link>
            </div>
          ) : null}
        </header>

        {errorMessage ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {justSaved ? (
          <section className="mt-5 rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6 sm:p-7">
            <div className="text-xs font-black tracking-[0.16em] text-emerald-700">
              REGISTERED
            </div>
            <h2 className="mt-2 text-2xl font-black text-emerald-950">
              CPP同窓会に登録しました
            </h2>
            <p className="mt-3 text-sm leading-7 text-emerald-900">
              次に、ほかの参加者に見える短いSOCIAL PROFILEを確認してください。すでに登録済みの内容があればそのまま利用できます。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/my/cpp/social-profile?returnTo=/cpp/alumni/members"
                className="rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white"
              >
                SOCIAL PROFILEを確認する →
              </Link>
              <Link
                href="/cpp/alumni/members"
                className="rounded-full border border-emerald-300 bg-white px-6 py-3 text-sm font-bold text-emerald-950"
              >
                先に登録者を見る
              </Link>
            </div>
          </section>
        ) : null}

        <section className="mt-5 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <div className="text-xs font-black tracking-[0.14em] text-neutral-400">
              CURRENT PROFILE
            </div>
            <h2 className="mt-2 text-xl font-black text-neutral-950">
              現在のあなた
            </h2>
            <p className="mt-2 text-xs leading-6 text-neutral-500">
              名前・所属・立場はCPP LIVEでも使うSOCIAL PROFILEと共通です。研究者プロフィールがある場合は、その内容を初期値として利用します。
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-neutral-600">
                お名前
              </span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className={inputClassName}
                placeholder="山田 花子"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-neutral-600">
                メールアドレス
              </span>
              <input
                value={email}
                readOnly
                className={`${inputClassName} bg-neutral-50 text-neutral-500`}
              />
              <span className="mt-2 block text-xs text-neutral-400">
                連絡用です。同窓会の登録者一覧には表示しません。
              </span>
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-neutral-600">
                  現在の所属
                </span>
                <input
                  value={affiliation}
                  onChange={(event) => setAffiliation(event.target.value)}
                  className={inputClassName}
                  placeholder="京都大学 / ○○株式会社"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-neutral-600">
                  現在の立場・役職
                </span>
                <input
                  value={roleTitle}
                  onChange={(event) => setRoleTitle(event.target.value)}
                  className={inputClassName}
                  placeholder="准教授 / 研究部長 / 起業家"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <div className="text-xs font-black tracking-[0.14em] text-neutral-400">
              YOUR CPP
            </div>
            <h2 className="mt-2 text-xl font-black text-neutral-950">
              CPPに参加したときのこと
            </h2>
            <p className="mt-2 text-xs leading-6 text-neutral-500">
              参加した回数分、年と開催地を追加してください。
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <div className="space-y-4">
              {participations.map((participation, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="text-xs font-black tracking-[0.12em] text-neutral-500">
                      参加歴 {index + 1}
                    </div>
                    {participations.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeParticipation(index)}
                        className="text-xs font-bold text-neutral-400 hover:text-red-600"
                      >
                        削除
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-bold text-neutral-600">
                        参加した年
                      </span>
                      <select
                        value={participation.year}
                        onChange={(event) =>
                          updateParticipation(index, "year", event.target.value)
                        }
                        className={inputClassName}
                      >
                        <option value="">選択してください</option>
                        {yearOptions.map((year) => (
                          <option key={year} value={year}>
                            {year}年
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-bold text-neutral-600">
                        開催地
                      </span>
                      <input
                        value={participation.location}
                        onChange={(event) =>
                          updateParticipation(
                            index,
                            "location",
                            event.target.value.slice(0, 120),
                          )
                        }
                        className={inputClassName}
                        placeholder="東京 / 京都 / 大阪 など"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addParticipation}
              className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-neutral-700 transition hover:border-neutral-500"
            >
              ＋ 参加歴を追加
            </button>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-neutral-600">
                CPPで印象に残っていること、当時の感想
              </span>
              <textarea
                value={cppMemory}
                onChange={(event) => setCppMemory(event.target.value.slice(0, 2000))}
                rows={8}
                className={`${inputClassName} resize-none leading-7`}
                placeholder="当時の出会い、印象に残っていること、その後につながったことなどを自由にお書きください。"
              />
              <span className="mt-2 block text-right text-xs text-neutral-400">
                {cppMemory.length}/2000
              </span>
            </label>

            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-full bg-neutral-950 px-7 py-3 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-40"
            >
              {saving
                ? "保存しています…"
                : registered
                  ? "登録内容を更新する"
                  : "CPP同窓会に登録する"}
            </button>
          </div>
        </section>
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
