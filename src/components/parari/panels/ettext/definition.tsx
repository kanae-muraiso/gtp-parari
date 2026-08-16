import type {
  PanelDefinition,
  PanelEditorProps,
  PanelRendererProps,
} from "../panelDefinitionTypes";
import {
  createEmptyEtTextPanelData,
  parseEtTextPanelBody,
  serializeEtTextPanelData,
} from "./etTextSsot";
import { EtTextPanelData } from "./types";
import { EtTextPanelEditor } from "./EtTextPanelEditor";
import { EtTextPanelRenderer } from "./EtTextPanelRenderer";

function normalizeData(data: EtTextPanelData | unknown): EtTextPanelData {
  if (
    data &&
    typeof data === "object" &&
    (data as EtTextPanelData).type === "ETTEXT"
  ) {
    return data as EtTextPanelData;
  }

  return createEmptyEtTextPanelData();
}

function EtTextPanelDefinitionEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<EtTextPanelData>) {
  const value = normalizeData(data);

  return (
    <EtTextPanelEditor
      value={value}
      onChange={(next) => {
        onChangeRaw?.(serializeEtTextPanelData(next));
      }}
    />
  );
}

function EtTextPanelDefinitionRenderer({
  data,
}: PanelRendererProps<EtTextPanelData>) {
  return <EtTextPanelRenderer data={normalizeData(data)} />;
}

export const etTextPanelDefinition: PanelDefinition<EtTextPanelData> = {
  tag: "ETTEXT",
  label: "音声同期テキスト",
  description:
    "音声URLとプレーンテキストを持ち、文字範囲と音声時間を同期するパネルです。",

  parse(raw: string): EtTextPanelData {
    return parseEtTextPanelBody(raw);
  },

  serialize(data: EtTextPanelData): string {
    return serializeEtTextPanelData(normalizeData(data));
  },

  Editor: EtTextPanelDefinitionEditor,
  Renderer: EtTextPanelDefinitionRenderer,
};
