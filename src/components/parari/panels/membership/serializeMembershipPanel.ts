// apps/tools/parari/src/components/parari/panels/membership/serializeMembershipPanel.ts
// 2026-08-13 JST
// PART: MEMBERSHIP Panel serializer
//
// コメント:
// - SSOTには recruitmentId の参照だけを書く
// - Membership名、説明、会員情報などはDBに持つ

import type { MembershipPanelData } from "./membershipTypes";

export function serializeMembershipPanel(
  data: MembershipPanelData,
): string {
  const recruitmentId = String(data.recruitmentId ?? "").trim();

  if (!recruitmentId) {
    return "[MEMBERSHIP]";
  }

  return `[MEMBERSHIP] recruitmentId="${recruitmentId}"`;
}
