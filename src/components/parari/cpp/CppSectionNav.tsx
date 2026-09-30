"use client";

import Link from "next/link";
import CppMessageNavLink from "./messages/CppMessageNavLink";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useOptionalCppSave } from "./CppSaveBoundary";

const modeLabels = { researcher: "研究者モード", company: "会社モード", admin: "管理者モード" };
type Mode = keyof typeof modeLabels;

type CppSection = "home" | "announcements" | "browse" | "manual" | "live";

const items: Array<{ href: string; label: string; key: CppSection }> = [
  { href: "/my/cpp/home", label: "ホーム", key: "home" },
  { href: "/my/cpp/announcements", label: "お知らせ", key: "announcements" },
  { href: "/my/cpp/members", label: "閲覧", key: "browse" },
  { href: "/my/cpp/manual", label: "マニュアル", key: "manual" },
  { href: "/my/cpp/live", label: "LIVE", key: "live" },
];

export default function CppSectionNav({
  active,
  floating = false,
  settingsLinks = [],
}: {
  active?: CppSection;
  floating?: boolean;
  settingsLinks?: Array<{ href: string; label: string }>;
}) {
  const router = useRouter();
  const save = useOptionalCppSave();
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void supabase?.rpc("cpp_mode_status").then(({ data }) => {
      const value = data?.[0]?.mode;
      if (active && value && value in modeLabels) setMode(value as Mode);
    });
    return () => { active = false; };
  }, []);
  const switchMode = async (next: Mode) => {
    if (!supabase || busy) return;
    setBusy(true); setError("");
    if (save && !(await save.flush())) { setBusy(false); return; }
    const { error } = await supabase.rpc("cpp_set_mode", { p_mode: next });
    if (error) { setError(error.message); setBusy(false); return; }
    setMode(next);
    router.push("/my/cpp/home");
    window.dispatchEvent(new Event("cpp-mode-changed"));
    setBusy(false);
  };
  return (
    <nav
      aria-label="CPPメニュー"
      className={
        floating
          ? "fixed left-3 right-3 top-3 z-[100] rounded-full border border-neutral-200 bg-white/95 p-1 shadow-lg backdrop-blur"
          : "sticky top-0 z-40 border-b border-neutral-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-6"
      }
    >
      <div className={floating ? "mx-auto flex max-w-6xl items-center gap-2" : "mx-auto flex max-w-6xl items-center gap-2"}>
        <div className="flex min-w-0 flex-1 overflow-x-auto">
        {items.map((item) => {
          const selected = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={selected ? "page" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition sm:px-4 ${
                selected
                  ? "bg-neutral-950 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <CppMessageNavLink />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
        {mode ? <span className="shrink-0 px-2 text-xs font-black text-red-600" role="status">{modeLabels[mode]}</span> : null}
        <details className="relative shrink-0">
            <summary className="cursor-pointer list-none rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-100">設定 ▾</summary>
            <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-neutral-200 bg-white p-2 shadow-lg">
              {mode ? <fieldset disabled={busy} className="mb-2 border-b border-neutral-100 pb-2"><legend className="px-4 py-2 text-xs text-neutral-500">表示モード</legend>{(Object.keys(modeLabels) as Mode[]).map((key) => <button type="button" key={key} aria-pressed={mode === key} onClick={() => void switchMode(key)} className={`block w-full rounded-xl px-4 py-3 text-left text-sm font-bold ${mode === key ? "bg-red-50 text-red-700" : "text-neutral-700 hover:bg-neutral-100"}`}>{modeLabels[key]}{mode === key ? " ✓" : ""}</button>)}</fieldset> : null}
              {mode === "admin" ? <Link href="/my/cpp/admin/settings" className="block rounded-xl px-4 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-100">モード利用者の設定</Link> : null}
              <Link href="/my/cpp/messages/settings" className="block rounded-xl px-4 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-100">メッセージ設定</Link>
              {settingsLinks.map((item) => <Link key={item.href} href={item.href} className="block rounded-xl px-4 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-100">{item.label}</Link>)}
            </div>
          </details>
        </div>
      </div>
      {error ? <p role="alert" className="mx-auto max-w-6xl px-2 py-2 text-xs text-red-700">{error}</p> : null}
    </nav>
  );
}
