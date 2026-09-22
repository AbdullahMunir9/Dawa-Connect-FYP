"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatPKR } from "@/lib/currency";

export default function ProductPurchaseCard({ product }) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const inStock = product.stock > 0;

  function addProduct() {
    addToCart({
      id: product.id,
      cartItemId: `${product.pharmacyId}-${product.id}`,
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.image,
      category: product.category,
      pharmacyId: product.pharmacyId,
      pharmacyName: product.pharmacyName,
      timing: product.timing,
      deliveryCharge: product.deliveryCharge,
      deliveryType: product.deliveryType,
      taxRate: product.taxRate,
    });
    setAdded(true);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <p className="text-sm text-gray-500">Order total before delivery and tax</p>
      <p className="text-2xl font-bold text-blue-900 mt-1">{formatPKR(product.price * quantity)}</p>

      <div className="flex items-center border border-gray-300 rounded-lg mt-5 overflow-hidden">
        <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="px-4 py-2 hover:bg-gray-50">−</button>
        <span className="flex-1 text-center font-medium">{quantity}</span>
        <button type="button" onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))} className="px-4 py-2 hover:bg-gray-50">+</button>
      </div>

      <button
        type="button"
        onClick={addProduct}
        disabled={!inStock}
        className="mt-3 w-full py-3 rounded-lg bg-blue-800 hover:bg-blue-900 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium flex items-center justify-center gap-2"
      >
        <ShoppingCart className="w-5 h-5" />
        {inStock ? "Add to Cart" : "Out of Stock"}
      </button>
      {added && <Link href="/cart" className="block text-center text-sm text-blue-700 font-medium mt-3">Added — view cart</Link>}
    </div>
  );
}
