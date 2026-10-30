// src/components/parari/panels/table/TablePanelEditor.tsx
// 2026-10-30 JST
// PART: Direct cell editing with explicit row and column operations.
"use client";
import { useState } from "react";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import { serializeTablePanel, type TablePanelData } from "./tableSsot";

export function TablePanelEditor({ data, onChangeRaw }: PanelEditorProps<TablePanelData>) {
  const [selected, setSelected] = useState({ row: 0, col: 0 });
  const row = Math.min(selected.row, data.rows.length - 1);
  const col = Math.min(selected.col, data.rows[0].length - 1);
  const update = (next: TablePanelData) => onChangeRaw?.(serializeTablePanel(next));
  const remove = (axis: "row" | "col") => {
    const cells = axis === "row" ? data.rows[row] : data.rows.map(r => r[col]);
    if (cells.some(cell => cell.length > 0) && !window.confirm(`${axis === "row" ? "行" : "列"}の内容も削除しますか？`)) return;
    update({ ...data, rows: axis === "row" ? data.rows.filter((_, i) => i !== row) : data.rows.map(r => r.filter((_, i) => i !== col)) });
  };
  const button = "rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs disabled:opacity-40";
  return <div className="space-y-3">
    <input aria-label="表のタイトル" placeholder="表のタイトル（任意）" className="w-full rounded border border-neutral-300 px-3 py-2 text-sm" value={data.caption} onChange={e => update({ ...data, caption: e.target.value })} />
    <div className="flex flex-wrap items-center gap-2">
      <label className="mr-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={data.header} onChange={e => update({ ...data, header: e.target.checked })} />先頭行を見出しにする</label>
      <button type="button" className={button} onClick={() => { const rows = [...data.rows]; rows.splice(row + 1, 0, Array(data.rows[0].length).fill("")); update({ ...data, rows }); }}>下に行を追加</button>
      <button type="button" className={button} onClick={() => update({ ...data, rows: data.rows.map(r => { const next = [...r]; next.splice(col + 1, 0, ""); return next; }) })}>右に列を追加</button>
      <button type="button" className={button} disabled={data.rows.length <= 1} onClick={() => remove("row")}>選択行を削除</button>
      <button type="button" className={button} disabled={data.rows[0].length <= 1} onClick={() => remove("col")}>選択列を削除</button>
    </div>
    <p className="text-xs text-neutral-500">{row + 1}行・{col + 1}列を選択中</p>
    <div className="max-w-full overflow-x-auto">
      <table className="w-full border-collapse"><tbody>{data.rows.map((cells, r) => <tr key={r}>{cells.map((cell, c) => <td key={c} className={`min-w-32 border border-neutral-300 p-0 ${data.header && r === 0 ? "bg-neutral-100 font-semibold" : "bg-white"}`}>
        <textarea aria-label={`${r + 1}行${c + 1}列`} rows={2} value={cell} onFocus={() => setSelected({ row: r, col: c })} onChange={e => update({ ...data, rows: data.rows.map((values, i) => i === r ? values.map((value, j) => j === c ? e.target.value : value) : values) })} className="block w-full min-w-32 resize-y bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-inset focus:ring-amber-500" />
      </td>)}</tr>)}</tbody></table>
    </div>
  </div>;
}
