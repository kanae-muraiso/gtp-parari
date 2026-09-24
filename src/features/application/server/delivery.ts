import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const APPLICATION_DELIVERY_BUCKET =
  "application-delivery";

export type ApplicationFileDelivery = {
  kind: "file";
  storagePath: string;
  fileName: string;
  contentType: string;
  size: number;
};

export type ApplicationWorkDelivery = {
  kind: "work";
  workId: string;
  workTitle: string;
};

export type ApplicationDelivery =
  | ApplicationFileDelivery
  | ApplicationWorkDelivery;

function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function getApplicationDeliveryFromSnapshot(
  snapshot: unknown,
): ApplicationDelivery | null {
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

    const targetType =
      block.targetType === "work"
        ? "work"
        : "file";

    if (targetType === "work") {
      const workId =
        typeof block.workId === "string"
          ? block.workId.trim()
          : "";
      const workTitle =
        typeof block.workTitle === "string"
          ? block.workTitle.trim()
          : "";

      if (!workId || !workTitle) {
        return null;
      }

      return {
        kind: "work",
        workId,
        workTitle,
      };
    }

    const storagePath =
      typeof block.storagePath === "string"
        ? block.storagePath.trim()
        : "";
    const fileName =
      typeof block.fileName === "string"
        ? block.fileName.trim()
        : "";
    const contentType =
      typeof block.contentType === "string"
        ? block.contentType.trim()
        : "application/octet-stream";
    const size =
      typeof block.size === "number" &&
      Number.isFinite(block.size) &&
      block.size >= 0
        ? block.size
        : 0;

    if (
      !storagePath ||
      storagePath.includes("..") ||
      !fileName
    ) {
      return null;
    }

    return {
      kind: "file",
      storagePath,
      fileName,
      contentType,
      size,
    };
  }

  return null;
}

export function canAccessApplicationDelivery(
  entry: {
    status: string;
    payment_status: string;
  },
): boolean {
  return (
    entry.status === "confirmed" &&
    (
      entry.payment_status ===
        "not_required" ||
      entry.payment_status ===
        "paid"
    )
  );
}

export async function createApplicationDeliverySignedUrl(
  delivery: ApplicationFileDelivery,
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin.storage
      .from(
        APPLICATION_DELIVERY_BUCKET,
      )
      .createSignedUrl(
        delivery.storagePath,
        60,
        {
          download:
            delivery.fileName,
        },
      );

  if (
    error ||
    !data?.signedUrl
  ) {
    throw (
      error ??
      new Error(
        "Signed URL was not created.",
      )
    );
  }

  return data.signedUrl;
}
