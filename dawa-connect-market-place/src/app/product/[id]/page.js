import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, MapPin, Package, Store } from "lucide-react";
import { getCatalogProductById } from "@/lib/pharmacyCatalog";
import { formatPKR } from "@/lib/currency";
import ProductPurchaseCard from "@/components/ProductPurchaseCard";

export const dynamic = "force-dynamic";

export default async function ProductDetails({ params }) {
  const { id } = await params;
  const product = await getCatalogProductById(id);
  if (!product) notFound();

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/search" className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to products
        </Link>

        <div className="grid lg:grid-cols-[1fr_360px] gap-8">
          <section className="bg-white border border-gray-200 rounded-xl p-6 md:p-8">
            <div className="w-24 h-24 bg-blue-50 rounded-xl flex items-center justify-center text-5xl mb-6">
              {product.image}
            </div>
            <p className="text-xs uppercase tracking-wide text-blue-700 font-semibold">{product.category}</p>
            <h1 className="text-3xl font-bold text-gray-900 mt-2">{product.name}</h1>
            <p className="text-2xl font-bold text-blue-900 mt-4">{formatPKR(product.price)}</p>

            <dl className="grid sm:grid-cols-2 gap-4 mt-8">
              <div className="rounded-lg border border-gray-100 p-4">
                <dt className="text-xs uppercase text-gray-500">Available stock</dt>
                <dd className="font-semibold text-gray-900 mt-1">{product.stock} {product.unit || "units"}</dd>
              </div>
              <div className="rounded-lg border border-gray-100 p-4">
                <dt className="text-xs uppercase text-gray-500">Supplier</dt>
                <dd className="font-semibold text-gray-900 mt-1">{product.supplier || "Not specified"}</dd>
              </div>
              <div className="rounded-lg border border-gray-100 p-4">
                <dt className="text-xs uppercase text-gray-500">Batch</dt>
                <dd className="font-semibold text-gray-900 mt-1">{product.batch || "Not specified"}</dd>
              </div>
              <div className="rounded-lg border border-gray-100 p-4">
                <dt className="text-xs uppercase text-gray-500">Expiry</dt>
                <dd className="font-semibold text-gray-900 mt-1">{product.expiry || "Not specified"}</dd>
              </div>
            </dl>
          </section>

          <aside className="space-y-5">
            <ProductPurchaseCard product={product} />
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-2 text-blue-800 font-semibold">
                <Store className="w-5 h-5" />
                Fulfilled by
              </div>
              <Link href={`/pharmacies/${product.pharmacyId}`} className="block text-lg font-semibold text-gray-900 hover:text-blue-700 mt-3">
                {product.pharmacyName}
              </Link>
              <div className="space-y-2 mt-4 text-sm text-gray-600">
                <p className="flex items-center gap-2"><MapPin className="w-4 h-4" />{product.pharmacyAddress || product.pharmacyCity || "Registered pharmacy"}</p>
                <p className="flex items-center gap-2"><Clock className="w-4 h-4" />{product.timing}</p>
                <p className="flex items-center gap-2"><Package className="w-4 h-4" />{product.deliveryType}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
