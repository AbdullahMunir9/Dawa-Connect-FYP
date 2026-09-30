import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 5;
export const OTP_EXPIRY_MS = OTP_EXPIRY_MINUTES * 60 * 1000;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_RESEND_COOLDOWN_MS = OTP_RESEND_COOLDOWN_SECONDS * 1000;
export const MAX_OTP_ATTEMPTS = 5;
export const MAX_OTP_SENDS_PER_HOUR = 5;

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isPlausibleEmail(value) {
  const email = normalizeEmail(value);
  if (email.length < 6 || email.length > 254) return false;
  const at = email.lastIndexOf("@");
  if (at <= 0 || at >= email.length - 3) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return local.length <= 64 && !local.startsWith(".") && !local.endsWith(".") &&
    !local.includes("..") && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) &&
    domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".") &&
    domain.split(".").every((label) => label.length > 0 && label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label));
}

export function createEmailOtp() {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

export function hashEmailOtp({ challengeId, email, otp, pepper }) {
  if (!pepper || String(pepper).length < 32) {
    throw new Error("EMAIL_OTP_PEPPER must contain at least 32 characters.");
  }
  return createHmac("sha256", pepper)
    .update(`${challengeId}:${normalizeEmail(email)}:${String(otp)}`)
    .digest("hex");
}

export function emailOtpMatches({ challengeId, email, otp, pepper, expectedHash }) {
  if (!/^[0-9]{6}$/.test(String(otp || "")) || !/^[a-f0-9]{64}$/i.test(String(expectedHash || ""))) {
    return false;
  }
  const actual = Buffer.from(hashEmailOtp({ challengeId, email, otp, pepper }), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function maskEmail(value) {
  const email = normalizeEmail(value);
  const [local, domain] = email.split("@");
  if (!local || !domain) return "your email address";
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(3, Math.min(8, local.length - visible.length)))}@${domain}`;
}

export function requestAddress(headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headers.get("x-real-ip")?.trim()
    || "local";
}
