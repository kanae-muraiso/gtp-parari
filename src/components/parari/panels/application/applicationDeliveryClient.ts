export type ApplicationDeliveryMeta =
  | {
      kind: "file";
      fileName: string;
      size: number;
    }
  | {
      kind: "work";
      workTitle: string;
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

    if (block.targetType === "work") {
      const workTitle =
        typeof block.workTitle === "string"
          ? block.workTitle.trim()
          : "";

      if (!workTitle) {
        return null;
      }

      return {
        kind: "work",
        workTitle,
      };
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
      kind: "file",
      fileName,
      size,
    };
  }

  return null;
}
