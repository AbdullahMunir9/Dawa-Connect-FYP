import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { getEmailVerificationConfig } from "@/lib/emailConfig";
import {
  MAX_OTP_SENDS_PER_HOUR,
  OTP_EXPIRY_MS,
  OTP_RESEND_COOLDOWN_MS,
  createEmailOtp,
  hashEmailOtp,
  requestAddress,
} from "@/lib/emailVerification.mjs";
import { sendSignupVerificationEmail } from "@/lib/resendEmail";
import { consumeVerificationRateLimit } from "@/lib/verificationRateLimit";
import PendingRegistration from "@/models/PendingRegistration";

export const runtime = "nodejs";

const HOUR_MS = 60 * 60 * 1000;

function reply(body, status, headers = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function POST(req) {
  try {
    const { challengeId } = await req.json();
    if (typeof challengeId !== "string" || challengeId.length < 30) {
      return reply({ message: "This verification request is invalid." }, 400);
    }
    const { pepper } = getEmailVerificationConfig();
    await connectToDatabase();
    const rate = await consumeVerificationRateLimit({
      scope: "signup-resend-ip",
      identifier: requestAddress(req.headers),
      limit: 20,
      windowMs: HOUR_MS,
    });
    if (!rate.allowed) {
      return reply(
        { message: "Too many resend requests. Please wait before trying again.", retryAfter: rate.retryAfterSeconds },
        429,
        { "Retry-After": String(rate.retryAfterSeconds) }
      );
    }

    const pending = await PendingRegistration.findOne({ challengeId }).select("+otpHash");
    if (!pending || pending.consumedAt) {
      return reply({ message: "This verification request is invalid or has already been used." }, 400);
    }
    const now = new Date();
    if (pending.resendAvailableAt.getTime() > now.getTime()) {
      const retryAfter = Math.max(1, Math.ceil((pending.resendAvailableAt.getTime() - now.getTime()) / 1000));
      return reply({ message: `You can request another code in ${retryAfter} seconds.`, retryAfter }, 429, { "Retry-After": String(retryAfter) });
    }

    const windowExpired = now.getTime() - pending.sendWindowStartedAt.getTime() >= HOUR_MS;
    const sendCount = windowExpired ? 0 : pending.sendCount;
    if (sendCount >= MAX_OTP_SENDS_PER_HOUR) {
      const retryAfter = Math.max(1, Math.ceil((pending.sendWindowStartedAt.getTime() + HOUR_MS - now.getTime()) / 1000));
      return reply({ message: "Too many codes were sent to this address. Please try again later.", retryAfter }, 429, { "Retry-After": String(retryAfter) });
    }

    const otp = createEmailOtp();
    const otpHash = hashEmailOtp({ challengeId, email: pending.email, otp, pepper });
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);
    const resendAvailableAt = new Date(now.getTime() + OTP_RESEND_COOLDOWN_MS);
    const oldState = {
      otpHash: pending.otpHash,
      expiresAt: pending.expiresAt,
      resendAvailableAt: pending.resendAvailableAt,
      attempts: pending.attempts,
      sendCount: pending.sendCount,
      sendWindowStartedAt: pending.sendWindowStartedAt,
      deliveryStatus: pending.deliveryStatus,
      deliveryFailure: pending.deliveryFailure,
    };

    const updated = await PendingRegistration.findOneAndUpdate(
      { _id: pending._id, consumedAt: null, resendAvailableAt: { $lte: now } },
      { $set: {
        otpHash,
        expiresAt,
        deleteAt: new Date(now.getTime() + HOUR_MS),
        resendAvailableAt,
        attempts: 0,
        sendCount: sendCount + 1,
        sendWindowStartedAt: windowExpired ? now : pending.sendWindowStartedAt,
        deliveryStatus: "queued",
        deliveryFailure: "",
      } },
      { new: true }
    );
    if (!updated) return reply({ message: "A new code is already being requested. Please wait." }, 409);

    let emailId;
    try {
      emailId = await sendSignupVerificationEmail({ to: pending.email, name: pending.name, otp });
    } catch (error) {
      await PendingRegistration.updateOne({ _id: pending._id, otpHash }, { $set: oldState });
      console.error("Resend verification email error:", error?.message || error);
      return reply({ message: "We could not send another code. Check the address and try again." }, 502);
    }

    await PendingRegistration.updateOne(
      { _id: pending._id, otpHash },
      { $set: { lastEmailId: emailId, deliveryStatus: "sent" } }
    );
    return reply({
      message: "A new verification code was sent.",
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: resendAvailableAt.toISOString(),
    }, 200);
  } catch (error) {
    if (/RESEND_|EMAIL_OTP_PEPPER/.test(String(error?.message || ""))) {
      console.error("Email verification configuration error:", error.message);
      return reply({ message: "Email verification is not configured yet. Please contact support." }, 503);
    }
    console.error("Signup resend error:", error?.message || error);
    return reply({ message: "Another code could not be sent. Please try again." }, 500);
  }
}
