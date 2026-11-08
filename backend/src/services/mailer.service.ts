import nodemailer, { type Transporter } from "nodemailer";
import type { Attachment } from "nodemailer/lib/mailer";
import { env } from "@/config/env";
import { logger } from "@/config/logger";

export interface MailInput {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
}

export interface MailResult {
  sent: boolean;
  /** Why nothing was sent (not configured, no recipients, SMTP error...). */
  reason?: string;
  recipients: string[];
  messageId?: string;
}

let transporter: Transporter | null = null;

export function isMailConfigured(): boolean {
  return !!env.smtp.host;
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

/** Never throws: callers decide how to report `sent: false` (billing must not fail because email did). */
export async function sendMail(input: MailInput): Promise<MailResult> {
  const recipients = Array.from(new Set(input.to.map((e) => e.trim()).filter(Boolean)));
  if (recipients.length === 0) return { sent: false, reason: "No email recipients are configured", recipients };
  if (!isMailConfigured()) {
    return {
      sent: false,
      reason: "Email is not set up: add SMTP_HOST / SMTP_USER / SMTP_PASS to backend/.env and restart the API",
      recipients,
    };
  }
  try {
    const info = await getTransporter().sendMail({
      from: env.smtp.from,
      to: recipients.join(", "),
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments,
    });
    return { sent: true, recipients, messageId: info.messageId };
  } catch (err) {
    logger.error({ err }, "mail send failed");
    const reason = env.isProduction
      ? "Could not send email. Check SMTP settings and server logs."
      : `Could not send email: ${err instanceof Error ? err.message : "Unknown SMTP error"}`;
    return { sent: false, reason, recipients };
  }
}
