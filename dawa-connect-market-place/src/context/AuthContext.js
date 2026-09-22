"use client";

import { createContext, useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkUserLoggedIn();
  }, []);

  const checkUserLoggedIn = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, redirectTo = "/") => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await res.json();
    
    if (res.ok) {
      setUser(data.user);
      const safeRedirect =
        typeof redirectTo === "string" &&
        redirectTo.startsWith("/") &&
        !redirectTo.startsWith("//")
          ? redirectTo
          : "/";
      router.push(safeRedirect);
      router.refresh();
      return { success: true };
    } else {
      return { success: false, message: data.message };
    }
  };

  const googleAuthenticate = async (credential, intent, redirectTo = "/") => {
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential, intent }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, message: data.message || "Google sign-in failed." };

    setUser(data.user);
    const safeRedirect =
      typeof redirectTo === "string" && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
        ? redirectTo
        : "/";
    router.push(safeRedirect);
    router.refresh();
    return { success: true };
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
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, googleAuthenticate, signup, logout, checkUserLoggedIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
