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
//   ManagementTabsを使うため右上リンクは非表示にできる

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
      ) : null}
    </div>
  );
}
