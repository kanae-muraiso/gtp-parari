// apps/tools/parari/src/components/parari/panels/application/applicationTypes.ts
// src/components/parari/panels/application/applicationTypes.ts
// 2026-08-15 JST
//
// APPLICATION v2 共通型

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

export type ApplicationDefinitionData = {
  fields: ApplicationField[];

  // 応募・参加ボタンを押す前に提示する確認・同意事項
  agreement?: string;

  // 「参加する」「応募する」など
  actionLabel?: string;
};

export type ApplicationPanelData = {
  applicationId: string | null;
};
