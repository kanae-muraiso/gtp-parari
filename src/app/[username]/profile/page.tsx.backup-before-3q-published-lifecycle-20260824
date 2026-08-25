// src/app/[username]/profile/page.tsx
// src/app/[username]/profile/page.tsx
// 2026-05-05 JST

"use client";

/**
 * PART: User Profile Page with selected works
 * コメント:
 * - 固定3タブ
 * - リンク表示あり
 * - 無料会員の作品タブは、作者が選んだ3作品だけ表示
 */

import {
    useEffect, useState
} from "react";
import {
    useParams,
} from "next/navigation";
import Link from "next/link";
import {
    supabase
} from "@/lib/supabaseClient";
import {
    parseParari, parseParariToNodes
} from "@/lib/parariParse";
import {
    isExpired
} from "@/lib/parariExpiry";
import HeroPanel from "@/components/parari/HeroPanel";
import EventClassBrandPanel, {
    type EventClassBrandItem,
} from "@/components/parari/EventClassBrandPanel";
import PublicPagePatternRenderer, {
    type PublicPagePattern,
} from "@/components/parari/public-page/PublicPagePatternRenderer";

type ProfileRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  bio: string | null;

    is_monitor: boolean | null;
    tab_label_profile?: string | null;
    tab_label_links?: string | null;
    tab_label_works?: string | null;
    
    profile_body?: string | null;
    
    avatar_url?: string | null;
    cover_image_url?: string | null;
    
    cta_enabled?: boolean | null;
    cta_label?: string | null;
    cta_href?: string | null;
    
    homepage_mode?: HomepageMode | null;
    homepage_book_id?: string | null;
    homepage_tag_key?: HomepageTagKey | null;
    firstlook_tag_key?: HomepageTagKey | null;
    firstlook_layout?: HomepageLayout | null;
    
    homepage_menu_count?: number | null;
    homepage_tab1_layout?: HomepageLayout | null;
    homepage_tab2_layout?: HomepageLayout | null;
    homepage_tab3_layout?: HomepageLayout | null;
    
    homepage_tab1_type?: HomepagePageType | null;
    homepage_tab2_type?: HomepagePageType | null;
    homepage_tab3_type?: HomepagePageType | null;
    
    homepage_header_logo_url?: string | null;
    homepage_header_logo_align?: HomepageLogoAlign | null;
    homepage_show_username?: boolean | null;
    
    homepage_profile_image_style?: HomepageProfileImageStyle | null;
    homepage_profile_align?: HomepageProfileAlign | null;

    public_page_pattern?: string | null;
};

type BookRow = {
    id: string;
    title: string | null;
    content: string | null;
    created_at: string | null;
    updated_at: string | null;
    visibility: string | null;
    custom_slug?: string | null;
    stable_slug?: string | null;
    slug?: string | null;
    expires_at?: string | null;
    show_in_profile_works?: boolean | null;
    profile_works_order?: number | null;
};

type ProfileLinkRow = {
    id: string;
    user_id: string;
    label: string;
    url: string;
    icon: string | null;
    sort_order: number | null;
    is_enabled: boolean | null;
};

type UserTab = "profile" | "links" | "works";

type HomepageMode = "profile" | "book" | "tag";
type HomepageTagKey = "profile" | "links" | "works";
type HomepageLayout = "cards" | "linktree";

type HomepagePageType = "profile" | "works" | "links";

/**
 * PART: homepage header/menu types
 * コメント:
 * - 通常ホームページ用のヘッダー/表示内容数
 */
type HomepageMenuCount = 1 | 2 | 3;
type HomepageLogoAlign = "left" | "center" | "right";

type HomepageProfileImageStyle = "circle" | "logo" | "none";
type HomepageProfileAlign = "left" | "center" | "right";

function normalizePublicPagePattern(
    value: string | null | undefined,
): PublicPagePattern | null {
    if (
        value === "person-first" ||
        value === "offer-first" ||
        value === "story-first" ||
        value === "welcome-first"
    ) {
        return value;
    }

    return null;
}

function formatDateJa(dateString: string | null) {
    if (!dateString) return "";
    try {
        return new Date(dateString).toLocaleDateString("ja-JP");
    } catch {
        return "";
    }
}

function getDisplayTitle(book: BookRow) {
    try {
        const parsedTitle = book.content ? parseParari(book.content).bookTitle : "";
        return parsedTitle || book.title || "(no title)";
    } catch {
        return book.title || "(no title)";
    }
}

