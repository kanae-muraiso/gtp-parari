// apps/tools/parari/src/app/my/profile/page.tsx
// apps/tools/parari/src/app/my/profile/page.tsx
// 2026-05-05 JST

"use client";

/**
 * PART: Profile Settings Page v6
 * コメント:
 * - 黒帯 ControlBar を表示
 * - returnTo があれば保存後に元ページへ戻る
 * - useSearchParams は使わず、window.location.search から読む
 * - username / display_name / bio を保存
 * - リンク入力UIを追加
 * - 候補ボタンから label / icon をすぐ入れられる
 * - 最大10リンクまで
 */

import React, { useEffect, useState } from "react";
import {
    useRouter
} from "next/navigation";
import {
    supabase
} from "../../../lib/supabaseClient";
import EditorControlBar from "../../../components/parari/EditorControlBar";

const USERNAME_RE = /^(?=.{5,32}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

type ProfileLinkRow = {
    id: string;
    user_id: string;
    label: string;
    url: string;
    icon: string | null;
    sort_order: number | null;
    is_enabled: boolean | null;
};

/**
 * PART: Username Owner Row
 * コメント:
 * - username がどの user_id に属しているか確認するための型
 */
type UsernameOwnerRow = {
  user_id: string;
  username: string | null;
};

type HomepageMode = "profile" | "book" | "tag";
type HomepageTagKey = "profile" | "links" | "works";
type HomepageLayout = "cards" | "linktree";

/**
 * PART: homepage page type
 * コメント:
 * - 通常ホームページの各メニューに割り当てるページ形式
 * - layout ではなく「何を表示するか」を表す
 */
type HomepagePageType = "profile" | "works" | "links";

/**
 * PART: homepage header settings types
 * コメント:
 * - 通常ホームページのヘッダーとメニュー数設定
 */
type HomepageMenuCount = 1 | 2 | 3;
type HomepageLogoAlign = "left" | "center" | "right";

type HomepageProfileImageStyle = "circle" | "logo" | "none";
type HomepageProfileAlign = "left" | "center" | "right";

type ProfileBookOption = {
    id: string;
    title: string | null;
    created_at: string | null;
};

const LINK_PRESETS = [
    {
        label: "ホームページ", icon: "🌐"
    },
    {
        label: "Instagram", icon: "📷"
    },
    {
        label: "Threads", icon: "🧵"
    },
    {
        label: "X", icon: "𝕏"
    },
    {
        label: "YouTube", icon: "▶️"
    },
    {
        label: "TikTok", icon: "🎵"
    },
    {
        label: "Facebook", icon: "📘"
    },
    {
        label: "LinkedIn", icon: "💼"
    },
    {
        label: "LINE公式", icon: "💬"
    },
    {
        label: "note", icon: "📝"
    },
];

function normalizeUsername(input: string) {
    return input.trim().toLowerCase();
}

function getUsernameError(username: string) {
    if (!username) return "ユーザーネームを入力してください";
    if (!USERNAME_RE.test(username)) {
        return "英小文字・数字・ハイフンのみ、5〜32文字で入力してください";
    }
    return "";
}

/**
 * PART: parseParariBookUrl
 * コメント:
 * - BOOK型ホームページで使うPARARI作品URLを検証する
 * - まずは安全に /p/{bookId} 形式だけ受け付ける
 * - parari.app / www.parari.app 以外は受け付けない
 */
function parseParariBookUrl(input: string): string | null {
    const raw = String(input ?? "").trim();
    
    if (!raw) return null;
    
    try {
        const url = new URL(raw);
        
        const isParariHost =
        url.hostname === "parari.app" || url.hostname === "www.parari.app";
        
        if (!isParariHost) return null;
        
        const parts = url.pathname.split("/").filter(Boolean);
        
        if (parts[0] !== "p") return null;
        if (!parts[1]) return null;
        
        return parts[1];
    } catch {
        return null;
    }
}

/**
 * PART: buildParariBookUrl
 * コメント:
 * - 保存済み homepage_book_id から表示用URLを作る
 */
function buildParariBookUrl(bookId: string) {
    const safeBookId = String(bookId ?? "").trim();
    return safeBookId ? `https://parari.app/p/${safeBookId}` : "";
}

/**
 * PART: HomepageAccordionSection
 * コメント:
 * - ホームページ作成画面用の簡易アコーディオン
 * - 通常ホームページ設定を「順番に開く」UIにする
 * - ロジック変更なし。見た目の整理だけを担当する
 */
function HomepageAccordionSection({
  number,
  title,
  description,
  defaultOpen = true,
  children,
}: {
  number: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="flex gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
            {number}
          </div>

          <div>
            <div className="text-sm font-semibold text-neutral-900">
              {title}
            </div>

            {description ? (
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="pt-1 text-xs text-neutral-400">
          {open ? "閉じる" : "開く"}
        </div>
      </button>

          {open ? (
            <div className="space-y-5 border-t border-neutral-100 px-5 py-5">
              {children}
            </div>
          ) : null}
    </section>
  );
}

export default function ProfilePage() {
    
    async function uploadProfileImage(
                                      file: File,
                                      type: "avatar" | "cover" | "logo",
                                      userId: string
                                      ) {
        const ext = file.name.split(".").pop();
        const fileName = `${type}-${Date.now()}.${ext}`;
        const path = `${userId}/${fileName}`;
        
        const {
            error
        } = await supabase.storage
        .from("parari-images")
        .upload(path, file, {
            upsert: true
        });
        
        if (error) {
            alert("アップロード失敗: " + error.message);
            return null;
        }
        
        const {
            data
        } = supabase.storage
        .from("parari-images")
        .getPublicUrl(path);
        
        return data.publicUrl;
    }
    
    const router = useRouter();
    
    const [returnTo, setReturnTo] = useState("/mypage");
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [linkSaving, setLinkSaving] = useState(false);
    
    const [userId, setUserId] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    
    /**
     * PART: Account Integrity State
     * コメント:
     * - Current UID / Profile UID / Username Owner UID のズレを確認する
     * - 通常はすべて同じになるべき
     */
    const [profileUserId, setProfileUserId] = useState<string | null>(null);
    const [usernameOwnerUserId, setUsernameOwnerUserId] = useState<string | null>(null);
    const [accountIntegrityMessage, setAccountIntegrityMessage] = useState("");
    
    const [displayName, setDisplayName] = useState("");
    const [username, setUsername] = useState("");
    const [bio, setBio] = useState("");
    
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
    
    const [ctaEnabled, setCtaEnabled] = useState(false);
    const [ctaLabel, setCtaLabel] = useState("");
    const [ctaHref, setCtaHref] = useState("");
    
    const [tabLabelProfile, setTabLabelProfile] = useState("");
    const [tabLabelLinks, setTabLabelLinks] = useState("");
    const [tabLabelWorks, setTabLabelWorks] = useState("");
    
    const [homepageMode, setHomepageMode] = useState<HomepageMode>("profile");
    const [homepageBookId, setHomepageBookId] = useState("");
    
    /**
     * PART: homepage book url state
     * コメント:
     * - BOOK型ホームページで入力されたPARARI作品URLを保持する
     * - 保存時に /p/{bookId} 形式から bookId を取り出して homepage_book_id に保存する
     */
    const [homepageBookUrl, setHomepageBookUrl] = useState("");
    const [homepageBookUrlError, setHomepageBookUrlError] = useState("");
    
    const [homepageTagKey, setHomepageTagKey] = useState<HomepageTagKey>("works");
    const [firstlookTagKey, setFirstlookTagKey] = useState<HomepageTagKey>("works");
    const [firstlookLayout, setFirstlookLayout] = useState<HomepageLayout>("cards");
    
    const [homepageTab1Layout, setHomepageTab1Layout] =
      useState<HomepageLayout>("cards");

    const [homepageTab2Layout, setHomepageTab2Layout] =
      useState<HomepageLayout>("linktree");

    const [homepageTab3Layout, setHomepageTab3Layout] =
      useState<HomepageLayout>("cards");
    
    const [homepageTab1Type, setHomepageTab1Type] =
      useState<HomepagePageType>("profile");

    const [homepageTab2Type, setHomepageTab2Type] =
      useState<HomepagePageType>("links");

    const [homepageTab3Type, setHomepageTab3Type] =
      useState<HomepagePageType>("works");
    
    const [bookOptions, setBookOptions] = useState<ProfileBookOption[]>([]);
    
    /**
     * PART: homepage layout/header state
     * コメント:
     * - 通常ホームページ用の表示内容数・ロゴ・ユーザー名表示
     */
    const [homepageMenuCount, setHomepageMenuCount] =
    useState<HomepageMenuCount>(3);
    
    const [homepageHeaderLogoUrl, setHomepageHeaderLogoUrl] =
    useState<string | null>(null);
    
    const [homepageHeaderLogoAlign, setHomepageHeaderLogoAlign] =
    useState<HomepageLogoAlign>("center");
    
    const [homepageShowUsername, setHomepageShowUsername] = useState(true);
    
    const [homepageProfileImageStyle, setHomepageProfileImageStyle] =
    useState<HomepageProfileImageStyle>("circle");
    
    const [homepageProfileAlign, setHomepageProfileAlign] =
    useState<HomepageProfileAlign>("left");
    
    const [usernameTouched, setUsernameTouched] = useState(false);
    const [message, setMessage] = useState("");
    const [homepageSetupStarted, setHomepageSetupStarted] = useState(false);
    
    const CTA_EDITABLE_USER_ID = "2c8cfafa-da1c-42bb-8092-94ff922a60b4"; // ← あなたの user_id に置き換え
    const canEditCTA = userId === CTA_EDITABLE_USER_ID;
    
    /**
     * PART: links state
     * コメント:
     * - 既存リンク一覧
     * - 新規追加フォーム
     */
    const [links, setLinks] = useState<ProfileLinkRow[]>([]);
    const [newLabel, setNewLabel] = useState("");
    const [newUrl, setNewUrl] = useState("");
    const [newIcon, setNewIcon] = useState("");
    
    /**
     * PART: read returnTo from URL
     * コメント:
     * - useSearchParams を避ける
     * - クライアント側で query string を読む
     */
    useEffect(() => {
        if (typeof window === "undefined") return;
        
        const params = new URLSearchParams(window.location.search);
        const nextReturnTo = params.get("returnTo");
        
        if (nextReturnTo && nextReturnTo.startsWith("/")) {
            setReturnTo(nextReturnTo);
        }
    }, []);
    
    /**
     * PART: initial load
     * コメント:
     * - profile 本体
     * - links 一覧
     */
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setMessage("");
            
            const {
                data: {
                    user
                },
                error: userError,
            } = await supabase.auth.getUser();
            
            if (userError) {
                setMessage("ユーザー取得失敗: " + userError.message);
                setLoading(false);
                return;
            }
            
            if (!user) {
                setMessage("ログイン状態を確認できませんでした");
                setLoading(false);
                return;
            }
            
            setUserId(user.id);
            setEmail(user.email ?? "");
            
            const {
                data, error
            } = await supabase
            .from("profiles")
            .select(
                    "user_id, username, display_name, bio, tab_label_profile, tab_label_links, tab_label_works, avatar_url, cover_image_url, cta_enabled, cta_label, cta_href, homepage_mode, homepage_book_id, homepage_tag_key, firstlook_tag_key, firstlook_layout, homepage_menu_count, homepage_header_logo_url, homepage_header_logo_align, homepage_show_username, homepage_profile_image_style, homepage_profile_align, homepage_tab1_layout, homepage_tab2_layout, homepage_tab3_layout, homepage_tab1_type, homepage_tab2_type, homepage_tab3_type"
                    )
            .eq("user_id", user.id)
            .maybeSingle();
            
            if (error) {
                setMessage("プロフィール読込失敗: " + error.message);
                setLoading(false);
                return;
            }
            
            if (data) {
                setProfileUserId(data.user_id ?? null);

                setDisplayName(data.display_name ?? "");
                setUsername(data.username ?? "");
                setBio(data.bio ?? "");
                
                setTabLabelProfile(data.tab_label_profile ?? "");
                setTabLabelLinks(data.tab_label_links ?? "");
                setTabLabelWorks(data.tab_label_works ?? "");
                
                setAvatarUrl(data.avatar_url ?? null);
                setCoverImageUrl(data.cover_image_url ?? null);
                
                setCtaEnabled(Boolean(data.cta_enabled));
                setCtaLabel(data.cta_label ?? "");
                setCtaHref(data.cta_href ?? "");
                
                setHomepageMode((data.homepage_mode ?? "profile") as HomepageMode);
                setHomepageBookId(data.homepage_book_id ?? "");
                
                
                /**
                 * PART: apply homepage book url
                 * コメント:
                 * - 既にBOOK型ホームページが設定されている場合、URL欄にも表示する
                 */
                setHomepageBookUrl(buildParariBookUrl(data.homepage_book_id ?? ""));
                setHomepageBookUrlError("");
                
                setHomepageTagKey((data.homepage_tag_key ?? "works") as HomepageTagKey);
                setFirstlookTagKey((data.firstlook_tag_key ?? "works") as HomepageTagKey);
                setFirstlookLayout((data.firstlook_layout ?? "cards") as HomepageLayout);
                
                setHomepageTab1Layout(
                  (data.homepage_tab1_layout as HomepageLayout) || "cards",
                );

                setHomepageTab2Layout(
                  (data.homepage_tab2_layout as HomepageLayout) || "linktree",
                );

                setHomepageTab3Layout(
                  (data.homepage_tab3_layout as HomepageLayout) || "cards",
                );
                
                setHomepageTab1Type(
                  (data.homepage_tab1_type as HomepagePageType) || "profile",
                );

                setHomepageTab2Type(
                  (data.homepage_tab2_type as HomepagePageType) || "links",
                );

                setHomepageTab3Type(
                  (data.homepage_tab3_type as HomepagePageType) || "works",
                );
                
                setHomepageMenuCount(
                                     ((data.homepage_menu_count ?? 3) as HomepageMenuCount),
                                     );
                
                setHomepageHeaderLogoUrl(data.homepage_header_logo_url ?? null);
                
                setHomepageHeaderLogoAlign(
                                           ((data.homepage_header_logo_align ?? "center") as HomepageLogoAlign),
                                           );
                
                setHomepageShowUsername(data.homepage_show_username !== false);
                
                setHomepageProfileImageStyle(
                                             ((data.homepage_profile_image_style ?? "circle") as HomepageProfileImageStyle),
                                             );
                
                setHomepageProfileAlign(
                                        ((data.homepage_profile_align ?? "left") as HomepageProfileAlign),
                                        );
                
                const loadedUsername = normalizeUsername(data.username ?? "");

                if (loadedUsername) {
                  const {
                    data: usernameOwner,
                    error: usernameOwnerError,
                  } = await supabase
                    .from("profiles")
                    .select("user_id, username")
                    .eq("username", loadedUsername)
                    .maybeSingle();

                  if (usernameOwnerError) {
                    setAccountIntegrityMessage(
                      "ユーザーネーム所有者確認に失敗しました: " +
                        usernameOwnerError.message,
                    );
                  } else {
                    const owner = usernameOwner as UsernameOwnerRow | null;
                    setUsernameOwnerUserId(owner?.user_id ?? null);

                    if (owner?.user_id && owner.user_id !== user.id) {
                      setAccountIntegrityMessage(
                        "警告：このユーザーネームは別のアカウントに紐づいています。",
                      );
                    } else {
                      setAccountIntegrityMessage("");
                    }
                  }
                }
                
            }
            
            const {
                data: linksData, error: linksError
            } = await supabase
            .from("profile_links")
            .select("id, user_id, label, url, icon, sort_order, is_enabled")
            .eq("user_id", user.id)
            .eq("is_enabled", true)
            .order("sort_order", {
                ascending: true
            });
            
            if (linksError) {
                setMessage("リンク読込失敗: " + linksError.message);
                setLoading(false);
                return;
            }
            
            setLinks((linksData ?? []) as ProfileLinkRow[]);
            
            const {
                data: booksData, error: booksError
            } = await supabase
            .from("parari_books")
            .select("id, title, created_at")
            .eq("owner", user.id)
            .or("is_public.eq.true,visibility.eq.public")
            .order("created_at", {
                ascending: false
            });
            
            if (!booksError && booksData) {
                setBookOptions((booksData ?? []) as ProfileBookOption[]);
            }
            
            setLoading(false);
        };
        
        load();
    }, []);
    
    const normalizedUsername = normalizeUsername(username);
    const usernameError = usernameTouched ? getUsernameError(normalizedUsername) : "";
    const previewUrl = normalizedUsername
    ? `parari.app/${normalizedUsername}`
    : "parari.app/your-name";
    
    /**
     * PART: Account Integrity View State
     * コメント:
     * - 本人専用画面に表示するアカウント確認情報
     * - 通常は Current UID / Profile UID / Username Owner UID が一致する
     */
    const hasAccountIntegrityWarning =
        Boolean(accountIntegrityMessage) ||
        Boolean(profileUserId && userId && profileUserId !== userId) ||
        Boolean(usernameOwnerUserId && userId && usernameOwnerUserId !== userId);

    const accountIntegrityLabel = hasAccountIntegrityWarning
        ? "確認が必要です"
        : "正常";
    
    /**
     * PART: Account Information Card
     * コメント:
     * - 本人だけが見られるアカウント確認情報
     * - UIDズレの早期発見に使う
     * - loading画面ではなく通常画面側で表示する
     */
    const AccountInformationCard = (
      <section className="mb-4 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-neutral-900">
              アカウント情報
            </div>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              登録情報と公開URLの所有者を確認できます。
            </p>
          </div>

          <div
            className={[
              "rounded-md px-2 py-1 text-xs font-medium",
              hasAccountIntegrityWarning
                ? "bg-red-50 text-red-700"
                : "bg-emerald-50 text-emerald-700",
            ].join(" ")}
          >
            {accountIntegrityLabel}
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-md bg-neutral-50 p-3">
            <div className="text-[11px] font-semibold tracking-wide text-neutral-500">
              登録メールアドレス
            </div>
            <div className="mt-1 break-all text-neutral-900">
              {email || "未取得"}
            </div>
          </div>

          <div className="rounded-md bg-neutral-50 p-3">
            <div className="text-[11px] font-semibold tracking-wide text-neutral-500">
              ユーザーネーム
            </div>
            <div className="mt-1 break-all text-neutral-900">
              {normalizedUsername || "未設定"}
            </div>
          </div>

          <div className="rounded-md bg-neutral-50 p-3">
            <div className="text-[11px] font-semibold tracking-wide text-neutral-500">
              会員ID
            </div>
            <div className="mt-1 break-all font-mono text-xs text-neutral-900">
              {userId || "未取得"}
            </div>
          </div>
        </div>

        <details className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-neutral-600">
            開発用確認情報
          </summary>

          <div className="mt-3 space-y-2 font-mono text-[11px] leading-5 text-neutral-600">
            <div>
              Current UID:{" "}
              <span className="break-all">{userId || "未取得"}</span>
            </div>
            <div>
              Profile UID:{" "}
              <span className="break-all">{profileUserId || "未取得"}</span>
            </div>
            <div>
              Username Owner UID:{" "}
              <span className="break-all">
                {usernameOwnerUserId || "未取得"}
              </span>
            </div>
          </div>
        </details>

        {hasAccountIntegrityWarning ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
            {accountIntegrityMessage ||
              "ログイン中の会員IDと、プロフィールまたはユーザーネームの所有者が一致していません。"}
          </div>
        ) : null}
      </section>
    );
    
    /**
     * PART: save profile
     */
    const handleSave = async () => {
        if (!userId) {
            setMessage("ユーザーIDが見つかりません");
            return;
        }
        
        setUsernameTouched(true);
        
        const validationError = getUsernameError(normalizedUsername);
        if (validationError) {
            setMessage(validationError);
            return;
        }

        /**
         * PART: Username Owner Guard
         * コメント:
         * - username は公開URLの所有権そのもの
         * - 既に別 user_id が所有している username は保存させない
         * - 今回のような UID ズレを再発防止する
         */
        const {
            data: usernameOwner,
            error: usernameOwnerError,
        } = await supabase
            .from("profiles")
            .select("user_id, username")
            .eq("username", normalizedUsername)
            .maybeSingle();

        if (usernameOwnerError) {
            setMessage(
                "ユーザーネーム所有者確認に失敗しました: " +
                    usernameOwnerError.message,
            );
            return;
        }

        const owner = usernameOwner as UsernameOwnerRow | null;
        setUsernameOwnerUserId(owner?.user_id ?? null);

        if (owner?.user_id && owner.user_id !== userId) {
            setMessage(
                "このユーザーネームは別のアカウントに紐づいています。管理者による確認が必要です。",
            );
            setAccountIntegrityMessage(
                `警告：${normalizedUsername} の所有UIDが現在のログインUIDと一致していません。`,
            );
            return;
        }

        setAccountIntegrityMessage("");
        setSaving(true);
        setMessage("");
        
        /**
         * PART: validate book homepage url
         * コメント:
         * - BOOK型ホームページの場合は、PARARI作品URLから bookId を取り出す
         * - /p/{bookId} 形式以外は保存しない
         */
        let nextHomepageBookId = homepageBookId || null;
        
        if (homepageMode === "book") {
            const parsedBookId = parseParariBookUrl(homepageBookUrl);
            
            if (!parsedBookId) {
                setHomepageBookUrlError(
                                        "PARARI作品のURLを入力してください。例：https://parari.app/p/xxxx",
                                        );
                setSaving(false);
                return;
            }
            
            setHomepageBookUrlError("");
            nextHomepageBookId = parsedBookId;
        }
        
        const payload = {
            user_id: userId,
            username: normalizedUsername,
            display_name: displayName.trim() || null,
            bio: bio.trim() || null,
            tab_label_profile: tabLabelProfile.trim() || null,
            tab_label_links: tabLabelLinks.trim() || null,
            tab_label_works: tabLabelWorks.trim() || null,
            
            homepage_mode: homepageMode,
            homepage_book_id: nextHomepageBookId,
            homepage_tag_key: homepageTagKey,
            firstlook_tag_key: firstlookTagKey,
            firstlook_layout: firstlookLayout,
            
            homepage_menu_count: homepageMenuCount,
            homepage_header_logo_url: homepageHeaderLogoUrl,
            homepage_header_logo_align: homepageHeaderLogoAlign,
            homepage_show_username: homepageShowUsername,
            
            homepage_profile_image_style: homepageProfileImageStyle,
            homepage_profile_align: homepageProfileAlign,
            
            homepage_tab1_layout: homepageTab1Layout,
            homepage_tab2_layout: homepageTab2Layout,
            homepage_tab3_layout: homepageTab3Layout,
            
            homepage_tab1_type: homepageTab1Type,
            homepage_tab2_type: homepageTab2Type,
            homepage_tab3_type: homepageTab3Type,
            
            avatar_url: avatarUrl,
            cover_image_url: coverImageUrl,
            
            cta_enabled: ctaEnabled,
            cta_label: ctaLabel.trim() || null,
            cta_href: ctaHref.trim() || null,
        };
        
        console.log("[PROFILE SAVE PAYLOAD]", payload);
        
        const {
            data: updatedRows, error: updateError
        } = await supabase
        .from("profiles")
        .update({
            username: payload.username,
            display_name: payload.display_name,
            bio: payload.bio,
            tab_label_profile: payload.tab_label_profile,
            tab_label_links: payload.tab_label_links,
            tab_label_works: payload.tab_label_works,
            
            homepage_mode: payload.homepage_mode,
            homepage_book_id: payload.homepage_book_id,
            homepage_tag_key: payload.homepage_tag_key,
            firstlook_tag_key: payload.firstlook_tag_key,
            firstlook_layout: payload.firstlook_layout,
            
            homepage_menu_count: payload.homepage_menu_count,
            homepage_header_logo_url: payload.homepage_header_logo_url,
            homepage_header_logo_align: payload.homepage_header_logo_align,
            homepage_show_username: payload.homepage_show_username,
            
            homepage_profile_image_style: payload.homepage_profile_image_style,
            homepage_profile_align: payload.homepage_profile_align,
            
            homepage_tab1_layout: payload.homepage_tab1_layout,
            homepage_tab2_layout: payload.homepage_tab2_layout,
            homepage_tab3_layout: payload.homepage_tab3_layout,

            homepage_tab1_type: payload.homepage_tab1_type,
            homepage_tab2_type: payload.homepage_tab2_type,
            homepage_tab3_type: payload.homepage_tab3_type,
            
            avatar_url: payload.avatar_url,
            cover_image_url: payload.cover_image_url,
            
            cta_enabled: payload.cta_enabled,
            cta_label: payload.cta_label,
            cta_href: payload.cta_href,
        })
        .eq("user_id", userId)
        .select("user_id");
        
        if (updateError) {
            const lower = String(updateError.message || "").toLowerCase();
            
            if (lower.includes("duplicate")) {
                setMessage("このユーザーネームはすでに使われています");
            } else {
                setMessage("保存失敗(update): " + updateError.message);
            }
            
            setSaving(false);
            return;
        }
        
        if (!updatedRows || updatedRows.length === 0) {
            const {
                error: insertError
            } = await supabase.from("profiles").insert(payload);
            
            if (insertError) {
                const lower = String(insertError.message || "").toLowerCase();
                
                if (lower.includes("duplicate")) {
                    setMessage("このユーザーネームはすでに使われています");
                } else {
                    setMessage("保存失敗(insert): " + insertError.message);
                }
                
                setSaving(false);
                return;
            }
        }
        
        setSaving(false);
        setMessage("保存しました");
        
        router.push(returnTo);
        router.refresh();
    };
    
    /**
     * PART: preset apply
     * コメント:
     * - 候補ボタンを押したら label / icon を入れる
     * - URL は本人が入力
     */
    const applyPreset = (preset: {
        label: string; icon: string
    }) => {
        setNewLabel(preset.label);
        setNewIcon(preset.icon);
    };
    
    /**
     * PART: add link
     * コメント:
     * - 最大10リンクまで
     * - sort_order は末尾に追加
     */
    const handleAddLink = async () => {
        if (!userId) {
            setMessage("ユーザーIDが見つかりません");
            return;
        }
        
        if (links.length >= 10) {
            setMessage("リンクは最大10件までです");
            return;
        }
        
        if (!newLabel.trim()) {
            setMessage("リンクの表示名を入力してください");
            return;
        }
        
        if (!newUrl.trim()) {
            setMessage("リンクのURLを入力してください");
            return;
        }
        
        setLinkSaving(true);
        setMessage("");
        
        const {
            error
        } = await supabase.from("profile_links").insert({
            user_id: userId,
            label: newLabel.trim(),
            url: newUrl.trim(),
            icon: newIcon.trim() || null,
            sort_order: links.length + 1,
            is_enabled: true,
        });
        
        if (error) {
            setMessage("リンク追加失敗: " + error.message);
            setLinkSaving(false);
            return;
        }
        
        const {
            data: linksData, error: linksError
        } = await supabase
        .from("profile_links")
        .select("id, user_id, label, url, icon, sort_order, is_enabled")
        .eq("user_id", userId)
        .eq("is_enabled", true)
        .order("sort_order", {
            ascending: true
        });
        
        if (linksError) {
            setMessage("リンク再読込失敗: " + linksError.message);
            setLinkSaving(false);
            return;
        }
        
        setLinks((linksData ?? []) as ProfileLinkRow[]);
        setNewLabel("");
        setNewUrl("");
        setNewIcon("");
        setLinkSaving(false);
        setMessage("リンクを追加しました");
    };
    
    /**
     * PART: delete link
     * コメント:
     * - v0は論理削除
     */
    const handleDeleteLink = async (linkId: string) => {
        if (!userId) {
            setMessage("ユーザーIDが見つかりません");
            return;
        }
        
        const {
            error
        } = await supabase
        .from("profile_links")
        .update({
            is_enabled: false
        })
        .eq("id", linkId)
        .eq("user_id", userId);
        
        if (error) {
            setMessage("リンク削除失敗: " + error.message);
            return;
        }
        
        setLinks((prev) => prev.filter((link) => link.id !== linkId));
        setMessage("リンクを削除しました");
    };
    
    if (loading) {
        return (
                <main className="min-h-screen">
                <EditorControlBar
                current="profile"
                returnTo={
                    returnTo
                }
                />
                
                
                
                <div className="p-6">Loading...</div>
                </main>
                );
    }
    
    const hasHomepageUsername = Boolean(normalizedUsername);
    const showHomepageStart = !hasHomepageUsername && !homepageSetupStarted;
    
    if (showHomepageStart) {
        return (
                <>
                <main className="min-h-screen bg-white">
                <EditorControlBar
                current="profile"
                returnTo={
                    returnTo
                }
                />
                
                <div className="mx-auto max-w-xl px-4 py-8">
                
                {AccountInformationCard}
                
                <section className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-5">
                <div>
                <h1 className="text-xl font-semibold text-neutral-900">
                ホームページ作成
                </h1>
                
                <p className="mt-3 text-sm leading-7 text-neutral-600">
                PARARI（パラリ）では、あなたの作品・企画・サービスを紹介するホームページを作ることができます。
                ホームページを作ると、あなた専用のURLを使えるようになります。
                </p>
                
                <p className="mt-3 text-sm leading-7 text-neutral-600">
                まだ必要ない場合は、今は作らずにPARARIを使い始めることもできます。
                作品の作成、あとで読む、本棚、参加BOOKなどはそのまま使えます。
                </p>
                </div>
                
                <div className="space-y-3">
                <button
                type="button"
                onClick={
() => setHomepageSetupStarted(true)
                }
                className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white"
                >
                ホームページを作る
                </button>
                
                <button
                type="button"
                onClick={
() => router.push(returnTo)
                }
                className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-700"
                >
                今は作らない
                </button>
                </div>
                
                <p className="text-xs leading-5 text-neutral-400">
                ホームページはあとからいつでも作成できます。
                </p>
                </section>
                </div>
                </main>
                </>
                );
    }
    
    return (            <>
            
            <main className="min-h-screen">
            <EditorControlBar
            current="profile"
            returnTo={
        returnTo
    }
            />
            <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
            
            {AccountInformationCard}
                                        
            {/* PART: homepage setup intro + mode selector */}
            <section className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div>
                <div className="text-2xl font-bold text-neutral-900">
                  ホームページ作成
                </div>
                <p className="mt-4 text-sm leading-8 text-neutral-700">
                  PARARIでは、あなたの作品・企画・サービス・活動を紹介するホームページを作ることができます。
                  作り方を選んで、順番に設定してください。入力されていない項目は、公開ページには表示されません。
                </p>
              </div>

              <div className="grid gap-4">
                <button
                  type="button"
                  onClick={() => setHomepageMode("book")}
                  className={[
                    "w-full rounded-2xl border p-5 text-left transition",
                    homepageMode === "book"
                      ? "border-black bg-neutral-50"
                      : "border-neutral-200 bg-white hover:bg-neutral-50",
                  ].join(" ")}
                >
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-2xl font-semibold text-neutral-900">
                作品をホームページにする
              </div>
              <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-white">
                有料予定
              </span>
            </div>

                  <div className="mt-3 text-sm leading-7 text-neutral-600">
            本格的なホームページを作りたい方は、PARARI作品を自由にレイアウトして、その作品をホームページとして指定できます。
            この機能は将来的に有料プランで提供予定です。
            P-Snapをホームページとして用いるには、先にPARARI作品への昇格が必要です。
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setHomepageMode("profile")}
                  className={[
                    "w-full rounded-2xl border p-5 text-left transition",
                    homepageMode !== "book"
                      ? "border-black bg-neutral-50"
                      : "border-neutral-200 bg-white hover:bg-neutral-50",
                  ].join(" ")}
                >
                  <div className="text-2xl font-semibold text-neutral-900">
                    通常ホームページを作る
                  </div>

                  <div className="mt-3 text-sm leading-7 text-neutral-600">
                    プロフィール、リンク、作品一覧などを組み合わせて、あなたの入口ページを作ります。
                  </div>

                  <div className="mt-4 space-y-2 text-sm leading-7 text-neutral-700">
                    <div>1. ホームページURLを決めます。</div>
                    <div>2. トップ表示を整えます。</div>
                    <div>3. 表示内容とリンクを設定します。</div>
                    <div>4. 保存すると公開ページに反映されます。</div>
                  </div>
                </button>
              </div>
            </section>
            

            {
        /* PART: book homepage editor */
    }
            {homepageMode === "book" ? (
                                        <section className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                                        <div>
                                        <div className="text-sm font-medium text-neutral-900">
                                        作品をホームページにする
                                        </div>
                                        <p className="mt-1 text-xs leading-5 text-neutral-500">
                                        ホームページURLと、表示したいPARARI作品のURLを設定します。
                                        </p>
                                        </div>
                                        
                                        <div className="space-y-2">
                                        <label className="block text-sm font-medium text-neutral-900">
                                        ホームページURL（ユーザー名）
                                        </label>
                                        
                                        <p className="text-xs leading-5 text-neutral-500">
                                        この文字列が、あなたのホームページURLになります。英小文字・数字・ハイフンのみ使えます。
                                        </p>
                                        
                                        <input
                                        value={
                                            username
                                        }
                                        onChange={
                                            (e) => setUsername(normalizeUsername(e.target.value))
                                        }
                                        onBlur={
() => setUsernameTouched(true)
                                        }
                                        className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                                        placeholder="例）taro-aoyama"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={
                                            false
                                        }
                                        />
                                        
                                        <div className="rounded-xl bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
                                        {
                                            previewUrl
                                        }
                                        </div>
                                        
                                        {usernameError ? (
                                                          <p className="text-xs text-red-600">{
                                                              usernameError
                                                          }</p>
                                                          ) : null}
                                        </div>
                                        
                                        <div className="space-y-2">
                                        <label className="block text-sm font-medium text-neutral-900">
                                        PARARI作品のURL
                                        </label>
                                        
                                        <p className="text-xs leading-5 text-neutral-500">
                                        ホームページとして表示したいPARARI作品のURLを入力してください。
                                        P-Snapをホームページとして用いるには、先にPARARI作品への昇格が必要です。
                                        </p>
                                        
                                        <input
                                        value={
                                            homepageBookUrl
                                        }
                                        onChange={(e) => {
                                            setHomepageBookUrl(e.target.value);
                                            setHomepageBookUrlError("");
                                        }}
                                        className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-black"
                                        placeholder="https://parari.app/p/xxxx"
                                        />
                                        
                                        {homepageBookUrlError ? (
                                                                 <div className="text-xs text-red-600">{
                                                                     homepageBookUrlError
                                                                 }</div>
                                                                 ) : (
                                                                      <div className="text-xs leading-5 text-neutral-400">
                                                                      現在は https://parari.app/p/xxxx 形式の作品URLに対応しています。
                                                                      </div>
                                                                      )}
                                        </div>
                                        
                                        <button
                                        onClick={
                                            handleSave
                                        }
                                        disabled={
                                            saving
                                        }
                                        className="w-full rounded-xl bg-black py-2 text-sm text-white disabled:opacity-60"
                                        >
                                        {
                                            saving ? "保存中..." : "ホームページ設定を保存"
                                        }
                                        </button>
                                        </section>
                                        ) : null}
            
            {
        /* PART: normal homepage editor */
    }
            {homepageMode !== "book" ? (
                                        <>
                                        
                                        <HomepageAccordionSection
                                          number="1"
                                          title="ホームページURL"
                                          description="あなたのホームページURLを設定します。"
                                          defaultOpen={true}
                                        >
                                        
                                        <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-neutral-900">
                                        ログイン中のメールアドレス
                                        </label>
                                        
                                        <input
                                        value={
                                            email
                                        }
                                        readOnly
                                        className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700"
                                        />
                                        
                                        <p className="text-xs leading-5 text-neutral-500">
                                        ログインに使っているメールアドレスです（公開プロフィール画面には表示されません）
                                        </p>
                                        </div>
                                        
                                        <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-neutral-900">
                                        トップに表示する名前
                                        </label>
                                        
                                        <p className="text-xs leading-5 text-neutral-500">
                                        ホームページの上部に表示される名前です。ペンネーム・屋号・教室名などでも使えます。
                                        </p>
                                        
                                        <input
                                        value={
                                            displayName
                                        }
                                        onChange={
                                            (e) => setDisplayName(e.target.value)
                                        }
                                        className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                                        placeholder="例）青山太郎"
                                        />
                                        </div>
                                        
                                        <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-neutral-900">
                                        ホームページURL（ユーザー名）
                                        </label>
                                        
                                        <p className="text-xs leading-5 text-neutral-500">
                                        この文字列が、あなたのホームページURLになります。英小文字・数字・ハイフンのみ使えます。
                                        </p>
                                        
                                        <input
                                        value={
                                            username
                                        }
                                        onChange={
                                            (e) => setUsername(normalizeUsername(e.target.value))
                                        }
                                        onBlur={
() => setUsernameTouched(true)
                                        }
                                        className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                                        placeholder="例）taro-aoyama"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={
                                            false
                                        }
                                        />
                                        
                                        <div className="rounded-xl bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
                                        {
                                            previewUrl
                                        }
                                        </div>
                                        
                                        <p className="text-xs text-neutral-400">
                                        ※後から変更するとリンク先が変わる場合があります
                                        </p>
                                        
                                        {
                                            usernameError ? <p className="text-xs text-red-600">{
                                                usernameError
                                            }</p> : null
                                        }
                                        </div>
                                        
                                        </HomepageAccordionSection>

                                        <HomepageAccordionSection
                                          number="2"
                                          title="トップ表示"
                                          description="名前、紹介文、プロフィール画像、ヘッダー画像を設定します。"
                                          defaultOpen={true}
                                        >
                                        
                                        <div className="space-y-3 rounded-xl bg-neutral-50 p-4">
                                        <label className="block text-sm font-semibold text-neutral-900">
                                        紹介文
                                        </label>
                                        
                                        <p className="text-xs leading-5 text-neutral-500">
                                        ホームページを開いた人に、最初に伝えたいことを書いてください。
                                        </p>
                                        
                                        <textarea
                                        value={
                                            bio
                                        }
                                        onChange={
                                            (e) => setBio(e.target.value)
                                        }
                                        className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                                        rows={
                                            4
                                        }
                                          placeholder="例）作家"
                                        />
                                        </div>

                                        {
                                          /* === ここから追加 === */
                                        }
                                        
                                        <div className="space-y-3 rounded-xl bg-neutral-50 p-4">
                                        
                                        <div>
                                        <div className="text-sm font-semibold text-neutral-900">
                                        プロフィール画像
                                        </div>
                                        <p className="mt-1 text-xs leading-5 text-neutral-500">
                                        顔写真、ロゴ、ブランド画像などを設定できます。表示方法は下の「プロフィール表示」で変更できます。
                                        </p>
                                        </div>
                                        
                                        <input
                                        type="file"
                                        accept="image/*"
                                        className="text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-200 file:px-3 file:py-1.5 file:text-sm file:text-neutral-700"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const url = await uploadProfileImage(file, "avatar", userId);
                                            if (url) setAvatarUrl(url);
                                        }}
                                        />
                                        
                                        {avatarUrl && (
                                                       <img src={
                                                           avatarUrl
                                                       } className="w-20 h-20 rounded-full mt-2" />
                                                       )}
                                        
                                        </div>
                                        
                                        <div className="space-y-3 rounded-xl bg-neutral-50 p-4">
                                        
                                        <div>
                                        <div className="text-sm font-semibold text-neutral-900">
                                        ヘッダー背景画像
                                        </div>
                                        <p className="mt-1 text-xs leading-5 text-neutral-500">
                                        ホームページの一番上に表示される横長の画像です。
                                        </p>
                                        </div>
                                        
                                        <input
                                        type="file"
                                        accept="image/*"
                                        className="text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-200 file:px-3 file:py-1.5 file:text-sm file:text-neutral-700"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const url = await uploadProfileImage(file, "cover", userId);
                                            if (url) setCoverImageUrl(url);
                                        }}
                                        />
                                        
                                        {coverImageUrl && (
                                                           <img src={
                                                               coverImageUrl
                                                           } className="w-full h-32 object-cover mt-2 rounded-xl" />
                                                           )}
                                        
                                        </div>
                                        
                                        {
                                            /* PART: homepage header logo */
                                        }
                                        <div className="space-y-3 rounded-xl bg-neutral-50 p-4">
                                        <div>
                                        <div className="text-sm font-semibold text-neutral-900">
                                        プロフィール表示
                                        </div>
                                        <p className="mt-1 text-xs leading-5 text-neutral-500">
                                        プロフィール画像を、顔写真・ロゴ・ブランド画像として表示できます。
                                        画像・名前・ユーザーネーム・紹介文は、まとめて左・中央・右に寄せられます。
                                        </p>
                                        </div>
                                        
                                        <div className="space-y-2">
                                        <div className="text-xs font-semibold text-neutral-700">
                                        プロフィール画像の表示
                                        </div>
                                        
                                        <div className="grid gap-2">
                                        {[
                                            {
                                                key: "circle",
                                                title: "丸アイコンとして表示",
                                                body: "顔写真や個人アイコン向きです。",
                                            },
                                            {
                                                key: "logo",
                                                title: "ロゴ画像として表示",
                                                body: "屋号・教室名・ブランド画像向きです。丸く切り抜きません。",
                                            },
                                            {
                                                key: "none",
                                                title: "表示しない",
                                                body: "名前と紹介文だけのシンプルな表示にします。",
                                            },
                                        ].map((item) => {
                                            const active = homepageProfileImageStyle === item.key;
                                            
                                            return (
                                                    <button
                                                    key={
                                                        item.key
                                                    }
                                                    type="button"
                                                    onClick={() =>
                                                        setHomepageProfileImageStyle(
                                                                                     item.key as HomepageProfileImageStyle,
                                                                                     )
                                                    }
                                                    className={[
                                                        "rounded-xl border p-3 text-left transition",
                                                        active
                                                        ? "border-black bg-neutral-50"
                                                        : "border-neutral-200 bg-white hover:bg-neutral-50",
                                                    ].join(" ")}
                                                    >
                                                    <div className="text-sm font-medium text-neutral-900">
                                                    {
                                                        item.title
                                                    }
                                                    </div>
                                                    <div className="mt-1 text-xs leading-5 text-neutral-500">
                                                    {
                                                        item.body
                                                    }
                                                    </div>
                                                    </button>
                                                    );
                                        })}
                                        </div>
                                        </div>
                                        
                                        <div className="space-y-2">
                                        <div className="text-xs font-semibold text-neutral-700">
                                        プロフィール全体の位置
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2">
                                        {[
                                            {
                                                key: "left", label: "左"
                                            },
                                            {
                                                key: "center", label: "中央"
                                            },
                                            {
                                                key: "right", label: "右"
                                            },
                                        ].map((item) => {
                                            const active = homepageProfileAlign === item.key;
                                            
                                            return (
                                                    <button
                                                    key={
                                                        item.key
                                                    }
                                                    type="button"
                                                    onClick={() =>
                                                        setHomepageProfileAlign(item.key as HomepageProfileAlign)
                                                    }
                                                    className={[
                                                        "rounded-full border px-3 py-1.5 text-xs",
                                                        active
                                                        ? "border-black bg-black text-white"
                                                        : "border-neutral-300 bg-white text-neutral-600",
                                                    ].join(" ")}
                                                    >
                                                    {
                                                        item.label
                                                    }
                                                    </button>
                                                    );
                                        })}
                                        </div>
                                        </div>
                                        
                                        <label className="flex items-center gap-2 text-sm text-neutral-700">
                                        <input
                                        type="checkbox"
                                        checked={
                                            homepageShowUsername
                                        }
                                        onChange={
                                            (e) => setHomepageShowUsername(e.target.checked)
                                        }
                                        />
                                        ユーザーネーム（@{
                                            normalizedUsername || "your-name"
                                        }）を表示する
                                        </label>
                                        </div>
                                        
                                        {
                                            /* === ここまで追加 === */
                                        }

                                        </HomepageAccordionSection>

                                        <HomepageAccordionSection
                                          number="3"
                                          title="表示内容"
                                          description="メニューの数と、それぞれのメニューに表示するページ形式を設定します。"
                                          defaultOpen={true}
                                        >
                                        {/* PART: homepage page type explanation */}
                                        <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                                          <div className="text-sm font-semibold text-neutral-900">
                                            通常ホームページで使えるページ形式
                                          </div>
                                          <div className="mt-2 space-y-1 text-xs leading-6 text-neutral-600">
                                            <div>1. プロフィール＋代表作品：自己紹介と代表作品を1つ表示します。</div>
                                            <div>2. 作品集：作品リストを表示します。無料会員は3作品まで掲載できます。</div>
                                            <div>3. リンク集：SNSや外部サイトへのリンクを最大10件まで表示できます。</div>
                                          </div>
                                          <p className="mt-3 text-xs leading-6 text-neutral-500">
                                            メニューを1つだけにした場合、メニュー表示は出ません。通常ホームページはメニュー1から開きます。
                                          </p>
                                        </section>
                                          {/* PART: homepage menu count */}
                                          <section className="space-y-4 rounded-xl border border-neutral-200 p-4">
                                            <div>
                                              <div className="text-sm font-semibold text-neutral-900">
                                                メニューの数
                                              </div>
                                              <p className="mt-1 text-xs leading-5 text-neutral-500">
                                        メニューを1つだけにした場合は、メニュー表示を出さずにその内容だけを表示します。2つ以上に分ける場合だけ、上部にメニューを表示します。
                                              </p>
                                            </div>

                                            <div className="grid gap-2">
                                              {[
                                                {
                                                  value: 1,
                                                  title: "1つだけ表示する（メニューなし）",
                                                  body: "もっともシンプルなホームページにします。",
                                                },
                                                {
                                                  value: 2,
                                                  title: "2つに分ける",
                                                  body: "例：作品とリンクなど、2つの内容を切り替えます。",
                                                },
                                                {
                                                  value: 3,
                                                  title: "3つに分ける",
                                                  body: "プロフィール・リンク・作品など、3つの内容を切り替えます。",
                                                },
                                              ].map((item) => {
                                                const active = homepageMenuCount === item.value;

                                                return (
                                                  <button
                                                    key={item.value}
                                                    type="button"
                                                    onClick={() => {
                                                      setHomepageMenuCount(item.value as HomepageMenuCount);

                                                      if (item.value === 1) {
                                                        setHomepageTagKey("profile");
                                                      }

                                                      if (item.value === 2 && homepageTagKey === "works") {
                                                        setHomepageTagKey("profile");
                                                      }
                                                    }}
                                                    className={[
                                                      "rounded-xl border p-3 text-left transition",
                                                      active
                                                        ? "border-black bg-neutral-50"
                                                        : "border-neutral-200 bg-white hover:bg-neutral-50",
                                                    ].join(" ")}
                                                  >
                                                    <div className="text-sm font-medium text-neutral-900">
                                                      {item.title}
                                                    </div>
                                                    <div className="mt-1 text-xs leading-5 text-neutral-500">
                                                      {item.body}
                                                    </div>
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </section>

                                        {/* PART: homepage menu item settings */}
                                        <section className="space-y-4 rounded-xl border border-neutral-200 p-4">
                                          <div>
                                            <div className="text-sm font-semibold text-neutral-900">
                                              メニューごとの設定
                                            </div>
                                            <p className="mt-1 text-xs leading-5 text-neutral-500">
                                        メニュー名と、それぞれのメニューに割り当てるページ形式を設定します。
                                            </p>
                                          </div>

                                          <div className="space-y-4 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                                            <div className="text-sm font-semibold text-neutral-900">
                                              メニュー1
                                            </div>

                                            <div className="space-y-2">
                                              <label className="block text-sm font-medium text-neutral-900">
                                                メニュー名
                                              </label>
                                              <input
                                                value={tabLabelProfile}
                                                onChange={(e) => setTabLabelProfile(e.target.value)}
                                                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                                                placeholder="例）はじめに"
                                              />
                                            </div>

                                            <div className="space-y-2">
                                              <label className="block text-sm font-medium text-neutral-900">
                                                ページ形式
                                              </label>
                                              <select
                                                value={homepageTab1Type}
                                                onChange={(e) =>
                                                  setHomepageTab1Type(e.target.value as HomepagePageType)
                                                }
                                                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                                              >
                                                <option value="profile">プロフィール＋代表作品</option>
                                                <option value="works">作品集</option>
                                                <option value="links">リンク集</option>
                                              </select>
                                            </div>
                                          </div>

                                          {homepageMenuCount >= 2 ? (
                                            <div className="space-y-4 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                                              <div className="text-sm font-semibold text-neutral-900">
                                                メニュー2
                                              </div>

                                              <div className="space-y-2">
                                                <label className="block text-sm font-medium text-neutral-900">
                                                  メニュー名
                                                </label>
                                                <input
                                                  value={tabLabelLinks}
                                                  onChange={(e) => setTabLabelLinks(e.target.value)}
                                                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                                                  placeholder="例）リンク"
                                                />
                                              </div>

                                              <div className="space-y-2">
                                                <label className="block text-sm font-medium text-neutral-900">
                                                  ページ形式
                                                </label>
                                                <select
                                                  value={homepageTab2Type}
                                                  onChange={(e) =>
                                                    setHomepageTab2Type(e.target.value as HomepagePageType)
                                                  }
                                                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                                                >
                                                  <option value="profile">プロフィール＋代表作品</option>
                                                  <option value="works">作品集</option>
                                                  <option value="links">リンク集</option>
                                                </select>
                                              </div>
                                            </div>
                                          ) : null}

                                          {homepageMenuCount >= 3 ? (
                                            <div className="space-y-4 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                                              <div className="text-sm font-semibold text-neutral-900">
                                                メニュー3
                                              </div>

                                              <div className="space-y-2">
                                                <label className="block text-sm font-medium text-neutral-900">
                                                  メニュー名
                                                </label>
                                                <input
                                                  value={tabLabelWorks}
                                                  onChange={(e) => setTabLabelWorks(e.target.value)}
                                                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                                                  placeholder="例）作品"
                                                />
                                              </div>

                                              <div className="space-y-2">
                                                <label className="block text-sm font-medium text-neutral-900">
                                                  ページ形式
                                                </label>
                                                <select
                                                  value={homepageTab3Type}
                                                  onChange={(e) =>
                                                    setHomepageTab3Type(e.target.value as HomepagePageType)
                                                  }
                                                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                                                >
                                                  <option value="profile">プロフィール＋代表作品</option>
                                                  <option value="works">作品集</option>
                                                  <option value="links">リンク集</option>
                                                </select>
                                              </div>
                                            </div>
                                          ) : null}
                                        </section>

                                          
                                        </HomepageAccordionSection>

                                        <HomepageAccordionSection
                                          number="4"
                                          title="リンク集の設定"
                                          description="表示内容で「リンク集」を選んだ場合に使います。Instagram、LINE、YouTubeなどのリンクを登録できます。"
                                          defaultOpen={false}
                                        >
                                        
                                        {canEditCTA ? (
                                        <section
                                        className={[
                                            "space-y-3 rounded-xl border p-4",
                                            
                                            canEditCTA
                                            ? "border-neutral-200"
                                            : "border-neutral-200 bg-neutral-100 text-neutral-400",
                                        ].join(" ")}
                                        >
                                        
                                        
                                        
                                        <div>
                                        <div className="text-sm font-medium">CTAボタン</div>
                                        <p className="mt-1 text-xs leading-5">
                                        フロント用ユーザーだけ変更できます。
                                        </p>
                                        </div>
                                        
                                        <label className="flex items-center gap-2 text-sm">
                                        <input
                                        type="checkbox"
                                        checked={
                                            ctaEnabled
                                        }
                                        disabled={
                                            !canEditCTA
                                        }
                                        onChange={
                                            (e) => setCtaEnabled(e.target.checked)
                                        }
                                        />
                                        CTAを表示する
                                        </label>
                                        
                                        <div className="space-y-2">
                                        <label className="block text-sm font-medium">ボタン文言</label>
                                        <input
                                        value={
                                            ctaLabel
                                        }
                                        disabled={
                                            !canEditCTA
                                        }
                                        onChange={
                                            (e) => setCtaLabel(e.target.value)
                                        }
                                        className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-200"
                                        placeholder="例）参加登録"
                                        />
                                        </div>
                                        
                                        
                                        
                                        <div className="space-y-2">
                                        <label className="block text-sm font-medium">リンク先</label>
                                        <input
                                        value={
                                            ctaHref
                                        }
                                        disabled={
                                            !canEditCTA
                                        }
                                        onChange={
                                            (e) => setCtaHref(e.target.value)
                                        }
                                        className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-200"
                                        placeholder="例）/login"
                                        />
                                        </div>
                                        </section>
                                        ) : null}
            
            {
        /* PART: links editor */
    }
            <section className="space-y-4 border-t pt-6">
            <div>
            <h2 className="text-lg font-semibold">リンク</h2>
            <p className="mt-1 text-xs text-neutral-500">
            最大10件まで追加できます。よく使う候補を押すと、表示名とアイコンが入ります。
            </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
            {LINK_PRESETS.map((preset) => (
                                           <button
                                           key={
                                               preset.label
                                           }
                                           type="button"
                                           onClick={
() => applyPreset(preset)
                                           }
                                           className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50"
                                           >
                                           {
                                               preset.icon
                                           } {
                                               preset.label
                                           }
                                           </button>
                                           ))}
            </div>
            
            <div className="space-y-2">
            <div>
            <label className="mb-1 block text-sm font-medium text-neutral-900">
            表示名
            </label>
            <input
            value={
        newLabel
    }
            onChange={
        (e) => setNewLabel(e.target.value)
    }
            placeholder="例）Instagram"
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
            />
            </div>
            
            <div>
            <label className="mb-1 block text-sm font-medium text-neutral-900">
            URL
            </label>
            <input
            value={
        newUrl
    }
            onChange={
        (e) => setNewUrl(e.target.value)
    }
            placeholder="https://..."
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={
        false
    }
            />
            </div>
            
            <div>
            <label className="mb-1 block text-sm font-medium text-neutral-900">
            アイコン（任意）
            </label>
            <input
            value={
        newIcon
    }
            onChange={
        (e) => setNewIcon(e.target.value)
    }
            placeholder="例）📷"
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
            />
            </div>
            
            <button
            type="button"
            onClick={
        handleAddLink
    }
            disabled={
        linkSaving || links.length >= 10
    }
            className="w-full rounded-xl border border-neutral-300 bg-neutral-300 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-300 disabled:opacity-60"
            >
            {
        linkSaving ? "追加中..." : links.length >= 10 ? "最大10件です" : "リンク追加"
    }
            </button>
            </div>
            
            <div className="space-y-2">
            {links.length === 0 ? (
                                   <div className="rounded-xl border border-dashed border-neutral-300 px-3 py-4 text-sm text-neutral-400">
                                   まだリンクがありません
                                   </div>
                                   ) : (
                                        links.map((link) => (
                                                             <div
                                                             key={
                                                                 link.id
                                                             }
                                                             className="flex items-center justify-between gap-3 rounded-xl border border-neutral-300 px-3 py-3"
                                                             >
                                                             <div className="min-w-0">
                                                             <div className="truncate text-sm font-medium text-neutral-900">
                                                             <span className="mr-2">{
                                                                 link.icon || "🔗"
                                                             }</span>
                                                             {
                                                                 link.label
                                                             }
                                                             </div>
                                                             <div className="truncate text-xs text-neutral-500">{
                                                                 link.url
                                                             }</div>
                                                             </div>
                                                             
                                                             <button
                                                             type="button"
                                                             onClick={
() => handleDeleteLink(link.id)
                                                             }
                                                             className="shrink-0 text-xs text-red-600 hover:underline"
                                                             >
                                                             削除
                                                             </button>
                                                             </div>
                                                             ))
                                        )}
                                        </div>
                                        </section>

                                        </HomepageAccordionSection>
                                        
                                        <button
                                        onClick={
                                    handleSave
                                }
                                        disabled={
                                    saving
                                }
                                        className="w-full rounded-xl bg-black py-2 text-sm text-white disabled:opacity-60"
                                        >
                                        {
                                    saving ? "保存中..." : "ホームページ設定を保存"
                                }
                                        </button>

                                        
                                        </>
                                      ) : null}
                                        
                            {message ? (
            <div className="rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
            {
                message
            }
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
