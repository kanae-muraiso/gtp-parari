// src/components/parari/panels/application/ApplicationPassCard.tsx
// 2026-09-15 JST

"use client";

import * as React from "react";

import {
  createQrVersion3M,
  QR_VERSION_3_SIZE,
} from "@/lib/qr/qrVersion3M";

type PassResponse = {
  ok?: boolean;
  pass?: {
    code?: string;
  };
  message?: string;
};

export default function ApplicationPassCard({
  entryId,
  title,
  participantName,
}: {
  entryId: string;
  title: string;
  participantName: string;
}) {
  const [passCode, setPassCode] =
    React.useState("");
  const [message, setMessage] =
    React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    async function loadPass() {
      setMessage("");

      try {
        const response = await fetch(
          `/api/application/pass?entryId=${encodeURIComponent(
            entryId,
          )}`,
          { cache: "no-store" },
        );

        const result =
          (await response
            .json()
            .catch(() => null)) as
            | PassResponse
            | null;

        if (cancelled) {
          return;
        }

        const code =
          String(
            result?.pass?.code ?? "",
          ).trim();

        if (
          !response.ok ||
          !result?.ok ||
          !/^[0-9a-f]{16}$/.test(code)
        ) {
          setMessage(
            result?.message ??
              "参加証を表示できませんでした。",
          );
          return;
        }

        setPassCode(code);
      } catch (error) {
        console.error(
          "[APPLICATION PASS] load failed:",
          error,
        );

        if (!cancelled) {
          setMessage(
            "参加証を表示できませんでした。",
          );
        }
      }
    }

    void loadPass();

    return () => {
      cancelled = true;
    };
  }, [entryId]);

  if (message) {
    return (
      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        {message}
      </div>
    );
  }

  if (!passCode) {
    return (
      <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
        参加証を発行しています...
      </div>
    );
  }

  const checkInUrl =
    `https://parari.app/q/${passCode}`;

  return (
    <div className="mt-5 overflow-hidden rounded-3xl border-2 border-neutral-950 bg-white">
      <div className="bg-neutral-950 px-5 py-4 text-white">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-300">
          PARARI PASS
        </div>
        <div className="mt-1 text-xl font-bold">
          参加証
        </div>
      </div>

      <div className="p-5 text-center">
        <div className="text-sm font-bold leading-6 text-neutral-950">
          {title}
        </div>
        <div className="mt-1 text-sm text-neutral-600">
          {participantName}
        </div>

        <div className="mx-auto mt-5 w-full max-w-[260px] rounded-2xl bg-white p-3">
          <QrSvg value={checkInUrl} />
        </div>

        <div className="mt-4 text-xs font-mono tracking-widest text-neutral-500">
          {passCode.toUpperCase()}
        </div>

        <div className="mt-5 rounded-2xl bg-neutral-50 px-4 py-4 text-left">
          <div className="text-sm font-bold text-neutral-950">
            この画面をスクリーンショットで保存してください
          </div>
          <p className="mt-2 text-sm leading-7 text-neutral-600">
            当日は、この参加証を受付でご提示ください。
          </p>
        </div>
      </div>
    </div>
  );
}

function QrSvg({
  value,
}: {
  value: string;
}) {
  const modules =
    React.useMemo(
      () => createQrVersion3M(value),
      [value],
    );

  const quietZone = 4;
  const viewSize =
    QR_VERSION_3_SIZE +
    quietZone * 2;

  return (
    <svg
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      role="img"
      aria-label="参加証コード"
      className="block h-auto w-full"
      shapeRendering="crispEdges"
    >
      <rect
        x="0"
        y="0"
        width={viewSize}
        height={viewSize}
        fill="white"
      />

      {modules.flatMap(
        (row, rowIndex) =>
          row.map(
            (dark, columnIndex) =>
              dark ? (
                <rect
                  key={`${rowIndex}-${columnIndex}`}
                  x={
                    columnIndex +
                    quietZone
                  }
                  y={
                    rowIndex +
                    quietZone
                  }
                  width="1"
                  height="1"
                  fill="black"
                />
              ) : null,
          ),
      )}
    </svg>
  );
}
