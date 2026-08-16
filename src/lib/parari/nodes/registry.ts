// apps/tools/parari/src/lib/parari/nodes/registry.ts
// apps/tools/parari/src/lib/parari/nodes/registry.ts
// 2026-03-30 JST

/**
 * PART: node registry
 * コメント:
 * - image / youtube / instagram / vimeo / application を module 登録
 */

import { youtubeNodeModule } from "./youtubeNode";
import { instagramNodeModule } from "./instagramNode";
import { vimeoNodeModule } from "./vimeoNode";
import type { ParariNodeModule } from "./types";

export const parariNodeModules: ParariNodeModule[] = [
  youtubeNodeModule,
  instagramNodeModule,
  vimeoNodeModule,
];

export const parariNodeModuleMap = new Map(
  parariNodeModules.map((mod) => [mod.type, mod])
);
