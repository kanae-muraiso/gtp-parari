// 2026-10-07 JST — Display-only palette shared by editing, confirmation and the legend.
export const EIKEN_BACKGROUNDS = [
  { level: "1", label: "1級", color: "#fb923c" },
  { level: "pre1", label: "準1級", color: "#fdba74" },
  { level: "2", label: "2級", color: "#fcd34d" },
  { level: "pre2", label: "準2級", color: "#fef08a" },
  { level: "basic", label: "3〜5級", color: "#dcfce7" },
] as const;

export function eikenBackgroundLevel(level: string | null | undefined): string | undefined {
  if (level === "3" || level === "4" || level === "5") return "basic";
  return EIKEN_BACKGROUNDS.find(item => item.level === level)?.level;
}

export function eikenBackgroundColor(level: string | null | undefined): string | undefined {
  return EIKEN_BACKGROUNDS.find(item => item.level === eikenBackgroundLevel(level))?.color;
}
