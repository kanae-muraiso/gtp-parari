export type EtTextSegment = {
  id: string;
  charStart: number;
  charEnd: number;
  audioStart: number;
  audioEnd: number;
  selectedText: string;
};

export type EtTextPanelData = {
  type: "ETTEXT";
  audioUrl: string;
  text: string;
  segments: EtTextSegment[];
};

export function normalizeEtTextInput(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function sortEtTextSegments(
  segments: EtTextSegment[]
): EtTextSegment[] {
  return [...segments].sort((a, b) => {
    if (a.charStart !== b.charStart) return a.charStart - b.charStart;
    return a.audioStart - b.audioStart;
  });
}

export function hasCharRangeOverlap(
  candidate: Pick<EtTextSegment, "charStart" | "charEnd">,
  segments: EtTextSegment[],
  ignoreId?: string
): boolean {
  return segments.some((seg) => {
    if (ignoreId && seg.id === ignoreId) return false;
    return candidate.charStart < seg.charEnd && candidate.charEnd > seg.charStart;
  });
}

export function createEtTextSegmentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `seg_${crypto.randomUUID()}`;
  }

  return `seg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
