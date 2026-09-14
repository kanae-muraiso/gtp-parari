"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

export default function CppCompanySupportModeBanner() {
  const supabase = useMemo(() => sharedSupabase, []);
  const [isConsultant, setIsConsultant] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      const { data } = await supabase
        .from("cpp_company_members")
        .select("role")
        .eq("user_id", authData.user.id)
        .limit(1);
      setIsConsultant((data ?? [])[0]?.role === "consultant");
    })();
  }, [supabase]);

  if (!isConsultant) return null;

  return (
    <div className="sticky top-0 z-40 border-b border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-bold">CPP COMPANY サポーターモード</span>
          <span className="ml-2 text-xs">企業担当者と同じWORKBOOKを共同編集しています。公開状態・owner権限は変更できません。</span>
        </div>
        <Link href="/my/cpp/consultant" className="rounded-full bg-white px-4 py-2 text-xs font-bold text-sky-900 ring-1 ring-sky-200">担当企業を切り替える</Link>
      </div>
    </div>
  );
}
