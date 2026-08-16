// apps/tools/parari/src/components/parari/panels/membership/membershipDefinition.ts
// 2026-08-13 JST
// PART: MEMBERSHIP PanelDefinition
//
// コメント:
// - MEMBERSHIPを正式なPanelDefinitionとして登録する
// - SSOTには recruitmentId だけを保存する
// - Membership本体・会員・仮登録はDB/API側で扱う

import type { PanelDefinition } from "../panelDefinitionTypes";
import type { MembershipPanelData } from "./membershipTypes";
import MembershipPanelEditor from "./MembershipPanelEditor";
import MembershipPanelRenderer from "./MembershipPanelRenderer";
import { parseMembershipPanel } from "./parseMembershipPanel";
import { serializeMembershipPanel } from "./serializeMembershipPanel";

export const membershipDefinition: PanelDefinition<MembershipPanelData> = {
  tag: "MEMBERSHIP",

  label: "MEMBERSHIP",

  description:
    "Membershipへの会員登録・PARARIユーザー登録を行うパネル",

  parse: (raw) => {
    return parseMembershipPanel(raw);
  },

  serialize: (data) => {
    return serializeMembershipPanel(data);
  },

  Editor: MembershipPanelEditor,

  Renderer: MembershipPanelRenderer,
};
