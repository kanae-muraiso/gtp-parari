// apps/tools/parari/src/app/display/page.tsx
// apps/tools/parari/src/app/display/page.tsx
// 2026-04-06 JST

"use client";

/**
 * PART: Display Settings Page (NEW)
 * コメント:
 * - 本棚と同じレイアウトに統一
 * - bar / page / panel の3テーマを編集
 */

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import BookshelfControlBar from "../../components/parari/BookshelfControlBar";
import { getThemeClass, normalizeTheme } from "../../lib/shelfTheme";

const COLORS = ["cream", "mint", "sky", "lavender", "rose", "stone", "midnight"];

export default function DisplaySettingsPage() {
  const router = useRouter();

  const [userId, setUserId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [barTheme, setBarTheme] = React.useState("cream");
  const [pageTheme, setPageTheme] = React.useState("cream");
  const [panelTheme, setPanelTheme] = React.useState("cream");

  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    async function load() {
      if (!supabase) return;

      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }

      setUserId(data.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "shelf_bar_theme, shelf_page_theme, shelf_panel_theme"
        )
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!mounted) return;

      setBarTheme(profile?.shelf_bar_theme ?? "cream");
      setPageTheme(profile?.shelf_page_theme ?? "cream");
      setPanelTheme(profile?.shelf_panel_theme ?? "cream");

      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleSave() {
    if (!supabase || !userId) return;

    setSaving(true);

    await supabase.from("profiles").upsert(
      {
        user_id: userId,
        shelf_bar_theme: barTheme,
        shelf_page_theme: pageTheme,
        shelf_panel_theme: panelTheme,
      },
      { onConflict: "user_id" }
    );

    setSaving(false);
    router.push("/mypage");
  }

  const themePage = getThemeClass(normalizeTheme(pageTheme));

  if (loading) return null;

  return (
    <main className={`min-h-screen ${themePage.page}`}>
      <BookshelfControlBar current="display" barTheme={barTheme} />

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div className="text-xl font-bold">表示設定</div>

        {/* bar */}
        <section className="rounded-2xl border bg-white p-4">
          <div className="mb-3 font-medium">コントロールバー</div>
          <ColorSelector value={barTheme} setValue={setBarTheme} />
        </section>

        {/* page */}
        <section className="rounded-2xl border bg-white p-4">
          <div className="mb-3 font-medium">外側背景</div>
          <ColorSelector value={pageTheme} setValue={setPageTheme} />
        </section>

        {/* panel */}
        <section className="rounded-2xl border bg-white p-4">
          <div className="mb-3 font-medium">パネル</div>
          <ColorSelector value={panelTheme} setValue={setPanelTheme} />
        </section>

        <button
          onClick={handleSave}
          className="w-full rounded-xl bg-black py-3 text-white"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </main>
  );
}

/**
 * PART: color map
 */
const COLOR_PREVIEW_CLASS: Record<string, string> = {
  cream: "bg-amber-100 border-amber-200",
  mint: "bg-emerald-100 border-emerald-200",
  sky: "bg-sky-100 border-sky-200",
  lavender: "bg-violet-100 border-violet-200",
  rose: "bg-rose-100 border-rose-200",
  stone: "bg-stone-200 border-stone-300",
  midnight: "bg-zinc-800 border-zinc-700",
};

/**
 * PART: ColorSelector（新）
 */
function ColorSelector({
  value,
  setValue,
}: {
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-4">
      {COLORS.map((c) => {
        const selected = value === c;

        return (
          <button
            key={c}
            type="button"
            onClick={() => setValue(c)}
            className="flex w-[76px] flex-col items-center gap-2"
          >
            <span
              className={`block h-12 w-12 rounded-full border ${
                COLOR_PREVIEW_CLASS[c] ?? "bg-white border-neutral-200"
              } ${selected ? "ring-2 ring-black ring-offset-2" : ""}`}
            />
            <span className="text-xs text-neutral-700">{c}</span>
          </button>
        );
      })}
    </div>
  );
}
