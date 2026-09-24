// src/components/parari/navigation/MyAreaHeader.tsx
// 2026/09/15 JST
//
// PARARI共通ヘッダー
// - 利用側は LIBRARY
// - 制作・運営側は STUDIO
// - 設定は両方から使う共通領域
// - OPERATIONS は運営スタッフ専用領域

import LogoutButton from "@/components/parari/navigation/LogoutButton";
import WorkspaceLinks from "@/components/parari/navigation/WorkspaceLinks";
import WorkspaceVisitTracker from "@/components/parari/navigation/WorkspaceVisitTracker";

type WorkspaceArea = "library" | "studio" | "settings" | "operations";

type MyAreaHeaderProps = {
  title: string;
  showManagementLinks?: boolean;
  area?: WorkspaceArea;
};

export default function MyAreaHeader({
  title,
  showManagementLinks = true,
  area,
}: MyAreaHeaderProps) {
  const resolvedArea: WorkspaceArea =
    area ?? (showManagementLinks ? "library" : "studio");

  const areaLabel =
    resolvedArea === "settings"
      ? "PARARI"
      : resolvedArea === "operations"
        ? "PARARI · OPERATIONS"
        : resolvedArea === "library"
          ? "PARARI · LIBRARY · 読む・参加する"
          : "PARARI · STUDIO · 制作・編集";

  const isStudio =
    resolvedArea === "studio";

  return (
    <>
      {resolvedArea === "library" || resolvedArea === "studio" ? (
        <WorkspaceVisitTracker workspace={resolvedArea} />
      ) : null}

      <div
        className={[
          "flex items-start justify-between gap-4 rounded-2xl border px-4 py-3",
          isStudio
            ? "border-neutral-300 bg-neutral-100"
            : "border-neutral-200 bg-white",
        ].join(" ")}
      >
        <div>
          <div
            className={[
              "text-xs font-bold tracking-[0.18em]",
              isStudio
                ? "text-neutral-600"
                : "text-neutral-400",
            ].join(" ")}
          >
            {areaLabel}
          </div>

          <h1 className="mt-1 text-xl font-bold text-neutral-950">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <WorkspaceLinks area={resolvedArea} />
          <LogoutButton />
        </div>
      </div>
    </>
  );
}
