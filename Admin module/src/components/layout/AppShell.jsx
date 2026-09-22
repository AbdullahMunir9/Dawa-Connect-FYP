import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck, PanelLeftClose, PanelLeftOpen, Menu, X, Sun, Moon, Monitor, LogOut, ChevronDown, Activity } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useBadges } from "../../context/BadgesContext";
import { useQuery } from "../../hooks/useQuery";
import { AdminAPI } from "../../lib/api";
import { cn } from "../../lib/format";
import { Avatar, Menu as DropMenu } from "../ui/primitives";
import { NAV, pageTitle } from "../../lib/nav";

function NavItem({ item, collapsed, badge, onNavigate }) {
  return (
    <NavLink to={item.to} end={item.end} onClick={onNavigate} title={collapsed ? item.label : undefined}
      className={({ isActive }) => cn("group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
        isActive ? "bg-brand-600 text-white shadow-sm shadow-brand-600/25" : "text-ink-2 hover:bg-surface-3 hover:text-ink", collapsed && "justify-center px-0")}>
      {({ isActive }) => (
        <>
          <item.icon className={cn("h-4.5 w-4.5 shrink-0", isActive ? "text-white" : "text-muted group-hover:text-ink")} />
          {!collapsed && <span className="truncate">{item.label}</span>}
          {badge > 0 && (
            <span className={cn("tabular rounded-full text-[10px] font-semibold", collapsed ? "absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 leading-4" : "ml-auto min-w-5 px-1.5 py-0.5 text-center", isActive ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200")}>
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { isSuperadmin } = useAuth();
  const { badges } = useBadges();
  return (
    <>
      <div className={cn("fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[1px] lg:hidden", mobileOpen ? "block animate-fade" : "hidden")} onClick={() => setMobileOpen(false)} />
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-surface transition-[width,transform] duration-200 lg:translate-x-0",
        collapsed ? "w-[68px]" : "w-64", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className={cn("flex h-16 items-center border-b border-line", collapsed ? "justify-center px-2" : "justify-between px-4")}>
          <NavLink to="/" className="flex items-center gap-2.5" aria-label="DawaConnect Admin home">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-white shadow-sm shadow-brand-600/30"><ShieldCheck className="h-4.5 w-4.5" /></span>
            {!collapsed && <span className="leading-tight"><span className="block text-[15px] font-bold tracking-tight text-ink">DawaConnect</span><span className="block text-[11px] font-medium text-muted">Admin console</span></span>}
          </NavLink>
          <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-surface-3 hover:text-ink lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X className="h-5 w-5" /></button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main">
          {NAV.map((group) => {
            const items = group.items.filter((item) => !item.superadmin || isSuperadmin);
            if (!items.length) return null;
            return (
              <div key={group.group}>
                {!collapsed && <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">{group.group}</p>}
                {collapsed && <div className="mx-2 mb-2 h-px bg-line first:hidden" />}
                <div className="space-y-0.5">
                  {items.map((item) => <NavItem key={item.to} item={item} collapsed={collapsed} badge={item.badge ? badges?.[item.badge] : 0} onNavigate={() => setMobileOpen(false)} />)}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="hidden border-t border-line p-3 lg:block">
          <button type="button" onClick={() => setCollapsed(!collapsed)} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-muted hover:bg-surface-3 hover:text-ink", collapsed && "justify-center px-0")} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> Collapse</>}
          </button>
        </div>
      </aside>
    </>
  );
}

function ThemeMenu() {
  const { preference, setTheme, isDark } = useTheme();
  const items = [
    { label: "Light", icon: Sun, onClick: () => setTheme("light") },
    { label: "Dark", icon: Moon, onClick: () => setTheme("dark") },
    { label: "System", icon: Monitor, onClick: () => setTheme("system") },
  ].map((item) => ({ ...item, label: `${item.label}${preference === item.label.toLowerCase() ? "  ✓" : ""}` }));
  return <DropMenu items={items} trigger={<button type="button" className="rounded-lg p-2 text-muted hover:bg-surface-3 hover:text-ink" aria-label="Change theme">{isDark ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}</button>} />;
}

function ApiStatus() {
  const { data, error } = useQuery(() => AdminAPI.health(), [], { pollMs: 60000 });
  const healthy = data?.ok && data.marketplaceDb && data.pharmacyDb;
  const label = error ? "API offline" : !data ? "Checking API…" : healthy ? "All systems connected" : "Database connecting…";
  return (
    <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted md:inline-flex" title={label}>
      <span className={cn("h-1.5 w-1.5 rounded-full", error ? "bg-red-500" : healthy ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
      <Activity className="h-3 w-3" />{label}
    </span>
  );
}

function Topbar({ setMobileOpen }) {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button type="button" className="rounded-lg p-2 text-muted hover:bg-surface-3 hover:text-ink lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
        <h1 className="truncate text-[17px] font-semibold tracking-tight text-ink">{pageTitle(location.pathname)}</h1>
      </div>
      <div className="flex items-center gap-1.5">
        <ApiStatus />
        <ThemeMenu />
        <DropMenu
          trigger={
            <button type="button" className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-surface-3" aria-label="Account menu">
              <Avatar name={admin?.name} size="sm" />
              <span className="hidden text-left leading-tight sm:block"><span className="block max-w-32 truncate text-[13px] font-semibold text-ink">{admin?.name}</span><span className="block text-[11px] capitalize text-muted">{admin?.role}</span></span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-muted sm:block" />
            </button>
          }
          items={[
            { label: admin?.email || "", disabled: true },
            "divider",
            admin?.role === "superadmin" && { label: "Manage admins", icon: ShieldCheck, onClick: () => navigate("/admins") },
            { label: "Sign out", icon: LogOut, danger: true, onClick: () => logout() },
          ]}
        />
      </div>
    </header>
  );
}

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem("dc-admin-sidebar") === "collapsed"; } catch { return false; } });
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { try { localStorage.setItem("dc-admin-sidebar", collapsed ? "collapsed" : "open"); } catch { /* ignore */ } }, [collapsed]);
  useEffect(() => { document.title = `${pageTitle(location.pathname)} · DawaConnect Admin`; }, [location.pathname]);

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className={cn("flex min-h-screen flex-col transition-[padding] duration-200", collapsed ? "lg:pl-[68px]" : "lg:pl-64")}>
        <Topbar setMobileOpen={setMobileOpen} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div key={location.pathname} className="mx-auto w-full max-w-[1440px] animate-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
