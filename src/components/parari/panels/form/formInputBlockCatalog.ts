// src/components/parari/panels/form/formInputBlockCatalog.ts
//
// FORM input block catalog
//
// FORM屋さんが提供する入力Blockの商品台帳。
// APPLICATIONなどの利用側は、このカタログから必要なBlockを選ぶ。

export const FORM_INPUT_BLOCK_CATALOG = [
  { kind: "name", label: "氏名" },
  { kind: "email", label: "メールアドレス" },
  { kind: "tel", label: "電話番号" },
  { kind: "postalCode", label: "郵便番号" },
  { kind: "address", label: "住所" },
  { kind: "text", label: "一行テキスト" },
  { kind: "textarea", label: "長文" },
  { kind: "checkbox", label: "チェックボックス" },
  { kind: "radio", label: "ラジオボタン" },
  { kind: "select", label: "プルダウン" },
  { kind: "date", label: "日付" },
  { kind: "datetime", label: "日時" },
] as const;

export type FormInputBlockKind =
  (typeof FORM_INPUT_BLOCK_CATALOG)[number]["kind"];
