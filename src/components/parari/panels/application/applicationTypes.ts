// apps/tools/parari/src/components/parari/panels/application/applicationTypes.ts
// src/components/parari/panels/application/applicationTypes.ts
// 2026-08-15 JST
//
// APPLICATION v2 共通型

import type {
  FormInputBlockKind,
} from "@/components/parari/panels/form/formInputBlockCatalog";

export type ApplicationType =
  | "EVENT"
  | "RECRUITMENT"
  | "SCHOOL"
  | "CONTEST"
  | "VOLUNTEER"
  | "OTHER";

export type ApplicationAcceptanceMode =
  | "instant"
  | "approval";

export type ApplicationMode =
  | "lite"
  | "builder";

export type ApplicationFieldType =
  | "text"
  | "textarea"
  | "date"
  | "datetime"
  | "number"
  | "money"
  | "url";

export type ApplicationField = {
  id: string;

  // PARARIが意味を理解できる標準項目なら固定keyを持つ。
  // 作者独自項目なら null。
  key: string | null;

  label: string;

  type: ApplicationFieldType;

  value: string;

  required: boolean;
};

export type ApplicationInputFieldKind =
  FormInputBlockKind;

export type ApplicationInputField = {
  id: string;
  kind: ApplicationInputFieldKind | null;
  label: string;
  required: boolean;
};

export type ApplicationFieldBlock = {
  id: string;
  type: "field";
  fieldId: string;
};

export type ApplicationFormBlock = {
  id: string;
  type: "form";
  fieldIds: string[];
};

export type ApplicationCalendarBlock = {
  id: string;
  type: "calendar";
  calendarItemId: string;
};

export type ApplicationMembershipBlock = {
  id: string;
  type: "membership";
  membershipId: string;
};

export type ApplicationBlock =
  | ApplicationFieldBlock
  | ApplicationFormBlock
  | ApplicationCalendarBlock
  | ApplicationMembershipBlock;

export type ApplicationDefinitionData = {
  // APPLICATIONの編集モード。
  // 既存APPLICATIONとの互換のためoptional。
  // mode未設定の既存データはBuilderとして扱う。
  mode?: ApplicationMode;

  // 新APPLICATION:
  // FORM / CALENDAR / MEMBERSHIPなどの約束要素を、
  // APPLICATION内で表示・実行する順番に並べる。
  blocks?: ApplicationBlock[];

  // APPLICATION Proで相手に入力してもらう項目。
  // 既存のdefinition.fields（定員・締切等）とは別物。
  inputFields?: ApplicationInputField[];

  // 旧APPLICATION互換。
  // manual APPLICATIONの新規作成では使用しない。
  // calendar-origin等の現役経路を移行するまで残す。
  fields: ApplicationField[];

  // 応募・参加ボタンを押す前に提示する確認・同意事項
  agreement?: string;

  // 「参加する」「応募する」など
  actionLabel?: string;
};

export type ApplicationPanelData = {
  applicationId: string | null;
};
