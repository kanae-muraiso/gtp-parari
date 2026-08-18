// apps/tools/parari/src/app/my/profile/page.tsx
// src/app/my/profile/page.tsx
// 2026/08/18 14:45
// PART: MVP profile settings
// コメント:
// - /my/works から使う公開URL設定ページ
// - username / display_name だけを編集するMVP版
// - 旧ホームページ作成・リンク集・画像設定は後で再統合する
// - 保存後は returnTo があればそこへ戻り、なければ /my/works へ戻る

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";
import SettingsTabs, {
  type SettingsTab,
} from "@/components/parari/settings/SettingsTabs";
import ApplicationManager from "@/components/parari/settings/ApplicationManager";
import MembershipShelfPanel from "@/components/parari/MembershipShelfPanel";

const USERNAME_RE = /^(?=.{5,32}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RESERVED_USERNAMES = new Set([
  "admin",
  "api",
  "auth",
  "editor",
  "editor-v2",
  "login",
  "logout",
  "my",
  "new",
  "p",
  "signup",
  "works",
]);

type LoadStatus =
  | { type: "loading"; message: string }
  | { type: "ready"; message: string }
  | { type: "saving"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type UserTopMode = "web" | "profile" | "works";

type ProfileRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  homepage_mode: string | null;
  homepage_book_id: string | null;
};

type PrivateProfileRow = {
  user_id: string;
  full_name: string | null;
};

type WebWorkRow = {
  id: string;
  title: string | null;
  content: string | null;
  stable_slug: string | null;
  custom_slug: string | null;
  slug: string | null;
};

type UsernameOwnerRow = {
  user_id: string;
  username: string | null;
};

export default function MyProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => sharedSupabase, []);

  const [returnTo, setReturnTo] = useState("/my/works");
  const [siteOrigin, setSiteOrigin] = useState("");
  const [activeTab, setActiveTab] =
    useState<SettingsTab>("basic");

  const [status, setStatus] = useState<LoadStatus>({
    type: "loading",
    message: "プロフィールを読み込んでいます...",
  });

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");

    const [displayName, setDisplayName] = useState("");
    const [username, setUsername] = useState("");
    const [fullName, setFullName] = useState("");
    const [usernameTouched, setUsernameTouched] = useState(false);

  const [userTopMode, setUserTopMode] =
    useState<UserTopMode>("works");

  const [homepageBookId, setHomepageBookId] =
    useState("");

  const [webWorks, setWebWorks] =
    useState<WebWorkRow[]>([]);

  const normalizedUsername = normalizeUsername(username);
  const usernameError = usernameTouched
    ? getUsernameError(normalizedUsername)
    : "";

  const publicWorksUrl = normalizedUsername
    ? buildFullUrl(siteOrigin, `/${normalizedUsername}/works`)
    : buildFullUrl(siteOrigin, "/your-name/works");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setSiteOrigin(window.location.origin);

    const params = new URLSearchParams(window.location.search);

    const nextTab = params.get("tab");

    if (
      nextTab === "plus" ||
      nextTab === "host" ||
      nextTab === "pro"
    ) {
      setActiveTab(nextTab);
    } else {
      setActiveTab("basic");
    }

    const nextReturnTo = params.get("returnTo");

    if (
      nextReturnTo &&
      nextReturnTo.startsWith("/") &&
      !nextReturnTo.startsWith("//")
    ) {
      setReturnTo(nextReturnTo);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    if (!supabase) {
      setStatus({
        type: "error",
        message: "Supabase環境変数がありません。",
      });
      return;
    }

    setStatus({
      type: "loading",
      message: "プロフィールを読み込んでいます...",
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatus({
        type: "error",
        message: "プロフィール設定にはログインが必要です。",
      });
      return;
    }

    setUserId(user.id);
    setEmail(user.email ?? "");

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "user_id, username, display_name, homepage_mode, homepage_book_id",
      )
      .eq("user_id", user.id)
      .maybeSingle<ProfileRow>();

    if (error) {
      setStatus({
        type: "error",
        message: `プロフィール取得に失敗しました: ${error.message}`,
      });
      return;
    }

    setUsername(data?.username ?? "");
    setDisplayName(data?.display_name ?? "");
      
      const { data: privateProfile, error: privateProfileError } = await supabase
        .from("user_private_profiles")
        .select("user_id, full_name")
        .eq("user_id", user.id)
        .maybeSingle<PrivateProfileRow>();

      if (privateProfileError) {
        setStatus({
          type: "error",
          message: `登録情報の取得に失敗しました: ${privateProfileError.message}`,
        });
        return;
      }

      setFullName(privateProfile?.full_name ?? "");

    const loadedMode =
      data?.homepage_mode === "book"
        ? "web"
        : data?.homepage_mode === "profile"
          ? "profile"
          : "works";

    setUserTopMode(loadedMode);
    setHomepageBookId(
      data?.homepage_book_id ?? "",
    );

    const {
      data: webWorkRows,
      error: webWorksError,
    } = await supabase
      .from("parari_books")
      .select(
        "id, title, content, stable_slug, custom_slug, slug",
      )
      .eq("owner", user.id)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .order("created_at", {
        ascending: false,
      });

    if (webWorksError) {
      setStatus({
        type: "error",
        message:
          `WEB作品の取得に失敗しました: ${webWorksError.message}`,
      });
      return;
    }

    const availableWebWorks = (
      (webWorkRows ?? []) as WebWorkRow[]
    ).filter((work) =>
      /^\s*\[(WEB|WEBINFO)\b/i.test(
        String(work.content ?? ""),
      ),
    );

    setWebWorks(availableWebWorks);

    if (
      loadedMode === "web" &&
      data?.homepage_book_id &&
      !availableWebWorks.some(
        (work) =>
          work.id === data.homepage_book_id,
      )
    ) {
      setHomepageBookId("");
    }

    setStatus({
      type: "ready",
      message: "プロフィールを読み込みました。",
    });
  }, [supabase]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSave = useCallback(async () => {
    if (!supabase) {
      setStatus({
        type: "error",
        message: "Supabase環境変数がありません。",
      });
      return;
    }

    if (!userId) {
      setStatus({
        type: "error",
        message: "ログインユーザーを確認できませんでした。",
      });
      return;
    }

    setUsernameTouched(true);

    const validationError = getUsernameError(normalizedUsername);

    if (validationError) {
      setStatus({
        type: "error",
        message: validationError,
      });
      return;
    }

    setStatus({
      type: "saving",
      message: "保存中です...",
    });

    const { data: usernameOwner, error: usernameOwnerError } = await supabase
      .from("profiles")
      .select("user_id, username")
      .eq("username", normalizedUsername)
      .maybeSingle<UsernameOwnerRow>();

    if (usernameOwnerError) {
      setStatus({
        type: "error",
        message: `ユーザーネーム確認に失敗しました: ${usernameOwnerError.message}`,
      });
      return;
    }

    if (usernameOwner?.user_id && usernameOwner.user_id !== userId) {
      setStatus({
        type: "error",
        message: "このユーザーネームはすでに使われています。",
      });
      return;
    }

    if (
      userTopMode === "web" &&
      !homepageBookId
    ) {
      setStatus({
        type: "error",
        message:
          "トップページに使用するWEBサイトを選択してください。",
      });
      return;
    }

    const payload = {
      user_id: userId,
      username: normalizedUsername,
      display_name: displayName.trim() || null,
      homepage_mode:
        userTopMode === "web"
          ? "book"
          : userTopMode,
      homepage_book_id:
        userTopMode === "web"
          ? homepageBookId
          : null,
    };

    const { data: updatedRows, error: updateError } = await supabase
      .from("profiles")
      .update({
        username: payload.username,
        display_name: payload.display_name,
        homepage_mode: payload.homepage_mode,
        homepage_book_id:
          payload.homepage_book_id,
      })
      .eq("user_id", userId)
      .select("user_id");

    if (updateError) {
      setStatus({
        type: "error",
        message: normalizeSupabaseSaveError(updateError.message),
      });
      return;
    }

    if (!updatedRows || updatedRows.length === 0) {
      const { error: insertError } = await supabase.from("profiles").insert({
        user_id: payload.user_id,
        username: payload.username,
        display_name: payload.display_name,
        homepage_mode: payload.homepage_mode,
        homepage_book_id:
          payload.homepage_book_id,
      });

      if (insertError) {
        setStatus({
          type: "error",
          message: normalizeSupabaseSaveError(insertError.message),
        });
        return;
      }
    }

      const { error: privateProfileSaveError } = await supabase
        .from("user_private_profiles")
        .upsert(
          {
            user_id: userId,
            full_name: fullName.trim() || null,
          },
          {
            onConflict: "user_id",
          },
        );

      if (privateProfileSaveError) {
        setStatus({
          type: "error",
          message: `登録情報の保存に失敗しました: ${privateProfileSaveError.message}`,
        });
        return;
      }
      
    setStatus({
      type: "success",
      message: "プロフィールを保存しました。",
    });

    router.push(returnTo);
    router.refresh();
  }, [
    displayName,
    fullName,
    homepageBookId,
    normalizedUsername,
    returnTo,
    router,
    supabase,
    userId,
    userTopMode,
  ]);

  const isBusy = status.type === "loading" || status.type === "saving";

  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-neutral-400">
              /my/profile
            </div>
          <h1 className="text-lg font-semibold text-neutral-900">
            設定
          </h1>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            PARARIの基本設定と、PLUS・HOST・PROの機能設定を管理します。
          </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "basic" ? (
              <StatusBadge status={status} />
            ) : null}

            <a
              href={returnTo}
              className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-200"
            >
              戻る
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6">
        <SettingsTabs active={activeTab} />

        {activeTab === "basic" ? (
          <div className="mt-5">
            {status.type === "loading" ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
            {status.message}
          </div>
        ) : null}

        {status.type !== "loading" ? (
          <div className="space-y-5">
                                      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
                                        <div>
                                          <div className="text-sm font-bold text-neutral-900">
                                            登録情報
                                          </div>

                                          <p className="mt-1 text-xs leading-5 text-neutral-500">
                                            Membershipへの参加や申込みなど、
                                            本人確認や連絡が必要なサービスで使用します。
                                            通常のプロフィールには表示されません。
                                          </p>
                                        </div>

                                        <div className="mt-5 space-y-5">
                                          <div className="space-y-2">
                                            <label className="block text-sm font-semibold text-neutral-900">
                                              氏名（本名）
                                            </label>

                                            <input
                                              value={fullName}
                                              onChange={(event) => setFullName(event.target.value)}
                                              className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600"
                                              placeholder="例）青山 太郎"
                                              autoComplete="name"
                                            />

                                            <p className="text-xs leading-5 text-neutral-500">
                                              Membershipや申込みで相手があなたを確認するために使用します。
                                              これらのサービスを利用する場合は、実際のお名前を登録してください。
                                            </p>
                                          </div>

                                          <div className="space-y-2">
                                            <div className="text-sm font-semibold text-neutral-900">
                                              メールアドレス
                                            </div>

                                            <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
                                              {email || "未取得"}
                                            </div>

                                            <p className="text-xs leading-5 text-neutral-500">
                                              PARARIへのログインに使用しているメールアドレスです。
                                              Membershipや申込みの連絡先にも使用します。
                                            </p>
                                          </div>
                                        </div>
                                      </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div>
                                      <div className="text-sm font-bold text-neutral-900">
                                        PARARIで表示する情報
                                      </div>
                                      <p className="mt-1 text-xs leading-5 text-neutral-500">
                                        作品ページやプロフィールページなどで表示される情報です。
                                      </p>
              </div>

              <div className="mt-5 space-y-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-neutral-900">
                    表示名
                  </label>

                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600"
                    placeholder="例）青山太郎"
                  />

                  <p className="text-xs leading-5 text-neutral-400">
                   PARARIで表示される名前です。ペンネームや活動名でもかまいません。
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-neutral-900">
                    ユーザーネーム
                  </label>

                  <input
                    value={username}
                    onChange={(event) =>
                      setUsername(normalizeUsername(event.target.value))
                    }
                    onBlur={() => setUsernameTouched(true)}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600"
                    placeholder="例）taro-aoyama"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />

                  <p className="text-xs leading-5 text-neutral-400">
                    英小文字・数字・ハイフンのみ。5〜32文字で入力してください。
                  </p>

                  {usernameError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                      {usernameError}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="text-xs font-bold text-neutral-500">
                    公開作品リストURL
                  </div>

                  <div className="mt-2 break-all rounded-xl bg-white px-3 py-2 font-mono text-xs text-neutral-700 ring-1 ring-neutral-200">
                    {publicWorksUrl}
                  </div>

                  <p className="mt-2 text-xs leading-5 text-neutral-400">
                    `/my/works` で「作品リストに掲載」にした公開作品が、このURLに表示されます。
                  </p>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="text-sm font-bold text-neutral-900">
                    ユーザートップページ
                  </div>

                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    <code>/{normalizedUsername || "username"}/</code>
                    にアクセスしたときの表示先を選びます。
                  </p>

                  <div className="mt-4 space-y-3">
                    <label className="flex cursor-pointer gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
                      <input
                        type="radio"
                        name="user-top-mode"
                        value="web"
                        checked={userTopMode === "web"}
                        onChange={() =>
                          setUserTopMode("web")
                        }
                        className="mt-1"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-neutral-900">
                          WEBサイトを表示
                        </div>
                        <div className="mt-1 text-xs leading-5 text-neutral-500">
                          選択したWEBサイトへ転送します。
                        </div>

                        {userTopMode === "web" ? (
                          <select
                            value={homepageBookId}
                            onChange={(event) =>
                              setHomepageBookId(
                                event.target.value,
                              )
                            }
                            className="mt-3 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                          >
                            <option value="">
                              WEBサイトを選択
                            </option>

                            {webWorks.map((work) => {
                              const slug =
                                work.stable_slug ||
                                work.custom_slug ||
                                work.slug ||
                                "";

                              return (
                                <option
                                  key={work.id}
                                  value={work.id}
                                >
                                  {work.title || "無題のWEB"}
                                  {slug
                                    ? `（${slug}）`
                                    : ""}
                                </option>
                              );
                            })}
                          </select>
                        ) : null}

                        {userTopMode === "web" &&
                        webWorks.length === 0 ? (
                          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                            選択できるWEBサイトがありません。
                            先にWEBサイトを作成してください。
                          </div>
                        ) : null}
                      </div>
                    </label>

                    <label className="flex cursor-pointer gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
                      <input
                        type="radio"
                        name="user-top-mode"
                        value="profile"
                        checked={
                          userTopMode === "profile"
                        }
                        onChange={() =>
                          setUserTopMode("profile")
                        }
                        className="mt-1"
                      />

                      <div>
                        <div className="text-sm font-bold text-neutral-900">
                          プロフィールを表示
                        </div>
                        <div className="mt-1 text-xs leading-5 text-neutral-500">
                          <code>
                            /{normalizedUsername || "username"}/profile
                          </code>
                          へ転送します。
                        </div>
                      </div>
                    </label>

                    <label className="flex cursor-pointer gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
                      <input
                        type="radio"
                        name="user-top-mode"
                        value="works"
                        checked={
                          userTopMode === "works"
                        }
                        onChange={() =>
                          setUserTopMode("works")
                        }
                        className="mt-1"
                      />

                      <div>
                        <div className="text-sm font-bold text-neutral-900">
                          作品一覧を表示
                        </div>
                        <div className="mt-1 text-xs leading-5 text-neutral-500">
                          <code>
                            /{normalizedUsername || "username"}/works
                          </code>
                          へ転送します。
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {status.type === "error" ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                    {status.message}
                  </div>
                ) : null}

                {status.type === "success" ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                    {status.message}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isBusy}
                    className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
                  >
                    {status.type === "saving" ? "保存中..." : "保存"}
                  </button>

                  <a
                    href={returnTo}
                    className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50"
                  >
                    作品リストへ戻る
                  </a>
                </div>
              </div>
            </section>
          </div>
        ) : null}
          </div>
        ) : null}

        {activeTab === "plus" ? (
          <PlusSettingsPanel />
        ) : null}

        {activeTab === "host" ? (
          <HostSettingsPanel />
        ) : null}

        {activeTab === "pro" ? (
          <ProSettingsPanel />
        ) : null}
      </div>
    </main>
  );
}


