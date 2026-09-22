import { getClientSessionId } from "@/lib/clientSession";

/** Records recent search when possible and navigates to /search?q=… */
export async function recordSearchAndNavigate(router, rawQuery) {
  const q = String(rawQuery ?? "").trim();
  if (!q) return;
  const sessionId = getClientSessionId();
  if (sessionId) {
    try {
      await fetch("/api/recent-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-id": sessionId },
        body: JSON.stringify({ query: q }),
      });
    } catch {
      /* navigate anyway */
    }
  }
  router.push(`/search?q=${encodeURIComponent(q)}`);
}
