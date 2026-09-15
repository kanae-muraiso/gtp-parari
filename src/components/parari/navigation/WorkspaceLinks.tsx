"use client";

import Link from "next/link";

import useParariExperience from "@/components/parari/hooks/useParariExperience";
import useParariStaff from "@/components/parari/hooks/useParariStaff";

type WorkspaceLinksProps = {
  area: "library" | "studio" | "settings" | "operations";
};

const linkClass =
  "text-xs font-bold tracking-[0.06em] text-neutral-500 transition hover:text-neutral-950";

export default function WorkspaceLinks({ area }: WorkspaceLinksProps) {
  const { studioEnabled } = useParariExperience();
  const { isStaff } = useParariStaff();

  return (
    <div className="flex items-center gap-4">
      {area !== "library" ? (
        <Link href="/mypage" className={linkClass}>
          LIBRARY
        </Link>
      ) : null}

      {studioEnabled && area !== "studio" ? (
        <Link href="/my/works" className={linkClass}>
          STUDIO
        </Link>
      ) : null}

      {isStaff && area !== "operations" ? (
        <Link href="/my/operations" className={linkClass}>
          OPERATIONS
        </Link>
      ) : null}

      {area !== "settings" ? (
        <Link href="/my/settings" className={linkClass}>
          設定
        </Link>
      ) : null}
    </div>
  );
}
