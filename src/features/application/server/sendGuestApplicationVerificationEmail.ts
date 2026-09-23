import { Resend } from "resend";

const DEFAULT_APP_URL = "https://www.parari.app";

type GuestApplicationVerificationEmailInput = {
  applicantEmail: string;
  applicantName: string;
  applicationTitle: string;
  verificationToken: string;
};

type GuestApplicationVerificationEmailResult =
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

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return DEFAULT_APP_URL;
    }

    return url.origin;
  } catch {
    return DEFAULT_APP_URL;
  }
}

export async function sendGuestApplicationVerificationEmail(
  input: GuestApplicationVerificationEmailInput,
): Promise<GuestApplicationVerificationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    console.error(
      "[APPLICATION guest verification email] RESEND_API_KEY is not set.",
    );
    return { ok: false };
  }

  const verificationUrl = new URL(
    "/api/application/guest-verify",
    getAppUrl(),
  );

  verificationUrl.searchParams.set(
    "token",
    input.verificationToken,
  );

  const subject =
    `【PARARI】${input.applicationTitle} メールアドレス確認`;
  const text = [
    `${input.applicantName} 様`,
    "",
    `「${input.applicationTitle}」へのお申し込みを完了するには、メールアドレスの確認が必要です。`,
    "",
    "次のリンクを開いてください。",
    verificationUrl.toString(),
    "",
    "リンクを開くまでAPPLICATIONは確定しません。",
    "定員のある募集では、確認時点で空きがある場合に受付されます。",
    "",
    "このメールに心当たりがない場合は、何もせず破棄してください。",
    "",
    "PARARI",
  ].join("\n");

  const safeName = escapeHtml(input.applicantName);
  const safeTitle = escapeHtml(input.applicationTitle);
  const safeUrl = escapeHtml(verificationUrl.toString());
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #171717; line-height: 1.8; max-width: 600px; margin: 0 auto; padding: 24px;">
      <p>${safeName} 様</p>
      <h1 style="font-size: 20px; margin: 24px 0 12px;">${safeTitle}</h1>
      <p>お申し込みを完了するには、メールアドレスの確認が必要です。</p>
      <p style="margin: 24px 0;">
        <a href="${safeUrl}" style="display: inline-block; border-radius: 9999px; background: #171717; color: #ffffff; padding: 12px 20px; text-decoration: none; font-weight: 700;">メールアドレスを確認して申し込みを完了</a>
      </p>
      <p style="font-size: 12px; color: #737373;">リンクを開くまでAPPLICATIONは確定しません。定員のある募集では、確認時点で空きがある場合に受付されます。</p>
      <p style="font-size: 12px; color: #737373;">このメールに心当たりがない場合は、何もせず破棄してください。</p>
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
        "[APPLICATION guest verification email] Resend rejected the message:",
        error.name,
      );
      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    console.error(
      "[APPLICATION guest verification email] Send failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return { ok: false };
  }
}
