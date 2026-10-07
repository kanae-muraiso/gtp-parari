// src/app/[username]/pages/new/page.tsx
// 2026-10-07 19:30 JST
// PART: Keep old creation links on the canonical work creation path
import { redirect } from "next/navigation";

export default function LegacyNewPage() {
  redirect("/editor/new");
}
