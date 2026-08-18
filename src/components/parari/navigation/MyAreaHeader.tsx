// src/components/parari/navigation/MyAreaHeader.tsx
// src/components/parari/navigation/MyAreaHeader.tsx
// 2026/08/18 JST
//
// PARARI共通ヘッダー
//
// 利用者側:
//   右上に管理側への入口を表示
//
// 管理側:
//   ManagementTabsを使うため管理リンクは表示せず、
//   代わりに「利用に戻る」を表示する

import Link from "next/link";

import ManagementLinks from "@/components/parari/navigation/ManagementLinks";

type MyAreaHeaderProps = {
  title: string;
  showManagementLinks?: boolean;
};

export default function MyAreaHeader({
  title,
  showManagementLinks = true,
}: MyAreaHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
          PARARI
        </div>

        <h1 className="mt-1 text-xl font-bold text-neutral-950">
          {title}
        </h1>
      </div>

      {showManagementLinks ? (
        <ManagementLinks />
      ) : (
        <Link
          href="/mypage"
          className="rounded-full bg-white px-4 py-2 text-xs font-bold text-neutral-700 shadow-sm ring-1 ring-neutral-200 transition hover:bg-neutral-50"
        >
          HOME
        </Link>
      )}
    </div>
  );
}
