"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

type Summary = {
  researchers_total: number;
  researchers_public: number;
  researchers_new_7d: number;
  companies_total: number;
  companies_public: number;
  companies_new_7d: number;
  recruitments_total: number;
  recruitments_published: number;
  active_company_codes: number;
};

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-bold tracking-[0.08em] text-neutral-400">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-neutral-950">{value}</div>
      <div className="mt-1 text-xs leading-5 text-neutral-500">{note}</div>
    </div>
  );
}

export default function CppOperationsDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!supabase) return;
      const { data, error: loadError } = await supabase.rpc(
        "get_cpp_operations_summary",
      );

      if (!mounted) return;

      if (loadError) {
        setError(loadError.message);
      } else {
        const row = (Array.isArray(data) ? data[0] : data) as Summary | null;
        setSummary(row);
      }
      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-3xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
        CPPの状況を読み込んでいます…
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        CPPの状況を読み込めませんでした。{error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 text-xs font-bold tracking-[0.14em] text-neutral-400">
          今日の確認
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="研究者"
            value={summary.researchers_total}
            note={`公開 ${summary.researchers_public} / 直近7日 +${summary.researchers_new_7d}`}
          />
          <StatCard
            label="企業"
            value={summary.companies_total}
            note={`公開 ${summary.companies_public} / 直近7日 +${summary.companies_new_7d}`}
          />
          <StatCard
            label="募集"
            value={summary.recruitments_total}
            note={`公開中 ${summary.recruitments_published}`}
          />
          <StatCard
            label="企業登録コード"
            value={summary.active_company_codes}
            note="未使用・有効期限内"
          />
        </div>
      </section>

      <section>
        <div className="mb-3 text-xs font-bold tracking-[0.14em] text-neutral-400">
          メンテナンス
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/my/cpp"
            className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:bg-neutral-50"
          >
            <div className="text-sm font-bold text-neutral-950">CPP画面を開く</div>
            <p className="mt-1 text-xs leading-6 text-neutral-500">
              研究者プロフィールやCPPの通常画面を確認します。
            </p>
          </Link>

          <Link
            href="/my/cpp/admin/company-codes"
            className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:bg-neutral-50"
          >
            <div className="text-sm font-bold text-neutral-950">企業登録コード</div>
            <p className="mt-1 text-xs leading-6 text-neutral-500">
              企業向け登録コードの発行・確認を行います。
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
