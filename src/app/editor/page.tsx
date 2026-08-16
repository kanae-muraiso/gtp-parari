// apps/tools/parari/src/app/editor/page.tsx
// 2026-04-05 JST

"use client";

/**
 * PART: Editor Entry Redirect Page
 * コメント:
 * - /editor を作品管理画面の入口にする
 * - 既存の /my/works を生かしつつ、URLだけ /editor に寄せる第一段階
 */

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function EditorPage() {
  const router = useRouter();

  React.useEffect(() => {
    let mounted = true;

    async function checkAuthAndRedirect() {
      if (!supabase) {
        if (!mounted) return;
        router.replace("/login");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      router.replace("/my/works");
    }

    void checkAuthAndRedirect();

    return () => {
      mounted = false;
    };
  }, [router]);

  return <main className="min-h-screen bg-white" />;
}
