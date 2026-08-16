// apps/tools/parari/src/app/editor/profile/page.tsx
// 2026-04-06 JST

"use client";

/**
 * PART: Editor Profile Redirect
 * コメント:
 * - /editor/profile をプロフィール編集入口にする
 * - 既存の /my/profile にリダイレクト
 */

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function EditorProfilePage() {
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

      router.replace("/my/profile");
    }

    void checkAuthAndRedirect();

    return () => {
      mounted = false;
    };
  }, [router]);

  return <main className="min-h-screen bg-white" />;
}
