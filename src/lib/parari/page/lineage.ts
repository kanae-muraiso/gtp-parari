export function parseOriginPageId(
  ssot: string | null | undefined,
): string | null {
  const match = String(ssot ?? "").match(
    /^\s*originPageId\s*:\s*(.+?)\s*$/im,
  );

  const id = String(match?.[1] ?? "").trim();

  return id || null;
}

export function isDerivedPageSsot(
  ssot: string | null | undefined,
): boolean {
  return Boolean(parseOriginPageId(ssot));
}


export function parseOriginBookId(
  ssot: string | null | undefined,
): string | null {
  const match = String(ssot ?? "").match(
    /^\s*originBookId\s*:\s*(.+?)\s*$/im,
  );

  const id = String(match?.[1] ?? "").trim();

  return id || null;
}
