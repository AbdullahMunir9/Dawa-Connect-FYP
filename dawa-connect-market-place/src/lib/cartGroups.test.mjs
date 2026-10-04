import test from "node:test";
import assert from "node:assert/strict";
import { assertSinglePharmacyItems, getPharmacyCart, groupCartItemsByPharmacy } from "./cartGroups.mjs";

const items = [
  { cartItemId: "a", pharmacyId: "p1", pharmacyName: "One", price: 100, quantity: 2, taxRate: 5, deliveryCharge: 40 },
  { cartItemId: "b", pharmacyId: "p2", pharmacyName: "Two", price: 50, quantity: 1, taxRate: 0, deliveryCharge: 20 },
  { cartItemId: "c", pharmacyId: "p1", pharmacyName: "One", price: 200, quantity: 1, taxRate: 5, deliveryCharge: 40 },
];

test("groups independent carts by pharmacy and prices each cart separately", () => {
  const carts = groupCartItemsByPharmacy(items);
  assert.equal(carts.length, 2);
  assert.equal(carts[0].itemCount, 3);
  assert.equal(carts[0].subtotal, 400);
  assert.equal(carts[0].tax, 20);
  assert.equal(carts[0].deliveryFee, 40);
  assert.equal(carts[0].processingFee, 100);
  assert.equal(carts[0].total, 560);
});

test("selects one pharmacy cart without including another pharmacy", () => {
  const cart = getPharmacyCart(items, "p2");
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].cartItemId, "b");
});

test("accepts only a non-empty single-pharmacy checkout", () => {
  assert.equal(assertSinglePharmacyItems(items), null);
  assert.equal(assertSinglePharmacyItems(items.filter((item) => item.pharmacyId === "p1")), "p1");
  assert.equal(assertSinglePharmacyItems([]), null);
});
