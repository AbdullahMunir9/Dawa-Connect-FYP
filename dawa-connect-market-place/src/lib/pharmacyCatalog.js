import "server-only";

import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb";

const PHARMACY_DB_NAME = process.env.PHARMACY_DB_NAME || "Pharmacy";

function idString(value) {
  return value == null ? "" : String(value);
}

function activePharmacyFilter(extra = {}) {
  return {
    approvalStatus: { $regex: /^approved$/i },
    status: { $not: { $regex: /^suspended$/i } },
    ...extra,
  };
}

function sellableProductFilter(extra = {}) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...extra,
    $or: [
      { expiry: { $exists: false } },
      { expiry: null },
      { expiry: "" },
      { expiry: { $gte: today } },
    ],
  };
}

export async function getCommerceDatabases() {
  await connectToDatabase();
  const client = mongoose.connection.getClient();
  return {
    client,
    marketplaceDb: mongoose.connection.db,
    pharmacyDb: client.db(PHARMACY_DB_NAME),
  };
}

function buildPharmacyView(user, profile, productCount = 0, ratingSummary) {
  const ownerId = idString(user._id);
  const name = profile?.name || user.pharmacyName || "Registered Pharmacy";
  const address = profile?.address || user.addressLine1 || "";
  const hours = profile?.hours || `${user.openingTime || "08:00"} - ${user.closingTime || "22:00"}`;
  const operationalStatus = profile?.status || "Open";
  const reviewCount = Number(ratingSummary?.count || 0);
  const rating = reviewCount ? Number(Number(ratingSummary.average).toFixed(1)) : null;
  const latitudeValue = profile?.latitude ?? user.latitude;
  const longitudeValue = profile?.longitude ?? user.longitude;
  const latitude = latitudeValue != null && Number.isFinite(Number(latitudeValue))
    ? Number(latitudeValue)
    : null;
  const longitude = longitudeValue != null && Number.isFinite(Number(longitudeValue))
    ? Number(longitudeValue)
    : null;

  return {
    id: ownerId,
    name,
    ownerName: user.ownerName || "",
    address,
    area: user.area || "",
    city: user.city || "",
    province: user.province || "",
    latitude,
    longitude,
    location: latitude !== null && longitude !== null
      ? { type: "Point", coordinates: [longitude, latitude] }
      : null,
    phone: profile?.phone || user.phone || "",
    email: profile?.email || user.email || "",
    license: profile?.license || user.licenseNumber || "",
    timing: hours,
    status: operationalStatus,
    isOpen: String(operationalStatus).toLowerCase() === "open",
    deliveryCharge: Number(profile?.deliveryCharge ?? user.deliveryCharge ?? 0),
    deliveryRadius: Number(profile?.deliveryRadius ?? user.serviceRadiusKm ?? 0),
    deliveryType: profile?.deliveryType || "Self Delivery",
    taxRate: Number(profile?.taxRate ?? 0),
    rating,
    reviewCount,
    productCount: Number(productCount || 0),
  };
}

function buildProductView(product, pharmacy) {
  const id = idString(product._id);
  return {
    id,
    productId: id,
    slug: id,
    name: product.name || "Unnamed medicine",
    category: product.category || "General",
    price: Number(product.price || 0),
    stock: Number(product.stock || 0),
    threshold: Number(product.threshold || 0),
    expiry: product.expiry || "",
    batch: product.batch || "",
    supplier: product.supplier || "",
    unit: product.unit || "",
    image: product.image || "💊",
    pharmacyId: pharmacy.id,
    pharmacyName: pharmacy.name,
    pharmacyCity: pharmacy.city,
    pharmacyAddress: pharmacy.address,
    pharmacyRating: pharmacy.rating,
    pharmacyDistance: pharmacy.city || pharmacy.address || "Registered pharmacy",
    distanceMiles: null,
    timing: pharmacy.timing,
    deliveryAvailable: pharmacy.isOpen,
    deliveryCharge: pharmacy.deliveryCharge,
    deliveryType: pharmacy.deliveryType,
    taxRate: pharmacy.taxRate,
  };
}

