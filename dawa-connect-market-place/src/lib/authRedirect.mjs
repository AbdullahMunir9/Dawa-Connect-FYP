const APP_ORIGIN = "https://dawaconnect.local";
const AUTH_PATHS = new Set(["/login", "/signup"]);

export function safeAuthRedirect(value, fallback = "/") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(value, APP_ORIGIN);
    if (url.origin !== APP_ORIGIN || AUTH_PATHS.has(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function authPageHref(authPath, returnTo) {
  const page = authPath === "/signup" ? "/signup" : "/login";
  return `${page}?next=${encodeURIComponent(safeAuthRedirect(returnTo))}`;
}
