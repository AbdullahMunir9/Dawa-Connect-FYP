"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, ListOrdered, FileText, Settings, MapPinHouse, Loader2, MessageSquareWarning, Bookmark, LogOut, Bot, ChevronRight, MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn, initials } from "@/components/ui";

const NAV = [
  { name: "Overview", href: "/dashboard", icon: LayoutGrid, hint: "Your activity at a glance" },
  { name: "Orders", href: "/dashboard/orders", icon: ListOrdered, hint: "Track and review orders" },
  { name: "Prescriptions", href: "/dashboard/prescriptions", icon: FileText, hint: "Upload and manage" },
  { name: "Saved items", href: "/dashboard/saved", icon: Bookmark, hint: "Products you bookmarked" },
  { name: "Addresses", href: "/dashboard/addresses", icon: MapPinHouse, hint: "Delivery locations" },
  { name: "Support & complaints", href: "/dashboard/complaints", icon: MessageSquareWarning, hint: "Get help with an order" },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, hint: "Profile and account" },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, pathname, router, user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-700" aria-label="Checking session" />
      </div>
    );
  }

  const current = NAV.find((item) => (item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href))) || NAV[0];

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          {/* ------------------------------ Sidebar ------------------------------ */}
          <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:w-72 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="bg-gradient-to-br from-blue-800 to-blue-950 p-5 text-white">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15 text-base font-bold ring-2 ring-white/20">{initials(user.name)}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold leading-tight">{user.name}</p>
                    <p className="truncate text-xs text-blue-200">{user.email}</p>
                    {user.city && <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-blue-200"><MapPin className="h-3 w-3" />{user.city}</p>}
                  </div>
                </div>
              </div>

              {/* Mobile: horizontal scroll tabs. Desktop: vertical list. */}
              <nav className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Portal sections">
                {NAV.map((item) => {
                  const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                      className={cn("group flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", active ? "bg-blue-50 text-blue-800" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
                      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg transition", active ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-500 group-hover:bg-white group-hover:text-blue-700")}><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0"><span className="block whitespace-nowrap">{item.name}</span><span className="hidden text-[11px] font-normal text-gray-400 lg:block">{item.hint}</span></span>
                      <ChevronRight className={cn("ml-auto hidden h-4 w-4 lg:block", active ? "text-blue-400" : "text-gray-300 opacity-0 transition group-hover:opacity-100")} />
                    </Link>
                  );
                })}
              </nav>

              <div className="hidden border-t border-gray-100 p-3 lg:block">
                <Link href="/assistant" className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-violet-50 to-blue-50 px-3 py-2.5 text-sm font-medium text-blue-900 transition hover:from-violet-100 hover:to-blue-100">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-violet-700 shadow-sm"><Bot className="h-4 w-4" /></span>
                  <span>Ask the AI assistant</span>
                </Link>
                <button type="button" onClick={logout} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-red-50 hover:text-red-700">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-gray-100 text-gray-500"><LogOut className="h-4 w-4" /></span>Sign out
                </button>
              </div>
            </div>
          </aside>

          {/* ------------------------------ Main ------------------------------ */}
          <main className="min-w-0 flex-1">
            <nav className="mb-4 flex items-center gap-1.5 text-xs text-gray-500" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-gray-900">Home</Link><ChevronRight className="h-3 w-3" />
              <Link href="/dashboard" className="hover:text-gray-900">User portal</Link>
              {current.href !== "/dashboard" && <><ChevronRight className="h-3 w-3" /><span className="font-medium text-gray-900">{current.name}</span></>}
            </nav>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
