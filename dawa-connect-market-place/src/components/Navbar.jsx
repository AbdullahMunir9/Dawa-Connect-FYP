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

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [navQuery, setNavQuery] = useState("");
  const [authReturnPath, setAuthReturnPath] = useState(pathname || "/");
  const { user, loading, logout } = useAuth();
  const { totalItems } = useCart();

  useEffect(() => {
    setAuthReturnPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  }, [pathname]);
  
  const hideNavSearch =
    pathname.startsWith("/pharmacies") ||
    pathname.startsWith("/assistant") ||
    pathname.startsWith("/dashboard");

  // Search in navbar: not on Home, and not on Pharmacies / AI Assistant / User Portal
  const showSearch = pathname !== "/" && !hideNavSearch;

  return (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="text-base sm:text-xl font-bold text-blue-600">
              DawaConnect
            </Link>
          </div>

          {/* Links */}
          <div className="hidden md:flex flex-1 justify-center space-x-4 lg:space-x-6">
            <Link href="/" className={`text-sm font-medium px-1 py-5 whitespace-nowrap ${pathname === '/' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}>
              Home
            </Link>
            <Link href="/pharmacies" className={`text-sm font-medium px-1 py-5 whitespace-nowrap ${pathname.startsWith('/pharmacies') && pathname !== '/pharmacies/map' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}>
              Pharmacies
            </Link>
            <Link href="/pharmacies/map" className={`text-sm font-medium px-1 py-5 whitespace-nowrap ${pathname === '/pharmacies/map' ? 'text-teal-700 border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-900'}`}>
              Find Care
            </Link>
            <Link href="/assistant" className={`text-sm font-medium px-1 py-5 whitespace-nowrap ${pathname.startsWith('/assistant') ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}>
              AI Assistant
            </Link>
            <Link href="/dashboard" className={`text-sm font-medium px-1 py-5 whitespace-nowrap ${pathname.startsWith('/dashboard') ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'}`}>
              User Portal
            </Link>
          </div>

          {/* Optional Search Bar */}
          {showSearch && (
            <form
              className="hidden lg:flex flex-1 max-w-md mx-4 gap-2 items-center"
              onSubmit={(e) => {
                e.preventDefault();
                void recordSearchAndNavigate(router, navQuery).then(() => setNavQuery(""));
              }}
            >
              <div className="relative w-full flex-1 min-w-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="search"
                  value={navQuery}
                  onChange={(e) => setNavQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Search medicines..."
                  aria-label="Search medicines"
                />
              </div>
              <VoiceMedicineSearchButton compact size="sm" className="shrink-0" />
            </form>
          )}

          {/* Right Icons */}
          <div className="flex items-center gap-3 lg:gap-5">
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
                    <Link href="/dashboard" className="hidden sm:flex text-gray-500 hover:text-gray-900 items-center gap-2">
                      <User className="h-5 w-5" />
                      <span className="hidden md:inline text-sm font-medium">{user.name}</span>
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
