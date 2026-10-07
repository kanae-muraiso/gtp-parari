export type TextReadingSupportOptions = {
  dictionary: boolean;
  eikenLevel: boolean;
  // Retain legacy attributes for SSOT compatibility; inline notes are no longer displayed.
  notes: boolean;
  noteFrom: "all" | "5" | "4" | "3" | "pre2" | "2" | "pre1" | "1";
};

export const DEFAULT_TEXT_READING_SUPPORT: TextReadingSupportOptions = {
  dictionary: false,
  eikenLevel: false,
  notes: false,
  noteFrom: "3",
};

const KNOWN_KEYS = new Set(["dictionary", "eiken", "notes", "noteFrom"]);

export function parseTextReadingSupportAttrs(
  attrs?: string,
): TextReadingSupportOptions {
  const result = { ...DEFAULT_TEXT_READING_SUPPORT };
  const tokens = String(attrs ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    const [rawKey, rawValue = ""] = token.split(":", 2);
    const key = rawKey.trim();
    const value = rawValue.trim();

    if (key === "dictionary") result.dictionary = value === "on";
    if (key === "eiken") result.eikenLevel = value === "on";
    if (key === "notes") result.notes = value === "on";

    if (
      key === "noteFrom" &&
      ["all", "5", "4", "3", "pre2", "2", "pre1", "1"].includes(value)
    ) {
      result.noteFrom = value as TextReadingSupportOptions["noteFrom"];
    }
  }

  return result;
}

export function serializeTextReadingSupportAttrs(
  previousAttrs: string | undefined,
  options: TextReadingSupportOptions,
): string {
  const preserved = String(previousAttrs ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => {
      const [key] = token.split(":", 1);
      return !KNOWN_KEYS.has(key);
    });

  const readingTokens = [
    options.dictionary ? "dictionary:on" : "",
    options.eikenLevel ? "eiken:on" : "",
    options.notes ? "notes:on" : "",
    options.notes ? `noteFrom:${options.noteFrom}` : "",
  ].filter(Boolean);

  return [...preserved, ...readingTokens].join(" ");
}

export function hasTextReadingSupport(
  options: TextReadingSupportOptions,
): boolean {
  return options.dictionary || options.eikenLevel;
}

export function formatEikenLevelJa(level: string | null | undefined): string {
  switch (level) {
    case "5":
    case "4":
    case "3":
    case "2":
    case "1":
      return `英検${level}級`;
    case "pre2":
      return "英検準2級";
    case "pre1":
      return "英検準1級";
    default:
      return "";
  }
}
