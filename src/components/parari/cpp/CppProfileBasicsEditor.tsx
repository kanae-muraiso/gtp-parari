// src/components/parari/cpp/CppProfileBasicsEditor.tsx
// CPP WORKBOOK - basic profile, private contact, research fields and keywords
// 2026-09-14

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type DegreeLevel =
  | "doctorate"
  | "masters"
  | "bachelors"
  | "other"
  | "none"
  | "doctoral_student"
  | "masters_student";

type DegreeStatus = "obtained" | "expected";

type ProfileRow = {
  user_id: string;
  public_name: string | null;
  photo_path: string | null;
  degree_level: DegreeLevel | null;
  degree_text: string | null;
  degree_status: DegreeStatus | null;
  degree_institution: string | null;
  degree_date: string | null;
  affiliation: string | null;
  position_title: string | null;
};

type ContactRow = {
  user_id: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type ResearchFieldRow = {
  id: string;
  major_name_ja: string;
  minor_name_ja: string;
  major_sort: number;
  minor_sort: number;
};

type ResearchFieldLinkRow = {
  research_field_id: string;
};

type KeywordRow = {
  id: string;
  keyword: string;
  sort_order: number;
};

type Props = {
  userId: string;
  userEmail?: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const DEGREE_OPTIONS: Array<{ value: DegreeLevel; label: string }> = [
  { value: "doctorate", label: "博士" },
  { value: "masters", label: "修士" },
  { value: "bachelors", label: "学士" },
  { value: "other", label: "その他" },
  { value: "none", label: "学位なし" },
];

export default function CppProfileBasicsEditor({ userId, userEmail }: Props) {
  const supabase = useMemo(() => sharedSupabase, []);
  const profileLoadedRef = useRef(false);
  const contactLoadedRef = useRef(false);
  const profileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [publicName, setPublicName] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [degreeLevel, setDegreeLevel] = useState<DegreeLevel | "">("");
  const [degreeStatus, setDegreeStatus] = useState<DegreeStatus | "">("");
  const [degreeText, setDegreeText] = useState("");
  const [degreeInstitution, setDegreeInstitution] = useState("");
  const [degreeDate, setDegreeDate] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [positionTitle, setPositionTitle] = useState("");

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [researchFields, setResearchFields] = useState<ResearchFieldRow[]>([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [fieldMajor, setFieldMajor] = useState("");
  const [fieldCandidateId, setFieldCandidateId] = useState("");

  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [keywordInput, setKeywordInput] = useState("");

  const photoUrl = useMemo(() => {
    if (!supabase || !photoPath) return null;
    return supabase.storage.from("parari-images").getPublicUrl(photoPath).data.publicUrl;
  }, [photoPath, supabase]);

  const majorOptions = useMemo(() => {
    const seen = new Set<string>();
    return researchFields
      .filter((field) => {
        if (seen.has(field.major_name_ja)) return false;
        seen.add(field.major_name_ja);
        return true;
      })
      .map((field) => field.major_name_ja);
  }, [researchFields]);

  const minorOptions = useMemo(
    () =>
      researchFields.filter(
        (field) =>
          field.major_name_ja === fieldMajor && !selectedFieldIds.has(field.id),
      ),
    [fieldMajor, researchFields, selectedFieldIds],
  );

  const selectedFields = useMemo(
    () => researchFields.filter((field) => selectedFieldIds.has(field.id)),
    [researchFields, selectedFieldIds],
  );

  const load = useCallback(async () => {
    if (!supabase) return;

    setLoading(true);
    setErrorMessage("");

    const [profileResult, contactResult, fieldsResult, linksResult, keywordsResult] =
      await Promise.all([
        supabase
          .from("cpp_profiles")
          .select(
            "user_id, public_name, photo_path, degree_level, degree_text, degree_status, degree_institution, degree_date, affiliation, position_title",
          )
          .eq("user_id", userId)
          .single<ProfileRow>(),
        supabase
          .from("cpp_private_contacts")
          .select("user_id, email, phone, address")
          .eq("user_id", userId)
          .maybeSingle<ContactRow>(),
        supabase
          .from("cpp_research_fields")
          .select("id, major_name_ja, minor_name_ja, major_sort, minor_sort")
          .order("major_sort", { ascending: true })
          .order("minor_sort", { ascending: true }),
        supabase
          .from("cpp_profile_research_fields")
          .select("research_field_id")
          .eq("user_id", userId),
        supabase
          .from("cpp_profile_keywords")
          .select("id, keyword, sort_order")
          .eq("user_id", userId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);

    const firstError =
      profileResult.error ||
      contactResult.error ||
      fieldsResult.error ||
      linksResult.error ||
      keywordsResult.error;

    if (firstError) {
      setErrorMessage(`基本情報の取得に失敗しました: ${firstError.message}`);
      setLoading(false);
      return;
    }

    const profile = profileResult.data;
    setPublicName(profile.public_name ?? "");
    setPhotoPath(profile.photo_path ?? null);

    if (profile.degree_level === "doctoral_student") {
      setDegreeLevel("doctorate");
      setDegreeStatus("expected");
    } else if (profile.degree_level === "masters_student") {
      setDegreeLevel("masters");
      setDegreeStatus("expected");
    } else {
      setDegreeLevel(profile.degree_level ?? "");
      setDegreeStatus(profile.degree_status ?? "");
    }

    setDegreeText(profile.degree_text ?? "");
    setDegreeInstitution(profile.degree_institution ?? "");
    setDegreeDate(profile.degree_date ?? "");
    setAffiliation(profile.affiliation ?? "");
    setPositionTitle(profile.position_title ?? "");

    let contact = contactResult.data;
    if (!contact) {
      const { data, error } = await supabase
        .from("cpp_private_contacts")
        .insert({
          user_id: userId,
          email: userEmail ?? null,
        })
        .select("user_id, email, phone, address")
        .single<ContactRow>();

      if (error) {
        setErrorMessage(`連絡先の初期化に失敗しました: ${error.message}`);
        setLoading(false);
        return;
      }
      contact = data;
    }

    setEmail(contact.email ?? userEmail ?? "");
    setPhone(contact.phone ?? "");
    setAddress(contact.address ?? "");
    setResearchFields((fieldsResult.data ?? []) as ResearchFieldRow[]);
    setSelectedFieldIds(
      new Set(
        ((linksResult.data ?? []) as ResearchFieldLinkRow[]).map(
          (row) => row.research_field_id,
        ),
      ),
    );
    setKeywords((keywordsResult.data ?? []) as KeywordRow[]);

    profileLoadedRef.current = true;
    contactLoadedRef.current = true;
    setLoading(false);
  }, [supabase, userEmail, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!profileLoadedRef.current || !supabase) return;
    if (profileTimerRef.current) clearTimeout(profileTimerRef.current);

    profileTimerRef.current = setTimeout(async () => {
      setSaveState("saving");
      setSaveMessage("基本情報を保存中...");

      const { error } = await supabase
        .from("cpp_profiles")
        .update({
          public_name: cleanText(publicName),
          degree_level: degreeLevel || null,
          degree_status: degreeStatus || null,
          degree_text: cleanText(degreeText),
          degree_institution: cleanText(degreeInstitution),
          degree_date: degreeDate || null,
          affiliation: cleanText(affiliation),
          position_title: cleanText(positionTitle),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) {
        setSaveState("error");
        setSaveMessage(error.message);
      } else {
        setSaveState("saved");
        setSaveMessage("保存しました");
      }
    }, 700);

    return () => {
      if (profileTimerRef.current) clearTimeout(profileTimerRef.current);
    };
  }, [
    affiliation,
    degreeDate,
    degreeInstitution,
    degreeLevel,
    degreeStatus,
    degreeText,
    positionTitle,
    publicName,
    supabase,
    userId,
  ]);

  useEffect(() => {
    if (!contactLoadedRef.current || !supabase) return;
    if (contactTimerRef.current) clearTimeout(contactTimerRef.current);

    contactTimerRef.current = setTimeout(async () => {
      setSaveState("saving");
      setSaveMessage("非公開連絡先を保存中...");

      const { error } = await supabase
        .from("cpp_private_contacts")
        .upsert({
          user_id: userId,
          email: cleanText(email),
          phone: cleanText(phone),
          address: cleanText(address),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        setSaveState("error");
        setSaveMessage(error.message);
      } else {
        setSaveState("saved");
        setSaveMessage("保存しました");
      }
    }, 700);

    return () => {
      if (contactTimerRef.current) clearTimeout(contactTimerRef.current);
    };
  }, [address, email, phone, supabase, userId]);

  const uploadPhoto = useCallback(
    async (file: File) => {
      if (!supabase) return;
      if (!file.type.startsWith("image/")) {
        setErrorMessage("画像ファイルを選択してください。");
        return;
      }

      setPhotoUploading(true);
      setErrorMessage("");

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
        setErrorMessage(`顔写真のアップロードに失敗しました: ${uploadError.message}`);
        return;
      }

      const { error: dbError } = await supabase
        .from("cpp_profiles")
        .update({ photo_path: path, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      if (dbError) {
        await supabase.storage.from("parari-images").remove([path]);
        setPhotoUploading(false);
        setErrorMessage(`顔写真の保存に失敗しました: ${dbError.message}`);
        return;
      }

      if (photoPath) {
        await supabase.storage.from("parari-images").remove([photoPath]);
      }

      setPhotoPath(path);
      setPhotoUploading(false);
      setSaveState("saved");
      setSaveMessage("写真を保存しました");
    },
    [photoPath, supabase, userId],
  );

  const addResearchField = useCallback(async () => {
    if (!supabase || !fieldCandidateId || selectedFieldIds.has(fieldCandidateId)) return;

    const { error } = await supabase.from("cpp_profile_research_fields").insert({
      user_id: userId,
      research_field_id: fieldCandidateId,
      sort_order: selectedFieldIds.size,
    });

    if (error) {
      setErrorMessage(`研究分野の追加に失敗しました: ${error.message}`);
      return;
    }

    setSelectedFieldIds((current) => new Set([...current, fieldCandidateId]));
    setFieldCandidateId("");
  }, [fieldCandidateId, selectedFieldIds, supabase, userId]);

  const removeResearchField = useCallback(
    async (fieldId: string) => {
      if (!supabase) return;

      const { error } = await supabase
        .from("cpp_profile_research_fields")
        .delete()
        .eq("user_id", userId)
        .eq("research_field_id", fieldId);

      if (error) {
        setErrorMessage(`研究分野の削除に失敗しました: ${error.message}`);
        return;
      }

      setSelectedFieldIds((current) => {
        const next = new Set(current);
        next.delete(fieldId);
        return next;
      });
    },
    [supabase, userId],
  );

  const addKeyword = useCallback(async () => {
    if (!supabase) return;
    const keyword = keywordInput.trim();
    if (!keyword) return;

    if (keywords.some((row) => row.keyword.toLocaleLowerCase() === keyword.toLocaleLowerCase())) {
      setKeywordInput("");
      return;
    }

    const { data, error } = await supabase
      .from("cpp_profile_keywords")
      .insert({ user_id: userId, keyword, sort_order: keywords.length })
      .select("id, keyword, sort_order")
      .single<KeywordRow>();

    if (error || !data) {
      setErrorMessage(`キーワードの追加に失敗しました: ${error?.message ?? "unknown error"}`);
      return;
    }

    setKeywords((current) => [...current, data]);
    setKeywordInput("");
  }, [keywordInput, keywords, supabase, userId]);

  const removeKeyword = useCallback(
    async (id: string) => {
      if (!supabase) return;
      const { error } = await supabase
        .from("cpp_profile_keywords")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        setErrorMessage(`キーワードの削除に失敗しました: ${error.message}`);
        return;
      }
      setKeywords((current) => current.filter((row) => row.id !== id));
    },
    [supabase, userId],
  );

  if (loading) {
    return (
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-400 shadow-sm">
        基本情報を読み込んでいます...
      </section>
    );
  }

  return (
    <>
      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-neutral-950">基本情報</h2>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              氏名・最終学位・現在の所属など、研究者プロフィールの基本情報です。
            </p>
          </div>
          <SaveBadge state={saveState} message={saveMessage} />
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-[140px_1fr]">
          <div>
            <div className="aspect-square overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-100">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="顔写真" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-neutral-400">
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
                  if (file) void uploadPhoto(file);
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

            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-neutral-950">最終学位（予定を含む）</div>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    学位、取得場所、取得・取得予定日を登録します。
                  </p>
                </div>
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">
                  公開時必須
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="取得状況">
                  <select
                    value={degreeStatus}
                    onChange={(event) => setDegreeStatus(event.target.value as DegreeStatus | "")}
                    className={inputClassName}
                  >
                    <option value="">選択してください</option>
                    <option value="obtained">取得済み</option>
                    <option value="expected">取得予定</option>
                  </select>
                </Field>

                <Field label="学位">
                  <select
                    value={degreeLevel}
                    onChange={(event) => setDegreeLevel(event.target.value as DegreeLevel | "")}
                    className={inputClassName}
                  >
                    <option value="">選択してください</option>
                    {DEGREE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-4 space-y-4">
                <Field label="学位名称">
                  <input
                    value={degreeText}
                    onChange={(event) => setDegreeText(event.target.value)}
                    className={inputClassName}
                    placeholder="例）博士（理学）"
                  />
                </Field>

                <Field label="取得場所">
                  <input
                    value={degreeInstitution}
                    onChange={(event) => setDegreeInstitution(event.target.value)}
                    className={inputClassName}
                    placeholder="例）京都大学"
                  />
                </Field>

                <Field label={degreeStatus === "expected" ? "取得予定日" : "取得日"}>
                  <input
                    type="date"
                    value={degreeDate}
                    onChange={(event) => setDegreeDate(event.target.value)}
                    className={inputClassName}
                  />
                </Field>
              </div>
            </div>

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-neutral-950">連絡先</h2>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              メールアドレス、電話番号、住所は登録必須です。
            </p>
          </div>
          <span className="rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-bold text-white">
            一般には公開されません
          </span>
        </div>

        <div className="mt-5 space-y-4">
          <RequiredField label="メールアドレス">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClassName}
              placeholder="name@example.com"
            />
          </RequiredField>
          <RequiredField label="電話番号">
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={inputClassName}
              placeholder="090-0000-0000"
            />
          </RequiredField>
          <RequiredField label="住所">
            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="min-h-24 w-full resize-y rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-neutral-600"
              placeholder="郵便番号・都道府県から入力してください"
            />
          </RequiredField>
        </div>
      </section>

      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-base font-bold text-neutral-950">研究分野</h2>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            JREC-INの研究分野分類から選び、必要なだけ追加できます。
          </p>
        </div>

        {selectedFields.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {selectedFields.map((field) => (
              <button
                key={field.id}
                type="button"
                onClick={() => void removeResearchField(field.id)}
                className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white"
                title="クリックで削除"
              >
                {field.minor_name_ja} ×
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-neutral-400">まだ研究分野は登録されていません。</p>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
          <select
            value={fieldMajor}
            onChange={(event) => {
              setFieldMajor(event.target.value);
              setFieldCandidateId("");
            }}
            className={inputClassName}
          >
            <option value="">大分類を選択</option>
            {majorOptions.map((major) => (
              <option key={major} value={major}>
                {major}
              </option>
            ))}
          </select>

          <select
            value={fieldCandidateId}
            onChange={(event) => setFieldCandidateId(event.target.value)}
            disabled={!fieldMajor}
            className={inputClassName}
          >
            <option value="">研究分野を選択</option>
            {minorOptions.map((field) => (
              <option key={field.id} value={field.id}>
                {field.minor_name_ja}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void addResearchField()}
            disabled={!fieldCandidateId}
            className="rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            追加
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-base font-bold text-neutral-950">キーワード</h2>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            分類だけでは表せないテーマ、技術、手法などを自由に登録します。
          </p>
        </div>

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
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-neutral-900">{label}</label>
      {children}
    </div>
  );
}

function RequiredField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
        {label}
        <span className="text-[11px] font-bold text-red-600">必須</span>
      </label>
      {children}
    </div>
  );
}

function SaveBadge({ state, message }: { state: SaveState; message: string }) {
  if (state === "idle") return null;
  const className =
    state === "error"
      ? "bg-red-50 text-red-700"
      : state === "saving"
        ? "bg-amber-50 text-amber-700"
        : "bg-emerald-50 text-emerald-700";

  return (
    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${className}`}>
      {message}
    </span>
  );
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

const inputClassName =
  "w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400";
