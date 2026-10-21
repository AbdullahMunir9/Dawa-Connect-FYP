import { distanceKm, validateCoordinates } from './healthcareGeo.mjs';

export const SEARCH_PROCESSING_FEE = 100;

function amount(value) {
  return Math.max(0, Number(value) || 0);
}

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function assessPharmacyDelivery(pharmacy, destination) {
  const destinationPoint = validateCoordinates(destination?.latitude, destination?.longitude);
  if (!destinationPoint) {
    return {
      canDeliver: false,
      deliveryStatus: 'location-required',
      deliveryMessage: 'Choose a delivery location to check availability',
      distanceKm: null,
    };
  }

  const pharmacyPoint = validateCoordinates(pharmacy?.latitude, pharmacy?.longitude);
  const radius = amount(pharmacy?.deliveryRadius);
  if (!pharmacyPoint || radius <= 0) {
    return {
      canDeliver: false,
      deliveryStatus: 'location-unavailable',
      deliveryMessage: 'Delivery coverage is not configured',
      distanceKm: null,
    };
  }

  const distance = distanceKm(destinationPoint, pharmacyPoint);
  if (pharmacy?.isOpen === false) {
    return {
      canDeliver: false,
      deliveryStatus: 'closed',
      deliveryMessage: 'Pharmacy is currently closed',
      distanceKm: money(distance),
    };
  }

  if (distance > radius) {
    return {
      canDeliver: false,
      deliveryStatus: 'outside-radius',
      deliveryMessage: `Outside this pharmacy’s ${radius.toLocaleString()} km delivery area`,
      distanceKm: money(distance),
    };
  }

  return {
    canDeliver: true,
    deliveryStatus: 'delivers',
    deliveryMessage: 'Delivers to this location',
    distanceKm: money(distance),
  };
}

export function checkoutEstimate(product) {
  const subtotal = amount(product?.price);
  const tax = money(subtotal * (amount(product?.taxRate) / 100));
  const deliveryFee = amount(product?.deliveryCharge);
  const processingFee = subtotal > 0 ? SEARCH_PROCESSING_FEE : 0;
  return {
    subtotal,
    tax,
    deliveryFee,
    processingFee,
    total: money(subtotal + tax + deliveryFee + processingFee),
  };
}

export function selectOptimalOffer(products) {
  const candidates = (Array.isArray(products) ? products : [])
    .filter((product) => product?.canDeliver && Number(product.stock || 0) > 0)
    .map((product) => ({ ...product, checkoutEstimate: checkoutEstimate(product) }));

  candidates.sort((first, second) =>
    first.checkoutEstimate.total - second.checkoutEstimate.total ||
    Number(first.distanceKm ?? Number.POSITIVE_INFINITY) - Number(second.distanceKm ?? Number.POSITIVE_INFINITY) ||
    Number(second.pharmacyRating || 0) - Number(first.pharmacyRating || 0) ||
    String(first.pharmacyName || '').localeCompare(String(second.pharmacyName || '')));

  return candidates[0] || null;
}
