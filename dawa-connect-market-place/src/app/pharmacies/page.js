import Link from "next/link";
import { Clock, MapPin, PackageSearch, Star } from "lucide-react";
import { listApprovedPharmacies } from "@/lib/pharmacyCatalog";

export const dynamic = "force-dynamic";

export default async function PharmaciesPage() {
  const pharmacies = await listApprovedPharmacies();

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Registered Pharmacies</h1>
          <p className="mt-2 text-gray-600">Browse approved DawaConnect pharmacies and their current inventory.</p>
          <Link href="/pharmacies/map" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"><MapPin className="h-4 w-4" /> Find nearby care on the map</Link>
        </div>

        {pharmacies.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pharmacies.map((pharmacy) => (
              <article key={pharmacy.id} className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-blue-700" />
                  </div>
                  <span className="inline-flex items-center gap-1 bg-teal-50 px-2.5 py-1 rounded text-teal-700 text-sm font-medium">
                    {pharmacy.rating ?? "New"}
                    {pharmacy.rating != null && <Star className="w-3.5 h-3.5 fill-current" />}
                  </span>
                </div>

                <h2 className="text-xl font-semibold text-gray-900">{pharmacy.name}</h2>
                <p className="text-sm text-gray-500 mt-2 min-h-10">
                  {pharmacy.address || [pharmacy.area, pharmacy.city].filter(Boolean).join(", ") || "Address not provided"}
                </p>

                <div className="mt-5 space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-500" />
                    {pharmacy.timing}
                  </div>
                  <div className="flex items-center gap-2">
                    <PackageSearch className="w-4 h-4 text-blue-600" />
                    {pharmacy.productCount} current {pharmacy.productCount === 1 ? "product" : "products"}
                  </div>
                </div>

                <Link
                  href={`/pharmacies/${pharmacy.id}`}
                  className="mt-6 block text-center w-full py-2.5 bg-blue-800 text-white hover:bg-blue-900 rounded-lg font-medium transition-colors"
                >
                  View Inventory
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <PackageSearch className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h2 className="font-semibold text-gray-900">No approved pharmacies available</h2>
            <p className="text-sm text-gray-500 mt-1">Registered pharmacies will appear here after approval.</p>
          </div>
        )}
      </div>
    </div>
  );
}
