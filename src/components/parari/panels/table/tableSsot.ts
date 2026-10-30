// src/components/parari/panels/table/tableSsot.ts
// 2026-10-30 JST
// PART: TABLE SSOT codec. Cell text remains in the work's sole SSOT.
export type TablePanelData = { caption: string; header: boolean; rows: string[][] };

function encode(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\|/g, "\\|");
}

function decode(value: string): string {
  return value.replace(/\\([\\nr|])/g, (_, char: string) => char === "n" ? "\n" : char === "r" ? "\r" : char);
}

export function parseTablePanel(raw: string): TablePanelData {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const rows: string[][] = [];
  let caption = "";
  let header = true;
  for (const line of lines.slice(1)) {
    if (line === "[/TABLE]") break;
    if (line.startsWith("caption: ")) caption = decode(line.slice(9));
    else if (line.startsWith("header: ")) header = line.slice(8).trim() !== "false";
    else if (line.startsWith("|") && line.endsWith("|")) {
      const cells: string[] = [];
      let cell = "";
      for (let i = 1; i < line.length; i++) {
        if (line[i] === "\\" && i + 1 < line.length) cell += line[i] + line[++i];
        else if (line[i] === "|") { cells.push(decode(cell)); cell = ""; }
        else cell += line[i];
      }
      rows.push(cells);
    }
  }
  const width = Math.max(1, ...rows.map(row => row.length));
  return { caption, header, rows: rows.length ? rows.map(row => [...row, ...Array(width - row.length).fill("")]) : [[""]] };
}

export function serializeTablePanel(data: TablePanelData): string {
  return ["[TABLE]", `caption: ${encode(data.caption)}`, `header: ${data.header}`, ...data.rows.map(row => `|${row.map(encode).join("|")}|`), "[/TABLE]"].join("\n");
}

export function createTablePanel(): string {
  return serializeTablePanel({ caption: "", header: true, rows: [["", ""], ["", ""], ["", ""]] });
}
