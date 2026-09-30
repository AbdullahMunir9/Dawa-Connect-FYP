import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectToDatabase from "@/lib/mongodb";
import { getEmailVerificationConfig } from "@/lib/emailConfig";
import {
  OTP_EXPIRY_MS,
  OTP_RESEND_COOLDOWN_MS,
  createEmailOtp,
  hashEmailOtp,
  isPlausibleEmail,
  maskEmail,
  normalizeEmail,
  requestAddress,
} from "@/lib/emailVerification.mjs";
import { sendSignupVerificationEmail } from "@/lib/resendEmail";
import { consumeVerificationRateLimit } from "@/lib/verificationRateLimit";
import PendingRegistration from "@/models/PendingRegistration";
import User from "@/models/User";

export const runtime = "nodejs";

const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const HOUR_MS = 60 * 60 * 1000;

function reply(body, status, headers = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function POST(req) {
  let challengeId = "";
  try {
    const { name, email, password, phone, city } = await req.json();
    const normalizedEmail = normalizeEmail(email);
    const trimmedName = String(name || "").trim();
    const trimmedPhone = String(phone || "").trim();
    const trimmedCity = String(city || "").trim();

    if (!trimmedName || !normalizedEmail || !password || !trimmedPhone || !trimmedCity) {
      return reply({ message: "Please fill in all fields." }, 400);
    }
    if (trimmedName.length > 60 || trimmedPhone.length > 40 || trimmedCity.length > 100) {
      return reply({ message: "One or more registration fields are too long." }, 400);
    }
    if (!isPlausibleEmail(normalizedEmail)) {
      return reply({ message: "Enter a valid email address." }, 400);
    }
    if (!STRONG_PASSWORD_REGEX.test(password)) {
      return reply({ message: "Password must be at least 8 characters and include 1 uppercase letter, 1 number, and 1 special character." }, 400);
    }

    const { pepper } = getEmailVerificationConfig();
    await connectToDatabase();
    const ipLimit = await consumeVerificationRateLimit({
      scope: "signup-request-ip",
      identifier: requestAddress(req.headers),
      limit: 20,
      windowMs: HOUR_MS,
    });
    const emailLimit = await consumeVerificationRateLimit({
      scope: "signup-request-email",
      identifier: normalizedEmail,
      limit: 5,
      windowMs: HOUR_MS,
    });
    if (!ipLimit.allowed || !emailLimit.allowed) {
      const retryAfter = Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds);
      return reply(
        { message: "Too many verification requests. Please wait before trying again.", retryAfter },
        429,
        { "Retry-After": String(retryAfter) }
      );
    }

    if (await User.exists({ email: normalizedEmail })) {
      return reply({ message: "An account already exists with this email. Sign in instead." }, 409);
    }

    const now = new Date();
    const otp = createEmailOtp();
    challengeId = randomBytes(32).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 12);
    const otpHash = hashEmailOtp({ challengeId, email: normalizedEmail, otp, pepper });
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);
    const resendAvailableAt = new Date(now.getTime() + OTP_RESEND_COOLDOWN_MS);

    await PendingRegistration.findOneAndUpdate(
      { email: normalizedEmail },
      { $set: {
        challengeId,
        email: normalizedEmail,
        name: trimmedName,
        phone: trimmedPhone,
        city: trimmedCity,
        passwordHash,
        otpHash,
        expiresAt,
        deleteAt: new Date(now.getTime() + HOUR_MS),
        resendAvailableAt,
        attempts: 0,
        sendCount: 1,
        sendWindowStartedAt: now,
        consumedAt: null,
        lastEmailId: "",
        deliveryStatus: "queued",
        deliveryFailure: "",
      } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    let emailId;
    try {
      emailId = await sendSignupVerificationEmail({ to: normalizedEmail, name: trimmedName, otp });
    } catch (error) {
      await PendingRegistration.deleteOne({ challengeId });
      console.error("Signup verification email error:", error?.message || error);
      return reply({ message: "We could not send the verification email. Check the address and try again." }, 502);
    }

    await PendingRegistration.updateOne({ challengeId }, { $set: { lastEmailId: emailId, deliveryStatus: "sent" } });
    return reply({
      message: "Verification code sent.",
      challengeId,
      maskedEmail: maskEmail(normalizedEmail),
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: resendAvailableAt.toISOString(),
    }, 202);
  } catch (error) {
    if (challengeId) await PendingRegistration.deleteOne({ challengeId }).catch(() => {});
    if (error?.code === 11000) {
      return reply({ message: "A verification request is already in progress. Please try again." }, 409);
    }
    if (/RESEND_|EMAIL_OTP_PEPPER/.test(String(error?.message || ""))) {
      console.error("Email verification configuration error:", error.message);
      return reply({ message: "Email verification is not configured yet. Please contact support." }, 503);
    }
    console.error("Signup request error:", error?.message || error);
    return reply({ message: "An error occurred while starting registration." }, 500);
  }
}
