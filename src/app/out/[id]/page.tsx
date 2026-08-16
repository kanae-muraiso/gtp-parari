// apps/tools/parari/src/app/out/[id]/page.tsx
// 2026-03-31 JST

"use client";

/**
 * PART: Out Redirect
 * コメント:
 * - link marker (⟦lk:id|text⟧) の遷移先解決
 * - id → URL をDBから取得してブラウザ遷移
 * - Router action before initialization を回避するため
 *   next/navigation の redirect は使わない
 */

import React from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function OutPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "").trim();

  const [message, setMessage] = React.useState("リンク先を確認中…");

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!id) {
        if (!cancelled) {
          setMessage("リンクIDが見つかりませんでした。");
        }
        return;
      }

      const { data, error } = await supabase
        .from("parari_applications")
        .select("id, url")
        .eq("id", id)
        .single();

      if (cancelled) return;

      if (error || !data?.url) {
        setMessage("リンク先が見つかりませんでした。");
        return;
      }

      window.location.href = data.url;
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-6 py-16 text-sm text-neutral-600">
        {message}
      </div>
    </main>
  );
}
