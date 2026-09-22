"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, MapPin, Star, ChevronDown, ChevronLeft, ChevronRight, MessageSquareHeart, X } from "lucide-react";
import { formatPKR } from "@/lib/currency";
import { useCart } from "@/context/CartContext";
import { getClientSessionId } from "@/lib/clientSession";
import VoiceMedicineSearchButton from "@/components/VoiceMedicineSearchButton";

function SearchResultsGridInner() {
  const { addToCart } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, startIndex: 0, endIndex: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recentSearches, setRecentSearches] = useState([]);
  const [filters, setFilters] = useState({
    minPrice: 0,
    maxPrice: 10000,
    maxDistance: 5,
    inStockOnly: true,
    deliveryOnly: false,
    minRating: 4.5,
    sortBy: "relevance",
  });

  const sessionId = useMemo(() => getClientSessionId(), []);

  const skippedInitialFiltersFetch = useRef(false);
  const skipNextUrlSync = useRef(false);

  const fetchSearchResults = async (nextPage = 1, searchValue = activeQuery, nextFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        query: searchValue,
        page: String(nextPage),
        limit: "12",
        minPrice: String(nextFilters.minPrice),
        maxPrice: String(nextFilters.maxPrice),
        maxDistance: String(nextFilters.maxDistance),
        minRating: String(nextFilters.minRating),
        inStockOnly: String(nextFilters.inStockOnly),
        deliveryOnly: String(nextFilters.deliveryOnly),
        sortBy: nextFilters.sortBy,
      });

      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load results");
      const data = await response.json();
      setResults(data.items || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0, startIndex: 0, endIndex: 0 });
    } catch (fetchError) {
      setError(fetchError.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentSearches = async () => {
    if (!sessionId) return;
    const response = await fetch("/api/recent-searches", { headers: { "x-session-id": sessionId } });
    if (response.ok) {
      const data = await response.json();
      setRecentSearches(data.recentSearches || []);
    }
  };

  const saveRecentSearch = async (value) => {
    if (!sessionId || !value.trim()) return;
    await fetch("/api/recent-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": sessionId },
      body: JSON.stringify({ query: value.trim() }),
    });
    fetchRecentSearches();
  };

  useEffect(() => {
    if (!sessionId) return;
    if (skipNextUrlSync.current) {
      skipNextUrlSync.current = false;
      return;
    }
    const qFromUrl = searchParams.get("q")?.trim() ?? "";
    setQuery(qFromUrl);
    setActiveQuery(qFromUrl);
    fetchRecentSearches();
    fetchSearchResults(1, qFromUrl, filters);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, searchParams.toString()]);

  useEffect(() => {
    if (!skippedInitialFiltersFetch.current) {
      skippedInitialFiltersFetch.current = true;
      return;
    }
    fetchSearchResults(1, activeQuery, filters);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleSearch = async (value = query) => {
    const normalized = value.trim();
    setActiveQuery(normalized);
    setQuery(normalized);
    setPage(1);
    skipNextUrlSync.current = true;
    router.replace(normalized ? `/search?q=${encodeURIComponent(normalized)}` : "/search");
    await fetchSearchResults(1, normalized, filters);
    if (normalized) await saveRecentSearch(normalized);
  };

  const handleDeleteRecent = async (id) => {
    if (!sessionId) return;
    const response = await fetch(`/api/recent-searches?id=${id}`, {
      method: "DELETE",
      headers: { "x-session-id": sessionId },
    });
    if (response.ok) {
      const data = await response.json();
      setRecentSearches(data.recentSearches || []);
    }
  };

  const goToPage = (nextPage) => {
    if (nextPage < 1 || nextPage > pagination.totalPages || nextPage === page) return;
    setPage(nextPage);
    fetchSearchResults(nextPage, activeQuery, filters);
  };

  const clearAllFilters = () => {
    setFilters({
      minPrice: 0,
      maxPrice: 10000,
      maxDistance: 5,
      inStockOnly: true,
      deliveryOnly: false,
      minRating: 4.5,
      sortBy: "relevance",
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header text */}
      <div className="text-center mb-8 max-w-2xl mx-auto">
        <h1 className="text-blue-800 font-medium mb-2">Find Your Medicine Faster</h1>
        <p className="text-gray-600 text-sm">
          Access thousands of verified medicines from licensed pharmacies. Powered by intelligent AI suggestions.
        </p>
      </div>

      {/* Main Search Bar */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
          <div className="relative flex-1 min-w-0 flex items-center">
            <Search className="absolute left-4 text-gray-400 w-5 h-5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, category, or symptoms (e.g. 'headache medicine')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Search medicines"
            />
          </div>
          <div className="flex items-center gap-3 shrink-0 justify-end sm:justify-start">
            <VoiceMedicineSearchButton compact />
            <button
              type="button"
              onClick={() => handleSearch()}
              className="bg-blue-800 text-white px-6 py-4 sm:py-2.5 rounded-xl sm:rounded-lg font-medium hover:bg-blue-900 transition-colors min-w-[7rem]"
            >
              Search
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-sm">
          <span className="text-gray-500 font-medium">Recent Searches:</span>
          {recentSearches.length === 0 && <span className="text-gray-400">No recent searches</span>}
          {recentSearches.map((item) => (
            <div key={item._id} className="group flex items-center bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
              <button onClick={() => { setQuery(item.query); handleSearch(item.query); }} className="px-4 py-1.5 text-gray-600">
                {item.query}
              </button>
              <button
                onClick={() => handleDeleteRecent(item._id)}
                className="pr-2 text-gray-400 hover:text-red-500"
                aria-label="Delete recent search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Filters Sidebar */}
        <div className="w-full lg:w-1/4 flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-gray-900">Filters</h2>
              <button onClick={clearAllFilters} className="text-sm text-blue-600 font-medium hover:underline">Clear All</button>
            </div>

            {/* Price Range */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Price Range (PKR)</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <input
                  type="number"
                  value={filters.minPrice}
                  min={0}
                  onChange={(e) => setFilters((prev) => ({ ...prev, minPrice: Number(e.target.value) || 0 }))}
                  className="border border-gray-200 rounded-lg py-2 px-3 text-sm"
                  placeholder="Min"
                />
                <input
                  type="number"
                  value={filters.maxPrice}
                  min={0}
                  onChange={(e) => setFilters((prev) => ({ ...prev, maxPrice: Number(e.target.value) || 10000 }))}
                  className="border border-gray-200 rounded-lg py-2 px-3 text-sm"
                  placeholder="Max"
                />
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{formatPKR(filters.minPrice)}</span>
                <span>{formatPKR(filters.maxPrice)}+</span>
              </div>
            </div>

            <hr className="border-gray-100 my-6" />

            {/* Pharmacy Distance */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Pharmacy Distance</h3>
              <div className="relative">
                <select
                  value={filters.maxDistance}
                  onChange={(e) => setFilters((prev) => ({ ...prev, maxDistance: Number(e.target.value) }))}
                  className="w-full appearance-none border border-gray-200 rounded-lg py-2.5 pl-4 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={3}>Within 5 km</option>
                  <option value={6}>Within 10 km</option>
                  <option value={1000}>Any distance</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>

            <hr className="border-gray-100 my-6" />

            {/* Availability */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Availability</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.inStockOnly}
                    onChange={(e) => setFilters((prev) => ({ ...prev, inStockOnly: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">In Stock</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.deliveryOnly}
                    onChange={(e) => setFilters((prev) => ({ ...prev, deliveryOnly: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Available via Delivery</span>
                </label>
              </div>
            </div>

            <hr className="border-gray-100 my-6" />

            {/* Pharmacy Ratings */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">Pharmacy Ratings</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="rating"
                    checked={filters.minRating === 4.5}
                    onChange={() => setFilters((prev) => ({ ...prev, minRating: 4.5 }))}
                    className="w-4 h-4 text-orange-500 border-gray-300 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700 flex items-center gap-1">
                    4.5 & up <Star className="w-3 h-3 fill-orange-400 text-orange-400" />
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="rating"
                    checked={filters.minRating === 4}
                    onChange={() => setFilters((prev) => ({ ...prev, minRating: 4 }))}
                    className="w-4 h-4 text-orange-500 border-gray-300 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700 flex items-center gap-1">
                    4.0 & up <Star className="w-3 h-3 fill-orange-400 text-orange-400" />
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="rating"
                    checked={filters.minRating === 0}
                    onChange={() => setFilters((prev) => ({ ...prev, minRating: 0 }))}
                    className="w-4 h-4 text-orange-500 border-gray-300 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Any rating</span>
                </label>
              </div>
            </div>

          </div>

          {/* AI Banner */}
          <div className="bg-[#006054] rounded-xl p-6 text-white">
            <MessageSquareHeart className="w-6 h-6 mb-4 text-white/90" />
            <h3 className="font-semibold mb-2">Free Consultation</h3>
            <p className="text-sm text-teal-100 mb-6 leading-relaxed">
              Chat with our AI medical assistant for symptom guidance.
            </p>
            <Link href="/assistant" className="block w-full text-center bg-white text-[#006054] font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
              Start Chat
            </Link>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="w-full lg:w-3/4">
          
          {/* Popular Categories */}
          <div className="mb-10">
            <h2 className="text-sm text-gray-500 mb-4">Popular Categories</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative h-32 rounded-xl overflow-hidden group cursor-pointer">
                <div className="absolute inset-0 bg-gray-800"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10"></div>
                <div className="absolute bottom-4 left-4 z-20">
                  <h3 className="text-white font-medium">Pain Relief</h3>
                  <p className="text-white/70 text-xs text-[10px] mt-1 tracking-wider">120+ PRODUCTS</p>
                </div>
              </div>
              <div className="relative h-32 rounded-xl overflow-hidden group cursor-pointer">
                <div className="absolute inset-0 bg-gray-700"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10"></div>
                <div className="absolute bottom-4 left-4 z-20">
                  <h3 className="text-white font-medium">Vitamins</h3>
                  <p className="text-white/70 text-xs text-[10px] mt-1 tracking-wider">85+ PRODUCTS</p>
                </div>
              </div>
              <div className="relative h-32 rounded-xl overflow-hidden group cursor-pointer">
                <div className="absolute inset-0 bg-teal-900"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10"></div>
                <div className="absolute bottom-4 left-4 z-20">
                  <h3 className="text-white font-medium">First Aid</h3>
                  <p className="text-white/70 text-xs text-[10px] mt-1 tracking-wider">40+ PRODUCTS</p>
                </div>
              </div>
            </div>
          </div>

          {/* Results Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
            <h2 className="text-gray-900 font-medium">Top Results {activeQuery ? `for "${activeQuery}"` : ""}</h2>
            <div className="flex items-center gap-3 mt-2 sm:mt-0">
              <p className="text-sm text-gray-500">
                Showing {pagination.startIndex}-{pagination.endIndex} of {pagination.total} results
              </p>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value }))}
                className="border border-gray-200 rounded-lg py-1.5 px-2 text-sm"
              >
                <option value="relevance">Best Match</option>
                <option value="lowest-price">Lowest Price</option>
                <option value="highest-rated">Highest Rated</option>
                <option value="nearest">Nearest</option>
              </select>
            </div>
          </div>

          {/* Results List */}
          <div className="space-y-4 mb-8">
            {error && <p className="text-red-600 text-sm">{error}</p>}
            {loading && <p className="text-gray-500 text-sm">Loading results...</p>}
            {!loading && results.length === 0 && <p className="text-gray-500">No medicines match your filters.</p>}
            {results.map((item) => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-6 hover:shadow-sm transition-shadow">
                <div className="w-full md:w-32 h-32 bg-blue-50 rounded-lg flex items-center justify-center shrink-0 text-5xl">
                  {item.image || "💊"}
                </div>

                <div className="flex-grow flex flex-col justify-center">
                  <div className="flex justify-between items-start mb-1">
                    <Link href={`/product/${item.id}`} className="text-lg font-semibold text-blue-800 hover:underline">
                      {item.name}
                    </Link>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border hidden md:block ${item.stock > 0 ? "bg-teal-50 text-teal-700 border-teal-100" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                      {item.stock > 0 ? "Available" : "Out of Stock"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{item.category}</p>

                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-orange-400 text-orange-400" />
                      <span className="font-medium text-gray-900">{item.pharmacyRating}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>{item.pharmacyName} ({item.pharmacyDistance})</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-center shrink-0 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 min-w-[140px]">
                  <div className="text-right mb-4">
                    <p className="text-xl font-bold text-blue-900">{formatPKR(item.price)}</p>
                  </div>
                  <button
                    onClick={() =>
                      addToCart({
                        id: item.id,
                        cartItemId: `${item.pharmacyId}-${item.id}`,
                        productId: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: 1,
                        image: item.image,
                        category: item.category,
                        pharmacyId: item.pharmacyId,
                        pharmacyName: item.pharmacyName,
                        timing: item.timing,
                        deliveryCharge: item.deliveryCharge,
                        deliveryType: item.deliveryType,
                        taxRate: item.taxRate,
                      })
                    }
                    disabled={item.stock <= 0}
                    className={`w-full text-center py-2 px-4 rounded-lg text-sm font-medium transition-colors cursor-pointer ${item.stock > 0 ? "bg-blue-800 text-white hover:bg-blue-900" : "bg-gray-100 text-gray-500 cursor-not-allowed"}`}
                  >
                    {item.stock > 0 ? "Add to Cart" : "Notify Me"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center items-center gap-2">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).slice(0, 6).map((pageNumber) => (
              <button
                key={pageNumber}
                onClick={() => goToPage(pageNumber)}
                className={`w-10 h-10 rounded-lg border font-medium flex items-center justify-center cursor-pointer ${
                  pageNumber === page ? "bg-blue-800 text-white border-blue-800" : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= pagination.totalPages}
              className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function SearchResultsGrid() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-gray-500 text-sm">Loading search…</div>
      }
    >
      <SearchResultsGridInner />
    </Suspense>
  );
}
