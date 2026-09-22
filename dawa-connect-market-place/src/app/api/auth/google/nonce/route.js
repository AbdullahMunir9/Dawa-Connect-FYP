import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!clientId) {
    return NextResponse.json(
      { configured: false, message: "Google sign-in is not configured yet." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const nonce = randomBytes(32).toString("base64url");
  const response = NextResponse.json(
    { configured: true, clientId, nonce },
    { headers: { "Cache-Control": "no-store" } }
  );
  response.cookies.set({
    name: "google_auth_nonce",
    value: nonce,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 10 * 60,
    path: "/api/auth/google",
  });
  return response;
}
