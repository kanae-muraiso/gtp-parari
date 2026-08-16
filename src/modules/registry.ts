// src/modules/registry.ts
// src/modules/registry.ts
// 2026-08-15 JST

/**
 * PART: module registry
 *
 * PARARI に登録されているモジュール一覧。
 *
 * 旧APPLICATION moduleは2026-08-15に撤去。
 * 新APPLICATIONはPanelDefinition系として再構築する。
 */

export const moduleRegistry = {} as const;

export type RegisteredModuleKey =
  keyof typeof moduleRegistry;

export const registeredModules =
  Object.values(moduleRegistry);
