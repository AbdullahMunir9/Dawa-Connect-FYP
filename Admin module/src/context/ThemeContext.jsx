import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);
const KEY = "dc-admin-theme";

function readPreference() {
  try { return localStorage.getItem(KEY) || "system"; } catch { return "system"; }
}

function resolve(preference) {
  if (preference === "dark" || preference === "light") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readPreference);
  const [resolved, setResolved] = useState(() => resolve(readPreference()));

  useEffect(() => {
    const apply = () => {
      const next = resolve(preference);
      setResolved(next);
      document.documentElement.classList.toggle("dark", next === "dark");
    };
    apply();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);

  const set = useCallback((next) => {
    setPreference(next);
    try { if (next === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, next); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({
    preference, theme: resolved, isDark: resolved === "dark", setTheme: set,
    toggle: () => set(resolved === "dark" ? "light" : "dark"),
  }), [preference, resolved, set]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
