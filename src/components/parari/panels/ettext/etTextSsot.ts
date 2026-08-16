import {
  EtTextPanelData,
  EtTextSegment,
  normalizeEtTextInput,
  sortEtTextSegments,
} from "./types";

function stripOuterNewline(value: string): string {
  let next = value;

  if (next.startsWith("\n")) {
    next = next.slice(1);
  }

  if (next.endsWith("\n")) {
    next = next.slice(0, -1);
  }

  return next;
}

function extractSection(body: string, name: string): string | null {
  const open = `---${name}---`;
  const close = `---/${name}---`;

  const openIndex = body.indexOf(open);
  if (openIndex === -1) return null;

  const contentStart = openIndex + open.length;
  const closeIndex = body.indexOf(close, contentStart);
  if (closeIndex === -1) return null;

  return stripOuterNewline(body.slice(contentStart, closeIndex));
}

function parseSegments(raw: string | null): EtTextSegment[] {
  if (!raw || raw.trim() === "") return [];

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return sortEtTextSegments(
      parsed
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: String(item.id ?? ""),
          charStart: Number(item.charStart ?? 0),
          charEnd: Number(item.charEnd ?? 0),
          audioStart: Number(item.audioStart ?? 0),
          audioEnd: Number(item.audioEnd ?? 0),
          selectedText: String(item.selectedText ?? ""),
        }))
        .filter((item) => {
          return (
            item.id &&
            Number.isFinite(item.charStart) &&
            Number.isFinite(item.charEnd) &&
            Number.isFinite(item.audioStart) &&
            Number.isFinite(item.audioEnd) &&
            item.charEnd > item.charStart &&
            item.audioEnd > item.audioStart
          );
        })
    );
  } catch {
    return [];
  }
}

export function parseEtTextPanelBody(body: string): EtTextPanelData {
  const withoutTag = body.replace(/^\s*\[ETTEXT\]\s*\n?/u, "");

  const audioMatch = withoutTag.match(/^audio:\s*(.*)$/mu);
  const audioUrl = audioMatch?.[1]?.trim() ?? "";

  const text = normalizeEtTextInput(extractSection(withoutTag, "TEXT") ?? "");
  const segments = parseSegments(extractSection(withoutTag, "SYNC"));

  return {
    type: "ETTEXT",
    audioUrl,
    text,
    segments,
  };
}

export function serializeEtTextPanelData(data: EtTextPanelData): string {
  const text = normalizeEtTextInput(data.text ?? "");
  const segments = sortEtTextSegments(data.segments ?? []);

  return [
    "[ETTEXT]",
    `audio: ${data.audioUrl ?? ""}`,
    "",
    "---TEXT---",
    text,
    "---/TEXT---",
    "",
    "---SYNC---",
    JSON.stringify(segments, null, 2),
    "---/SYNC---",
  ].join("\n");
}

export function createEmptyEtTextPanelData(): EtTextPanelData {
  return {
    type: "ETTEXT",
    audioUrl: "",
    text: "",
    segments: [],
  };
}
