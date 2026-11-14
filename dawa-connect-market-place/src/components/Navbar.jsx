"use client";

import Link from "next/link";
import { Search, ShoppingCart, Bell, User, MapPinned } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useEffect, useState } from "react";
import { recordSearchAndNavigate } from "@/lib/searchNavigation";
import { authPageHref } from "@/lib/authRedirect.mjs";
import VoiceMedicineSearchButton from "@/components/VoiceMedicineSearchButton";
import UserAvatar from "@/components/UserAvatar";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [navQuery, setNavQuery] = useState("");
  const [authReturnPath, setAuthReturnPath] = useState(pathname || "/");
  const { user, loading, logout } = useAuth();
  const { totalItems } = useCart();
  const portalHref = user ? "/dashboard" : authPageHref("/signup", "/dashboard");

  useEffect(() => {
    setAuthReturnPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  }, [pathname]);
  
  const isCommerceRoute =
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout");
  const hideNavSearch =
    pathname.startsWith("/pharmacies") ||
    pathname.startsWith("/assistant") ||
    pathname.startsWith("/dashboard") ||
    isCommerceRoute;

  // Search in navbar: not on Home, and not on Pharmacies / AI Assistant / User Portal
  const showSearch = pathname !== "/" && !hideNavSearch;

  return (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-3">
          
          {/* Logo */}
          <div className="min-w-0 justify-self-start">
            <Link href="/" className="text-xl font-bold tracking-tight text-blue-600 sm:text-2xl">
              DawaConnect
            </Link>
          </div>

          {/* Links */}
          <div className="hidden items-center justify-self-center space-x-4 md:flex lg:space-x-7">
            <Link href="/" className={`whitespace-nowrap px-1 py-5 text-[15px] font-medium ${pathname === '/' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}>
              Home
            </Link>
            <Link href="/pharmacies" className={`whitespace-nowrap px-1 py-5 text-[15px] font-medium ${pathname.startsWith('/pharmacies') && pathname !== '/pharmacies/map' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}>
              Pharmacies
            </Link>
            <Link href="/pharmacies/map" className={`whitespace-nowrap px-1 py-5 text-[15px] font-medium ${pathname === '/pharmacies/map' ? 'text-teal-700 border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-900'}`}>
              Find Care
            </Link>
            <Link href="/assistant" className={`whitespace-nowrap px-1 py-5 text-[15px] font-medium ${pathname.startsWith('/assistant') ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}>
              AI Assistant
            </Link>
            <Link href={portalHref} prefetch={false} className={`whitespace-nowrap px-1 py-5 text-[15px] font-medium ${pathname.startsWith('/dashboard') ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}>
              User Portal
            </Link>
          </div>

          {/* Right Icons */}
          <div className="flex min-w-0 items-center justify-self-end gap-3 lg:gap-4">
            {showSearch && (
              <form
                className="hidden w-52 items-center gap-2 min-[1800px]:flex"
                onSubmit={(e) => {
                  e.preventDefault();
                  void recordSearchAndNavigate(router, navQuery).then(() => setNavQuery(""));
                }}
              >
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={navQuery}
                    onChange={(e) => setNavQuery(e.target.value)}
                    className="block w-full rounded-md border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm leading-5 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Search medicines..."
                    aria-label="Search medicines"
                  />
                </div>
                <VoiceMedicineSearchButton compact size="sm" className="shrink-0" />
              </form>
            )}
            {showSearch && <Link href="/search" className="hidden text-gray-500 hover:text-gray-900 lg:block min-[1800px]:hidden" aria-label="Search medicines"><Search className="h-5 w-5" /></Link>}
            <Link href="/pharmacies/map" className="md:hidden text-teal-700" aria-label="Find nearby care on the map"><MapPinned className="h-5 w-5" /></Link>
            {pathname === "/" && (
              <button type="button" className="hidden sm:block text-gray-500 hover:text-gray-900 md:hidden" aria-label="Search">
                <Search className="h-5 w-5" />
              </button>
            )}
            <Link href="/cart" className="text-gray-500 hover:text-gray-900 relative">
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 block h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold text-center leading-4">
                {totalItems}
              </span>
            </Link>
            <Link href="/notifications" className="hidden sm:block text-gray-500 hover:text-gray-900 relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
            </Link>
            
            {/* Auth Button */}
            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center gap-2">
                    <Link href="/dashboard" prefetch={false} className="hidden sm:flex text-gray-500 hover:text-gray-900 items-center gap-2">
                      <UserAvatar user={user} className="h-6 w-6 text-[10px]" fallbackClassName="bg-blue-50 text-blue-700" />
                      <span className={`hidden text-sm font-medium md:inline ${showSearch ? "min-[1800px]:hidden" : ""}`}>{user.name}</span>
                    </Link>
                    <button onClick={logout} className="text-sm font-medium text-red-600 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors">
                      Logout
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link href={authPageHref("/login", authReturnPath)} aria-label="Log in" className="hidden sm:flex text-gray-500 hover:text-gray-900 items-center gap-2">
                      <User className="h-5 w-5" />
                      <span className="hidden lg:inline text-sm font-medium">Login</span>
                    </Link>
                    <Link
                      href={authPageHref("/signup", authReturnPath)}
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                      Sign up
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
          
        </div>
      </div>
    </nav>
  );
}
