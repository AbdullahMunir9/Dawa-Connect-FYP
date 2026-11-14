"use client";

import { useCallback, useEffect, useState } from "react";

export default function useOrderReviews({ enabled = true, orderId = "" } = {}) {
  const [reviewsByOrder, setReviewsByOrder] = useState({});
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState("");

  const loadReviews = useCallback(async (signal) => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const query = orderId ? `?orderId=${encodeURIComponent(orderId)}` : "";
      const response = await fetch(`/api/reviews${query}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to load pharmacy reviews.");
      const next = Object.fromEntries((data.reviews || []).map((review) => [review.orderId, review]));
      setReviewsByOrder(next);
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [enabled, orderId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadReviews(controller.signal);
    return () => controller.abort();
  }, [loadReviews]);

  const saveReview = useCallback((review) => {
    if (!review?.orderId) return;
    setReviewsByOrder((current) => ({ ...current, [review.orderId]: review }));
  }, []);

  return { reviewsByOrder, loading, error, reload: loadReviews, saveReview };
}
