"use client";

import Link from "next/link";

import useParariExperience from "@/components/parari/hooks/useParariExperience";
import useParariStaff from "@/components/parari/hooks/useParariStaff";

type WorkspaceLinksProps = {
  area: "library" | "studio" | "settings" | "operations";
};

function workspaceClass(active: boolean) {
  return [
    "rounded-full px-3 py-1.5 text-xs font-bold tracking-[0.06em] transition",
    active
      ? "bg-neutral-950 text-white"
      : "text-neutral-500 hover:bg-white hover:text-neutral-950",
  ].join(" ");
}

export default function WorkspaceLinks({ area }: WorkspaceLinksProps) {
  const { studioEnabled } = useParariExperience();
  const { isStaff } = useParariStaff();

  const isLibrary = area === "library";
  const isStudio = area === "studio";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full bg-neutral-100 p-1">
      <Link
        href="/mypage"
        className={workspaceClass(isLibrary)}
        aria-current={isLibrary ? "page" : undefined}
      >
        LIBRARY
      </Link>

      {studioEnabled ? (
        <Link
          href="/my/works"
          className={[
            workspaceClass(isStudio),
            isStudio
              ? ""
              : "hover:bg-emerald-50 hover:text-emerald-950",
          ].join(" ")}
          aria-current={isStudio ? "page" : undefined}
        >
          STUDIO
        </Link>
      ) : null}

      {isStaff && area !== "operations" ? (
        <Link
          href="/my/operations"
          className="rounded-full px-3 py-1.5 text-xs font-bold tracking-[0.06em] text-neutral-500 transition hover:bg-white hover:text-neutral-950"
        >
          OPERATIONS
        </Link>
      ) : null}

      {area !== "settings" ? (
        <Link
          href="/my/settings"
          className="rounded-full px-3 py-1.5 text-xs font-bold tracking-[0.06em] text-neutral-500 transition hover:bg-white hover:text-neutral-950"
        >
          設定
        </Link>
      ) : null}
    </div>
  );
}
