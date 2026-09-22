import { createContext, useContext, useMemo } from "react";
import { AdminAPI } from "../lib/api";
import { useQuery } from "../hooks/useQuery";
import { useAuth } from "./AuthContext";

const BadgesContext = createContext({ badges: null, refresh: () => {} });

// Sidebar counters (pending approvals, open complaints…) refreshed every 45 s and after actions.
export function BadgesProvider({ children }) {
  const { admin } = useAuth();
  const { data, refetch } = useQuery(() => AdminAPI.badges(), [admin?.id], { enabled: Boolean(admin), pollMs: 45000 });
  const value = useMemo(() => ({ badges: data, refresh: () => refetch({ silent: true }) }), [data, refetch]);
  return <BadgesContext.Provider value={value}>{children}</BadgesContext.Provider>;
}

export function useBadges() {
  return useContext(BadgesContext);
}
