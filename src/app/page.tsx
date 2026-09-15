// src/app/page.tsx
// 2026/09/15 JST

"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type StartDestination = "library" | "studio" | "last";
type Workspace = "library" | "studio";

type ExperienceRow = {
  studio_enabled: boolean | null;
};

function resolveDestination(
  startDestination: StartDestination,
  lastWorkspace: Workspace,
  studioEnabled: boolean,
) {
  if (!studioEnabled) return "/mypage";

  if (startDestination === "studio") return "/my/works";
  if (startDestination === "last") {
    return lastWorkspace === "studio" ? "/my/works" : "/mypage";
  }

  return "/mypage";
}

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    async function checkAuthAndRedirect() {
      if (!supabase) {
        if (mounted) setChecking(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        setChecking(false);
        return;
      }

      const [{ data: experienceData }, { data: preferenceData }] =
        await Promise.all([
          supabase.rpc("get_my_parari_experience"),
          supabase
            .from("user_workspace_preferences")
            .select("start_destination,last_workspace")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

      if (!mounted) return;

      const experience = (Array.isArray(experienceData)
        ? experienceData[0]
        : experienceData) as ExperienceRow | null;

      const studioEnabled = Boolean(experience?.studio_enabled);

      const rawStart = String(preferenceData?.start_destination ?? "library");
      const startDestination: StartDestination =
        rawStart === "studio" || rawStart === "last" ? rawStart : "library";

      const rawLast = String(preferenceData?.last_workspace ?? "library");
      const lastWorkspace: Workspace =
        rawLast === "studio" ? "studio" : "library";

      router.replace(
        resolveDestination(startDestination, lastWorkspace, studioEnabled),
      );
    }

    void checkAuthAndRedirect();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (checking) {
    return <main className="min-h-screen bg-white" />;
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-neutral-900">
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm tracking-[0.28em] text-neutral-500">
          PARARI
        </p>

        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          PARARI（パラリ）
        </h1>

        <p className="mt-6 text-lg leading-8 text-neutral-700">
          写真と文章でページを作り、束ねて1冊の本にできる
          デジタル・コミュニケーションツールです。
        </p>

        <p className="mt-4 text-base leading-8 text-neutral-600">
          ぱらりと読めて、きちんと届く。SNSでは流れてしまう想いや案内を、
          ひとつのURLにまとめて届けられます。
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white"
          >
            ログイン・登録
          </Link>

          <Link
            href="https://parari.cpp.co.jp/"
            className="rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-800"
          >
            パラリとは？
          </Link>
        </div>
      </section>
    </main>
  );
}
