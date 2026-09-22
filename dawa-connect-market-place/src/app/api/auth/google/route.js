import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import connectToDatabase from "@/lib/mongodb";
import { createMarketplaceToken, marketplaceUserView, setMarketplaceSession } from "@/lib/authSession";
import { googleIdentityFromPayload } from "@/lib/googleIdentity.mjs";
import User from "@/models/User";

export const runtime = "nodejs";

const googleClient = new OAuth2Client();
const rateState = globalThis.__googleMarketplaceAuthRate ||= new Map();

function sameValue(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function allowedRequest(request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== request.nextUrl.host) return false;
    } catch {
      return false;
    }
  }

  const rawAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip") || "local";
  const id = createHash("sha256").update(rawAddress).digest("hex").slice(0, 24);
  const now = Date.now();
  let entry = rateState.get(id);
  if (!entry || entry.expiresAt <= now) entry = { attempts: 0, expiresAt: now + 60_000 };
  entry.attempts += 1;
  rateState.set(id, entry);
  if (rateState.size > 2000) {
    for (const [key, value] of rateState) if (value.expiresAt <= now) rateState.delete(key);
  }
  return entry.attempts <= 20;
}

function clearNonce(response) {
  response.cookies.set({
    name: "google_auth_nonce",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/api/auth/google",
  });
  return response;
}

function failure(message, status) {
  return clearNonce(NextResponse.json({ message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  }));
}

export async function POST(request) {
  if (!allowedRequest(request)) {
    return failure("Too many Google sign-in attempts. Please wait a minute.", 429);
  }

  const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!clientId) return failure("Google sign-in is not configured yet.", 503);

  try {
    const body = await request.json();
    const credential = typeof body?.credential === "string" ? body.credential.trim() : "";
    const intent = body?.intent === "signup" ? "signup" : body?.intent === "login" ? "login" : "";
    const nonce = request.cookies.get("google_auth_nonce")?.value || "";
    if (!credential || credential.length > 10000 || !intent || !nonce) {
      return failure("Google sign-in expired. Please try again.", 400);
    }

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload || !sameValue(payload.nonce, nonce)) {
      return failure("Google sign-in could not be verified. Please try again.", 401);
    }

    const identity = googleIdentityFromPayload(payload);
    if (!identity) {
      return failure("Google did not provide a verified email address for this account.", 401);
    }

    await connectToDatabase();
    let user = await User.findOne({ googleSub: identity.sub }).select("+googleSub");

    if (!user) {
      user = await User.findOne({ email: identity.email }).select("+googleSub");
      if (user) {
        if (user.googleSub && user.googleSub !== identity.sub) {
          return failure("This email is already connected to another Google account.", 409);
        }
        if (!identity.authoritativeEmail) {
          return failure("Sign in with your password for this email. Email OTP linking will be available next.", 409);
        }
      } else if (intent === "login") {
        return failure("No Marketplace account uses this Google account. Choose Register first.", 404);
      } else {
        if (!identity.authoritativeEmail) {
          return failure("Use a Gmail or Google Workspace address, or register with email and verify it by OTP when that option is available.", 400);
        }
        user = new User({
          name: identity.name,
          email: identity.email,
          googleSub: identity.sub,
          emailVerifiedAt: new Date(),
          picture: identity.picture,
          status: "active",
          phone: "",
          city: "",
        });
      }
    }

    if (String(user.status || "active").toLowerCase() === "suspended") {
      return failure("Your account is suspended. Please contact support.", 403);
    }

    if (!user.googleSub) user.googleSub = identity.sub;
    if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
    if (!user.picture && identity.picture) user.picture = identity.picture;
    if (!user.status) user.status = "active";
    await user.save();

    const token = await createMarketplaceToken(user);
    const response = NextResponse.json({
      message: intent === "signup" ? "Google account connected successfully." : "Login successful.",
      user: marketplaceUserView(user),
    }, { headers: { "Cache-Control": "no-store" } });
    clearNonce(response);
    return setMarketplaceSession(response, token);
  } catch (error) {
    if (error?.code === 11000) {
      return failure("This Google account or email is already connected. Try signing in instead.", 409);
    }
    console.error("Google authentication error:", error?.message || error);
    return failure("Google sign-in could not be completed. Please try again.", 401);
  }
}
