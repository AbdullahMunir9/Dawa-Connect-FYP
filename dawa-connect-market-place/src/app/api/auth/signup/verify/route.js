import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { createMarketplaceToken, marketplaceUserView, setMarketplaceSession } from "@/lib/authSession";
import { getEmailVerificationConfig } from "@/lib/emailConfig";
import { MAX_OTP_ATTEMPTS, emailOtpMatches, requestAddress } from "@/lib/emailVerification.mjs";
import { consumeVerificationRateLimit } from "@/lib/verificationRateLimit";
import PendingRegistration from "@/models/PendingRegistration";
import User from "@/models/User";

export const runtime = "nodejs";

const TEN_MINUTES_MS = 10 * 60 * 1000;

function reply(body, status, headers = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function POST(req) {
  try {
    const { challengeId, otp } = await req.json();
    if (typeof challengeId !== "string" || challengeId.length < 30 || !/^\d{6}$/.test(String(otp || ""))) {
      return reply({ message: "Enter the six-digit verification code." }, 400);
    }

    const { pepper } = getEmailVerificationConfig();
    await connectToDatabase();
    const rate = await consumeVerificationRateLimit({
      scope: "signup-verify-ip",
      identifier: requestAddress(req.headers),
      limit: 30,
      windowMs: TEN_MINUTES_MS,
    });
    if (!rate.allowed) {
      return reply(
        { message: "Too many verification attempts. Please wait and try again.", retryAfter: rate.retryAfterSeconds },
        429,
        { "Retry-After": String(rate.retryAfterSeconds) }
      );
    }

    const pending = await PendingRegistration.findOne({ challengeId }).select("+otpHash +passwordHash");
    if (!pending || pending.consumedAt) {
      return reply({ message: "This verification request is invalid or has already been used." }, 400);
    }
    if (["bounced", "failed"].includes(pending.deliveryStatus)) {
      return reply({ message: "The verification email could not be delivered. Check the email address and start again." }, 400);
    }
    if (pending.expiresAt.getTime() <= Date.now()) {
      return reply({ message: "This verification code has expired. Request a new code." }, 410);
    }
    if (pending.attempts >= MAX_OTP_ATTEMPTS) {
      return reply({ message: "Too many incorrect attempts. Request a new code." }, 429);
    }

    const matches = emailOtpMatches({
      challengeId,
      email: pending.email,
      otp,
      pepper,
      expectedHash: pending.otpHash,
    });
    if (!matches) {
      const updated = await PendingRegistration.findOneAndUpdate(
        { _id: pending._id, consumedAt: null, attempts: { $lt: MAX_OTP_ATTEMPTS } },
        { $inc: { attempts: 1 } },
        { new: true }
      );
      const attemptsRemaining = Math.max(0, MAX_OTP_ATTEMPTS - Number(updated?.attempts || MAX_OTP_ATTEMPTS));
      return reply({
        message: attemptsRemaining
          ? `Incorrect verification code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining.`
          : "Too many incorrect attempts. Request a new code.",
        attemptsRemaining,
      }, attemptsRemaining ? 400 : 429);
    }

    if (await User.exists({ email: pending.email })) {
      await PendingRegistration.deleteOne({ _id: pending._id });
      return reply({ message: "An account already exists with this email. Sign in instead." }, 409);
    }

    const claimed = await PendingRegistration.findOneAndUpdate(
      { _id: pending._id, consumedAt: null, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_OTP_ATTEMPTS } },
      { $set: { consumedAt: new Date() } },
      { new: true }
    ).select("+passwordHash");
    if (!claimed) return reply({ message: "This verification request is no longer available." }, 409);

    let user;
    try {
      user = await User.create({
        name: claimed.name,
        email: claimed.email,
        password: claimed.passwordHash,
        status: "active",
        phone: claimed.phone,
        city: claimed.city,
        emailVerifiedAt: new Date(),
      });
    } catch (error) {
      if (error?.code !== 11000) {
        await PendingRegistration.updateOne(
          { _id: claimed._id, expiresAt: { $gt: new Date() } },
          { $set: { consumedAt: null } }
        );
        throw error;
      }
      await PendingRegistration.deleteOne({ _id: claimed._id });
      return reply({ message: "An account already exists with this email. Sign in instead." }, 409);
    }

    await PendingRegistration.deleteOne({ _id: claimed._id });
    const token = await createMarketplaceToken(user);
    const response = reply({
      message: "Email verified and account created successfully.",
      user: marketplaceUserView(user),
    }, 201);
    return setMarketplaceSession(response, token);
  } catch (error) {
    if (/RESEND_|EMAIL_OTP_PEPPER/.test(String(error?.message || ""))) {
      console.error("Email verification configuration error:", error.message);
      return reply({ message: "Email verification is not configured yet. Please contact support." }, 503);
    }
    console.error("Signup verification error:", error?.message || error);
    return reply({ message: "The verification could not be completed. Please try again." }, 500);
  }
}
