export type ApplicationDeliveryMeta = {
  fileName: string;
  size: number;
};

function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function getApplicationDeliveryMetaFromSnapshot(
  snapshot: unknown,
): ApplicationDeliveryMeta | null {
  const snapshotRecord =
    asRecord(snapshot);
  const definition =
    asRecord(
      snapshotRecord?.definition,
    );
  const blocks =
    Array.isArray(
      definition?.blocks,
    )
      ? definition.blocks
      : [];

  for (const rawBlock of blocks) {
    const block =
      asRecord(rawBlock);

    if (
      block?.type !== "delivery"
    ) {
      continue;
    }

    const fileName =
      typeof block.fileName === "string"
        ? block.fileName.trim()
        : "";
    const size =
      typeof block.size === "number" &&
      Number.isFinite(block.size) &&
      block.size >= 0
        ? block.size
        : 0;

    if (!fileName) {
      return null;
    }

    return {
      fileName,
      size,
    };
  }

  return null;
}
