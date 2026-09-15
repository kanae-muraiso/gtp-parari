"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import useParariStaff from "@/components/parari/hooks/useParariStaff";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import ParariTabs from "@/components/parari/navigation/ParariTabs";
import CppOperationsDashboard from "@/components/parari/operations/CppOperationsDashboard";
import ParariAnnouncementsAdmin from "@/components/parari/operations/ParariAnnouncementsAdmin";

type OperationsMode = "parari" | "cpp";

export default function OperationsPage() {
  const router = useRouter();
  const {
    isStaff,
    isSuperuser,
    canParari,
    canCpp,
    loading,
  } = useParariStaff();
  const [mode, setMode] = useState<OperationsMode>("parari");

  const tabs = useMemo(() => {
    const items: Array<{ key: OperationsMode; label: string }> = [];
    if (canParari) items.push({ key: "parari", label: "PARARI" });
    if (canCpp) items.push({ key: "cpp", label: "CPP" });
    return items;
  }, [canParari, canCpp]);

  useEffect(() => {
    if (loading) return;

    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tab");

    if (requested === "cpp" && canCpp) {
      setMode("cpp");
      return;
    }

    if (requested === "parari" && canParari) {
      setMode("parari");
      return;
    }

    if (canParari) {
      setMode("parari");
      return;
    }

    if (canCpp) setMode("cpp");
  }, [loading, canParari, canCpp]);

  function changeMode(next: OperationsMode) {
    if (next === "parari" && !canParari) return;
    if (next === "cpp" && !canCpp) return;

    setMode(next);
    router.replace(`/my/operations?tab=${next}`, { scroll: false });
  }

  if (loading) {
    return <main className="min-h-screen bg-neutral-50" />;
  }

  if (!isStaff) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="text-lg font-bold text-neutral-950">アクセスできません</div>
          <p className="mt-2 text-sm text-neutral-500">
            この画面は運営担当者専用です。
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="OPERATIONS" area="operations" />

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <ParariTabs
              items={tabs}
              active={mode}
              onChange={(key) => changeMode(key as OperationsMode)}
            />
          </div>

          {isSuperuser ? (
            <Link
              href="/my/operations/admin"
              className="shrink-0 rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
            >
              運営資格管理
            </Link>
          ) : null}
        </div>

        <div className="mt-8">
          {mode === "parari" && canParari ? (
            <ParariAnnouncementsAdmin />
          ) : null}

          {mode === "cpp" && canCpp ? (
            <CppOperationsDashboard />
          ) : null}
        </div>
      </div>
    </main>
  );
}
