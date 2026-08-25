// apps/tools/parari/src/components/parari/panels/panelDefinitionTypes.ts
// 2026-06-22 14:55 JST - PanelDefinition共通型

import type { ComponentType, ReactNode } from "react";
import type { PanelBlock } from "@/lib/parari/ssot-v2/panelTypes";

export type WebPageOption = {
  title: string;
  slug: string;
  isHome: boolean;
};

export type NestedPanelEditorRenderer = (args: {
  value: string;
  onChange: (nextValue: string) => void;
}) => ReactNode;

export type NestedPanelViewerRenderer = (
  bodySsot: string,
) => ReactNode;

export type PanelEditorProps<TData = unknown> = {
  block: PanelBlock;
  data: TData;
  onChangeRaw?: (nextRaw: string) => void;
  onInsertAfter?: (raw: string) => void;
  publicBasePath?: string;
  renderNestedPanelEditor?: NestedPanelEditorRenderer;

  /**
   * WEB作品のサイト識別情報。
   * PAGE・BOOKでは未指定のまま使用する。
   */
  ownerUsername?: string;
  siteSlug?: string;
  onSiteSlugChange?: (nextSlug: string) => void;

  /**
   * WEBINFO専用のWEBPAGE候補。
   * BOOK・PAGEなど既存パネルでは未指定のまま使用する。
   */
  webPages?: WebPageOption[];
};

export type PanelRendererProps<TData = unknown> = {
  block: PanelBlock;
  data: TData;
  onInsertAfter?: (raw: string) => void;
  renderNestedPanelViewer?: NestedPanelViewerRenderer;
};

export type PanelDefinition<TData = unknown> = {
  tag: string;
  label: string;
  description?: string;
  parse: (raw: string, block: PanelBlock) => TData;
  serialize: (data: TData, block: PanelBlock) => string;
  Editor: ComponentType<PanelEditorProps<TData>>;
  Renderer?: ComponentType<PanelRendererProps<TData>>;
};
