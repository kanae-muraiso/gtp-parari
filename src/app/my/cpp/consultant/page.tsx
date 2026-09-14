"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

type Assignment = {
  company_id: string;
  company_name: string;
  tagline: string | null;
  access_expires_at: string | null;
  is_active: boolean;
};

export default function CppConsultantPage() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [rows, setRows] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setErrorMessage("");
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("cpp_list_my_consultant_companies");
    if (error) {
      setErrorMessage(`担当企業を取得できませんでした: ${error.message}`);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as Assignment[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCompany = async (companyId: string) => {
    if (!supabase) return;
    setSwitchingId(companyId);
    setErrorMessage("");
    const { error } = await supabase.rpc("cpp_set_active_consultant_company", { p_company_id: companyId });
    if (error) {
      setSwitchingId(null);
      setErrorMessage(`担当企業を開けませんでした: ${error.message}`);
      return;
    }
    window.location.href = "/my/cpp/company";
  };

  if (loading) return <Centered>担当企業を読み込んでいます…</Centered>;

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">CPP COMPANY SUPPORTER</div>
          <h1 className="mt-1 text-2xl font-bold text-neutral-950">担当企業</h1>
          <p className="mt-2 text-sm leading-7 text-neutral-600">支援する会社を選ぶと、その会社のCOMPANY WORKBOOKを企業担当者と同じデータで開きます。</p>
        </header>

        {errorMessage ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}

        {rows.length === 0 ? (
          <section className="rounded-[2rem] border border-neutral-200 bg-white p-8 text-center shadow-sm">
            <div className="font-bold text-neutral-900">現在、担当企業はありません。</div>
            <p className="mt-2 text-sm leading-7 text-neutral-500">企業から届いた招待リンクを開くと、ここに担当企業が追加されます。</p>
          </section>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <section key={row.company_id} className={`rounded-[2rem] border bg-white p-6 shadow-sm ${row.is_active ? "border-sky-300" : "border-neutral-200"}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-neutral-950">{row.company_name}</h2>
                      {row.is_active ? <span className="rounded-full bg-sky-100 px-3 py-1 text-[10px] font-bold text-sky-700">現在選択中</span> : null}
                    </div>
                    {row.tagline ? <p className="mt-2 text-sm text-neutral-600">{row.tagline}</p> : null}
                    <div className="mt-3 text-xs text-neutral-400">編集期限 {row.access_expires_at ? formatDateTime(row.access_expires_at) : "設定なし"}</div>
                  </div>
                  <button type="button" onClick={() => void openCompany(row.company_id)} disabled={switchingId !== null} className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
                    {switchingId === row.company_id ? "開いています…" : "WORKBOOKを開く →"}
                  </button>
                </div>
              </section>
            ))}
          </div>
        )}

        <section className="rounded-[2rem] bg-neutral-900 p-6 text-white sm:p-8">
          <div className="text-xs font-bold tracking-[0.14em] text-neutral-400">COMPANY SIDE ONLY</div>
          <p className="mt-3 text-sm leading-7 text-neutral-200">この権限は企業ページ作成支援専用です。研究者側の相談画面や研究者の非公開情報にはアクセスしません。</p>
        </section>

        <div className="text-center">
          <Link href="/" className="text-xs font-semibold text-neutral-400 underline underline-offset-4">PARARIへ戻る</Link>
        </div>
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-neutral-50 px-4 py-16"><div className="mx-auto max-w-lg rounded-[2rem] border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">{children}</div></main>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
