"use client";

import Link from "next/link";
import { useRef } from "react";
import { ParticipationMenu } from "./ParticipationNav";
import LogoutButton from "./LogoutButton";

import useParariExperience from "@/components/parari/hooks/useParariExperience";
import useParariStaff from "@/components/parari/hooks/useParariStaff";

type WorkspaceLinksProps = {
  area: "library" | "studio" | "settings" | "operations";
};

function menuLinkClass(active: boolean) {
  return [
    "block rounded-xl px-3 py-2.5 text-sm font-bold transition",
    active
      ? "bg-neutral-950 text-white"
      : "text-neutral-700 hover:bg-neutral-100",
  ].join(" ");
}

export default function WorkspaceLinks({ area }: WorkspaceLinksProps) {
  const { studioEnabled } = useParariExperience();
  const { isStaff } = useParariStaff();
  const accountMenu = useRef<HTMLDetailsElement>(null);

  const closeAccountMenu = () => {
    if (accountMenu.current) accountMenu.current.open = false;
  };

  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="shrink-0">
        <Link
          href={
            area === "library" && studioEnabled
              ? "/my/works"
              : area === "studio"
                ? "/mypage"
                : studioEnabled
                  ? "/my/works"
                  : "/mypage"
          }
          title={
            area === "library" && studioEnabled
              ? "STUDIO・作品リストへ"
              : area === "studio"
                ? "LIBRARYへ"
                : studioEnabled
                  ? "STUDIO・作品リストへ"
                  : "LIBRARYへ"
          }
          className={[
            "inline-flex items-center rounded-lg px-2 py-1.5 text-sm font-black tracking-[0.18em] transition",
            area === "library"
              ? "text-[#5B8DB8] hover:bg-[#5B8DB8]/10"
              : area === "studio"
                ? "bg-[#D49A3A] text-[#FFF8E8] shadow-sm hover:bg-[#C98C2F]"
                : "text-neutral-950 hover:bg-neutral-100",
          ].join(" ")}
        >
          PARARI
        </Link>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-2">
        <ParticipationMenu />

        {studioEnabled ? (
          <Link
            href="/editor/quick"
            className="inline-flex shrink-0 rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-800"
          >
            作成
          </Link>
        ) : null}

        <div className="relative shrink-0">
          <details ref={accountMenu}>
            <summary className="cursor-pointer list-none rounded-full bg-white px-3 py-2 text-xs font-bold text-neutral-600 ring-1 ring-neutral-200 transition hover:bg-neutral-50">
              アカウント <span aria-hidden="true">▾</span>
            </summary>
            <div className="absolute right-0 top-full z-[10000] mt-2 w-44 rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
              <Link
                href="/my/settings"
                onClick={closeAccountMenu}
                className={menuLinkClass(area === "settings")}
                aria-current={area === "settings" ? "page" : undefined}
              >
                設定
              </Link>
              {isStaff ? (
                <Link
                  href="/my/operations"
                  onClick={closeAccountMenu}
                  className={menuLinkClass(area === "operations")}
                  aria-current={area === "operations" ? "page" : undefined}
                >
                  OPERATIONS
                </Link>
              ) : null}
              <div className="mt-1 border-t border-neutral-100 pt-2">
                <LogoutButton />
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
