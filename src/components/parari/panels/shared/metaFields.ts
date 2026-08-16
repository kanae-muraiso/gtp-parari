// apps/tools/parari/src/components/parari/panels/shared/metaFields.ts
// 2026-06-29 00:25 JST
// PART: SSOT meta field parser
// コメント:
// - BOOKINFO / PAGEINFO などの構造パネル用metaを軽く読む
// - 旧形式 key: value と v2候補 {key}\nvalue の両方を読む
// - 未知metaは消さない。ここでは表示用に読むだけ。

export type ParsedMetaFields = Record<string, string>;

export function parseMetaFields(raw: string): ParsedMetaFields {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const fields: ParsedMetaFields = {};

  let currentBraceKey = "";

  for (const originalLine of lines) {
    const trimmedLine = originalLine.trim();

    if (trimmedLine.length === 0) {
      continue;
    }

    if (trimmedLine.startsWith("[") && trimmedLine.endsWith("]")) {
      currentBraceKey = "";
      continue;
    }

    const braceMatch = trimmedLine.match(/^\{([^}]+)\}$/);

    if (braceMatch?.[1]) {
      currentBraceKey = normalizeMetaKey(braceMatch[1]);
      if (!(currentBraceKey in fields)) {
        fields[currentBraceKey] = "";
      }
      continue;
    }

    if (currentBraceKey) {
      fields[currentBraceKey] = appendMetaValue(
        fields[currentBraceKey],
        originalLine.replace(/^\s+/, ""),
      );
      continue;
    }

    const colonIndex = originalLine.indexOf(":");

    if (colonIndex > 0) {
      const key = normalizeMetaKey(originalLine.slice(0, colonIndex));
      const value = originalLine.slice(colonIndex + 1).replace(/^\s*/, "");

      if (key.length > 0) {
        fields[key] = value;
      }
    }
  }

  return fields;
}

export function getMetaValue(
  fields: ParsedMetaFields,
  keys: string[],
  fallback = "",
): string {
  for (const key of keys) {
    const normalizedKey = normalizeMetaKey(key);
    const value = fields[normalizedKey];

    if (value && value.trim().length > 0) {
      return value;
    }
  }

  return fallback;
}

export function getBooleanMeta(
  fields: ParsedMetaFields,
  keys: string[],
  fallback = false,
): boolean {
  const value = getMetaValue(fields, keys, "");

  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (["true", "yes", "1", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "0", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function normalizeMetaKey(value: string): string {
  return value.trim().toLowerCase();
}

function appendMetaValue(current: string, nextLine: string): string {
  if (!current) {
    return nextLine;
  }

  if (!nextLine) {
    return current;
  }

  return `${current}\n${nextLine}`;
}
