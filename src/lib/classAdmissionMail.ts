import "server-only";
import { Resend } from "resend";

export async function classAdmissionMail(to: string, subject: string, text: string, idempotencyKey: string, scheduledAt?: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  try {
    const { error } = await new Resend(key).emails.send({
      from: process.env.APPLICATION_EMAIL_FROM || "PARARI <application@parari.app>",
      to, subject, text, ...(scheduledAt ? { scheduledAt } : {}),
    }, { idempotencyKey });
    return !error;
  } catch {
    return false;
  }
}

export const classDateTime = (timestamp: string) => new Date(timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

export async function classNotice(recipients: (string | null | undefined)[], subject: string, text: string, key: string, scheduledAt?: string) {
  const emails = [...new Set(recipients.filter((email): email is string => Boolean(email)).map(email => email.toLowerCase()))];
  if (!emails.length) return false;
  const results = await Promise.all(emails.map((email, index) =>
    classAdmissionMail(email, subject, text, index ? key + "-" + index : key, scheduledAt)));
  return results.every(Boolean);
}