async function pharmacyViewsByOwners(pharmacyDb, users) {
  if (!users.length) return new Map();
  const ownerIds = users.map((user) => idString(user._id));
  const [profiles, counts, ratings] = await Promise.all([
    pharmacyDb.collection("profiles").find({ ownerId: { $in: ownerIds } }).toArray(),
    pharmacyDb.collection("products").aggregate([
      { $match: sellableProductFilter({ ownerId: { $in: ownerIds } }) },
      { $group: { _id: "$ownerId", count: { $sum: 1 } } },
    ]).toArray(),
    pharmacyDb.collection("reviews").aggregate([
      {
        $match: {
          ownerId: { $in: ownerIds },
          source: "marketplace",
          status: { $not: { $regex: /^rejected$/i } },
        },
      },
      { $group: { _id: "$ownerId", average: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]).toArray(),
  ]);

  const profilesByOwner = new Map(profiles.map((profile) => [idString(profile.ownerId), profile]));
  const countsByOwner = new Map(counts.map((row) => [idString(row._id), row.count]));
  const ratingsByOwner = new Map(ratings.map((row) => [idString(row._id), row]));

  return new Map(users.map((user) => {
    const ownerId = idString(user._id);
    return [ownerId, buildPharmacyView(
      user,
      profilesByOwner.get(ownerId),
      countsByOwner.get(ownerId),
      ratingsByOwner.get(ownerId),
    )];
  }));
}

export async function listApprovedPharmacies({ limit = 50 } = {}) {
  const { pharmacyDb } = await getCommerceDatabases();
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const users = await pharmacyDb.collection("users")
    .find(activePharmacyFilter())
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(safeLimit)
    .toArray();
  const views = await pharmacyViewsByOwners(pharmacyDb, users);
  return users.map((user) => views.get(idString(user._id)));
}

// Map discovery must not silently use the directory's 100-row limit: a nearby
// pharmacy could otherwise disappear just because it registered earlier.
export async function listMapPharmacies() {
  const { pharmacyDb } = await getCommerceDatabases();
  const users = await pharmacyDb.collection('users').find(activePharmacyFilter(), {
    projection: { _id: 1, pharmacyName: 1, addressLine1: 1, area: 1, city: 1, province: 1, latitude: 1, longitude: 1, phone: 1 }
  }).toArray();
  const ownerIds = users.map((user) => idString(user._id));
  const profiles = await pharmacyDb.collection('profiles').find({ ownerId: { $in: ownerIds } }, {
    projection: { ownerId: 1, name: 1, address: 1, latitude: 1, longitude: 1, phone: 1, status: 1 }
  }).toArray();
  const byOwner = new Map(profiles.map((profile) => [idString(profile.ownerId), profile]));
  return users.map((user) => {
    const profile = byOwner.get(idString(user._id));
    return {
      id: idString(user._id), name: profile?.name || user.pharmacyName,
      address: profile?.address || user.addressLine1 || '',
      area: user.area || '', city: user.city || '', province: user.province || '',
      latitude: profile?.latitude ?? user.latitude, longitude: profile?.longitude ?? user.longitude,
      phone: profile?.phone || user.phone || '', isOpen: profile?.status ? String(profile.status).toLowerCase() === 'open' : null
    };
  });
}

export async function getApprovedPharmacyById(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const { pharmacyDb } = await getCommerceDatabases();
  const user = await pharmacyDb.collection("users").findOne(activePharmacyFilter({
    _id: new mongoose.Types.ObjectId(id),
  }));
  if (!user) return null;

  const views = await pharmacyViewsByOwners(pharmacyDb, [user]);
  const pharmacy = views.get(idString(user._id));
  const products = await pharmacyDb.collection("products")
    .find(sellableProductFilter({ ownerId: pharmacy.id }))
    .sort({ stock: -1, name: 1 })
    .toArray();

  return {
    ...pharmacy,
    products: products.map((product) => buildProductView(product, pharmacy)),
  };
}

export async function getCatalogProductById(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const { pharmacyDb } = await getCommerceDatabases();
  const product = await pharmacyDb.collection("products").findOne(sellableProductFilter({
    _id: new mongoose.Types.ObjectId(id),
  }));
  if (!product?.ownerId || !mongoose.isValidObjectId(String(product.ownerId))) return null;

  const user = await pharmacyDb.collection("users").findOne(activePharmacyFilter({
    _id: new mongoose.Types.ObjectId(String(product.ownerId)),
  }));
  if (!user) return null;
  const views = await pharmacyViewsByOwners(pharmacyDb, [user]);
  return buildProductView(product, views.get(idString(user._id)));
}

export async function searchPharmacyCatalog({
  query = "",
  page = 1,
  limit = 12,
  minPrice = 0,
  maxPrice = Number.POSITIVE_INFINITY,
  minRating = 0,
  inStockOnly = false,
  deliveryOnly = false,
  sortBy = "relevance",
} = {}) {
  const { pharmacyDb } = await getCommerceDatabases();
  const users = await pharmacyDb.collection("users").find(activePharmacyFilter()).toArray();
  const pharmacyViews = await pharmacyViewsByOwners(pharmacyDb, users);
  const eligiblePharmacies = [...pharmacyViews.values()].filter((pharmacy) => {
    if (Number(minRating) > 0 && Number(pharmacy.rating || 0) < Number(minRating)) return false;
    if (deliveryOnly && !pharmacy.isOpen) return false;
    return true;
  });
  const ownerIds = eligiblePharmacies.map((pharmacy) => pharmacy.id);
  if (!ownerIds.length) {
    return { items: [], pagination: { page: 1, limit, total: 0, totalPages: 1, startIndex: 0, endIndex: 0 } };
  }

  const normalizedQuery = String(query || "").trim();
  const priceFilter = { $gte: Math.max(0, Number(minPrice) || 0) };
  if (Number.isFinite(Number(maxPrice))) priceFilter.$lte = Number(maxPrice);
  const productFilter = sellableProductFilter({
    ownerId: { $in: ownerIds },
    price: priceFilter,
  });
  if (inStockOnly) productFilter.stock = { $gt: 0 };
  if (normalizedQuery) {
    const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matcher = new RegExp(escaped, "i");
    productFilter.$and = [{ $or: [{ name: matcher }, { category: matcher }, { supplier: matcher }] }];
  }

  let products = await pharmacyDb.collection("products").find(productFilter).toArray();
  const pharmacyById = new Map(eligiblePharmacies.map((pharmacy) => [pharmacy.id, pharmacy]));
  products = products
    .map((product) => buildProductView(product, pharmacyById.get(idString(product.ownerId))))
    .filter((product) => product.pharmacyId);

  products.sort((a, b) => {
    if (sortBy === "lowest-price") return a.price - b.price;
    if (sortBy === "highest-rated") return Number(b.pharmacyRating || 0) - Number(a.pharmacyRating || 0);
    if (sortBy === "stock") return b.stock - a.stock;
    if (normalizedQuery) {
      const needle = normalizedQuery.toLowerCase();
      const aStarts = a.name.toLowerCase().startsWith(needle) ? 1 : 0;
      const bStarts = b.name.toLowerCase().startsWith(needle) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;
    }
    return a.name.localeCompare(b.name);
  });

  const safeLimit = Math.min(30, Math.max(1, Number(limit) || 12));
  const total = products.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const start = (safePage - 1) * safeLimit;

  return {
    items: products.slice(start, start + safeLimit),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
      startIndex: total ? start + 1 : 0,
      endIndex: Math.min(start + safeLimit, total),
    },
  };
}
