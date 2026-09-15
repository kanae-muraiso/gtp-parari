// src/components/parari/navigation/MyAreaHeader.tsx
// 2026/09/15 JST
//
// PARARI共通ヘッダー
// - 利用側は LIBRARY
// - 制作・運営側は STUDIO
// - 設定は両方から使う共通領域

import LogoutButton from "@/components/parari/navigation/LogoutButton";
import WorkspaceLinks from "@/components/parari/navigation/WorkspaceLinks";
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
  const area = isSettings
    ? "settings"
    : showManagementLinks
      ? "library"
      : "studio";

  const areaLabel =
    area === "settings"
      ? "PARARI"
      : area === "library"
        ? "PARARI · LIBRARY"
        : "PARARI · STUDIO";

  return (
    <>
      {area !== "settings" ? (
        <WorkspaceVisitTracker workspace={area} />
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

        <div className="flex items-center gap-4">
          <WorkspaceLinks area={area} />
          <LogoutButton />
        </div>
      </div>
    </>
  );
}
