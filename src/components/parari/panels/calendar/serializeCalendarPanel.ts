import type { CalendarPanelData } from "./calendarTypes";
import { isValidCalendarItemId } from "./parseCalendarPanel";

export function serializeCalendarPanel(
  data: CalendarPanelData,
): string {
  const calendarItemId =
    String(data.calendarItemId ?? "").trim();

  if (!isValidCalendarItemId(calendarItemId)) {
    return "[CALENDAR]";
  }

  return `[CALENDAR id: ${calendarItemId}]`;
}
