// src/app/[username]/pages/[workId]/edit/page.tsx
// 2026-10-07 19:30 JST
// PART: Route old PAGE edit links to the canonical editor and its ownership checks
import { redirect } from "next/navigation";

export default async function LegacyPageEdit({
  params,
}: {
  params: Promise<{ username: string; workId: string }>;
}) {
  const { workId } = await params;
  redirect(`/editor-v2/${encodeURIComponent(workId)}`);
}
