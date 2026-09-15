import fs from "node:fs";

const path = "docs/APPLICATION.md";
let source = fs.readFileSync(path, "utf8");

source = source.replace(
  "F. guest / member 共通の submit service を作る                         次\nG. 参加者画面を小コンポーネントへ分割",
  "F. guest / member 共通の submit service を作る                         完了\nG. 参加者画面を小コンポーネントへ分割                                  次",
);

const apiNeedle = "- `occurrence-participants` — 開催回の参加者\n\n## 8. 主なDBテーブル";
const apiReplacement = "- `occurrence-participants` — 開催回の参加者\n\n### 共通申込サービス\n\n`src/features/application/server/submitApplication.ts`\n\n- guest / member 共通の募集取得、開催回検証、重複確認、FORM確認、定員確認、snapshot、entry作成\n- `/api/application/guest-submit` と `/api/application/submit` は identity を渡す薄いadapter\n- manual CALENDAR block も両経路で同じ開催回解決を使う\n\n`src/features/application/server/submissionDefinition.ts`\n\n- APPLICATION definition の読み取り、入力回答検証、CALENDAR block抽出、締切・定員の補助処理\n\n## 8. 主なDBテーブル";

if (!source.includes(apiNeedle)) {
  throw new Error("Could not find shared submit insertion point");
}
source = source.replace(apiNeedle, apiReplacement);

source = source.replace(
  "### D. ゲスト申込と登録ユーザー申込のロジックが重複\n\n`guest-submit` と `submit` に似た検証があり、差が生じやすい状態です。\n\n### E. manual CALENDAR block の経路に非対称が残っている\n\nゲスト側は manual CALENDAR block を開催回予約として扱えますが、登録ユーザー側の submit 経路には古い処理が残っています。\nこれは機能追加前に共有 submit service へ寄せて解消します。",
  "### D. submit経路の共通化は完了\n\n`guest-submit` と `submit` は共通の `submitApplication()` を利用します。identity 固有の処理だけroute側に残しています。\n\n### E. manual CALENDAR block の非対称は解消済み\n\nゲスト / 登録ユーザーとも、APPLICATION内のCALENDAR blockから同じ開催回解決ロジックを利用します。",
);

fs.writeFileSync(path, source);
