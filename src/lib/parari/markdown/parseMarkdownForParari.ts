import { serializeTablePanel } from "@/components/parari/panels/table/tableSsot";

export type MarkdownPart = { kind: "text" | "table"; ssot: string };
const separator = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;
function cells(line: string): string[] {
  const raw = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return raw.split(/(?<!\\)\|/).map(cell => cell.replace(/\\\|/g, "|").trim());
}
function inline(value: string): string {
  return value.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, "[[$1]]($2)");
}
function asText(lines: string[]): string {
  return lines.map(line => {
    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading) return (heading[1].length >= 3 ? "### " : "## ") + inline(heading[2]);
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);\n    if (bullet) return "・" + inline(bullet[1]);\n    const numbered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);\n    if (numbered) return numbered[1] + ". " + inline(numbered[2]);\n    return inline(line);
  }).join("\n").trim();
}
export function parseMarkdownForParari(source: string): MarkdownPart[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const parts: MarkdownPart[] = [];
  let text: string[] = [];
  let inCode = false;
  const flush = () => {
    const ssot = asText(text);
    if (ssot) parts.push({kind:"text",ssot});
    text = [];
  };
  for (let i=0; i<lines.length; i++) {
    const line = lines[i];
    if (/^\s*`{3,}/.test(line)) {inCode = !inCode; text.push(line); continue;}
    if (!inCode && i+1<lines.length && line.includes("|") && separator.test(lines[i+1])) {
      const headers = cells(line);
      if (headers.length>=2) {
        const rows=[headers]; i++;
        while (i+1<lines.length && lines[i+1].includes("|") && lines[i+1].trim()) {
          const next=cells(lines[i+1]);
          if (next.length!==headers.length) break;
          rows.push(next); i++;
        }
        flush();
        parts.push({kind:"table",ssot:serializeTablePanel({caption:"",header:true,rows})});
        continue;
      }
    }
    text.push(line);
  }
  flush();
  return parts;
}
