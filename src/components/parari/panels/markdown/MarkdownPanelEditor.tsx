"use client";
import type {PanelEditorProps} from "../panelDefinitionTypes";
import {serializeMarkdownPanel,type MarkdownPanelData} from "./markdownSsot";
export function MarkdownPanelEditor({data,onChangeRaw}:PanelEditorProps<MarkdownPanelData>){
 return <div className="space-y-2">
  <p className="text-xs text-neutral-500">ChatGPTなどのMarkdownをそのまま貼り付けられます。表もこのパネル内で表示します。</p>
  <textarea aria-label="Markdown本文" spellCheck={false} value={data.source}
   onChange={e=>onChangeRaw?.(serializeMarkdownPanel({source:e.target.value}))}
   rows={12} className="w-full rounded-lg border border-neutral-300 bg-white p-3 font-mono text-sm leading-6"/>
 </div>;
}
