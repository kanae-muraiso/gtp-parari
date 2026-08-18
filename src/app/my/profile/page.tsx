// src/app/my/profile/page.tsx
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
import SettingsTabs from "@/components/parari/settings/SettingsTabs";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import ManagementTabs from "@/components/parari/navigation/ManagementTabs";
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
  const activeTab = "basic" as const;

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
      <main className="min-h-screen bg-neutral-50">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          {/* HEADER */}
          <MyAreaHeader
            title="設定"
            showManagementLinks={false}
          />

          {/* MANAGEMENT MAIN MENU */}
          <div className="mt-6">
            <ManagementTabs active="settings" />
          </div>

          {/* SETTINGS */}
          <div className="mx-auto mt-4 max-w-3xl">
            <SettingsTabs active={activeTab} />

            {activeTab === "basic" ? (
              <div className="mt-3 flex justify-end">
                <StatusBadge status={status} />
              </div>
            ) : null}

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

            </div>
          </div>
        </main>
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
