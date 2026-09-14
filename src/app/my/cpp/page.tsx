// src/app/my/cpp/page.tsx
// CPP WORKBOOK MVP
// 2026-09-14

"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import ManagementTabs from "@/components/parari/navigation/ManagementTabs";
import CppHistoryEditor from "@/components/parari/cpp/CppHistoryEditor";

type SaveState =
  | { type: "loading"; message: string }
  | { type: "ready"; message: string }
  | { type: "saving"; message: string }
  | { type: "saved"; message: string }
  | { type: "error"; message: string };

type DegreeLevel =
  | "doctorate"
  | "masters"
  | "bachelors"
  | "doctoral_student"
  | "masters_student"
  | "other"
  | "none";

type CppProfileRow = {
  user_id: string;
  public_name: string | null;
  photo_path: string | null;
  degree_level: DegreeLevel | null;
  degree_text: string | null;
  affiliation: string | null;
  position_title: string | null;
  visibility: "draft" | "published";
  published_at: string | null;
};

type ExistingProfileRow = {
  display_name: string | null;
};

type ResearchFieldRow = {
  id: string;
  source_key: string | null;
  major_name_ja: string;
  minor_name_ja: string;
  major_sort: number;
  minor_sort: number;
};

type ProfileResearchFieldRow = {
  research_field_id: string;
};

type KeywordRow = {
  id: string;
  keyword: string;
  sort_order: number;
};

const DEGREE_OPTIONS: Array<{ value: DegreeLevel; label: string }> = [
  { value: "doctorate", label: "博士" },
  { value: "doctoral_student", label: "博士課程在籍" },
  { value: "masters", label: "修士" },
  { value: "masters_student", label: "修士課程在籍" },
  { value: "bachelors", label: "学士" },
  { value: "other", label: "その他" },
  { value: "none", label: "学位なし" },
];

