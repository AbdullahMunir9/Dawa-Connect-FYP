import test from "node:test";
import assert from "node:assert/strict";
import {
  OTP_EXPIRY_MINUTES,
  createEmailOtp,
  emailOtpMatches,
  hashEmailOtp,
  isPlausibleEmail,
  maskEmail,
  normalizeEmail,
} from "./emailVerification.mjs";

const pepper = "test-only-pepper-that-is-longer-than-thirty-two-characters";

test("email OTP configuration uses a five-minute expiry", () => {
  assert.equal(OTP_EXPIRY_MINUTES, 5);
});

test("creates a six-digit OTP and verifies only the matching challenge", () => {
  const otp = createEmailOtp();
  assert.match(otp, /^\d{6}$/);
  const expectedHash = hashEmailOtp({ challengeId: "challenge-a", email: "USER@Example.com", otp, pepper });
  assert.equal(emailOtpMatches({ challengeId: "challenge-a", email: "user@example.com", otp, pepper, expectedHash }), true);
  assert.equal(emailOtpMatches({ challengeId: "challenge-b", email: "user@example.com", otp, pepper, expectedHash }), false);
  assert.equal(emailOtpMatches({ challengeId: "challenge-a", email: "user@example.com", otp: "000000", pepper, expectedHash }), otp === "000000");
});

test("normalizes, validates, and masks email addresses", () => {
  assert.equal(normalizeEmail("  Person@Example.COM "), "person@example.com");
  assert.equal(isPlausibleEmail("person@example.com"), true);
  assert.equal(isPlausibleEmail("person@invalid"), false);
  assert.equal(maskEmail("spongebob@gmail.com"), "sp*******@gmail.com");
});
