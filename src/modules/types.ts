// src/modules/application/service.ts
// src/modules/application/service.ts
// 2026-04-19 JST

/**
 * PART: module types
 * コメント:
 * - PARARI モジュール共通の最小型
 * - registry で載せ外しできる土台
 */

import type React from "react";

export type ModuleKey = "application";

export type ModuleEditorProps = {
  attachedApplicationId?: string | null;
  onAttachApplication?: (applicationId: string) => void;
  onDetachApplication?: () => void;
};

export type ModuleRendererProps = {
  id: string;
};

export type ModuleDefinition = {
  /**
   * PART: identity
   * コメント:
   * - システム内の一意キー
   */
  key: ModuleKey;

  /**
   * PART: UI label
   * コメント:
   * - エディタ上で見せる表示名
   */
  label: string;

  /**
   * PART: ssot tag
   * コメント:
   * - SSOT 上の block tag
   * - 例: [APPLICATION id: ...]
   */
  ssotTag: string;

  /**
   * PART: availability
   * コメント:
   * - BOOK 設定からこのモジュールを出してよいか判定する
   */
  isEnabled: (book: { modulesEnabled?: boolean }) => boolean;

  /**
   * PART: editor
   * コメント:
   * - ページエディタ側で使う最小編集UI
   */
  editor: React.ComponentType<ModuleEditorProps>;

  /**
   * PART: renderer
   * コメント:
   * - viewer 側でモジュールを描画するUI
   */
  renderer: React.ComponentType<ModuleRendererProps>;
};
