import "server-only";

import { OTP_EXPIRY_MINUTES } from "@/lib/emailVerification.mjs";

export function getEmailVerificationConfig() {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM_EMAIL || "").trim();
  const webhookSecret = String(process.env.RESEND_WEBHOOK_SECRET || "").trim();
  const pepper = String(process.env.EMAIL_OTP_PEPPER || "");

  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");
  if (!from) throw new Error("RESEND_FROM_EMAIL is not configured.");
  if (pepper.length < 32) throw new Error("EMAIL_OTP_PEPPER must contain at least 32 characters.");

  return { apiKey, from, webhookSecret, pepper, expiryMinutes: OTP_EXPIRY_MINUTES };
}
