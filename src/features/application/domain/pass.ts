function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function isApplicationPassEnabledFromDefinition(
  definition: unknown,
): boolean {
  const record =
    asRecord(definition);

  if (
    typeof record?.passEnabled ===
    "boolean"
  ) {
    return record.passEnabled;
  }

  // 既存APPLICATIONは従来どおり参加証ありとして扱う。
  return true;
}

export function isApplicationPassEnabledFromSnapshot(
  snapshot: unknown,
): boolean {
  const record =
    asRecord(snapshot);

  return isApplicationPassEnabledFromDefinition(
    record?.definition,
  );
}