function PlusSettingsPanel() {
  type FormFieldType =
    | "text"
    | "textarea"
    | "select"
    | "checkbox";

  type FormFieldWidth =
    | "full"
    | "half";

  type FormField = {
    id: string;
    type: FormFieldType;
    label: string;
    placeholder: string;
    required: boolean;
    width: FormFieldWidth;
    rows: number;
    options: string[];
  };

  type ManagedForm = {
    id: string;
    name: string;
    description: string | null;
    definition: {
      fields?: FormField[];
    };
    version: number;
    created_at?: string;
    updated_at?: string;
  };

  const [forms, setForms] =
    useState<ManagedForm[]>([]);

  const [
    isLoadingForms,
    setIsLoadingForms,
  ] = useState(true);

  const [
    showFormBuilder,
    setShowFormBuilder,
  ] = useState(false);
    
    const [
      editingFormId,
      setEditingFormId,
    ] = useState<string | null>(null);

  const [formName, setFormName] =
    useState("");

  const [
    formDescription,
    setFormDescription,
  ] = useState("");

  const [
    formFields,
    setFormFields,
  ] = useState<FormField[]>([]);

  const [
    isSavingForm,
    setIsSavingForm,
  ] = useState(false);

  const [
    formStatusMessage,
    setFormStatusMessage,
  ] = useState("");


  function createEmptyField(): FormField {
    return {
      id: crypto.randomUUID(),
      type: "text",
      label: "",
      placeholder: "",
      required: false,
      width: "full",
      rows: 4,
      options: [],
    };
  }


    function startCreateForm() {
      setEditingFormId(null);

      setFormName("");
      setFormDescription("");

      setFormFields([
        createEmptyField(),
      ]);

      setFormStatusMessage("");
      setShowFormBuilder(true);
    }

    function startEditForm(
      form: ManagedForm,
    ) {
      setEditingFormId(
        form.id,
      );

      setFormName(
        form.name,
      );

      setFormDescription(
        form.description ?? "",
      );

      setFormFields(
        (form.definition?.fields ?? []).map(
          (field) => ({
            id:
              field.id ||
              crypto.randomUUID(),

            type:
              field.type || "text",

            label:
              field.label || "",

            placeholder:
              field.placeholder || "",

            required:
              field.required === true,

            width:
              field.width || "full",

            rows:
              field.rows || 4,

            options:
              Array.isArray(
                field.options,
              )
                ? [...field.options]
                : [],
          }),
        ),
      );

      setFormStatusMessage("");
      setShowFormBuilder(true);
    }
    
  function updateField(
    fieldId: string,
    patch: Partial<FormField>,
  ) {
    setFormFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              ...patch,
            }
          : field,
      ),
    );
  }


  function removeField(
    fieldId: string,
  ) {
    setFormFields((current) =>
      current.filter(
        (field) =>
          field.id !== fieldId,
      ),
    );
  }


  useEffect(() => {
    let cancelled = false;

    async function loadForms() {
      if (!sharedSupabase) {
        if (!cancelled) {
          setIsLoadingForms(false);
          setFormStatusMessage(
            "ログイン情報を確認できませんでした。",
          );
        }
        return;
      }

      const {
        data: { session },
      } =
        await sharedSupabase.auth.getSession();

      if (!session?.access_token) {
        if (!cancelled) {
          setIsLoadingForms(false);
          setFormStatusMessage(
            "FORMの利用にはログインが必要です。",
          );
        }
        return;
      }

      try {
        const response = await fetch(
          "/api/form/manage",
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          },
        );

        const result = (await response
          .json()
          .catch(() => null)) as
          | {
              ok?: boolean;
              forms?: ManagedForm[];
              message?: string;
            }
          | null;

        if (cancelled) {
          return;
        }

        if (
          !response.ok ||
          !result?.ok
        ) {
          setFormStatusMessage(
            result?.message ||
              "FORM一覧を取得できませんでした。",
          );
          return;
        }

        setForms(
          result.forms ?? [],
        );
      } catch (error) {
        console.error(
          "form list failed:",
          error,
        );

        if (!cancelled) {
          setFormStatusMessage(
            "FORM一覧を取得できませんでした。",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingForms(false);
        }
      }
    }

    void loadForms();

    return () => {
      cancelled = true;
    };
  }, []);


  async function handleSaveForm() {
    const name =
      formName.trim();

    const description =
      formDescription.trim();

    if (!name) {
      setFormStatusMessage(
        "FORM名を入力してください。",
      );
      return;
    }

    if (formFields.length === 0) {
      setFormStatusMessage(
        "項目を1つ以上作ってください。",
      );
      return;
    }

    const hasBlankLabel =
      formFields.some(
        (field) =>
          !field.label.trim(),
      );

    if (hasBlankLabel) {
      setFormStatusMessage(
        "項目名が空欄のフィールドがあります。",
      );
      return;
    }

    const invalidSelect =
      formFields.some(
        (field) =>
          field.type === "select" &&
          field.options.filter(
            (option) =>
              option.trim(),
          ).length === 0,
      );

    if (invalidSelect) {
      setFormStatusMessage(
        "選択項目には選択肢を1つ以上設定してください。",
      );
      return;
    }

    if (!sharedSupabase) {
      setFormStatusMessage(
        "ログイン情報を確認できませんでした。",
      );
      return;
    }

    setIsSavingForm(true);
    setFormStatusMessage("");

    try {
      const {
        data: { session },
      } =
        await sharedSupabase.auth.getSession();

      if (!session?.access_token) {
        setFormStatusMessage(
          "FORMの保存にはログインが必要です。",
        );
        return;
      }

        const definition = {
          fields: formFields.map(
            (field) => ({
              ...field,

              label:
                field.label.trim(),

              placeholder:
                field.type === "text" ||
                field.type === "textarea"
                  ? field.placeholder.trim()
                  : "",

              options:
                field.type === "select"
                  ? field.options
                      .map(
                        (option) =>
                          option.trim(),
                      )
                      .filter(Boolean)
                  : [],
            }),
          ),
        };

        const response = await fetch(
          "/api/form/manage",
          {
            method:
              editingFormId
                ? "PATCH"
                : "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body: JSON.stringify({
              formId:
                editingFormId ?? undefined,

              name,
              description,
              definition,
            }),
          },
        );

      const result = (await response
        .json()
        .catch(() => null)) as
        | {
            ok?: boolean;
            form?: ManagedForm;
            message?: string;
          }
        | null;

      if (
        !response.ok ||
        !result?.ok ||
        !result.form
      ) {
        setFormStatusMessage(
          result?.message ||
            "FORMを保存できませんでした。",
        );
        return;
      }

        if (editingFormId) {
          setForms((current) =>
            current.map((form) =>
              form.id === editingFormId
                ? result.form!
                : form,
            ),
          );
        } else {
          setForms((current) => [
            result.form!,
            ...current,
          ]);
        }

        const wasEditing =
          editingFormId !== null;

        setShowFormBuilder(false);
        setEditingFormId(null);

        setFormName("");
        setFormDescription("");
        setFormFields([]);

        setFormStatusMessage(
          wasEditing
            ? "FORMを更新しました。"
            : "FORMを保存しました。",
        );
    } catch (error) {
      console.error(
        "form save failed:",
        error,
      );

      setFormStatusMessage(
        "FORMを保存できませんでした。",
      );
    } finally {
      setIsSavingForm(false);
    }
  }


  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
          PLUS
        </div>

        <h2 className="mt-2 text-xl font-bold text-neutral-950">
          読者から情報や意思を受け取る
        </h2>

        <p className="mt-3 text-sm leading-7 text-neutral-600">
          FORMとAPPLICATIONを使って、
          読者とのやり取りを作品の中に組み込みます。
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white">
            FORM
          </span>

          <span className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-500">
            APPLICATION
          </span>
        </div>
      </section>


      <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 px-6 py-5">
          <div>
            <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
              FORM
            </div>

            <div className="mt-1 text-sm font-bold text-neutral-900">
              FORMを作成・管理する
            </div>
          </div>

          {!showFormBuilder ? (
            <button
              type="button"
              onClick={
                startCreateForm
              }
              className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-700"
            >
              ＋ 新しいFORM
            </button>
          ) : null}
        </div>


        {showFormBuilder ? (
          <div className="px-6 py-8 sm:px-10 sm:py-10">
            <div className="mx-auto max-w-2xl">
              <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
                FORM DESIGN
              </div>

                            <h3 className="mt-2 text-2xl font-bold text-neutral-950">
                              {editingFormId
                                ? "FORMを編集する"
                                : "新しいFORMを作る"}
                            </h3>

              <p className="mt-3 text-sm leading-7 text-neutral-500">
                項目を自由に追加して、
                読者から受け取る情報を設計します。
              </p>


              <div className="mt-8 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-neutral-900">
                    FORM名
                  </label>

                  <input
                    type="text"
                    value={formName}
                    onChange={(event) =>
                      setFormName(
                        event.target.value,
                      )
                    }
                    placeholder="例）夜ふかし読書会アンケート"
                    className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600"
                  />
                </div>


                <div>
                  <label className="block text-sm font-bold text-neutral-900">
                    説明
                  </label>

                  <textarea
                    value={
                      formDescription
                    }
                    onChange={(event) =>
                      setFormDescription(
                        event.target.value,
                      )
                    }
                    placeholder="例）本の話から始まって、どこへ着地するかはまだ分かりません。"
                    rows={3}
                    className="mt-2 w-full resize-y rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm leading-7 outline-none transition focus:border-neutral-600"
                  />
                </div>
              </div>


              <div className="mt-10">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-neutral-950">
                      項目
                    </div>

                    <p className="mt-1 text-xs text-neutral-500">
                      {formFields.length}
                      項目
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setFormFields(
                        (current) => [
                          ...current,
                          createEmptyField(),
                        ],
                      )
                    }
                    className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-200"
                  >
                    ＋ 項目を追加
                  </button>
                </div>


                <div className="mt-5 space-y-5">
                  {formFields.map(
                    (
                      field,
                      index,
                    ) => (
                      <div
                        key={field.id}
                        className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-bold text-neutral-950">
                            項目{" "}
                            {index + 1}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeField(
                                field.id,
                              )
                            }
                            className="text-xs font-bold text-neutral-400 transition hover:text-neutral-700"
                          >
                            削除
                          </button>
                        </div>


                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-neutral-600">
                              項目名
                            </label>

                            <input
                              type="text"
                              value={
                                field.label
                              }
                              onChange={(
                                event,
                              ) =>
                                updateField(
                                  field.id,
                                  {
                                    label:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                              placeholder="例）最近読んだ本"
                              className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                            />
                          </div>


                          <div>
                            <label className="block text-xs font-bold text-neutral-600">
                              種類
                            </label>

                            <select
                              value={
                                field.type
                              }
                              onChange={(
                                event,
                              ) =>
                                updateField(
                                  field.id,
                                  {
                                    type:
                                      event
                                        .target
                                        .value as FormFieldType,
                                  },
                                )
                              }
                              className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                            >
                              <option value="text">
                                1行入力
                              </option>

                              <option value="textarea">
                                複数行入力
                              </option>

                              <option value="select">
                                選択肢
                              </option>

                              <option value="checkbox">
                                チェック
                              </option>
                            </select>
                          </div>


                          <div>
                            <label className="block text-xs font-bold text-neutral-600">
                              幅
                            </label>

                            <select
                              value={
                                field.width
                              }
                              onChange={(
                                event,
                              ) =>
                                updateField(
                                  field.id,
                                  {
                                    width:
                                      event
                                        .target
                                        .value as FormFieldWidth,
                                  },
                                )
                              }
                              className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                            >
                              <option value="full">
                                横幅いっぱい
                              </option>

                              <option value="half">
                                半分
                              </option>
                            </select>
                          </div>


                          {field.type ===
                          "textarea" ? (
                            <div>
                              <label className="block text-xs font-bold text-neutral-600">
                                高さ
                              </label>

                              <select
                                value={
                                  field.rows
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateField(
                                    field.id,
                                    {
                                      rows:
                                        Number(
                                          event
                                            .target
                                            .value,
                                        ),
                                    },
                                  )
                                }
                                className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                              >
                                <option value={3}>
                                  3行
                                </option>

                                <option value={5}>
                                  5行
                                </option>

                                <option value={8}>
                                  8行
                                </option>
                              </select>
                            </div>
                          ) : null}


                          {field.type !== "checkbox" &&
                          field.type !== "select" ? (
                            <div
                              className={
                                field.type ===
                                "textarea"
                                  ? ""
                                  : "sm:col-span-2"
                              }
                            >
                              <label className="block text-xs font-bold text-neutral-600">
                                プレースホルダー
                              </label>

                              <input
                                type="text"
                                value={
                                  field.placeholder
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateField(
                                    field.id,
                                    {
                                      placeholder:
                                        event
                                          .target
                                          .value,
                                    },
                                  )
                                }
                                placeholder="例）途中まででも立派な読書です"
                                className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                              />
                            </div>
                          ) : null}


                          {field.type ===
                          "select" ? (
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-bold text-neutral-600">
                                選択肢
                              </label>

                              <textarea
                                value={field.options.join(
                                  "\n",
                                )}
                                onChange={(
                                  event,
                                ) =>
                                  updateField(
                                    field.id,
                                    {
                                      options:
                                        event
                                          .target
                                          .value
                                          .split(
                                            "\n",
                                          ),
                                    },
                                  )
                                }
                                rows={4}
                                placeholder={
                                  "1行に1つずつ入力\n小説\nエッセイ\n積読専門"
                                }
                                className="mt-2 w-full resize-y rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm leading-7 outline-none focus:border-neutral-600"
                              />
                            </div>
                          ) : null}
                        </div>


                        <label className="mt-5 flex items-center gap-2 text-sm text-neutral-700">
                          <input
                            type="checkbox"
                            checked={
                              field.required
                            }
                            onChange={(
                              event,
                            ) =>
                              updateField(
                                field.id,
                                {
                                  required:
                                    event
                                      .target
                                      .checked,
                                },
                              )
                            }
                          />

                          必須項目にする
                        </label>
                      </div>
                    ),
                  )}
                </div>
              </div>


              {formStatusMessage ? (
                <p className="mt-5 text-sm leading-7 text-neutral-600">
                  {formStatusMessage}
                </p>
              ) : null}


              <div className="mt-8 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveForm();
                  }}
                  disabled={
                    isSavingForm
                  }
                  className="rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
                >
                            {isSavingForm
                              ? "保存しています..."
                              : editingFormId
                                ? "変更を保存"
                                : "FORMを保存"}
                </button>

                <button
                  type="button"
                            onClick={() => {
                              setShowFormBuilder(false);
                              setEditingFormId(null);
                              setFormStatusMessage("");
                            }}
                  disabled={
                    isSavingForm
                  }
                  className="rounded-full bg-neutral-100 px-6 py-3 text-sm font-bold text-neutral-600 transition hover:bg-neutral-200"
                >
                  戻る
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-8 sm:px-10 sm:py-10">
            <div className="mx-auto max-w-2xl">
              {isLoadingForms ? (
                <p className="text-sm text-neutral-500">
                  FORMを読み込んでいます...
                </p>
              ) : forms.length ===
                0 ? (
                <div className="py-8 text-center">
                  <div className="text-xl font-bold text-neutral-950">
                    まだFORMがありません
                  </div>

                  <p className="mt-3 text-sm leading-7 text-neutral-500">
                    最初のFORMを作ってみましょう。
                  </p>

                  <button
                    type="button"
                    onClick={
                      startCreateForm
                    }
                    className="mt-6 rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-neutral-700"
                  >
                    ＋ 新しいFORMを作る
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {forms.map(
                    (form) => (
                      <div
                        key={form.id}
                        className="rounded-2xl border border-neutral-200 p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-lg font-bold text-neutral-950">
                              {form.name}
                            </div>

                            {form.description ? (
                              <p className="mt-2 text-sm leading-7 text-neutral-600">
                                {
                                  form.description
                                }
                              </p>
                            ) : null}
                          </div>

                          <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-500">
                            {
                              form.definition
                                ?.fields
                                ?.length ??
                                0
                            }
                            項目
                          </div>
                        </div>

                               <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                 <div className="text-xs text-neutral-400">
                                   version{" "}
                                   {form.version}
                                 </div>

                                 <button
                                   type="button"
                                   onClick={() =>
                                     startEditForm(form)
                                   }
                                   className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-200"
                                 >
                                   編集する
                                 </button>
                               </div>
                      </div>
                    ),
                  )}
                </div>
              )}

              {formStatusMessage ? (
                <p className="mt-5 text-sm leading-7 text-neutral-600">
                  {formStatusMessage}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </section>
          
      <ApplicationManager />
          
    </div>
  );
}

function HostSettingsPanel() {
  const [isMonitor, setIsMonitor] =
    useState<boolean | null>(null);

    const [showCreateForm, setShowCreateForm] =
      useState(false);

    const [membershipName, setMembershipName] =
      useState("");

    const [
      membershipDescription,
      setMembershipDescription,
    ] = useState("");
    
    const [
      memberships,
      setMemberships,
    ] = useState<
      Array<{
        id: string;
        name: string;
        description: string | null;
        created_at?: string;
      }>
    >([]);

    const [
      isCreatingMembership,
      setIsCreatingMembership,
    ] = useState(false);

    const [
      membershipStatusMessage,
      setMembershipStatusMessage,
    ] = useState("");
    
    const [
      selectedMembershipForWorks,
      setSelectedMembershipForWorks,
    ] = useState<{
      id: string;
      name: string;
    } | null>(null);

    const [
      membershipBooks,
      setMembershipBooks,
    ] = useState<
      Array<{
        id: string;
        title: string | null;
        visibility: string | null;
        updated_at?: string;
        in_membership: boolean;
      }>
    >([]);

    const [
      isLoadingMembershipBooks,
      setIsLoadingMembershipBooks,
    ] = useState(false);

    const [
      updatingMembershipBookId,
      setUpdatingMembershipBookId,
    ] = useState<string | null>(null);
    
    const [
      previewMembership,
      setPreviewMembership,
    ] = useState<{
      id: string;
      name: string;
    } | null>(null);
    
  const [monitorStatusMessage, setMonitorStatusMessage] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMonitorStatus() {
      if (!sharedSupabase) {
        if (!cancelled) {
          setIsMonitor(false);
          setMonitorStatusMessage(
            "ログイン情報を確認できませんでした。",
          );
        }
        return;
      }

      const {
        data: { session },
      } = await sharedSupabase.auth.getSession();

      if (!session?.access_token) {
        if (!cancelled) {
          setIsMonitor(false);
          setMonitorStatusMessage(
            "Membershipの利用にはログインが必要です。",
          );
        }
        return;
      }

      const response = await fetch(
        "/api/membership/manage",
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        },
      );

        const result = (await response
          .json()
          .catch(() => null)) as
          | {
              ok?: boolean;
              isMonitor?: boolean;
              memberships?: Array<{
                id: string;
                name: string;
                description: string | null;
                created_at?: string;
              }>;
              message?: string;
            }
          | null;

      if (cancelled) {
        return;
      }

      if (!response.ok || !result?.ok) {
        setIsMonitor(false);
        setMonitorStatusMessage(
          result?.message ||
            "モニター情報を確認できませんでした。",
        );
        return;
      }

        setIsMonitor(
          result.isMonitor === true,
        );

        setMemberships(
          result.memberships ?? [],
        );

        setMonitorStatusMessage("");
    }

    void loadMonitorStatus();

    return () => {
      cancelled = true;
    };
  }, []);

    async function handleCreateMembership() {
      if (isMonitor !== true) {
        return;
      }

      const name = membershipName.trim();
      const description =
        membershipDescription.trim();

      if (!name) {
        setMembershipStatusMessage(
          "Membership名を入力してください。",
        );
        return;
      }

      if (!sharedSupabase) {
        setMembershipStatusMessage(
          "ログイン情報を確認できませんでした。",
        );
        return;
      }

      setIsCreatingMembership(true);
      setMembershipStatusMessage("");

      try {
        const {
          data: { session },
        } = await sharedSupabase.auth.getSession();

        if (!session?.access_token) {
          setMembershipStatusMessage(
            "Membershipの開設にはログインが必要です。",
          );
          return;
        }

        const response = await fetch(
          "/api/membership/manage",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              name,
              description,
            }),
          },
        );

        const result = (await response
          .json()
          .catch(() => null)) as
          | {
              ok?: boolean;
              membership?: {
                id: string;
                name: string;
                description: string | null;
              };
              message?: string;
            }
          | null;

        if (
          !response.ok ||
          !result?.ok ||
          !result.membership
        ) {
          setMembershipStatusMessage(
            result?.message ||
              "Membershipを開設できませんでした。",
          );
          return;
        }

          setMemberships((current) => [
            result.membership!,
            ...current,
          ]);

        setShowCreateForm(false);
        setMembershipName("");
        setMembershipDescription("");

        setMembershipStatusMessage(
          "Membershipを開設しました。",
        );
      } catch (error) {
        console.error(
          "create membership failed:",
          error,
        );

        setMembershipStatusMessage(
          "Membershipを開設できませんでした。",
        );
      } finally {
        setIsCreatingMembership(false);
      }
    }
    
    async function loadMembershipBooks(
      membership: {
        id: string;
        name: string;
      },
    ) {
      if (!sharedSupabase) {
        return;
      }

      setSelectedMembershipForWorks(membership);
      setIsLoadingMembershipBooks(true);
      setMembershipStatusMessage("");

      try {
        const {
          data: { session },
        } =
          await sharedSupabase.auth.getSession();

        if (!session?.access_token) {
          setMembershipStatusMessage(
            "ログイン情報を確認できませんでした。",
          );
          return;
        }

        const response = await fetch(
          `/api/membership/works?membership_id=${encodeURIComponent(
            membership.id,
          )}`,
          {
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          },
        );

        const result = await response
          .json()
          .catch(() => null);

        if (
          !response.ok ||
          !result?.ok
        ) {
          setMembershipStatusMessage(
            result?.message ||
              "作品一覧を取得できませんでした。",
          );
          return;
        }

        setMembershipBooks(
          result.books ?? [],
        );
      } catch (error) {
        console.error(
          "load membership books failed:",
          error,
        );

        setMembershipStatusMessage(
          "作品一覧を取得できませんでした。",
        );
      } finally {
        setIsLoadingMembershipBooks(false);
      }
    }
    
    async function handleToggleMembershipWork(
      book: {
        id: string;
        in_membership: boolean;
      },
    ) {
      if (
        !sharedSupabase ||
        !selectedMembershipForWorks
      ) {
        return;
      }

      setUpdatingMembershipBookId(book.id);
      setMembershipStatusMessage("");

      try {
        const functionName =
          book.in_membership
            ? "remove_work_from_membership"
            : "add_work_to_membership";

        const parameters =
          book.in_membership
            ? {
                p_membership_id:
                  selectedMembershipForWorks.id,
                p_book_id: book.id,
              }
            : {
                p_membership_id:
                  selectedMembershipForWorks.id,
                p_book_id: book.id,
                p_organization_id: null,
              };

        const { error } =
          await sharedSupabase.rpc(
            functionName,
            parameters,
          );

        if (error) {
          console.error(
            "toggle membership work failed:",
            error,
          );

          setMembershipStatusMessage(
            "Membership作品を変更できませんでした。",
          );
          return;
        }

        // DBを再取得して正しいvisibilityも反映
        await loadMembershipBooks(
          selectedMembershipForWorks,
        );

        setMembershipStatusMessage(
          book.in_membership
            ? "Membershipから作品を外しました。作品は必要に応じてprivateになります。"
            : "Membership限定作品に登録しました。",
        );
      } finally {
        setUpdatingMembershipBookId(null);
      }
    }
    
  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
          HOST
        </div>

        <h2 className="mt-2 text-xl font-bold text-neutral-950">
          人を迎え、関係を持ち、届ける
        </h2>

        <p className="mt-3 text-sm leading-7 text-neutral-600">
          MembershipとGatewayを使って、
          PARARI上に継続的な関係を持つ場所を作ります。
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white">
            MEMBERSHIP
          </span>

          <span className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-500">
            GATEWAY
          </span>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-6 py-5">
          <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
            MEMBERSHIP
          </div>
        </div>

          {memberships.length > 0 && !showCreateForm ? (
            <div className="px-6 py-8 sm:px-10 sm:py-10">
              <div className="mx-auto max-w-xl">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
                      YOUR MEMBERSHIPS
                    </div>

                    <h3 className="mt-2 text-2xl font-bold text-neutral-950">
                      あなたのMembership
                    </h3>
                  </div>

                  {isMonitor === true ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMembershipStatusMessage("");
                        setShowCreateForm(true);
                      }}
                      className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-700"
                    >
                      ＋ 新しいMembership
                    </button>
                  ) : null}
                </div>

                <div className="mt-7 space-y-3">
                  {memberships.map((membership) => (
                    <div
                      key={membership.id}
                      className="rounded-2xl border border-neutral-200 p-5"
                    >
                      <div className="text-lg font-bold text-neutral-950">
                        {membership.name}
                      </div>

                      {membership.description ? (
                        <p className="mt-2 text-sm leading-7 text-neutral-600">
                          {membership.description}
                        </p>
                      ) : null}
                                                    
                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        void loadMembershipBooks({
                                                          id: membership.id,
                                                          name: membership.name,
                                                        });
                                                      }}
                                                      className="mt-4 rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50"
                                                    >
                                                      メンバー限定作品を設定
                                                    </button>
                                                    
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setPreviewMembership({
                                                          id: membership.id,
                                                          name: membership.name,
                                                        });
                                                      }}
                                                      className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50"
                                                    >
                                                      会員から見える棚を確認
                                                    </button>
                                                    </div>
                                                    
                    </div>
                  ))}
                                                        
                                                        {selectedMembershipForWorks ? (
                                                          <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                                                            <div className="flex items-center justify-between gap-4">
                                                              <div>
                                                                <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
                                                                  MEMBERSHIP WORKS
                                                                </div>

                                                                <h4 className="mt-2 text-lg font-bold text-neutral-950">
                                                                  {selectedMembershipForWorks.name}
                                                                </h4>
                                                              </div>

                                                              <button
                                                                type="button"
                                                                onClick={() => {
                                                                  setSelectedMembershipForWorks(
                                                                    null,
                                                                  );
                                                                  setMembershipBooks([]);
                                                                }}
                                                                className="text-xs font-bold text-neutral-500"
                                                              >
                                                                閉じる
                                                              </button>
                                                            </div>

                                                            <p className="mt-3 text-xs leading-6 text-neutral-500">
                                                              登録すると、この作品はMembership限定作品になります。
                                                              Membershipから最後に外した場合はprivateになります。
                                                            </p>

                                                            {isLoadingMembershipBooks ? (
                                                              <div className="py-8 text-center text-sm text-neutral-400">
                                                                読み込み中...
                                                              </div>
                                                            ) : (
                                                              <div className="mt-5 space-y-2">
                                                                {membershipBooks.map((book) => (
                                                                  <div
                                                                    key={book.id}
                                                                    className="flex items-center justify-between gap-4 rounded-xl bg-white px-4 py-3"
                                                                  >
                                                                    <div className="min-w-0">
                                                                      <div className="truncate text-sm font-bold text-neutral-900">
                                                                        {book.title ||
                                                                          "無題の作品"}
                                                                      </div>

                                                                      <div className="mt-1 text-xs text-neutral-400">
                                                                        {book.in_membership
                                                                          ? "Membership限定"
                                                                          : book.visibility ||
                                                                            "private"}
                                                                      </div>
                                                                    </div>

                                                                    <button
                                                                      type="button"
                                                                      disabled={
                                                                        updatingMembershipBookId ===
                                                                        book.id
                                                                      }
                                                                      onClick={() => {
                                                                        void handleToggleMembershipWork(
                                                                          book,
                                                                        );
                                                                      }}
                                                                      className={[
                                                                        "shrink-0 rounded-full px-4 py-2 text-xs font-bold transition",
                                                                        book.in_membership
                                                                          ? "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                                                                          : "bg-neutral-950 text-white hover:bg-neutral-700",
                                                                      ].join(" ")}
                                                                    >
                                                                      {updatingMembershipBookId ===
                                                                      book.id
                                                                        ? "変更中..."
                                                                        : book.in_membership
                                                                          ? "解除"
                                                                          : "登録"}
                                                                    </button>
                                                                  </div>
                                                                ))}

                                                                {membershipBooks.length === 0 ? (
                                                                  <div className="py-8 text-center text-sm text-neutral-400">
                                                                    登録できる作品がありません。
                                                                  </div>
                                                                ) : null}
                                                              </div>
                                                            )}
                                                          </div>
                                                        ) : null}
                                                        
                </div>

                                                        {previewMembership ? (
                                                          <div className="mt-8 border-t border-neutral-200 pt-8">
                                                            <div className="mb-5 flex items-center justify-between gap-4">
                                                              <div>
                                                                <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
                                                                  MEMBER VIEW
                                                                </div>

                                                                <h4 className="mt-1 text-lg font-bold text-neutral-950">
                                                                  会員から見える棚
                                                                </h4>

                                                                <p className="mt-1 text-xs text-neutral-500">
                                                                  {previewMembership.name}
                                                                </p>
                                                              </div>

                                                              <button
                                                                type="button"
                                                                onClick={() =>
                                                                  setPreviewMembership(null)
                                                                }
                                                                className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-600 transition hover:bg-neutral-200"
                                                              >
                                                                閉じる
                                                              </button>
                                                            </div>

                                                            <MembershipShelfPanel
                                                              previewMembershipId={
                                                                previewMembership.id
                                                              }
                                                            />
                                                          </div>
                                                        ) : null}
                                                        
                {membershipStatusMessage ? (
                  <p className="mt-4 text-xs leading-6 text-emerald-700">
                    {membershipStatusMessage}
                  </p>
                ) : null}
              </div>
            </div>
          ) : !showCreateForm ? (
            <div className="px-6 py-10 text-center sm:px-10 sm:py-14">
              <div className="mx-auto max-w-xl">
                <div className="text-3xl font-bold tracking-tight text-neutral-950">
                  あなたのMembershipを開設します
                </div>

                <p className="mt-5 text-sm leading-8 text-neutral-600">
                  教室、スクール、サークル、研究会、顧客コミュニティなど、
                  継続して人と関係を持つためのMembershipを
                  PARARI上に開設できます。
                </p>

                <p className="mt-4 text-sm leading-8 text-neutral-600">
                  開設したMembershipには会員を迎え、
                  会員向けの作品を届けることができます。
                </p>

                <div className="mt-8">
                  <button
                    type="button"
                    disabled={isMonitor !== true}
                    onClick={() => {
                      if (isMonitor === true) {
                        setShowCreateForm(true);
                      }
                    }}
                    className={[
                      "rounded-full px-7 py-3 text-sm font-bold shadow-sm transition",
                      isMonitor === true
                        ? "bg-neutral-950 text-white hover:bg-neutral-700"
                        : "cursor-not-allowed bg-neutral-200 text-neutral-400",
                    ].join(" ")}
                  >
                    {isMonitor === null
                      ? "確認中..."
                      : isMonitor
                        ? "Membershipを開設する"
                        : "モニター限定"}
                  </button>
                </div>

                {isMonitor === false ? (
                  <p className="mt-4 text-xs leading-6 text-neutral-500">
                    {monitorStatusMessage ||
                      "Membershipは現在、PARARIモニター向けに試験提供しています。"}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="px-6 py-8 sm:px-10 sm:py-10">
              <div className="mx-auto max-w-xl">
                <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
                  OPEN MEMBERSHIP
                </div>

                <h3 className="mt-2 text-2xl font-bold text-neutral-950">
                  Membershipを開設する
                </h3>

                <p className="mt-3 text-sm leading-7 text-neutral-500">
                  あなたがこれから会員を迎える場所の名前と説明を登録します。
                </p>

                <div className="mt-7 space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-neutral-900">
                      Membership名
                    </label>

                    <input
                      type="text"
                      value={membershipName}
                      onChange={(event) =>
                        setMembershipName(event.target.value)
                      }
                      placeholder="例）夜ふかし読書会"
                      className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-neutral-900">
                      説明
                    </label>

                    <textarea
                      value={membershipDescription}
                      onChange={(event) =>
                        setMembershipDescription(
                          event.target.value,
                        )
                      }
                      placeholder="例）本を読んだり、話したり、たまに脱線したりする会です。（どのようなMembershipなのかを簡単に説明してください。）"
                      rows={5}
                      className="mt-2 w-full resize-y rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm leading-7 outline-none transition focus:border-neutral-600"
                    />
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap gap-2">
               <button
                 type="button"
                 onClick={() => {
                   void handleCreateMembership();
                 }}
                 disabled={
                   isCreatingMembership ||
                   !membershipName.trim()
                 }
                 className="rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
               >
                 {isCreatingMembership
                   ? "開設しています..."
                   : "開設する"}
               </button>

                  <button
                    type="button"
                    onClick={() =>
                      setShowCreateForm(false)
                    }
                    className="rounded-full bg-neutral-100 px-6 py-3 text-sm font-bold text-neutral-600 transition hover:bg-neutral-200"
                  >
                    戻る
                  </button>
               
               {membershipStatusMessage ? (
                 <p className="mt-4 text-xs leading-6 text-rose-600">
                   {membershipStatusMessage}
                 </p>
               ) : null}
               
                </div>
              </div>
            </div>
          )}
      </section>
    </div>
  );
}

