// apps/tools/parari/src/components/parari/BookshelfControlBar.tsx
// apps/tools/parari/src/components/parari/BookshelfControlBar.tsx
// 2026-04-25 JST

"use client";

/**
 * PART: BookshelfControlBar
 * コメント:
 * - 本棚環境専用の「中身組み立て役」
 * - バー本体は ControlBar に任せる
 * - 1段目: 世界の切替 / 現在地
 * - 2段目: 戻る / 表示設定などの操作
 * - 将来、2段目左側にタブや分類を足せる余地を残す
 */

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import {
  ControlBarButton,
  ControlBarLinkButton,
} from "./ControlBar";
import ControlBar from "./ControlBar";
import { getThemeClass, normalizeTheme } from "../../lib/shelfTheme";

/**
 * PART: ShelfTab
 * コメント:
 * - 本棚内の表示タブ
 */
type ShelfTab =
  | "home"
  | "shelf"
  | "managed"
  | "participant"
  | "read_later"
  | "viewed";

type Props = {
  current: "bookshelf" | "display";
  barTheme?: string | null;
  activeShelfTab?: ShelfTab;
  onShelfTabChange?: (tab: ShelfTab) => void;
};

export default function BookshelfControlBar({
  current,
  barTheme,
  activeShelfTab = "shelf",
  onShelfTabChange,
}: Props) {
  const router = useRouter();
  const normalizedTheme = normalizeTheme(barTheme);
  const theme = getThemeClass(normalizedTheme);
  const tone = normalizedTheme === "midnight" ? "dark" : "light";

  /**
   * PART: handle logout
   * コメント:
   * - 本棚環境右側の logout
   */
  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/");
  }

  /**
   * PART: bookshelf home
   * コメント:
   * - 1段目 = 世界の切替
   * - 2段目 = 将来の予約スペース + 表示設定
   */
    if (current === "bookshelf") {
        const shelfTabs: { key: ShelfTab; label: string }[] = [
          { key: "home", label: "🏠" },
          { key: "shelf", label: "マイ本棚" },
          { key: "managed", label: "マイ企画" },
          { key: "participant", label: "参加中" },
          { key: "read_later", label: "あとで読む" },
          { key: "viewed", label: "読んだ" },
        ];
        
    return (
      <ControlBar
        barClassName={theme.bar}
        tone={tone}
            headlineRight={
              <ControlBarLinkButton href="/display" tone={tone}>
                表示設定
              </ControlBarLinkButton>
            }
            actionLeft={
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex gap-2 overflow-x-auto whitespace-nowrap pr-4">
                  {shelfTabs.map((tab) => {
                    const active = activeShelfTab === tab.key;

                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => onShelfTabChange?.(tab.key)}
                        className={[
                              "shrink-0 rounded-lg border px-3 py-1 text-sm transition",
                              active
                                ? "bg-black text-white"
                                : "bg-white/70 text-neutral-700 hover:bg-white",
                            ].join(" ")}                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            }
            actionRight={
              <ControlBarButton onClick={handleLogout} tone={tone} muted>
                Logout
              </ControlBarButton>
            }
      />
    );
  }

  /**
   * PART: display settings
   * コメント:
   * - 1段目 = 現在地
   * - 2段目 = 戻る
   */
  return (
    <ControlBar
      barClassName={theme.bar}
      tone={tone}
      title="マイ本棚 / 表示設定"
      backHref="/mypage"
      backLabel="← 戻る"
      actionRight={
        <div className="flex min-h-[32px] items-center text-sm opacity-60">
          {/* 将来: 表示設定タブ予約スペース */}
        </div>
      }
    />
  );
}
