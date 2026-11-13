"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { Bookmark, Trash2, Loader2 } from "lucide-react";
import { formatPKR } from "@/lib/currency";
import { useFavourites } from "@/context/FavouritesContext";

export default function SavedItems() {
  const { user } = useAuth();
  const { items: savedItems, loading, toggleFavourite, isPending } = useFavourites();

  if (!user) return <div className="py-8 text-center text-red-500">Please log in.</div>;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">Saved Items</h1>
          <p className="text-sm text-gray-600">Items you have bookmarked for later.</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading items...</div>
      ) : savedItems.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500 shadow-sm">
          <Bookmark className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p>You haven't saved any items yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedItems.map(item => (
            <div key={item._id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-full h-32 bg-blue-50 rounded-lg mb-4 flex items-center justify-center text-4xl">
                {item.image || "💊"}
              </div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{item.category}</span>
              <h3 className="font-bold text-gray-900 mt-1 mb-2">{item.name}</h3>
              <p className="text-lg font-bold text-blue-800 mb-4">{formatPKR(item.price)}</p>
              
              <div className="flex gap-2">
                <Link href={`/product/${item.productId}`} className="flex-1 bg-blue-800 text-white flex items-center justify-center py-2 rounded-lg text-sm font-medium hover:bg-blue-900 transition-colors">
                  View Product
                </Link>
                <button onClick={() => void toggleFavourite(item).catch(() => {})} disabled={isPending(item)} className="p-2 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50" aria-label="Remove saved item">
                  {isPending(item) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