function getDeadlineLabel(expiresAt?: string | null) {
    if (!expiresAt) return null;
    
    const now = new Date();
    const exp = new Date(expiresAt);
    if (Number.isNaN(exp.getTime())) return null;
    
    const expired = exp.getTime() <= now.getTime();
    
    const sameDay =
    exp.getFullYear() === now.getFullYear() &&
    exp.getMonth() === now.getMonth() &&
    exp.getDate() === now.getDate();
    
    if (expired) return {
        text: "期限終了", type: "expired" as const
    };
    if (sameDay) return {
        text: "本日締切", type: "today" as const
    };
    
    return {
        text: `締切 ${exp.getMonth() + 1}/${exp.getDate()}`,
        type: "normal" as const,
    };
}

function WorkCard({
    username,
    book,
}: {
    username: string;
    book: BookRow;
}) {
    const doc = parseParari(book.content || "");
    const cardImage = doc.bookCoverImage || doc.pages?.[0]?.imageUrl || "";
    const displaySlug = book.custom_slug || book.stable_slug || book.slug || "";
    const displayTitle = getDisplayTitle(book);
    const deadline = getDeadlineLabel(book.expires_at);
    const expired = isExpired(book.expires_at);
    
    return (
            <Link
              href={`/p/${book.id}`}
              className="block"
            >
            <div className={
                `group cursor-pointer ${expired ? "opacity-70" : ""}`
            }>
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-gray-100">
            {deadline ? (
                         <div
                         className={`absolute left-2 top-2 z-10 rounded px-2 py-1 text-xs ${
                deadline.type === "expired"
                  ? "bg-red-100 text-red-700"
                  : deadline.type === "today"
                  ? "bg-red-600 text-white"
                  : "bg-red-500 text-white"
              }`}
                         >
                         {
                             deadline.text
                         }
                         </div>
                         ) : null}
            
            {cardImage ? (
                          <img
                          src={
                              cardImage
                          }
                          alt={
                              displayTitle
                          }
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                          ) : (
                               <div className="flex h-full items-center justify-center text-xs text-gray-400">
                               NO IMAGE
                               </div>
                               )}
            </div>
            
            <div className="mt-3 space-y-1">
            <div className="font-medium leading-6 text-gray-900 text-[16px]">
            {
                displayTitle
            }
            </div>
            
            <div className="text-xs text-gray-400">
            {
                formatDateJa(book.created_at)
            }
            </div>
            </div>
            </div>
            </Link>
            );
}

