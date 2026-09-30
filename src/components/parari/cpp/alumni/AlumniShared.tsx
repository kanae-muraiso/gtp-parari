"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import CppSectionNav from "../CppSectionNav";
import { supabase } from "@/lib/supabaseClient";

export type AlumniContext = { user_id: string; is_alumni: boolean; is_admin: boolean };
export type AlumniMember = {
  user_id: string; display_name: string; photo_url: string | null; affiliation: string | null;
  role_title: string | null; topics: string[] | null; intro: string | null;
  cpp_memory: string; created_at: string; participations: { year: number; location: string }[];
};
export type AlumniPost = {
  id: string; user_id: string; display_name: string; photo_url: string | null; body: string;
  work_url: string | null; created_at: string; updated_at: string; hidden_at: string | null;
};
export type AlumniNews = { id: string; title: string; body: string; status: "draft" | "published"; is_important: boolean; published_at: string | null; created_at: string };
export const panel = "rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7";
export const button = "inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50";
export const primary = "inline-flex items-center justify-center rounded-full bg-sky-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-900 disabled:opacity-50";
export const input = "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm focus:outline-sky-700";
export const memberHref = (userId: string) => `/cpp/alumni/members/${userId}`;
export const dateLabel = (date: string) => new Date(date).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
export const message = (error: unknown) => error instanceof Error ? error.message : "処理できませんでした。もう一度お試しください。";

export async function alumniRpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error("PARARIの接続設定を確認できませんでした。");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

const Context = createContext<AlumniContext | null>(null);
export function useAlumni() {
  const value = useContext(Context);
  if (!value) throw new Error("AlumniAccess is required");
  return value;
}

export function AlumniNav({ userId }: { userId?: string }) {
  const pathname = usePathname();
  return <CppSectionNav scope="alumni" active={pathname === "/cpp/alumni" ? "home" : pathname.includes("/feed") ? "feed" : pathname.includes("/announcements") ? "announcements" : "browse"}
    settingsLinks={[
      ...(userId ? [{ href: memberHref(userId), label: "自分の同窓会ページ" }] : []),
      { href: "/cpp/alumni?edit=1", label: "同窓会の登録内容を編集" },
      { href: "/my/cpp/social-profile?returnTo=/cpp/alumni", label: "名札を編集" },
    ]} />;
}

export function AlumniAccess({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const pathname = usePathname();
  const [context, setContext] = useState<AlumniContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (!supabase) throw new Error("接続設定を確認できませんでした。");
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError && authError.name !== "AuthSessionMissingError") throw authError;
        if (data.user) {
          const next = await alumniRpc<AlumniContext>("cpp_alumni_community_context");
          if (active) setContext(next);
        }
      } catch (e) { if (active) setError(message(e)); }
      finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, []);
  const allowed = context && (adminOnly ? context.is_admin : context.is_alumni || context.is_admin);
  return <>
    {adminOnly ? <CppSectionNav /> : <AlumniNav userId={context?.is_alumni ? context.user_id : undefined} />}
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        {loading ? <p role="status">同窓会を読み込んでいます…</p> : error ? <p role="alert" className={panel}>{error}</p> : allowed ?
          <Context.Provider value={context}>{children}</Context.Provider> :
          <div className={panel}><h1 className="text-2xl font-bold">CPP同窓会</h1>
            <p className="my-4 text-sm">{!context ? "ログインして同窓会にお入りください。" : adminOnly ? "設定から管理者モードに切り替えてください。" : "同窓会に登録すると、参加者や近況を閲覧できます。"}</p>
            <Link className={primary} href={!context ? `/login?returnTo=${encodeURIComponent(pathname)}` : adminOnly ? "/my/cpp/home" : "/cpp/alumni"}>{!context ? "ログイン" : adminOnly ? "CPPホームへ" : "同窓会に登録する"}</Link>
          </div>}
      </div>
    </main>
  </>;
}

export function MemberLink({ member }: { member: AlumniMember }) {
  return <Link href={memberHref(member.user_id)} className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-sky-500 hover:bg-sky-50">
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-100 text-lg font-bold text-sky-900">
      {member.photo_url ? <img src={member.photo_url} alt="" className="h-full w-full object-cover" /> : member.display_name.slice(0, 1)}
    </span>
    <span className="min-w-0 flex-1"><span className="block font-bold text-neutral-950">{member.display_name}</span>
      <span className="block text-xs leading-6 text-neutral-600">{[member.affiliation, member.role_title].filter(Boolean).join(" · ")}</span>
      <span className="block text-xs text-neutral-500">{member.participations.map(p => `${p.year}年 ${p.location}`).join(" / ")}</span>
    </span><span aria-hidden="true" className="text-sky-800">→</span>
  </Link>;
}

export function AlumniTitle({ title, children }: { title: string; children?: ReactNode }) {
  return <header><p className="text-xs font-bold tracking-widest text-sky-800">CPP ALUMNI</p><h1 className="mt-2 text-3xl font-black text-neutral-950">{title}</h1>{children ? <p className="mt-3 text-sm leading-7 text-neutral-600">{children}</p> : null}</header>;
}
