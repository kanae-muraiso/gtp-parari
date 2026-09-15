"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import useParariStaff from "@/components/parari/hooks/useParariStaff";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import ParariTabs from "@/components/parari/navigation/ParariTabs";
import CppOperationsDashboard from "@/components/parari/operations/CppOperationsDashboard";
import ParariAnnouncementsAdmin from "@/components/parari/operations/ParariAnnouncementsAdmin";

type OperationsMode = "parari" | "cpp";

const TABS = [
  { key: "parari", label: "PARARI" },
  { key: "cpp", label: "CPP" },
];

export default function OperationsPage() {
  const router = useRouter();
  const { isStaff, loading } = useParariStaff();
  const [mode, setMode] = useState<OperationsMode>("parari");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "cpp") setMode("cpp");
  }, []);

  function changeMode(next: OperationsMode) {
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
            この画面はPARARI運営スタッフ専用です。
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="OPERATIONS" area="operations" />

        <div className="mt-6">
          <ParariTabs
            items={TABS}
            active={mode}
            onChange={(key) => changeMode(key as OperationsMode)}
          />
        </div>

        <div className="mt-8">
          {mode === "parari" ? (
            <ParariAnnouncementsAdmin />
          ) : (
            <CppOperationsDashboard />
          )}
        </div>
      </div>
    </main>
  );
}
