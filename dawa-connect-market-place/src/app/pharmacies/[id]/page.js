import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Star, Clock } from "lucide-react";
import { getApprovedPharmacyById } from "@/lib/pharmacyCatalog";
import PharmacyProductsGrid from "@/components/PharmacyProductsGrid";

export const dynamic = "force-dynamic";

export default async function PharmacyProductsPage({ params }) {
  const { id } = await params;
  const pharmacy = await getApprovedPharmacyById(id);
  if (!pharmacy) notFound();

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Link href="/pharmacies" className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to pharmacies
        </Link>

        <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{pharmacy.name}</h1>
              <p className="text-gray-500 mt-2">{pharmacy.address || pharmacy.city || "Address not provided"}</p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-4">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  {pharmacy.city || pharmacy.area || "Registered pharmacy"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-orange-500" />
                  {pharmacy.timing}
                </span>
              </div>
            </div>
            <div className="inline-flex self-start items-center gap-1 bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg font-semibold">
              {pharmacy.rating ?? "New"}
              {pharmacy.rating != null && <Star className="w-4 h-4 fill-current" />}
            </div>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-5">Current Inventory ({pharmacy.products.length})</h2>
        <PharmacyProductsGrid pharmacy={pharmacy} />
      </div>
    </div>
  );
}
