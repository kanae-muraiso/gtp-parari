// apps/tools/parari/src/components/parari/panels/application/templates.ts
// src/components/parari/panels/application/templates.ts
// 2026-08-15 JST
//
// APPLICATION v2
// 募集タイプ別の初期テンプレート
//
// テンプレートは「完成品」ではない。
// 作者は項目名変更・削除・追加ができる。
// keyだけは標準項目の意味として保持する。

import type {
  ApplicationField,
  ApplicationType,
} from "./applicationTypes";

type TemplateField = Omit<
  ApplicationField,
  "id" | "value"
>;

const TEMPLATE_FIELDS: Record<
  ApplicationType,
  TemplateField[]
> = {
  EVENT: [
    {
      key: "starts_at",
      label: "開催日時",
      type: "datetime",
      required: false,
    },
    {
      key: "location",
      label: "場所",
      type: "text",
      required: false,
    },
    {
      key: "capacity",
      label: "定員",
      type: "number",
      required: false,
    },
    {
      key: "fee",
      label: "参加費",
      type: "money",
      required: false,
    },
    {
      key: "deadline",
      label: "募集締切",
      type: "datetime",
      required: false,
    },
    {
      key: "eligibility",
      label: "参加条件",
      type: "textarea",
      required: false,
    },
  ],

  RECRUITMENT: [
    {
      key: "position",
      label: "職種",
      type: "text",
      required: false,
    },
    {
      key: "location",
      label: "勤務地",
      type: "text",
      required: false,
    },
    {
      key: "employment_type",
      label: "雇用形態",
      type: "text",
      required: false,
    },
    {
      key: "compensation",
      label: "給与・報酬",
      type: "text",
      required: false,
    },
    {
      key: "eligibility",
      label: "応募資格",
      type: "textarea",
      required: false,
    },
    {
      key: "deadline",
      label: "応募締切",
      type: "datetime",
      required: false,
    },
  ],

  SCHOOL: [
    {
      key: "starts_at",
      label: "開始日",
      type: "date",
      required: false,
    },
    {
      key: "schedule",
      label: "開催日時・曜日",
      type: "text",
      required: false,
    },
    {
      key: "location",
      label: "開催場所",
      type: "text",
      required: false,
    },
    {
      key: "capacity",
      label: "定員",
      type: "number",
      required: false,
    },
    {
      key: "fee",
      label: "受講料",
      type: "money",
      required: false,
    },
    {
      key: "eligibility",
      label: "対象",
      type: "textarea",
      required: false,
    },
  ],

  CONTEST: [
    {
      key: "theme",
      label: "募集テーマ",
      type: "text",
      required: false,
    },
    {
      key: "deadline",
      label: "応募締切",
      type: "datetime",
      required: false,
    },
    {
      key: "eligibility",
      label: "応募資格",
      type: "textarea",
      required: false,
    },
    {
      key: "submission_rules",
      label: "作品条件",
      type: "textarea",
      required: false,
    },
    {
      key: "judging",
      label: "審査方法",
      type: "textarea",
      required: false,
    },
    {
      key: "result_date",
      label: "結果発表",
      type: "date",
      required: false,
    },
  ],

  VOLUNTEER: [
    {
      key: "starts_at",
      label: "活動日時",
      type: "datetime",
      required: false,
    },
    {
      key: "location",
      label: "集合場所",
      type: "text",
      required: false,
    },
    {
      key: "capacity",
      label: "募集人数",
      type: "number",
      required: false,
    },
    {
      key: "eligibility",
      label: "参加条件",
      type: "textarea",
      required: false,
    },
    {
      key: "bring",
      label: "持ち物",
      type: "textarea",
      required: false,
    },
    {
      key: "deadline",
      label: "募集締切",
      type: "datetime",
      required: false,
    },
  ],

  OTHER: [
    {
      key: null,
      label: "募集内容",
      type: "textarea",
      required: false,
    },
    {
      key: "deadline",
      label: "募集締切",
      type: "datetime",
      required: false,
    },
  ],
};

export const APPLICATION_TYPE_LABELS: Record<
  ApplicationType,
  string
> = {
  EVENT: "イベント・参加募集",
  RECRUITMENT: "採用・人材募集",
  SCHOOL: "教室・講座募集",
  CONTEST: "コンテスト・作品募集",
  VOLUNTEER: "ボランティア募集",
  OTHER: "その他の募集",
};

export const APPLICATION_DEFAULT_ACTION_LABELS: Record<
  ApplicationType,
  string
> = {
  EVENT: "参加する",
  RECRUITMENT: "応募する",
  SCHOOL: "受講を申し込む",
  CONTEST: "作品を応募する",
  VOLUNTEER: "参加を申し込む",
  OTHER: "申し込む",
};

export function createApplicationTemplate(
  type: ApplicationType,
): ApplicationField[] {
  return TEMPLATE_FIELDS[type].map(
    (field) => ({
      id: crypto.randomUUID(),
      ...field,
      value: "",
    }),
  );
}
