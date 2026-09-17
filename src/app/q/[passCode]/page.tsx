// src/app/q/[passCode]/page.tsx
// 2026-09-17 JST

"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import GuestPassCancellationAccess from "@/components/parari/application/GuestPassCancellationAccess";

type Occurrence = {
  id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  title: string | null;
  location: string | null;
};

type PassData = {
  application_title: string;
  participant_name: string;
  status: string;
  checked_in_at: string | null;
  occurrence: Occurrence | null;
  is_guest: boolean;
};

type PassResponse = {
  ok?: boolean;
  pass?: PassData;
  message?: string;
};

export default function ApplicationPassPage() {
  const params = useParams<{
    passCode: string;
  }>();

  const passCode = String(params.passCode ?? "")
    .trim()
    .toLowerCase();

  const [pass, setPass] = React.useState<PassData | null>(null);
  const [message, setMessage] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!/^[0-9a-f]{16}$/.test(passCode)) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPass() {
      setLoading(true);
      setMessage("");

      try {
        const response = await fetch(
          `/api/application/pass/view?passCode=${encodeURIComponent(passCode)}`,
          {
            cache: "no-store",
          },
        );

        const result = (await response.json().catch(() => null)) as
          | PassResponse
          | null;

        if (cancelled) {
          return;
        }

        if (!response.ok || !result?.ok || !result.pass) {
          setPass(null);
          setMessage(
            result?.message ??
              "参加証を確認できませんでした。",
          );
          return;
        }

        setPass(result.pass);
      } catch (error) {
        console.error(
          "[APPLICATION PASS PAGE] load failed:",
          error,
        );

        if (!cancelled) {
          setPass(null);
          setMessage("参加証を確認できませんでした。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPass();

    return () => {
      cancelled = true;
    };
  }, [passCode]);

  if (!/^[0-9a-f]{16}$/.test(passCode)) {
    return (
      <PassShell>
        <StatusCard
          kind="error"
          title="参加証を確認できません"
          body="参加証コードが正しくありません。"
        />
      </PassShell>
    );
  }

  if (loading) {
    return (
      <PassShell>
        <StatusCard
          kind="neutral"
          title="参加証を確認しています..."
          body="少しだけお待ちください。"
        />
      </PassShell>
    );
  }

  if (!pass) {
    return (
      <PassShell>
        <StatusCard
          kind="error"
          title="参加証を確認できません"
          body={message || "参加証を確認できませんでした。"}
        />
      </PassShell>
    );
  }

  const alreadyCheckedIn = Boolean(pass.checked_in_at);
  const confirmed = pass.status === "confirmed";

  return (
    <PassShell>
      <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div
          className={[
            "px-6 py-5",
            alreadyCheckedIn
              ? "bg-emerald-600 text-white"
              : confirmed
                ? "bg-neutral-950 text-white"
                : "bg-amber-100 text-amber-950",
          ].join(" ")}
        >
          <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
            PARARI PASS · READ ONLY
          </div>
          <h1 className="mt-2 text-2xl font-bold">
            {alreadyCheckedIn
              ? "受付済み"
              : confirmed
                ? "有効な参加証です"
                : "まだ参加確定していません"}
          </h1>
        </div>

        <div className="p-6">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-7 text-sky-900">
            <div className="font-bold">参加証閲覧モード</div>
            この画面から受付操作はできません。受付はPARARIの専用CHECK-IN MODEから行います。
          </div>

          <div className="mt-5 text-xs font-semibold text-neutral-400">
            APPLICATION
          </div>
          <div className="mt-1 text-lg font-bold text-neutral-950">
            {pass.application_title}
          </div>

          <div className="mt-5 text-xs font-semibold text-neutral-400">
            参加者
          </div>
          <div className="mt-1 text-xl font-bold text-neutral-950">
            {pass.participant_name}
          </div>

          {pass.occurrence ? (
            <OccurrenceSummary occurrence={pass.occurrence} />
          ) : null}

          {alreadyCheckedIn ? (
            <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">
              この参加証はすでに受付済みです。
              <br />
              受付時刻：{formatDateTime(pass.checked_in_at)}
            </div>
          ) : confirmed ? (
            <div className="mt-6 rounded-2xl bg-neutral-50 p-4 text-sm leading-7 text-neutral-700">
              この参加証は有効です。通常のQR閲覧では受付状態は変更されません。
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-amber-900">
              主催者による承認や支払い確認が完了すると参加確定になります。
            </div>
          )}

          {pass.is_guest ? (
            <div className="mt-6 border-t border-neutral-200 pt-5">
              <div className="text-sm font-bold text-neutral-950">
                申込の変更・キャンセル
              </div>
              <p className="mt-1 text-xs leading-6 text-neutral-500">
                申込時のメールアドレスを確認して、申込内容へ進めます。
              </p>
              <GuestPassCancellationAccess passCode={passCode} />
            </div>
          ) : null}

          {message ? (
            <p className="mt-4 text-sm text-red-600">{message}</p>
          ) : null}
        </div>
      </div>
    </PassShell>
  );
}

function PassShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-md bg-neutral-50 p-5 sm:py-10">
      {children}
    </main>
  );
}

function StatusCard({
  kind,
  title,
  body,
}: {
  kind: "neutral" | "error";
  title: string;
  body: string;
}) {
  return (
    <div
      className={[
        "rounded-3xl border p-6",
        kind === "error"
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-neutral-200 bg-white text-neutral-900",
      ].join(" ")}
    >
      <div className="text-xl font-bold">{title}</div>
      <p className="mt-2 text-sm leading-7 opacity-75">{body}</p>
    </div>
  );
}

function OccurrenceSummary({ occurrence }: { occurrence: Occurrence }) {
  return (
    <div className="mt-5 rounded-2xl bg-neutral-50 p-4">
      <div className="text-sm font-bold text-neutral-950">
        {formatOccurrenceDate(occurrence)}
      </div>
      {occurrence.location ? (
        <div className="mt-1 text-sm text-neutral-600">
          {occurrence.location}
        </div>
      ) : null}
    </div>
  );
}

function formatOccurrenceDate(occurrence: Occurrence): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: occurrence.timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(occurrence.starts_at));
  } catch {
    return occurrence.starts_at;
  }
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