function ProSettingsPanel() {
  return (
    <div className="mt-5">
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
          PRO
        </div>

        <h2 className="mt-2 text-xl font-bold text-neutral-950">
          AIによる制作・商品開発・発信支援
        </h2>

        <p className="mt-3 text-sm leading-7 text-neutral-600">
          PRO機能はここから設定・管理できるようにします。
          現在は準備中です。
        </p>
      </section>
    </div>
  );
}

function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

function getUsernameError(username: string): string {
  if (!username) {
    return "ユーザーネームを入力してください。";
  }

  if (RESERVED_USERNAMES.has(username)) {
    return "このユーザーネームは予約語のため使えません。";
  }

  if (!USERNAME_RE.test(username)) {
    return "英小文字・数字・ハイフンのみ、5〜32文字で入力してください。";
  }

  return "";
}

function normalizeSupabaseSaveError(message: string): string {
  const lower = String(message || "").toLowerCase();

  if (lower.includes("duplicate")) {
    return "このユーザーネームはすでに使われています。";
  }

  return `保存に失敗しました: ${message}`;
}

function buildFullUrl(origin: string, path: string): string {
  if (!origin) {
    return path;
  }

  return `${origin}${path}`;
}

function StatusBadge({ status }: { status: LoadStatus }) {
  const className =
    status.type === "error"
      ? "bg-rose-50 text-rose-700 ring-rose-100"
      : status.type === "saving"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : status.type === "success"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : status.type === "loading"
            ? "bg-amber-50 text-amber-700 ring-amber-100"
            : "bg-neutral-100 text-neutral-600 ring-neutral-200";

  return (
    <span
      className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${className}`}
    >
      {status.message}
    </span>
  );
}
