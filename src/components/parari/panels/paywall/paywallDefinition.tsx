// src/components/parari/panels/paywall/paywallDefinition.tsx
// 2026-10-08 JST / PART: A structural SSOT boundary, outside Lexical
import type { PanelDefinition } from "../panelDefinitionTypes";
function Boundary() { return <div className="my-4 border-y border-dashed border-amber-400 bg-amber-50 px-4 py-5 text-center text-sm font-bold text-amber-900">ここから先は有料です</div>; }
export const paywallDefinition: PanelDefinition<Record<string, never>> = { tag: "PAYWALL", label: "有料境界", description: "この位置より後を購入者・購読者に表示します。", parse: () => ({}), serialize: () => "[PAYWALL]", Editor: Boundary, Renderer: Boundary };
