// src/components/parari/navigation/MyAreaHeader.tsx
// 2026/08/18 JST
//
// PARARI利用者エリア共通ヘッダー

import ManagementLinks from "@/components/parari/navigation/ManagementLinks";

type MyAreaHeaderProps = {
  title: string;
};

export default function MyAreaHeader({
  title,
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

      <ManagementLinks />
    </div>
  );
}
