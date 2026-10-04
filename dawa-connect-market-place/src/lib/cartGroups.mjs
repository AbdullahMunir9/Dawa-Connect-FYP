const PROCESSING_FEE = 100;

function amount(value) {
  return Math.max(0, Number(value) || 0);
}

export function groupCartItemsByPharmacy(items) {
  const groups = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    const pharmacyId = String(item?.pharmacyId || "").trim();
    if (!pharmacyId) continue;

    if (!groups.has(pharmacyId)) {
      groups.set(pharmacyId, {
        pharmacyId,
        pharmacyName: String(item.pharmacyName || "Registered Pharmacy"),
        timing: String(item.timing || "Delivery timing not available"),
        deliveryType: String(item.deliveryType || "Standard delivery"),
        items: [],
      });
    }
    groups.get(pharmacyId).items.push(item);
  }

  return [...groups.values()].map((group) => {
    const itemCount = group.items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
    const subtotal = group.items.reduce(
      (sum, item) => sum + amount(item.price) * Math.max(1, Number(item.quantity) || 1),
      0,
    );
    const tax = group.items.reduce(
      (sum, item) => sum + (amount(item.price) * Math.max(1, Number(item.quantity) || 1) * amount(item.taxRate)) / 100,
      0,
    );
    const deliveryFee = amount(group.items[0]?.deliveryCharge);
    const processingFee = subtotal > 0 ? PROCESSING_FEE : 0;

    return {
      ...group,
      itemCount,
      subtotal,
      tax,
      deliveryFee,
      processingFee,
      total: subtotal + tax + deliveryFee + processingFee,
    };
  });
}

export function getPharmacyCart(items, pharmacyId) {
  const key = String(pharmacyId || "").trim();
  return groupCartItemsByPharmacy(items).find((group) => group.pharmacyId === key) || null;
}

export function assertSinglePharmacyItems(items) {
  const pharmacyIds = new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => String(item?.pharmacyId || "").trim())
      .filter(Boolean),
  );
  return pharmacyIds.size === 1 ? [...pharmacyIds][0] : null;
}

export const CART_PROCESSING_FEE = PROCESSING_FEE;
