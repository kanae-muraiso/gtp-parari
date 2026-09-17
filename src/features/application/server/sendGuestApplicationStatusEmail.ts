import { createHash } from "node:crypto";

import { Resend } from "resend";

const CANCELLATION_TOKEN_RE = /^[0-9a-f]{32}$/;
const DEFAULT_APP_URL = "https://www.parari.app";

export type GuestApplicationStatusEmailEntry = {
  cancellationToken: string;
  occurrenceLabel: string | null;
  status: string;
};

type GuestApplicationStatusEmailInput = {
  applicantEmail: string;
  applicantName: string;
  applicationId: string;
  applicationTitle: string;
  entries: GuestApplicationStatusEmailEntry[];
};

type GuestApplicationStatusEmailResult =
  | { ok: true }
  | { ok: false };

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function getAppUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    DEFAULT_APP_URL;

  try {
    const url = new URL(configuredUrl);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return DEFAULT_APP_URL;
    }

    return url.origin;
  } catch {
    return DEFAULT_APP_URL;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "submitted":
      return "受付済み（主催者確認待ち）";
    case "confirmed":
      return "参加確定";
    case "rejected":
      return "不承認";
    case "withdrawn":
      return "取り下げ済み";
    case "cancelled":
      return "キャンセル済み";
    case "expired":
      return "失効";
    default:
      return "申込状況を確認できます";
  }
}

function idempotencyKey(input: GuestApplicationStatusEmailInput): string {
  const emailDigest = createHash("sha256")
    .update(input.applicantEmail)
    .digest("hex")
    .slice(0, 24);
  const fiveMinuteBucket = Math.floor(Date.now() / (5 * 60_000));

  return `guest-status-${input.applicationId}-${emailDigest}-${fiveMinuteBucket}`;
}

export async function sendGuestApplicationStatusEmail(
  input: GuestApplicationStatusEmailInput,
): Promise<GuestApplicationStatusEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const entries = input.entries
    .map((entry) => ({
      ...entry,
      cancellationToken: entry.cancellationToken.trim().toLowerCase(),
    }))
    .filter((entry) =>
      CANCELLATION_TOKEN_RE.test(entry.cancellationToken),
    );

  if (!apiKey) {
    console.error(
      "[APPLICATION guest status email] RESEND_API_KEY is not set.",
    );
    return { ok: false };
  }

  if (entries.length === 0) {
    console.error(
      "[APPLICATION guest status email] No valid status link was provided.",
    );
    return { ok: false };
  }

  const statusItems = entries.map((entry, index) => {
    const statusUrl = new URL(
      `/c/${entry.cancellationToken}`,
      getAppUrl(),
    ).toString();
    const heading =
      entries.length === 1
        ? statusLabel(entry.status)
        : `申込 ${index + 1}：${statusLabel(entry.status)}`;

    return {
      heading,
      occurrenceLabel: entry.occurrenceLabel,
      statusUrl,
    };
  });
  const subject = `【PARARI】${input.applicationTitle} 申込状況の確認`;
  const text = [
    `${input.applicantName} 様`,
    "",
    `「${input.applicationTitle}」の申込状況を確認するための専用リンクです。`,
    "",
    ...statusItems.flatMap((item) => [
      item.heading,
      ...(item.occurrenceLabel ? [`開催日時：${item.occurrenceLabel}`] : []),
      item.statusUrl,
      "",
    ]),
    "このURLは申込者専用です。第三者へ共有しないでください。",
    "",
    "PARARI",
  ].join("\n");
  const safeName = escapeHtml(input.applicantName);
  const safeTitle = escapeHtml(input.applicationTitle);
  const htmlItems = statusItems
    .map((item) => {
      const safeHeading = escapeHtml(item.heading);
      const safeOccurrence = item.occurrenceLabel
        ? escapeHtml(item.occurrenceLabel)
        : "";
      const safeStatusUrl = escapeHtml(item.statusUrl);

      return `
        <div style="margin: 20px 0; padding: 16px; border: 1px solid #e5e5e5; border-radius: 16px;">
          <p style="margin: 0; font-weight: 700;">${safeHeading}</p>
          ${safeOccurrence ? `<p style="margin: 6px 0 0; font-size: 13px; color: #525252;">開催日時：${safeOccurrence}</p>` : ""}
          <p style="margin: 16px 0 0;">
            <a href="${safeStatusUrl}" style="display: inline-block; border-radius: 9999px; background: #171717; color: #ffffff; padding: 12px 20px; text-decoration: none; font-weight: 700;">申込内容・状況を確認する</a>
          </p>
        </div>
      `;
    })
    .join("");
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #171717; line-height: 1.8; max-width: 600px; margin: 0 auto; padding: 24px;">
      <p>${safeName} 様</p>
      <h1 style="font-size: 20px; margin: 24px 0 12px;">${safeTitle}</h1>
      <p>申込状況を確認するための専用リンクです。</p>
      ${htmlItems}
      <p style="font-size: 12px; color: #737373;">このURLは申込者専用です。第三者へ共有しないでください。</p>
      <p style="margin-top: 32px;">PARARI</p>
    </div>
  `;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send(
      {
        from: "PARARI <application@parari.app>",
        to: [input.applicantEmail],
        subject,
        text,
        html,
      },
      {
        headers: {
          "Idempotency-Key": idempotencyKey(input),
        },
      },
    );

    if (error) {
      console.error(
        "[APPLICATION guest status email] Resend rejected the message:",
        error.name,
      );
      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    console.error(
      "[APPLICATION guest status email] Send failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return { ok: false };
  }
}
