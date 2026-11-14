"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, Star, X } from "lucide-react";
import { cn } from "@/components/ui";
import { REVIEW_COMMENT_MAX_LENGTH } from "@/lib/reviewPolicy.mjs";

const RATING_LABELS = {
  1: "Very poor",
  2: "Poor",
  3: "Good",
  4: "Very good",
  5: "Excellent",
};

function RatingStars({ value, onChange, disabled = false, size = "large" }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Pharmacy rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? "" : "s"}: ${RATING_LABELS[star]}`}
          disabled={disabled}
          onClick={() => onChange(star)}
          className={cn(
            "rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed",
            size === "large" ? "p-1.5 sm:p-2" : "p-0.5",
          )}
        >
          <Star
            className={cn(
              size === "large" ? "h-8 w-8 sm:h-10 sm:w-10" : "h-4 w-4",
              star <= value ? "fill-amber-400 text-amber-400" : "text-gray-300 hover:text-amber-300",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export default function OrderReviewDialog({ order, review, reviewLoading = false, onReviewSaved, className }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const submittingRef = useRef(false);

  const delivered = String(order?.status || "").toLowerCase() === "delivered";
  const pharmacyName = order?.pharmacyName || order?.fulfillments?.[0]?.pharmacyName || "the pharmacy";

  function openReviewForm() {
    setRating(Number(review?.rating || 0));
    setComment(review?.comment || "");
    setError("");
    setSaved(false);
    setOpen(true);
  }

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !submittingRef.current) setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!delivered) return null;

  async function submitReview(event) {
    event.preventDefault();
    if (!rating) {
      setError("Choose a star rating before submitting your review.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/reviews", {
        method: review ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ orderId: order.orderId, rating, comment }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409 && data.review) onReviewSaved?.(data.review);
        throw new Error(data.message || "Your review could not be saved.");
      }
      onReviewSaved?.(data.review);
      setSaved(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={reviewLoading}
        onClick={openReviewForm}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60",
          review ? "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100" : "border-blue-200 bg-white text-blue-800 hover:bg-blue-50",
          className,
        )}
      >
        {reviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className={cn("h-4 w-4", review && "fill-amber-400 text-amber-400")} />}
        {reviewLoading ? "Checking review…" : review ? `Your review: ${review.rating}/5` : "Rate this pharmacy"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-gray-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !submitting) setOpen(false);
        }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`review-title-${order.orderId}`}
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Verified purchase</p>
                <h2 id={`review-title-${order.orderId}`} className="mt-1 truncate text-xl font-bold text-gray-950">
                  {review ? "Edit your pharmacy review" : "How was your experience?"}
                </h2>
              </div>
              <button type="button" disabled={submitting} onClick={() => setOpen(false)} aria-label="Close review form" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            {saved ? (
              <div className="px-6 py-10 text-center sm:px-8 sm:py-12">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-8 w-8" /></span>
                <h3 className="mt-5 text-xl font-bold text-gray-950">Thank you for your review</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-600">Your verified rating for {pharmacyName} is now visible across DawaConnect.</p>
                <button type="button" onClick={() => setOpen(false)} className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-blue-800 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-900 sm:w-auto">Done</button>
              </div>
            ) : (
              <form onSubmit={submitReview} className="space-y-6 px-5 py-6 sm:px-6">
                <div>
                  <p className="font-semibold text-gray-950">{pharmacyName}</p>
                  <p className="mt-1 text-sm text-gray-500">Order #{order.orderId}</p>
                </div>

                <fieldset>
                  <legend className="text-sm font-semibold text-gray-900">Your overall rating</legend>
                  <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <RatingStars value={rating} onChange={setRating} disabled={submitting} />
                    <span className="min-h-5 text-sm font-medium text-amber-700">{rating ? RATING_LABELS[rating] : "Select 1 to 5 stars"}</span>
                  </div>
                </fieldset>

                <label className="block">
                  <span className="text-sm font-semibold text-gray-900">Share more details <span className="font-normal text-gray-400">(optional)</span></span>
                  <textarea
                    value={comment}
                    disabled={submitting}
                    maxLength={REVIEW_COMMENT_MAX_LENGTH}
                    onChange={(event) => setComment(event.target.value)}
                    rows={5}
                    placeholder="Tell other customers about the service, packaging or delivery experience."
                    className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
                  />
                  <span className="mt-1 block text-right text-xs text-gray-400">{comment.length}/{REVIEW_COMMENT_MAX_LENGTH}</span>
                </label>

                <div className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-xs leading-5 text-emerald-900">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  This review will be marked as a verified purchase because it is connected to your delivered order.
                </div>

                {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}

                <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                  <button type="button" disabled={submitting} onClick={() => setOpen(false)} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                  <button type="submit" disabled={submitting || !rating} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-blue-300">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submitting ? "Saving…" : review ? "Save changes" : "Submit review"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