export default function CppWorkbookPage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  const [status, setStatus] = useState<SaveState>({
    type: "loading",
    message: "CPP WORKBOOKを読み込んでいます...",
  });

  const [userId, setUserId] = useState<string | null>(null);
  const [publicName, setPublicName] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [degreeLevel, setDegreeLevel] = useState<DegreeLevel | "">("");
  const [degreeText, setDegreeText] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [positionTitle, setPositionTitle] = useState("");
  const [visibility, setVisibility] = useState<"draft" | "published">("draft");
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  const [researchFields, setResearchFields] = useState<ResearchFieldRow[]>([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [fieldQuery, setFieldQuery] = useState("");

  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);

  const photoUrl = useMemo(() => {
    if (!supabase || !photoPath) {
      return null;
    }

    return supabase.storage.from("parari-images").getPublicUrl(photoPath).data
      .publicUrl;
  }, [photoPath, supabase]);

  const selectedFields = useMemo(
    () =>
      researchFields.filter((field) => selectedFieldIds.has(field.id)),
    [researchFields, selectedFieldIds],
  );

  const filteredFields = useMemo(() => {
    const query = fieldQuery.trim().toLocaleLowerCase("ja");
    if (!query) {
      return researchFields;
    }

    return researchFields.filter((field) =>
      `${field.major_name_ja} ${field.minor_name_ja}`
        .toLocaleLowerCase("ja")
        .includes(query),
    );
  }, [fieldQuery, researchFields]);

  const groupedFields = useMemo(() => {
    const groups = new Map<string, ResearchFieldRow[]>();

    for (const field of filteredFields) {
      const current = groups.get(field.major_name_ja) ?? [];
      current.push(field);
      groups.set(field.major_name_ja, current);
    }

    return Array.from(groups.entries());
  }, [filteredFields]);

  const loadWorkbook = useCallback(async () => {
    if (!supabase) {
      setStatus({
        type: "error",
        message: "Supabase環境変数がありません。",
      });
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatus({
        type: "error",
        message: "CPP WORKBOOKを使うにはログインが必要です。",
      });
      return;
    }

    setUserId(user.id);

    const [cppProfileResult, existingProfileResult, fieldsResult] =
      await Promise.all([
        supabase
          .from("cpp_profiles")
          .select(
            "user_id, public_name, photo_path, degree_level, degree_text, affiliation, position_title, visibility, published_at",
          )
          .eq("user_id", user.id)
          .maybeSingle<CppProfileRow>(),
        supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle<ExistingProfileRow>(),
        supabase
          .from("cpp_research_fields")
          .select(
            "id, source_key, major_name_ja, minor_name_ja, major_sort, minor_sort",
          )
          .order("major_sort", { ascending: true })
          .order("minor_sort", { ascending: true }),
      ]);

    if (cppProfileResult.error) {
      setStatus({
        type: "error",
        message: `CPPプロフィール取得に失敗しました: ${cppProfileResult.error.message}`,
      });
      return;
    }

    if (fieldsResult.error) {
      setStatus({
        type: "error",
        message: `研究分野一覧の取得に失敗しました: ${fieldsResult.error.message}`,
      });
      return;
    }

    let profile = cppProfileResult.data;

    if (!profile) {
      const initialName = existingProfileResult.data?.display_name ?? null;
      const { data: createdProfile, error: createError } = await supabase
        .from("cpp_profiles")
        .insert({
          user_id: user.id,
          public_name: initialName,
        })
        .select(
          "user_id, public_name, photo_path, degree_level, degree_text, affiliation, position_title, visibility, published_at",
        )
        .single<CppProfileRow>();

      if (createError || !createdProfile) {
        setStatus({
          type: "error",
          message: `CPPプロフィール作成に失敗しました: ${createError?.message ?? "unknown error"}`,
        });
        return;
      }

      profile = createdProfile;
    }

    const [selectedFieldsResult, keywordsResult] = await Promise.all([
      supabase
        .from("cpp_profile_research_fields")
        .select("research_field_id")
        .eq("user_id", user.id),
      supabase
        .from("cpp_profile_keywords")
        .select("id, keyword, sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    if (selectedFieldsResult.error) {
      setStatus({
        type: "error",
        message: `研究分野の取得に失敗しました: ${selectedFieldsResult.error.message}`,
      });
      return;
    }

    if (keywordsResult.error) {
      setStatus({
        type: "error",
        message: `キーワードの取得に失敗しました: ${keywordsResult.error.message}`,
      });
      return;
    }

    setPublicName(profile.public_name ?? "");
    setPhotoPath(profile.photo_path ?? null);
    setDegreeLevel(profile.degree_level ?? "");
    setDegreeText(profile.degree_text ?? "");
    setAffiliation(profile.affiliation ?? "");
    setPositionTitle(profile.position_title ?? "");
    setVisibility(profile.visibility ?? "draft");
    setPublishedAt(profile.published_at ?? null);
    setResearchFields((fieldsResult.data ?? []) as ResearchFieldRow[]);
    setSelectedFieldIds(
      new Set(
        ((selectedFieldsResult.data ?? []) as ProfileResearchFieldRow[]).map(
          (row) => row.research_field_id,
        ),
      ),
    );
    setKeywords((keywordsResult.data ?? []) as KeywordRow[]);

    loadedRef.current = true;
    setStatus({ type: "ready", message: "入力できます。" });
  }, [supabase]);

  useEffect(() => {
    void loadWorkbook();
  }, [loadWorkbook]);

  useEffect(() => {
    if (!loadedRef.current || !supabase || !userId) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(async () => {
      setStatus({ type: "saving", message: "保存中..." });

      const { error } = await supabase
        .from("cpp_profiles")
        .update({
          public_name: publicName.trim() || null,
          degree_level: degreeLevel || null,
          degree_text: degreeText.trim() || null,
          affiliation: affiliation.trim() || null,
          position_title: positionTitle.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) {
        setStatus({
          type: "error",
          message: `自動保存に失敗しました: ${error.message}`,
        });
        return;
      }

      setStatus({ type: "saved", message: "保存しました" });
    }, 700);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [
    affiliation,
    degreeLevel,
    degreeText,
    positionTitle,
    publicName,
    supabase,
    userId,
  ]);

  const toggleResearchField = useCallback(
    async (fieldId: string) => {
      if (!supabase || !userId) {
        return;
      }

      const currentlySelected = selectedFieldIds.has(fieldId);
      const next = new Set(selectedFieldIds);

      if (currentlySelected) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }

      setSelectedFieldIds(next);
      setStatus({ type: "saving", message: "研究分野を保存中..." });

      const result = currentlySelected
        ? await supabase
            .from("cpp_profile_research_fields")
            .delete()
            .eq("user_id", userId)
            .eq("research_field_id", fieldId)
        : await supabase.from("cpp_profile_research_fields").insert({
            user_id: userId,
            research_field_id: fieldId,
            sort_order: selectedFieldIds.size,
          });

      if (result.error) {
        setSelectedFieldIds(selectedFieldIds);
        setStatus({
          type: "error",
          message: `研究分野の保存に失敗しました: ${result.error.message}`,
        });
        return;
      }

      setStatus({ type: "saved", message: "保存しました" });
    }, [selectedFieldIds, supabase, userId],
  );

  const addKeyword = useCallback(async () => {
    if (!supabase || !userId) {
      return;
    }

    const keyword = keywordInput.trim();
    if (!keyword) {
      return;
    }

    if (
      keywords.some(
        (item) => item.keyword.toLocaleLowerCase() === keyword.toLocaleLowerCase(),
      )
    ) {
      setKeywordInput("");
      return;
    }

    setStatus({ type: "saving", message: "キーワードを保存中..." });

    const { data, error } = await supabase
      .from("cpp_profile_keywords")
      .insert({
        user_id: userId,
        keyword,
        sort_order: keywords.length,
      })
      .select("id, keyword, sort_order")
      .single<KeywordRow>();

    if (error || !data) {
      setStatus({
        type: "error",
        message: `キーワードの保存に失敗しました: ${error?.message ?? "unknown error"}`,
      });
      return;
    }

    setKeywords((current) => [...current, data]);
    setKeywordInput("");
    setStatus({ type: "saved", message: "保存しました" });
  }, [keywordInput, keywords, supabase, userId]);

  const removeKeyword = useCallback(
    async (keywordId: string) => {
      if (!supabase || !userId) {
        return;
      }

      const previous = keywords;
      setKeywords((current) => current.filter((item) => item.id !== keywordId));
      setStatus({ type: "saving", message: "キーワードを更新中..." });

      const { error } = await supabase
        .from("cpp_profile_keywords")
        .delete()
        .eq("id", keywordId)
        .eq("user_id", userId);

      if (error) {
        setKeywords(previous);
        setStatus({
          type: "error",
          message: `キーワードの削除に失敗しました: ${error.message}`,
        });
        return;
      }

      setStatus({ type: "saved", message: "保存しました" });
    },
    [keywords, supabase, userId],
  );

  const uploadPhoto = useCallback(
    async (file: File) => {
      if (!supabase || !userId) {
        return;
      }

      if (!file.type.startsWith("image/")) {
        setStatus({ type: "error", message: "画像ファイルを選択してください。" });
        return;
      }

      setPhotoUploading(true);
      setStatus({ type: "saving", message: "顔写真をアップロード中..." });

      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/cpp/profile-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("parari-images")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        setPhotoUploading(false);
        setStatus({
          type: "error",
          message: `顔写真のアップロードに失敗しました: ${uploadError.message}`,
        });
        return;
      }

      const { error: profileError } = await supabase
        .from("cpp_profiles")
        .update({
          photo_path: path,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (profileError) {
        setPhotoUploading(false);
        setStatus({
          type: "error",
          message: `顔写真の保存に失敗しました: ${profileError.message}`,
        });
        return;
      }

      if (photoPath) {
        await supabase.storage.from("parari-images").remove([photoPath]);
      }

      setPhotoPath(path);
      setPhotoUploading(false);
      setStatus({ type: "saved", message: "保存しました" });
    },
    [photoPath, supabase, userId],
  );

  const changeVisibility = useCallback(
    async (nextVisibility: "draft" | "published") => {
      if (!supabase || !userId) {
        return;
      }

      setStatus({
        type: "saving",
        message: nextVisibility === "published" ? "公開中..." : "下書きに戻しています...",
      });

      const nextPublishedAt =
        nextVisibility === "published" ? new Date().toISOString() : null;

      const { error } = await supabase
        .from("cpp_profiles")
        .update({
          visibility: nextVisibility,
          published_at: nextPublishedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) {
        setStatus({
          type: "error",
          message: `公開設定の変更に失敗しました: ${error.message}`,
        });
        return;
      }

      setVisibility(nextVisibility);
      setPublishedAt(nextPublishedAt);
      setStatus({
        type: "saved",
        message: nextVisibility === "published" ? "公開しました" : "下書きに戻しました",
      });
    },
    [supabase, userId],
  );

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="CPP WORKBOOK" showManagementLinks={false} />

        <div className="mt-6">
          <ManagementTabs active="settings" />
        </div>

        <div className="mx-auto mt-5 max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-neutral-950">研究者プロフィール</h1>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                完成していなくても大丈夫です。書いたところから自動保存されます。
              </p>
            </div>

            <SaveBadge status={status} />
          </div>

          {status.type === "error" ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {status.message}
            </div>
          ) : null}

          {status.type === "loading" ? (
            <div className="mt-5 rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
              {status.message}
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
                <SectionHeading
                  title="基本情報"
                  description="企業が最初に見る研究者としての基本情報です。"
                />

                <div className="mt-6 grid gap-5 sm:grid-cols-[140px_1fr]">
                  <div>
                    <div className="aspect-square overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-100">
                      {photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photoUrl}
                          alt="顔写真"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-3 text-center text-xs text-neutral-400">
                          顔写真
                        </div>
                      )}
                    </div>

                    <label className="mt-3 block cursor-pointer rounded-full border border-neutral-300 bg-white px-3 py-2 text-center text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
                      {photoUploading ? "アップロード中..." : "写真を選ぶ"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={photoUploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void uploadPhoto(file);
                          }
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>

                  <div className="space-y-5">
                    <Field label="氏名（公開名）">
                      <input
                        value={publicName}
                        onChange={(event) => setPublicName(event.target.value)}
                        className={inputClassName}
                        placeholder="例）山田 太郎"
                      />
                    </Field>

                    <Field label="学位・在籍状況">
                      <select
                        value={degreeLevel}
                        onChange={(event) =>
                          setDegreeLevel(event.target.value as DegreeLevel | "")
                        }
                        className={inputClassName}
                      >
                        <option value="">未選択</option>
                        {DEGREE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="学位名称（任意）">
                      <input
                        value={degreeText}
                        onChange={(event) => setDegreeText(event.target.value)}
                        className={inputClassName}
                        placeholder="例）博士（理学）"
                      />
                    </Field>

                    <Field label="現在の所属">
                      <input
                        value={affiliation}
                        onChange={(event) => setAffiliation(event.target.value)}
                        className={inputClassName}
                        placeholder="例）○○大学 ○○研究所"
                      />
                    </Field>

                    <Field label="身分・役職">
                      <input
                        value={positionTitle}
                        onChange={(event) => setPositionTitle(event.target.value)}
                        className={inputClassName}
                        placeholder="例）博士研究員 / 助教 / 大学院生"
                      />
                    </Field>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
                <SectionHeading
                  title="研究分野"
                  description="JREC-INの研究分野分類から複数選択できます。"
                />

                {selectedFields.length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {selectedFields.map((field) => (
                      <button
                        key={field.id}
                        type="button"
                        onClick={() => void toggleResearchField(field.id)}
                        className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white"
                        title="クリックで解除"
                      >
                        {field.minor_name_ja} ×
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-neutral-400">まだ選択されていません。</p>
                )}

                <div className="mt-5">
                  <input
                    value={fieldQuery}
                    onChange={(event) => setFieldQuery(event.target.value)}
                    className={inputClassName}
                    placeholder="研究分野を検索（例：分子生物学、情報、材料）"
                  />
                </div>

                <div className="mt-4 space-y-3">
                  {groupedFields.map(([major, fields]) => (
                    <details
                      key={major}
                      open={Boolean(fieldQuery.trim())}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50"
                    >
                      <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-neutral-900">
                        {major}
                        <span className="ml-2 text-xs font-normal text-neutral-400">
                          {fields.length}分野
                        </span>
                      </summary>

                      <div className="grid gap-1 border-t border-neutral-200 bg-white p-2 sm:grid-cols-2">
                        {fields.map((field) => {
                          const selected = selectedFieldIds.has(field.id);
                          return (
                            <label
                              key={field.id}
                              className="flex cursor-pointer items-start gap-2 rounded-xl px-3 py-2 text-sm hover:bg-neutral-50"
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => void toggleResearchField(field.id)}
                                className="mt-0.5"
                              />
                              <span className="leading-5 text-neutral-800">
                                {field.minor_name_ja}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </details>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
                <SectionHeading
                  title="キーワード"
                  description="研究分野だけでは表せないテーマ、技術、手法などを自由に登録します。"
                />

                {keywords.length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {keywords.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void removeKeyword(item.id)}
                        className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                        title="クリックで削除"
                      >
                        {item.keyword} ×
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-5 flex gap-2">
                  <input
                    value={keywordInput}
                    onChange={(event) => setKeywordInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void addKeyword();
                      }
                    }}
                    className={inputClassName}
                    placeholder="例）CRISPR"
                  />
                  <button
                    type="button"
                    onClick={() => void addKeyword()}
                    className="shrink-0 rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-bold text-white hover:bg-neutral-800"
                  >
                    追加
                  </button>
                </div>
              </section>

              <CppHistoryEditor userId={userId} />

              <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
                <SectionHeading
                  title="公開設定"
                  description="未完成のまま公開してもかまいません。後から何度でも更新できます。"
                />

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      visibility === "published"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    {visibility === "published" ? "公開中" : "下書き"}
                  </span>

                  {visibility === "draft" ? (
                    <button
                      type="button"
                      onClick={() => void changeVisibility("published")}
                      className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800"
                    >
                      公開する
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void changeVisibility("draft")}
                      className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-800 hover:bg-neutral-50"
                    >
                      下書きに戻す
                    </button>
                  )}
                </div>

                {publishedAt ? (
                  <p className="mt-3 text-xs text-neutral-400">
                    最終公開: {new Date(publishedAt).toLocaleString("ja-JP")}
                  </p>
                ) : null}
              </section>

              <div className="flex justify-between pb-10 text-sm">
                <Link href="/my/profile" className="text-neutral-500 hover:text-neutral-900">
                  ← 設定へ戻る
                </Link>
                <span className="text-neutral-400">CPP WORKBOOK v0.1</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const inputClassName =
  "w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-neutral-900">{label}</label>
      {children}
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-base font-bold text-neutral-950">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-neutral-500">{description}</p>
    </div>
  );
}

function SaveBadge({ status }: { status: SaveState }) {
  const className =
    status.type === "error"
      ? "bg-red-100 text-red-700"
      : status.type === "saving"
        ? "bg-amber-100 text-amber-800"
        : status.type === "saved"
          ? "bg-emerald-100 text-emerald-800"
          : "bg-neutral-100 text-neutral-600";

  return (
    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${className}`}>
      {status.message}
    </span>
  );
}
