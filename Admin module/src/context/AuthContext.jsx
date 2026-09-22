import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AdminAPI, session } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => session.admin);
  const [checking, setChecking] = useState(() => Boolean(session.token));
  const [sessionMessage, setSessionMessage] = useState("");

  const logout = useCallback((message = "") => {
    session.clear();
    setAdmin(null);
    setSessionMessage(message);
  }, []);

  // Validate a stored token once on load so a deleted/expired admin is signed out immediately.
  useEffect(() => {
    let active = true;
    if (!session.token) return undefined;
    AdminAPI.me()
      .then((fresh) => { if (active) { setAdmin(fresh); session.save(session.token, fresh); } })
      .catch(() => { if (active) logout(); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [logout]);

  useEffect(() => {
    const onUnauthorized = (event) => logout(event.detail || "Your session has ended. Please sign in again.");
    window.addEventListener("dc-admin:unauthorized", onUnauthorized);
    return () => window.removeEventListener("dc-admin:unauthorized", onUnauthorized);
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const data = await AdminAPI.login(email, password);
    session.save(data.token, data.admin);
    setSessionMessage("");
    setAdmin(data.admin);
    return data.admin;
  }, []);

  const value = useMemo(() => ({
    admin, checking, login, logout, sessionMessage, clearSessionMessage: () => setSessionMessage(""),
    isSuperadmin: admin?.role === "superadmin",
  }), [admin, checking, login, logout, sessionMessage]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
