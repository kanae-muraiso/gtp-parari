// apps/tools/parari/src/lib/parari/parariPatcher.demo.ts
// 2026-04-01 JST

/**
 * PART: Imports
 * コメント:
 * - patcherを1つだけ手で動かすための実験ファイル
 */

import { patchPageBody } from "./parariPatcher";

/**
 * PART: Input SSOT
 * コメント:
 * - これが「現在のSSOT」
 */

const ssot = `[BOOK] 京都散歩
subtitle: 春のメモ
mode: multi

[PAGE] 朝
[IMAGE] https://example.com/morning.jpg
朝の光がきれいだった。

[PAGE] 昼
鴨川を歩いた。`;

/**
 * PART: Patch Input
 * コメント:
 * - 何をどう変えるか
 * - 今回は「0ページ目の本文を新しい本文に変える」
 */

const pageIndex = 0;
const nextBody = `今日は少し寒かった。
でも空はきれいだった。`;

/**
 * PART: Execute
 * コメント:
 * - patcher実行
 */

const nextSsot = patchPageBody(ssot, pageIndex, nextBody);

/**
 * PART: Output
 * コメント:
 * - Before / After をそのまま表示
 */

console.log("===== BEFORE =====");
console.log(ssot);

console.log("\n===== AFTER =====");
console.log(nextSsot);
