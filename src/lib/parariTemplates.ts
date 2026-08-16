// src/lib/parariTemplates.ts
// src/lib/parariTemplates.ts
// 2026/06/10 09:43 JST

/**
 * PART: Parari Templates MVP
 * コメント:
 * - 新規作成時にBOOKINFO内から読み込むSSOTテンプレート
 * - MVPでは静的テンプレートだけを扱う
 * - APPLICATIONパネルなどDB実体が必要なものは自動生成しない
 */

export type ParariTemplate = {
  id: string;
  title: string;
  description: string;
  content: string;
};

export const PARARI_TEMPLATES: ParariTemplate[] = [
  {
    id: "diary",
    title: "日記",
    description: "今日の出来事や気づきを1ページ作品として残すための型です。",
    content: `[BOOK] 今日の日記
subtitle:
url:
time:
place:
topics: 日記
renderMode: page-scroll
physicalPagination: false

[PAGE]
今日の記録

■ 今日あったこと
ここに今日あったことを書きます。

■ 印象に残ったこと
ここに印象に残ったことを書きます。

■ ひとこと
ここに今日のひとことを書きます。
`,
  },

  {
    id: "travel",
    title: "旅行記",
    description: "旅の記録を、場所・印象・写真の流れでまとめるための型です。",
    content: `[BOOK] 旅の記録
subtitle:
url:
time:
place:
topics: 旅行記
renderMode: page-scroll
physicalPagination: false

[PAGE]
旅のはじまり

■ 行った場所
ここに旅先を書きます。

■ なぜ行ったのか
ここに旅のきっかけを書きます。

■ 最初の印象
ここに到着した時の印象を書きます。

[PAGE]
印象に残ったこと

■ 心に残った場所
ここに印象に残った場所を書きます。

■ 食べたもの・出会った人
ここに食事や出会いを書きます。

■ また行きたい理由
ここにもう一度行きたい理由を書きます。
`,
  },

  {
    id: "recruitment",
    title: "募集",
    description: "教室・イベント・講座などの募集ページを作るための型です。",
    content: `[BOOK] 募集のお知らせ
subtitle:
url:
time:
place:
topics: 募集
renderMode: page-scroll
physicalPagination: false

[PAGE]
募集のお知らせ

■ 募集内容
ここに募集内容を書きます。

■ 日時
ここに開催日時を書きます。

■ 場所
ここに開催場所を書きます。

■ 対象
ここに参加してほしい人を書きます。

■ 参加費
ここに参加費を書きます。

■ 参加方法
この下に申込パネルを追加してください。

申込パネルの追加方法：
1. PAGEの「INFO」を開く
2. APPLICATIONパネルを追加する
3. 定員・締切・開催日時を入力する
4. 保存して公開する

※この説明文は、申込パネルを設置したあと削除してください。
`,
  },
];
