// src/components/parari/panels/table/TablePanelRenderer.tsx
// 2026-10-30 JST
// PART: Semantic, escaped table display shared by editor and reader.
import type { PanelRendererProps } from "../panelDefinitionTypes";
import type { TablePanelData } from "./tableSsot";

export function TablePanelRenderer({ data }: PanelRendererProps<TablePanelData>) {
  return <div className="max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label={data.caption || "表"}>
    <table className="w-full border-collapse text-left text-sm">
      {data.caption ? <caption className="mb-2 text-left font-semibold whitespace-pre-wrap">{data.caption}</caption> : null}
      {data.header ? <thead><tr>{data.rows[0]?.map((cell, col) => <th key={col} scope="col" className="border border-neutral-300 bg-neutral-100 px-3 py-2 whitespace-pre-wrap break-words">{cell}</th>)}</tr></thead> : null}
      <tbody>{data.rows.slice(data.header ? 1 : 0).map((row, index) => <tr key={index}>{row.map((cell, col) => <td key={col} className="border border-neutral-300 px-3 py-2 whitespace-pre-wrap break-words">{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}
