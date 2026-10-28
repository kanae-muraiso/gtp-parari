// src/components/parari/navigation/MyAreaHeader.tsx
// 2026/10/28 JST
//
// PARARI共通ヘッダー
// - 左上の PARARI から利用環境を切り替える
// - 制作環境を持つユーザーだけ、右上に常設の「作成」を表示する
// - アカウント操作は右上のプルダウンへまとめる

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

  const isStudio = resolvedArea === "studio";

  return (
    <>
      {resolvedArea === "library" || resolvedArea === "studio" ? (
        <WorkspaceVisitTracker workspace={resolvedArea} />
      ) : null}

      <div
        className={[
          "rounded-2xl border px-4 py-3",
          isStudio
            ? "border-neutral-300 bg-neutral-100"
            : "border-neutral-200 bg-white",
        ].join(" ")}
      >
        <WorkspaceLinks area={resolvedArea} />

        <h1 className="mt-4 text-xl font-bold text-neutral-950">
          {title}
        </h1>
      </div>
    </>
  );
}
