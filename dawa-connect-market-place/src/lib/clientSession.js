/** Browser session used for anonymous recent searches (matches search page logic). */

export function getClientSessionId() {
  if (typeof window === "undefined") return "";
  const key = "dc_session_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const generated = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(key, generated);
  return generated;
}
