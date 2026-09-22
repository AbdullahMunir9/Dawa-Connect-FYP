import { NextResponse } from "next/server";
import { searchPharmacyCatalog } from "@/lib/pharmacyCatalog";

function optionalNumber(params, key, fallback) {
  const raw = params.get(key);
  if (raw == null || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("query") || "").trim();
    const result = await searchPharmacyCatalog({
      query,
      page: optionalNumber(searchParams, "page", 1),
      limit: optionalNumber(searchParams, "limit", 12),
      minPrice: optionalNumber(searchParams, "minPrice", 0),
      maxPrice: optionalNumber(searchParams, "maxPrice", Number.POSITIVE_INFINITY),
      minRating: optionalNumber(searchParams, "minRating", 0),
      inStockOnly: searchParams.get("inStockOnly") === "true",
      deliveryOnly: searchParams.get("deliveryOnly") === "true",
      sortBy: searchParams.get("sortBy") || "relevance",
    });

    return NextResponse.json({ query: query.toLowerCase(), ...result });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ message: "Failed to fetch live inventory" }, { status: 500 });
  }
}
