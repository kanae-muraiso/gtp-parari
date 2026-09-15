// src/components/parari/navigation/ManagementLinks.tsx
// 2026/09/15 JST
//
// LIBRARY から設定 / STUDIO へ移動する入口。
// STUDIO は本人が有効にするか、既存の制作・運営データがある場合だけ表示する。

"use client";

import Link from "next/link";

import useParariExperience from "@/components/parari/hooks/useParariExperience";

export default function ManagementLinks() {
  const { studioEnabled } = useParariExperience();

  return (
    <div className="flex items-center gap-4">
      {studioEnabled ? (
        <Link
          href="/my/works"
          className="text-xs font-bold tracking-[0.08em] text-neutral-500 transition hover:text-neutral-950"
        >
          STUDIO
        </Link>
      ) : null}

      <Link
        href="/my/profile"
        className="text-xs font-bold text-neutral-500 transition hover:text-neutral-950"
      >
        設定
      </Link>
    </div>
  );
}
