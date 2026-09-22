import "server-only";

import { SignJWT } from "jose";

const SESSION_SECONDS = 60 * 60 * 24 * 7;

function signingKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export function marketplaceUserView(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    status: String(user.status || "active").toLowerCase(),
    phone: user.phone || "",
    city: user.city || "",
    picture: user.picture || "",
    emailVerified: Boolean(user.emailVerifiedAt),
    addresses: user.addresses || [],
  };
}

export async function createMarketplaceToken(user) {
  return new SignJWT({
    userId: String(user._id),
    email: user.email,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(signingKey());
}

export function setMarketplaceSession(response, token) {
  response.cookies.set({
    name: "auth_token",
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_SECONDS,
    path: "/",
  });
  return response;
}
