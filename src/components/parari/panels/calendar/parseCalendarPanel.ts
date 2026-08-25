import type { CalendarPanelData } from "./calendarTypes";

const UUID_RE =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

export function parseCalendarPanel(
  raw: string,
): CalendarPanelData {
  const text = String(raw ?? "").trim();

  const patterns = [
    new RegExp(
      `^\\[CALENDAR\\s+id\\s*:\\s*(${UUID_RE})\\]\\s*$`,
      "i",
    ),
    new RegExp(
      `^\\[CALENDAR\\s+id\\s*=\\s*"(${UUID_RE})"\\]\\s*$`,
      "i",
    ),
    new RegExp(
      `^\\[CALENDAR\\]\\s+calendarItemId\\s*=\\s*"(${UUID_RE})"\\s*$`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return {
        calendarItemId: match[1],
      };
    }
  }

  return {
    calendarItemId: null,
  };
}

export function isValidCalendarItemId(
  value: string | null | undefined,
): boolean {
  const text = String(value ?? "").trim();
  return new RegExp(`^${UUID_RE}$`, "i").test(text);
}
