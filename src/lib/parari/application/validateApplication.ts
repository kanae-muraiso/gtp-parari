// apps/tools/parari/src/lib/parari/application/validateApplication.ts
// 2026-06-25 JST
// PART: APPLICATION validation helper
// コメント:
// - 公開前・申込前に最低限の不足を検出する
// - 重要4項目を空欄のまま公開しないための土台

type ValidateSource = {
  title?: unknown;
  important?: {
    datetimePlace?: unknown;
    pricePayment?: unknown;
    cancellation?: unknown;
    afterApplication?: unknown;
    safety?: unknown;
  } | null;
};

export type ApplicationValidationIssue = {
  key: string;
  message: string;
  level: "error" | "warning";
};

function isBlank(value: unknown): boolean {
  return String(value ?? "").trim().length === 0;
}

export function validateApplication(source: ValidateSource): ApplicationValidationIssue[] {
  const issues: ApplicationValidationIssue[] = [];
  const important = source.important ?? {};

  if (isBlank(source.title)) {
    issues.push({
      key: "title",
      message: "募集タイトルが未入力です。",
      level: "error",
    });
  }

  if (isBlank(important.datetimePlace)) {
    issues.push({
      key: "datetimePlace",
      message: "日時・場所が未入力です。",
      level: "error",
    });
  }

  if (isBlank(important.pricePayment)) {
    issues.push({
      key: "pricePayment",
      message: "料金・支払方法が未入力です。",
      level: "error",
    });
  }

  if (isBlank(important.cancellation)) {
    issues.push({
      key: "cancellation",
      message: "キャンセル条件が未入力です。あとでトラブルになりやすい項目です。",
      level: "error",
    });
  }

  if (isBlank(important.afterApplication)) {
    issues.push({
      key: "afterApplication",
      message: "申込後の流れが未入力です。",
      level: "error",
    });
  }

  return issues;
}
