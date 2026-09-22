import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function proxy(request) {
  const token = request.cookies.get("auth_token")?.value;
  let isAuthenticated = false;

  if (token && process.env.JWT_SECRET) {
    try {
      const key = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, key);
      isAuthenticated = Boolean(payload.userId);
    } catch {
      isAuthenticated = false;
    }
  }

  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    );
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
