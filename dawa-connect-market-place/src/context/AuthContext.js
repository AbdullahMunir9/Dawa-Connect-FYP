"use client";

import { createContext, useState, useEffect, useContext, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const sessionRevisionRef = useRef(0);

  const checkUserLoggedIn = useCallback(async () => {
    const revision = ++sessionRevisionRef.current;
    try {
      const res = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (revision !== sessionRevisionRef.current) return null;
      const nextUser = res.ok ? data.user : null;
      setUser(nextUser);
      return nextUser;
    } catch {
      if (revision === sessionRevisionRef.current) setUser(null);
      return null;
    } finally {
      if (revision === sessionRevisionRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkUserLoggedIn();
  }, [checkUserLoggedIn]);

  const safePath = (redirectTo) =>
    typeof redirectTo === "string" &&
    redirectTo.startsWith("/") &&
    !redirectTo.startsWith("//")
      ? redirectTo
      : "/";

  const finishAuthentication = async (revision, redirectTo) => {
    // Confirm that the HttpOnly cookie from the login response is usable before
    // entering a route protected by proxy.js. This also gives us the canonical
    // database user instead of trusting only the authentication response body.
    let sessionResponse;
    let sessionData;
    try {
      sessionResponse = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "same-origin",
      });
      sessionData = await sessionResponse.json().catch(() => ({}));
    } catch {
      return {
        success: false,
        message: "The sign-in session could not be verified. Check your connection and try again.",
      };
    }

    if (!sessionResponse.ok || !sessionData.user) {
      return {
        success: false,
        message: sessionData.message || "Your account was created, but the sign-in session could not be started. Please try again.",
      };
    }
    if (revision !== sessionRevisionRef.current) {
      return { success: false, message: "A newer sign-in request replaced this one." };
    }

    setUser(sessionData.user);
    setLoading(false);
    router.replace(safePath(redirectTo));
    router.refresh();
    return { success: true };
  };

  const login = async (email, password, redirectTo = "/") => {
    const revision = ++sessionRevisionRef.current;
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, password }),
    });
    
    const data = await res.json();
    
    if (res.ok) {
      return finishAuthentication(revision, redirectTo);
    } else {
      return { success: false, message: data.message };
    }
  };

  const googleAuthenticate = async (credential, intent, redirectTo = "/") => {
    const revision = ++sessionRevisionRef.current;
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ credential, intent }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, message: data.message || "Google sign-in failed." };
    return finishAuthentication(revision, redirectTo);
  };

  const signup = async (name, email, password, phone, city) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, phone, city }),
    });

    const data = await res.json();

    if (res.ok) {
      router.push("/login");
      return { success: true };
    } else {
      return { success: false, message: data.message };
    }
  };

  const logout = async () => {
    ++sessionRevisionRef.current;
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    setUser(null);
    setLoading(false);
    router.replace("/");
    router.refresh();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, googleAuthenticate, signup, logout, checkUserLoggedIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
