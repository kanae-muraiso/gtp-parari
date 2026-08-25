import type {
  PanelDefinition,
} from "../panelDefinitionTypes";

import type {
  CalendarPanelData,
} from "./calendarTypes";

import CalendarPanelEditor from "./CalendarPanelEditor";
import CalendarPanelRenderer from "./CalendarPanelRenderer";

import {
  parseCalendarPanel,
} from "./parseCalendarPanel";

import {
  serializeCalendarPanel,
} from "./serializeCalendarPanel";

export const calendarDefinition:
  PanelDefinition<CalendarPanelData> = {
    tag: "CALENDAR",
    label: "CALENDAR",
    description:
      "クラス・イベントと今後の開催予定を表示するCALENDARパネル",

    parse: (raw) => {
      return parseCalendarPanel(raw);
    },

    serialize: (data) => {
      return serializeCalendarPanel(data);
    },

    Editor:
      CalendarPanelEditor,

    Renderer:
      CalendarPanelRenderer,
  };
