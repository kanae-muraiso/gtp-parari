import { Resend } from "resend";

const CANCELLATION_TOKEN_RE = /^[0-9a-f]{32}$/;
const DEFAULT_APP_URL = "https://www.parari.app";

type GuestApplicationEmailInput = {
  applicantEmail: string;
  applicantName: string;
  applicationTitle: string;
  cancellationToken: string;
  entryStatus: string;
};

type GuestApplicationEmailResult =
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

export async function sendGuestApplicationConfirmationEmail(
  input: GuestApplicationEmailInput,
): Promise<GuestApplicationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const cancellationToken = input.cancellationToken
    .trim()
    .toLowerCase();

  if (!apiKey) {
    console.error(
      "[APPLICATION guest email] RESEND_API_KEY is not set.",
    );
    return { ok: false };
  }

  if (!CANCELLATION_TOKEN_RE.test(cancellationToken)) {
    console.error(
      "[APPLICATION guest email] Cancellation token is invalid.",
    );
    return { ok: false };
  }

  const statusUrl = new URL(
    `/c/${cancellationToken}`,
    getAppUrl(),
  ).toString();
  const acceptedMessage =
    input.entryStatus === "confirmed"
      ? "お申し込みが確定しました。"
      : "お申し込みを受け付けました。現在、主催者の確認待ちです。";
  const subject = `【PARARI】${input.applicationTitle} 申込受付のお知らせ`;
  const text = [
    `${input.applicantName} 様`,
    "",
    `「${input.applicationTitle}」への${acceptedMessage}`,
    "",
    "申込内容・現在の状況は、次の専用ページから確認できます。",
    "申込の取り下げ・キャンセルが可能な場合も、このページから手続きできます。",
    statusUrl,
    "",
    "このURLは申込者専用です。第三者へ共有しないでください。",
    "",
    "PARARI",
  ].join("\n");
  const safeName = escapeHtml(input.applicantName);
  const safeTitle = escapeHtml(input.applicationTitle);
  const safeAcceptedMessage = escapeHtml(acceptedMessage);
  const safeStatusUrl = escapeHtml(statusUrl);
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #171717; line-height: 1.8; max-width: 600px; margin: 0 auto; padding: 24px;">
      <p>${safeName} 様</p>
      <h1 style="font-size: 20px; margin: 24px 0 12px;">${safeTitle}</h1>
      <p>お申し込みについて、${safeAcceptedMessage}</p>
      <p style="margin-top: 24px;">申込内容・現在の状況は、次の専用ページから確認できます。申込の取り下げ・キャンセルが可能な場合も、このページから手続きできます。</p>
      <p style="margin: 24px 0;">
        <a href="${safeStatusUrl}" style="display: inline-block; border-radius: 9999px; background: #171717; color: #ffffff; padding: 12px 20px; text-decoration: none; font-weight: 700;">申込内容・状況を確認する</a>
      </p>
      <p style="font-size: 12px; color: #737373;">このURLは申込者専用です。第三者へ共有しないでください。</p>
      <p style="margin-top: 32px;">PARARI</p>
    </div>
  `;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "PARARI <application@parari.app>",
      to: [input.applicantEmail],
      subject,
      text,
      html,
    });

    if (error) {
      console.error(
        "[APPLICATION guest email] Resend rejected the message:",
        error.name,
      );
      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    console.error(
      "[APPLICATION guest email] Send failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return { ok: false };
  }
}
