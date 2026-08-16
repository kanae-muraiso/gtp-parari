// apps/tools/parari/src/components/parari/panels/membership/membershipTypes.ts
// 2026-08-13 JST
// PART: MEMBERSHIP Panel types
//
// コメント:
// - SSOTには recruitmentId だけを持つ
// - Membership本体・会員情報はDB側に持つ
// - recruitmentId = 「どの入会窓口か」を示すユニークID

export type MembershipPanelData = {
  recruitmentId: string | null;
};
