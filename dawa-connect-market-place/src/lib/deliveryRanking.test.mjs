import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPharmacyDelivery, checkoutEstimate, selectOptimalOffer } from './deliveryRanking.mjs';

const destination = { latitude: 31.5204, longitude: 74.3587 };
const pharmacy = { latitude: 31.5304, longitude: 74.3587, deliveryRadius: 10, isOpen: true };

test('classifies deliverable, closed, out-of-range and unlocated pharmacies', () => {
  const available = assessPharmacyDelivery(pharmacy, destination);
  assert.equal(available.deliveryStatus, 'delivers');
  assert.equal(available.canDeliver, true);
  assert.ok(available.distanceKm > 1 && available.distanceKm < 1.2);

  assert.equal(assessPharmacyDelivery({ ...pharmacy, isOpen: false }, destination).deliveryStatus, 'closed');
  assert.equal(assessPharmacyDelivery({ ...pharmacy, deliveryRadius: 0.5 }, destination).deliveryStatus, 'outside-radius');
  assert.equal(assessPharmacyDelivery(pharmacy, null).deliveryStatus, 'location-required');
  assert.equal(assessPharmacyDelivery({ deliveryRadius: 10, isOpen: true }, destination).deliveryStatus, 'location-unavailable');
});

test('checkout estimate matches cart pricing for one product', () => {
  assert.deepEqual(checkoutEstimate({ price: 500, taxRate: 5, deliveryCharge: 80 }), {
    subtotal: 500,
    tax: 25,
    deliveryFee: 80,
    processingFee: 100,
    total: 705,
  });
});

test('optimal offer excludes unavailable pharmacies and sorts by payable total then distance', () => {
  const offers = [
    { id: 'far-cheap', price: 400, taxRate: 0, deliveryCharge: 50, canDeliver: false, stock: 5, distanceKm: 2 },
    { id: 'near', price: 500, taxRate: 0, deliveryCharge: 50, canDeliver: true, stock: 5, distanceKm: 1 },
    { id: 'far', price: 500, taxRate: 0, deliveryCharge: 50, canDeliver: true, stock: 5, distanceKm: 4 },
  ];
  const selected = selectOptimalOffer(offers);
  assert.equal(selected.id, 'near');
  assert.equal(selected.checkoutEstimate.total, 650);
});
