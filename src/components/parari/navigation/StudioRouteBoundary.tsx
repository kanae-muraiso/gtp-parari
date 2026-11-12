"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import useParariExperience from "@/components/parari/hooks/useParariExperience";

// A workspace UI boundary; API permissions are governed by their own checks.
const STUDIO_PATH_PREFIXES = [
  "/my/works",
  "/my/manage",
  "/my/sales",
  "/my/author-library-settings",
  "/my/settings/seller",
  "/editor",
  "/editor-v2",
  "/writing",
] as const;

export function isStudioWorkspacePath(path: string) {
  // The blank quick editor is a try-before-activation space. No work is created
  // until meaningful content is saved; the save then activates STUDIO.
  if (path === "/editor/quick") return false;
  return STUDIO_PATH_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

function StudioOnly({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { studioEnabled, loading } = useParariExperience();

  useEffect(() => {
    if (!loading && !studioEnabled) router.replace("/my/bookshelf");
  }, [loading, studioEnabled, router]);

  // Do not mount STUDIO pages or trigger their data fetching until the user opts in.
  if (loading || !studioEnabled) {
    return (
      <main className="mx-auto min-h-screen max-w-xl px-5 py-16 text-sm text-neutral-600" role="status">
        {loading ? "利用できる環境を確認しています…" : "LIBRARYに移動しています…"}
      </main>
    );
  }

  return <>{children}</>;
}

export default function StudioRouteBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return isStudioWorkspacePath(pathname) ? <StudioOnly>{children}</StudioOnly> : <>{children}</>;
}
