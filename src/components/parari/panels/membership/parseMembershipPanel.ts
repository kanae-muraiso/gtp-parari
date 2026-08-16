// apps/tools/parari/src/components/parari/panels/membership/parseMembershipPanel.ts
// 2026-08-13 JST
// PART: MEMBERSHIP Panel parser
//
// コメント:
// - canonical:
//     [MEMBERSHIP] recruitmentId="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
// - 将来の表記変更や手入力にも少し耐えられるよう互換表記も読む

import type { MembershipPanelData } from "./membershipTypes";

const UUID_RE =
  "[0-9a-fA-F]{8}-" +
  "[0-9a-fA-F]{4}-" +
  "[0-9a-fA-F]{4}-" +
  "[0-9a-fA-F]{4}-" +
  "[0-9a-fA-F]{12}";

export function parseMembershipPanel(
  raw: string,
): MembershipPanelData {
  const text = String(raw ?? "").trim();

  if (!text) {
    return {
      recruitmentId: null,
    };
  }

  const patterns = [
    // canonical
    new RegExp(
      `^\\[MEMBERSHIP\\]\\s+recruitmentId\\s*=\\s*"(${UUID_RE})"\\s*$`,
      "i",
    ),

    // compatibility
    new RegExp(
      `^\\[MEMBERSHIP\\s+id\\s*:\\s*(${UUID_RE})\\]\\s*$`,
      "i",
    ),

    new RegExp(
      `^\\[MEMBERSHIP\\s+id\\s*=\\s*"(${UUID_RE})"\\]\\s*$`,
      "i",
    ),

    new RegExp(
      `^\\[MEMBERSHIP\\s+recruitmentId\\s*=\\s*"(${UUID_RE})"\\]\\s*$`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return {
        recruitmentId: match[1],
      };
    }
  }

  return {
    recruitmentId: null,
  };
}