export default function UserProfilePage() {
    const params = useParams();
    const routeUsername =
      typeof params?.username === "string"
        ? params.username
        : "";

    const [username, setUsername] = useState(routeUsername);
    
    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [books, setBooks] = useState<BookRow[]>([]);
    const [links, setLinks] = useState<ProfileLinkRow[]>([]);
    const [eventClassItems, setEventClassItems] =
      useState<EventClassBrandItem[]>([]);
    const [activeTab, setActiveTab] = useState<UserTab>("profile");
    const [didApplyFirstLook, setDidApplyFirstLook] = useState(false);
    const [loading, setLoading] = useState(true);

    /*
     * 通常URLではroute paramsから、
     * サブドメインの短いURLではhostnameからusernameを取得する。
     */
    useEffect(() => {
        if (routeUsername) {
            setUsername(routeUsername);
            return;
        }

        const hostname = window.location.hostname
          .trim()
          .toLowerCase();

        const subdomainUsername =
          hostname.split(".")[0] ?? "";

        if (subdomainUsername) {
            setUsername(subdomainUsername);
        }
    }, [routeUsername]);

    
    useEffect(() => {
        const load = async () => {
            if (!username) return;
            
            const {
                data: profileData, error: profileError
            } = await supabase
            .from("profiles")
            .select(
              "user_id, username, display_name, bio, profile_body, is_monitor, tab_label_profile, tab_label_links, tab_label_works, avatar_url, cover_image_url, cta_enabled, cta_label, cta_href, profile_body, homepage_mode, homepage_book_id, homepage_tag_key, firstlook_tag_key, firstlook_layout, homepage_menu_count, homepage_header_logo_url, homepage_header_logo_align, homepage_show_username, homepage_profile_image_style, homepage_profile_align, homepage_tab1_layout, homepage_tab2_layout, homepage_tab3_layout, homepage_tab1_type, homepage_tab2_type, homepage_tab3_type, public_page_pattern"
            )
            .eq("username", username)
            .maybeSingle();
            
            if (profileError || !profileData) {
                setLoading(false);
                return;
            }
            
            setProfile(profileData as ProfileRow);
            
            const loadedProfile = profileData as ProfileRow;

            if (!didApplyFirstLook) {
              const mode = loadedProfile.homepage_mode ?? "profile";
                const firstLook = loadedProfile.firstlook_tag_key ?? "profile";
                const homeTag = loadedProfile.homepage_tag_key ?? "profile";

              if (mode === "tag") {
                setActiveTab(homeTag);
              } else {
                setActiveTab(firstLook);
              }

              setDidApplyFirstLook(true);
            }
            
            const {
                data: booksData, error: booksError
            } = await supabase
            .from("parari_books")
            .select(
                    "id, title, content, created_at, updated_at, visibility, custom_slug, stable_slug, slug, expires_at, show_in_profile_works, profile_works_order"
                    )
            .eq("owner", profileData.user_id)
            .or("is_public.eq.true,visibility.eq.public")
            .order("created_at", {
                ascending: false
            });
            
            if (!booksError && booksData) {
                setBooks(booksData as BookRow[]);
            }
            
            const {
                data: linksData, error: linksError
            } = await supabase
            .from("profile_links")
            .select("id, user_id, label, url, icon, sort_order, is_enabled")
            .eq("user_id", profileData.user_id)
            .eq("is_enabled", true)
            .order("sort_order", {
                ascending: true
            });
            
            if (!linksError && linksData) {
                setLinks(linksData as ProfileLinkRow[]);
            }
            

            const calendarResponse =
              await fetch(
                `/api/calendar/profile-items?username=${encodeURIComponent(username)}`,
                {
                  cache: "no-store",
                },
              );

            const calendarResult =
              await calendarResponse
                .json()
                .catch(() => null);

            if (
              calendarResponse.ok &&
              calendarResult?.ok &&
              Array.isArray(
                calendarResult.items,
              )
            ) {
              setEventClassItems(
                calendarResult.items as EventClassBrandItem[],
              );
            } else {
              setEventClassItems([]);
            }

            setLoading(false);
        };
        
        void load();
    }, [username]);

    
    const selectedBooks = books
      .filter((b) => b.show_in_profile_works)
      .sort((a, b) => {
        const ao = a.profile_works_order ?? 999;
        const bo = b.profile_works_order ?? 999;
        return ao - bo;
      });
    
    if (loading) {
        return <div className="p-6">Loading...</div>;
    }
    
    const worksTabBooks = selectedBooks;
    
    const FRONT_USER_ID = "2c8cfafa-da1c-42bb-8092-94ff922a60b4"; // ← あなたの user_id に置き換える
    const isFrontUser = profile?.user_id === FRONT_USER_ID;
    

    
    console.log("[CTA DEBUG]", {
      profileUserId: profile?.user_id,
      FRONT_USER_ID,
      isFrontUser,
      ctaEnabled: profile?.cta_enabled,
      username: profile?.username,
    });
    
    if (!profile) {
        return (
                <main className="p-6 text-center text-sm text-gray-500">
                ユーザーが見つかりません
                </main>
                );
    }
    
    const publicPagePattern =
      normalizePublicPagePattern(
        profile.public_page_pattern,
      );

    const eventContent =
      eventClassItems.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {eventClassItems.map((item) => (
            <EventClassBrandPanel
              key={item.id}
              item={item}
            />
          ))}
        </div>
      ) : null;

    const worksContent =
      worksTabBooks.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {worksTabBooks.map((book) => (
            <WorkCard
              key={book.id}
              username={profile.username}
              book={book}
            />
          ))}
        </div>
      ) : null;

    const linksContent =
      links.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-sm font-semibold text-neutral-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="mr-2">
                {link.icon || "🔗"}
              </span>
              {link.label}
            </a>
          ))}
        </div>
      ) : null;

    if (publicPagePattern) {
      return (
        <PublicPagePatternRenderer
          pattern={publicPagePattern}
          displayName={
            profile.display_name || ""
          }
          username={profile.username}
          bio={profile.bio}
          profileBody={profile.profile_body}
          avatarUrl={profile.avatar_url}
          coverImageUrl={profile.cover_image_url}
          showUsername={
            profile.homepage_show_username !== false
          }
          showCTA={Boolean(
            profile.cta_enabled &&
            profile.cta_label &&
            profile.cta_href
          )}
          ctaLabel={profile.cta_label}
          ctaHref={profile.cta_href}
          eventContent={eventContent}
          worksContent={worksContent}
          linksContent={linksContent}
        />
      );
    }

    const homepageMode = profile.homepage_mode ?? "profile";
    
    const homepageMenuCount = Math.min(
      3,
      Math.max(1, Number(profile.homepage_menu_count ?? 3)),
    );

    const homepageTabs = [
      {
        key: "profile" as UserTab,
        label: (profile.tab_label_profile || "").trim() || "プロフィール",
      },
      {
        key: "links" as UserTab,
        label: (profile.tab_label_links || "").trim() || "リンク",
      },
      {
        key: "works" as UserTab,
        label: (profile.tab_label_works || "").trim() || "作品",
      },
    ].slice(0, homepageMenuCount);

    const visibleActiveTab = homepageTabs.some((tab) => tab.key === activeTab)
      ? activeTab
      : homepageTabs[0]?.key ?? "profile";

    function getTabPageType(tab: UserTab): HomepagePageType {
      if (tab === "profile") {
        return profile.homepage_tab1_type ?? "profile";
      }

      if (tab === "links") {
        return profile.homepage_tab2_type ?? "links";
      }

      return profile.homepage_tab3_type ?? "works";
    }

    const currentPageType = getTabPageType(visibleActiveTab);
    
    return (
            <main className="mx-auto w-full max-w-6xl px-4 py-8">
            
            <HeroPanel
              displayName={profile.display_name || ""}
              username={profile.username}
              bio={profile.bio}
              avatarUrl={profile.avatar_url}
              coverImageUrl={profile.cover_image_url}
              profileImageStyle={profile.homepage_profile_image_style ?? "circle"}
              profileAlign={profile.homepage_profile_align ?? "left"}
              showUsername={profile.homepage_show_username !== false}
              showCTA={Boolean(profile.cta_enabled && profile.cta_label && profile.cta_href)}
              ctaLabel={profile.cta_label || ""}
              ctaHref={profile.cta_href || ""}
            />

            {eventClassItems.length > 0 ? (
              <section className="mb-8">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-neutral-950">
                    クラス・イベント
                  </h2>

                  <span className="text-sm text-neutral-400">
                    {eventClassItems.length}件
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {eventClassItems.map(
                    (item) => (
                      <EventClassBrandPanel
                        key={item.id}
                        item={item}
                      />
                    ),
                  )}
                </div>
              </section>
            ) : null}
            
            
            {homepageMode !== "tag" && homepageMenuCount > 1 ? (
              <section className="mb-6 flex gap-2 border-b border-neutral-200">
                {homepageTabs.map((tab) => {
                  const isActive = visibleActiveTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={[
                        "px-3 py-2 text-sm transition",
                        isActive
                          ? "border-b-2 border-black font-semibold text-black"
                          : "text-gray-400 hover:text-black",
                      ].join(" ")}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </section>
            ) : null}
            
            {currentPageType === "profile" ? (
              <section className="py-4">
                {profile.profile_body?.trim() ? (
                  <div className="whitespace-pre-wrap text-sm leading-8 text-neutral-700">
                    {profile.profile_body}
                  </div>
                ) : (
                  <div className="text-sm text-neutral-400">
                    プロフィールはまだ登録されていません。
                  </div>
                )}
              </section>
            ) : null}
            
            {currentPageType === "links" ? (
                                       <section className="py-4">
                                       {links.length === 0 ? (
                                                              <div className="text-sm text-gray-400">
                                                              まだリンクがありません
                                                              </div>
                                                              ) : (
                                                                   <div className="space-y-3">
                                                                   {links.map((link) => (
                                                                                         <a
                                                                                         key={
                                                                                             link.id
                                                                                         }
                                                                                         href={
                                                                                             link.url
                                                                                         }
                                                                                         target="_blank"
                                                                                         rel="noopener noreferrer"
                                                                                         className={[
                                                                                           "block rounded-2xl border px-5 py-4 text-center text-sm font-medium transition",
                                                                                           currentPageType === "links" || homepageMode === "tag"
                                                                                             ? "border-neutral-900 bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-md"
                                                                                             : "border-neutral-200 hover:bg-neutral-50",
                                                                                         ].join(" ")}
                                                                                         >
                                                                                         <span className="mr-2">{
                                                                                             link.icon || "🔗"
                                                                                         }</span>
                                                                                         {
                                                                                             link.label
                                                                                         }
                                                                                         </a>
                                                                                         ))}
                                                                   </div>
                                                                   )}
                                       </section>
                                             ) : null}
            
            {currentPageType === "works" ? (
                                       <>
                                       <section className="mb-4 flex items-center justify-between">
                                       <h2 className="text-lg font-semibold">作品</h2>
                                       <p className="text-sm text-gray-500">{
                                           worksTabBooks.length
                                       }件</p>
                                       </section>
                                       
                                       {worksTabBooks.length === 0 ? (
                                                                     <div className="text-center text-sm text-gray-500">
                                                                     まだ表示作品が選ばれていません
                                                                     </div>
                                                                     ) : (
                                                                          <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
                                                                          {worksTabBooks.map((book) => (
                                                                                                       <WorkCard
                                                                                                       key={
                                                                                                           book.id
                                                                                                       }
                                                                                                       username={
                                                                                                           profile.username
                                                                                                       }
                                                                                                       book={
                                                                                                           book
                                                                                                       }
                />
              ))}
            </section>
          )}
        </>
                                             ) : null}
    </main>
  );
}
