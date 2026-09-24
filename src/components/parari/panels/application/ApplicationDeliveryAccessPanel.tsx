"use client";

import Link from "next/link";

import type {
  ApplicationDeliveryMeta,
} from "./applicationDeliveryClient";
import ApplicationDeliveryDownloadButton from "./ApplicationDeliveryDownloadButton";

type Props = {
  applicationId?: string;
  guestToken?: string;
  delivery: ApplicationDeliveryMeta;
  ready: boolean;
  pendingMessage?: string;
};

export default function ApplicationDeliveryAccessPanel({
  applicationId,
  guestToken,
  delivery,
  ready,
  pendingMessage,
}: Props) {
  if (delivery.kind === "file") {
    return (
      <ApplicationDeliveryDownloadButton
        applicationId={applicationId}
        guestToken={guestToken}
        fileName={delivery.fileName}
        size={delivery.size}
        ready={ready}
        pendingMessage={pendingMessage}
      />
    );
  }

  const accessKey =
    guestToken ||
    applicationId ||
    "";

  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="text-sm font-bold text-neutral-950">
        受け取るPARARI作品
      </div>

      <div className="mt-2 text-sm font-bold text-neutral-800">
        {delivery.workTitle}
      </div>

      {ready && accessKey ? (
        <Link
          href={`/access/${encodeURIComponent(
            accessKey,
          )}`}
          className="mt-4 block w-full rounded-full bg-neutral-950 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-neutral-700"
        >
          作品を読む
        </Link>
      ) : (
        <p className="mt-3 rounded-xl bg-neutral-50 px-4 py-3 text-xs leading-6 text-neutral-600">
          {pendingMessage ||
            "申込条件が整うと作品を読めます。"}
        </p>
      )}
    </div>
  );
}
