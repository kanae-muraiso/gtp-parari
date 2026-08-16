// apps/tools/parari/src/components/parari/WorkspaceSwitchBar.tsx
// apps/tools/parari/src/components/parari/WorkspaceSwitchBar.tsx
// 2026-04-06 JST

"use client";

/**
 * PART: WorkspaceSwitchBar
 * コメント:
 * - 本棚環境と編集環境を見た目で分ける
 * - shelf:
 *   - パステル1本バー
 *   - 左は「マイ本棚 ⇆」のラベル
 *   - 「編集環境」だけをボタンにする
 *   - 右に「表示設定 / EN / logout」
 * - editor:
 *   - 黒1本バー
 *   - 左にページタイトル
 *   - 右に主要操作
 */

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Props = {
  variant: "shelf" | "editor";
  title?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  extraActions?: React.ReactNode;
};

type ThemeMode = "mint" | "lavender" | "peach" | "sky" | "lemon" | "random";
type ResolvedTheme = Exclude<ThemeMode, "random">;

const RANDOM_THEME_CANDIDATES: ResolvedTheme[] = [
  "mint",
  "lavender",
  "peach",
  "sky",
  "lemon",
];

const THEME_CLASS_MAP: Record<ResolvedTheme, string> = {
  mint: "bg-emerald-100 border-emerald-200 text-emerald-900",
  lavender: "bg-violet-100 border-violet-200 text-violet-900",
  peach: "bg-orange-100 border-orange-200 text-orange-900",
  sky: "bg-sky-100 border-sky-200 text-sky-900",
  lemon: "bg-yellow-100 border-yellow-200 text-yellow-900",
};

function pickRandomTheme(): ResolvedTheme {
  const index = Math.floor(Math.random() * RANDOM_THEME_CANDIDATES.length);
  return RANDOM_THEME_CANDIDATES[index] ?? "mint";
}

export default function WorkspaceSwitchBar({
  variant,
  title = "",
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  extraActions,
}: Props) {
  const router = useRouter();

  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>("mint");
  const [loadingTheme, setLoadingTheme] = React.useState(variant === "shelf");
  const [loggingOut, setLoggingOut] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    async function loadShelfTheme() {
      if (variant !== "shelf") {
        setLoadingTheme(false);
        return;
      }

      if (!supabase) {
        if (!mounted) return;
        setResolvedTheme("mint");
        setLoadingTheme(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        setResolvedTheme("mint");
        setLoadingTheme(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("shelf_theme_mode")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      const mode = String(data?.shelf_theme_mode ?? "random") as ThemeMode;

      if (!error && mode && mode !== "random") {
        if (
          mode === "mint" ||
          mode === "lavender" ||
          mode === "peach" ||
          mode === "sky" ||
          mode === "lemon"
        ) {
          setResolvedTheme(mode);
          setLoadingTheme(false);
          return;
        }
      }

      const sessionKey = `parari-shelf-theme:${user.id}`;
      const stored = window.sessionStorage.getItem(sessionKey);

      if (
        stored === "mint" ||
        stored === "lavender" ||
        stored === "peach" ||
        stored === "sky" ||
        stored === "lemon"
      ) {
        setResolvedTheme(stored);
        setLoadingTheme(false);
        return;
      }

      const nextTheme = pickRandomTheme();
      window.sessionStorage.setItem(sessionKey, nextTheme);
      setResolvedTheme(nextTheme);
      setLoadingTheme(false);
    }

    void loadShelfTheme();

    return () => {
      mounted = false;
    };
  }, [variant]);

  async function handleLogout() {
    if (loggingOut || !supabase) return;

    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function handleEnglishClick() {
    window.alert("英語表示は準備中です。");
  }

  if (variant === "shelf") {
    const themeClass = THEME_CLASS_MAP[resolvedTheme];

    return (
      <div className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div
            className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
              loadingTheme ? "bg-neutral-100 border-neutral-200 text-neutral-700" : themeClass
            }`}
          >
            <div className="flex items-center gap-3 text-sm font-medium">
              <span>マイ本棚</span>
              <span>⇆</span>

              <Link
                href="/editor"
                className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm hover:bg-white"
              >
                マイ作品
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/display"
                className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm hover:bg-white"
              >
                表示設定
              </Link>

              <button
                type="button"
                onClick={handleEnglishClick}
                className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm hover:bg-white"
              >
                EN
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm hover:bg-white disabled:opacity-60"
              >
                {loggingOut ? "..." : "logout"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-50 border-b bg-black text-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {primaryHref && primaryLabel ? (
            <>
              <Link
                href={primaryHref}
                className="rounded-lg px-2 py-1 text-sm hover:bg-white/10"
              >
                {primaryLabel}
              </Link>
              <span className="text-sm text-white/60">⇆</span>
            </>
          ) : null}

          <div className="truncate text-sm font-semibold">
            {title || "マイ作品"}
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {extraActions ? <div className="flex items-center gap-2">{extraActions}</div> : null}

          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="rounded-lg px-2 py-1 text-sm text-white/80 hover:bg-white/10 hover:text-white"
            >
              {secondaryLabel}
            </Link>
          ) : null}

          <button
            type="button"
            onClick={handleEnglishClick}
            className="rounded-lg px-2 py-1 text-sm text-white/80 hover:bg-white/10 hover:text-white"
          >
            EN
          </button>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg px-2 py-1 text-sm text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-60"
          >
            {loggingOut ? "..." : "logout"}
          </button>
        </div>
      </div>
    </div>
  );
}
