"use client";

import { Heart, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useFavourites } from "@/context/FavouritesContext";
import { authPageHref } from "@/lib/authRedirect.mjs";
import { cn } from "@/components/ui";

export default function FavouriteButton({ product, className, showLabel = false }) {
  const { user } = useAuth();
  const { isFavourite, isPending, toggleFavourite } = useFavourites();
  const router = useRouter();
  const pathname = usePathname();
  const saved = isFavourite(product);
  const pending = isPending(product);

  async function handleClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      router.push(authPageHref("/login", pathname || "/"));
      return;
    }
    try {
      await toggleFavourite(product);
    } catch {
      // The global favourites notice explains the failure.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${product?.name || "item"} from favourites` : `Add ${product?.name || "item"} to favourites`}
      title={saved ? "Remove from favourites" : user ? "Add to favourites" : "Sign in to save this item"}
      className={cn("inline-flex items-center justify-center gap-2 rounded-xl border transition disabled:cursor-wait disabled:opacity-60", saved ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100" : "border-gray-200 bg-white text-gray-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600", showLabel ? "h-11 px-4 text-sm font-semibold" : "h-10 w-10", className)}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={cn("h-4 w-4", saved && "fill-current")} />}
      {showLabel && <span>{saved ? "Saved" : "Save to favourites"}</span>}
    </button>
  );
}
