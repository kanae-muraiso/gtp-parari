// src/components/parari/navigation/MyAreaHeader.tsx
// 2026/09/15 JST
//
// PARARI共通ヘッダー
// - 利用側は LIBRARY
// - 制作・運営側は STUDIO
// - 設定は両方から使う共通領域
// - LIBRARY / STUDIO を開いたときは最後に使った環境を記録する

import Link from "next/link";

import ManagementLinks from "@/components/parari/navigation/ManagementLinks";
import LogoutButton from "@/components/parari/navigation/LogoutButton";
import WorkspaceVisitTracker from "@/components/parari/navigation/WorkspaceVisitTracker";

type MyAreaHeaderProps = {
  title: string;
  showManagementLinks?: boolean;
};

export default function MyAreaHeader({
  title,
  showManagementLinks = true,
}: MyAreaHeaderProps) {
  const isSettings = title === "設定";
  const areaLabel = isSettings
    ? "PARARI"
    : showManagementLinks
      ? "PARARI · LIBRARY"
      : "PARARI · STUDIO";

  return (
    <>
      {!isSettings ? (
        <WorkspaceVisitTracker
          workspace={showManagementLinks ? "library" : "studio"}
        />
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
            {areaLabel}
          </div>

          <h1 className="mt-1 text-xl font-bold text-neutral-950">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {showManagementLinks ? (
            <ManagementLinks />
          ) : isSettings ? (
            <Link
              href="/mypage"
              className="rounded-full bg-white px-4 py-2 text-xs font-bold text-neutral-700 shadow-sm ring-1 ring-neutral-200 transition hover:bg-neutral-50"
            >
              LIBRARY
            </Link>
          ) : (
            <Link
              href="/mypage"
              className="rounded-full bg-white px-4 py-2 text-xs font-bold text-neutral-700 shadow-sm ring-1 ring-neutral-200 transition hover:bg-neutral-50"
            >
              LIBRARY
            </Link>
          )}

          <LogoutButton />
        </div>
      </div>
    </>
  );
}
