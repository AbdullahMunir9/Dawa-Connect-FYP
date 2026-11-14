import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Camera, Clock, MessageSquareQuote, MapPin, ShieldCheck, Star } from "lucide-react";
import { getApprovedPharmacyById } from "@/lib/pharmacyCatalog";
import PharmacyProductsGrid from "@/components/PharmacyProductsGrid";

export const dynamic = "force-dynamic";

export default async function PharmacyProductsPage({ params }) {
  const { id } = await params;
  const pharmacy = await getApprovedPharmacyById(id);
  if (!pharmacy) notFound();
  const photos = [
    pharmacy.photos?.outside?.url ? { key: "outside", label: "Outside", caption: "Storefront and entrance", url: pharmacy.photos.outside.url } : null,
    pharmacy.photos?.inside?.url ? { key: "inside", label: "Inside", caption: "Inside the pharmacy", url: pharmacy.photos.inside.url } : null,
  ].filter(Boolean);

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
              {pharmacy.reviewCount > 0 && <span className="ml-1 font-medium text-teal-600">({pharmacy.reviewCount})</span>}
            </div>
          </div>
        </div>

        {photos.length > 0 && (
          <section className="mb-8" aria-labelledby="pharmacy-photos-heading">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-teal-700"><Camera className="h-4 w-4" /> Pharmacy photos</p>
                <h2 id="pharmacy-photos-heading" className="mt-1 text-xl font-semibold text-gray-950">See the pharmacy before you visit</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800"><ShieldCheck className="h-3.5 w-3.5" /> Uploaded by the pharmacy</span>
            </div>
            <div className={`grid gap-4 ${photos.length === 2 ? "md:grid-cols-2" : "grid-cols-1"}`}>
              {photos.map((photo) => (
                <figure key={photo.key} className="group relative min-h-72 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm md:min-h-96">
                  <Image src={photo.url} alt={`${pharmacy.name} ${photo.caption.toLowerCase()}`} fill sizes={photos.length === 2 ? "(min-width: 768px) 50vw, 100vw" : "100vw"} className="object-cover transition duration-500 group-hover:scale-[1.02]" />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-gray-950/85 via-gray-950/40 to-transparent px-5 pb-5 pt-16 text-white">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-teal-200">{photo.label}</span>
                    <span className="mt-1 block text-sm font-medium">{photo.caption}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {pharmacy.reviews.length > 0 && (
          <section className="mb-8" aria-labelledby="pharmacy-reviews-heading">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-700"><MessageSquareQuote className="h-4 w-4" /> Customer reviews</p>
                <h2 id="pharmacy-reviews-heading" className="mt-1 text-xl font-semibold text-gray-950">Feedback from verified orders</h2>
              </div>
              <p className="text-sm text-gray-600">{pharmacy.rating} out of 5 from {pharmacy.reviewCount} review{pharmacy.reviewCount === 1 ? "" : "s"}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {pharmacy.reviews.map((review) => (
                <article key={review.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-950">{review.customer}</p>
                      {review.verifiedPurchase && <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" /> Verified purchase</p>}
                    </div>
                    <div className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
                      {[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-4 w-4 ${star <= review.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />)}
                    </div>
                  </div>
                  {review.comment ? <p className="mt-4 text-sm leading-6 text-gray-600">{review.comment}</p> : <p className="mt-4 text-sm italic text-gray-400">The customer left a rating without a written comment.</p>}
                  {review.date && <time className="mt-4 block text-xs text-gray-400">{new Date(review.date).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" })}</time>}
                </article>
              ))}
            </div>
          </section>
        )}

        <h2 className="text-xl font-semibold text-gray-900 mb-5">Current Inventory ({pharmacy.products.length})</h2>
        <PharmacyProductsGrid pharmacy={pharmacy} />
      </div>
    </div>
  );
}
