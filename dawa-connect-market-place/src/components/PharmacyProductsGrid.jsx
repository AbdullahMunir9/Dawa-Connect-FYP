"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { formatPKR } from "@/lib/currency";

export default function PharmacyProductsGrid({ pharmacy }) {
  const { addToCart } = useCart();

  if (!pharmacy.products.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
        This pharmacy has no current, non-expired inventory available.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {pharmacy.products.map((product) => {
        const isInStock = product.stock > 0;

        return (
          <div
            key={`${pharmacy.id}-${product.id}`}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
          >
            <div className="h-24 bg-blue-50 rounded-lg flex items-center justify-center text-4xl mb-4">
              {product.image}
            </div>
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{product.category}</p>
            <Link href={`/product/${product.id}`} className="block text-lg font-semibold text-gray-900 hover:text-blue-700 mb-2">
              {product.name}
            </Link>
            <div className="flex items-center justify-between gap-2">
              <p className="text-blue-900 font-bold">{formatPKR(product.price)}</p>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full border ${
                    isInStock
                      ? "bg-teal-50 text-teal-700 border-teal-100"
                      : "bg-gray-100 text-gray-600 border-gray-200"
                  }`}
                >
                  {isInStock ? `${product.stock} in stock` : "Out of stock"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    addToCart({
                      id: product.id,
                      cartItemId: `${pharmacy.id}-${product.id}`,
                      productId: product.id,
                      name: product.name,
                      price: product.price,
                      quantity: 1,
                      image: product.image,
                      category: product.category,
                      pharmacyId: pharmacy.id,
                      pharmacyName: pharmacy.name,
                      timing: pharmacy.timing,
                      deliveryCharge: product.deliveryCharge,
                      deliveryType: product.deliveryType,
                      taxRate: product.taxRate,
                    })
                  }
                  className={`${
                    isInStock
                      ? "bg-blue-800 hover:bg-blue-900 text-white"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  } p-2 rounded-lg transition-colors`}
                  disabled={!isInStock}
                  aria-label={isInStock ? "Add to cart" : "Out of stock"}
                >
                  <ShoppingCart className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
