// src/lib/parari/readerProjectionTypes.ts
// 2026-10-08 JST
// PART: Transient public reading data, never persisted as a content master
import type { SsotBlock } from "./ssot-v2/panelTypes";
export type PreparedReaderBlock = {
    id: string;
    kind: "text" | "panel";
    text?: string;
    tag?: string;
    variant?: string;
    attrs?: string;
    data?: any;
    gap?: "default" | "zero";
};
export function materializeReaderBlock(block: PreparedReaderBlock): SsotBlock {
    const common = { id: block.id, start: 0, end: 0, attrs: block.attrs };
    return block.kind === "text" ? { ...common, kind: "text", raw: block.text ?? "" } :
        { ...common, kind: "panel", raw: "", tag: block.tag ?? "", variant: block.variant, implemented: true };
}
