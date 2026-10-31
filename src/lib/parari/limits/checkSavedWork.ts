// src/lib/parari/limits/checkSavedWork.ts
// 2026-10-31 JST — PART: Validate all referenced PAGEs before publication/export.
import { loadEpubSource } from "@/lib/parari/epub/loadEpubSource";
import { contentIssues } from "./workLimits";
import type { PlanEntitlements } from "@/lib/billing/plan";
export async function checkSavedWork(work: {id:string;owner:string;content:string|null}, limits: PlanEntitlements): Promise<string[]> {
  const source = await loadEpubSource(work.content ?? "", work.owner);
  return contentIssues(source, limits);
}
