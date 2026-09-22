import "server-only";

import { randomBytes } from "crypto";
import mongoose from "mongoose";
import { getCommerceDatabases } from "@/lib/pharmacyCatalog";

export class CommerceError extends Error {
  constructor(message, status = 400, code = "COMMERCE_ERROR") {
    super(message);
    this.name = "CommerceError";
    this.status = status;
    this.code = code;
  }
}

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function orderNumber() {
  const time = Date.now().toString(36).toUpperCase();
  const random = randomBytes(3).toString("hex").toUpperCase();
  return `DC-${time}-${random}`;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CommerceError("Your cart is empty", 400, "EMPTY_CART");
  }
  if (items.length > 100) {
    throw new CommerceError("A single order cannot contain more than 100 cart lines", 400, "CART_TOO_LARGE");
  }

  const merged = new Map();
  for (const item of items) {
    const productId = String(item?.productId || item?.id || "");
    const pharmacyId = String(item?.pharmacyId || "");
    const quantity = Number(item?.quantity);
    if (!mongoose.isValidObjectId(productId) || !mongoose.isValidObjectId(pharmacyId)) {
      throw new CommerceError("Your cart contains a product that is no longer available", 409, "INVALID_CART_ITEM");
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw new CommerceError("Every cart quantity must be between 1 and 999", 400, "INVALID_QUANTITY");
    }
    const key = `${pharmacyId}:${productId}`;
    const existing = merged.get(key);
    if (existing) existing.quantity += quantity;
    else merged.set(key, { productId, pharmacyId, quantity });
  }
  return [...merged.values()];
}

function addressText(address) {
  return [address.line1, address.line2, address.city, address.province, address.postalCode]
    .filter(Boolean)
    .join(", ");
}

function normalizeDeliveryAddress(address) {
  const limits = {
    label: 40,
    fullName: 100,
    phone: 30,
    line1: 200,
    line2: 200,
    city: 100,
    province: 100,
    postalCode: 30,
  };
  const normalized = {};
  for (const [field, limit] of Object.entries(limits)) {
    normalized[field] = String(address?.[field] || "").trim().slice(0, limit);
  }
  normalized.label ||= "Delivery";

  for (const field of ["fullName", "phone", "line1", "city"]) {
    if (!normalized[field]) {
      throw new CommerceError(`Delivery address ${field} is required`, 400, "INVALID_ADDRESS");
    }
  }
  return normalized;
}

export async function createCommerceOrder({
  userId,
  guestSessionHash,
  items,
  addressId,
  deliveryAddress: suppliedAddress,
  saveAddress = false,
  paymentMethod,
}) {
  const isRegisteredCustomer = mongoose.isValidObjectId(userId);
  const isGuestCustomer = /^[a-f0-9]{64}$/.test(String(guestSessionHash || ""));
  if (!isRegisteredCustomer && !isGuestCustomer) {
    throw new CommerceError("A customer session is required", 401, "UNAUTHORIZED");
  }
  const requestedItems = normalizeItems(items);
  const normalizedPayment = String(paymentMethod || "cash").toLowerCase();
  if (normalizedPayment !== "cash") {
    throw new CommerceError("Card payments are not available yet. Please use cash on delivery", 400, "INVALID_PAYMENT_METHOD");
  }

  const { client, marketplaceDb, pharmacyDb } = await getCommerceDatabases();
  const session = client.startSession();
  let createdOrder;

  try {
    await session.withTransaction(async () => {
      const customer = isRegisteredCustomer
        ? await marketplaceDb.collection("users").findOne(
          { _id: new mongoose.Types.ObjectId(userId), status: { $not: { $regex: /^suspended$/i } } },
          { session },
        )
        : null;
      if (isRegisteredCustomer && !customer) {
        throw new CommerceError("Customer account is unavailable", 403, "CUSTOMER_UNAVAILABLE");
      }

      const savedAddress = customer && addressId
        ? (customer.addresses || []).find((address) => String(address._id) === String(addressId))
        : null;
      if (customer && addressId && !savedAddress) {
        throw new CommerceError("Please select a valid saved delivery address", 400, "INVALID_ADDRESS");
      }
      const deliveryAddress = savedAddress || normalizeDeliveryAddress(suppliedAddress);
      const shouldSaveAddress = Boolean(customer && !savedAddress && saveAddress);
      if (shouldSaveAddress) {
        deliveryAddress._id = new mongoose.Types.ObjectId();
        deliveryAddress.isDefault = (customer.addresses || []).length === 0;
      }

      const pharmacyIds = [...new Set(requestedItems.map((item) => item.pharmacyId))];
      const pharmacyObjectIds = pharmacyIds.map((id) => new mongoose.Types.ObjectId(id));
      const pharmacyUsers = await pharmacyDb.collection("users").find({
        _id: { $in: pharmacyObjectIds },
        approvalStatus: { $regex: /^approved$/i },
        status: { $not: { $regex: /^suspended$/i } },
      }, { session }).toArray();
      if (pharmacyUsers.length !== pharmacyIds.length) {
        throw new CommerceError("One or more pharmacies are no longer accepting marketplace orders", 409, "PHARMACY_UNAVAILABLE");
      }

      const profiles = await pharmacyDb.collection("profiles").find(
        { ownerId: { $in: pharmacyIds } },
        { session },
      ).toArray();
      const profilesByOwner = new Map(profiles.map((profile) => [String(profile.ownerId), profile]));
      const closedPharmacy = pharmacyIds.find((id) => {
        const status = profilesByOwner.get(id)?.status || "Open";
        return String(status).toLowerCase() !== "open";
      });
      if (closedPharmacy) {
        throw new CommerceError("One or more pharmacies in your cart are currently closed", 409, "PHARMACY_CLOSED");
      }

      const productObjectIds = requestedItems.map((item) => new mongoose.Types.ObjectId(item.productId));
      const products = await pharmacyDb.collection("products").find(
        { _id: { $in: productObjectIds } },
        { session },
      ).toArray();
      const productsById = new Map(products.map((product) => [String(product._id), product]));
      const pharmacyUsersById = new Map(pharmacyUsers.map((pharmacy) => [String(pharmacy._id), pharmacy]));
      const grouped = new Map();

      for (const requested of requestedItems) {
        const product = productsById.get(requested.productId);
        if (!product || String(product.ownerId) !== requested.pharmacyId) {
          throw new CommerceError("A product in your cart is no longer sold by the selected pharmacy", 409, "PRODUCT_UNAVAILABLE");
        }
        if (product.expiry && String(product.expiry) < new Date().toISOString().slice(0, 10)) {
          throw new CommerceError(`${product.name} is no longer available for sale`, 409, "PRODUCT_EXPIRED");
        }
        if (Number(product.stock || 0) < requested.quantity) {
          throw new CommerceError(`Only ${Number(product.stock || 0)} unit(s) of ${product.name} remain`, 409, "INSUFFICIENT_STOCK");
        }

        const reserved = await pharmacyDb.collection("products").updateOne(
          { _id: product._id, ownerId: requested.pharmacyId, stock: { $gte: requested.quantity } },
          { $inc: { stock: -requested.quantity }, $set: { updatedAt: new Date() } },
          { session },
        );
        if (reserved.modifiedCount !== 1) {
          throw new CommerceError(`Stock for ${product.name} changed while you were checking out`, 409, "STOCK_CHANGED");
        }

        const group = grouped.get(requested.pharmacyId) || { items: [], subtotal: 0 };
        const price = money(product.price || 0);
        group.items.push({
          productId: String(product._id),
          name: product.name || "Medicine",
          category: product.category || "General",
          unit: product.unit || "",
          quantity: requested.quantity,
          qty: requested.quantity,
          price,
          lineTotal: money(price * requested.quantity),
        });
        group.subtotal = money(group.subtotal + price * requested.quantity);
        grouped.set(requested.pharmacyId, group);
      }

      const now = new Date();
      const estimatedDelivery = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      const orderId = orderNumber();
      const marketplaceOrderObjectId = new mongoose.Types.ObjectId();
      const fulfillments = [];
      const pharmacyOrders = [];
      let subtotal = 0;
      let tax = 0;
      let deliveryFee = 0;
      let sequence = 1;

      for (const [pharmacyId, group] of grouped) {
        const user = pharmacyUsersById.get(pharmacyId);
        const profile = profilesByOwner.get(pharmacyId);
        const pharmacyName = profile?.name || user?.pharmacyName || "Registered Pharmacy";
        const groupTax = money(group.subtotal * (Number(profile?.taxRate || 0) / 100));
        const groupDeliveryFee = money(profile?.deliveryCharge ?? user?.deliveryCharge ?? 0);
        const fulfillmentTotal = money(group.subtotal + groupTax + groupDeliveryFee);
        const pharmacyOrderId = `${orderId}-${String(sequence).padStart(2, "0")}`;

        fulfillments.push({
          pharmacyId,
          pharmacyName,
          pharmacyOrderId,
          status: "Pending",
          itemCount: group.items.reduce((sum, item) => sum + item.quantity, 0),
          subtotal: group.subtotal,
          tax: groupTax,
          deliveryFee: groupDeliveryFee,
          total: fulfillmentTotal,
          updatedAt: now,
        });
        pharmacyOrders.push({
          id: pharmacyOrderId,
          marketplaceOrderId: String(marketplaceOrderObjectId),
          customerOrderId: orderId,
          source: "marketplace",
          ownerId: pharmacyId,
          customerUserId: customer ? String(customer._id) : "",
          customer: customer?.name || deliveryAddress.fullName || "Guest Customer",
          phone: deliveryAddress.phone || customer?.phone || "",
          items: group.items,
          subtotal: group.subtotal,
          tax: groupTax,
          deliveryFee: groupDeliveryFee,
          total: fulfillmentTotal,
          status: "Pending",
          date: now.toISOString().slice(0, 10),
          address: addressText(deliveryAddress),
          deliveryAddress,
          delivery: profile?.deliveryType || "Standard",
          payMethod: normalizedPayment === "cash" ? "Cash on Delivery" : "Card",
          paymentStatus: normalizedPayment === "cash" ? "Due on delivery" : "Pending gateway confirmation",
          inventoryReserved: true,
          inventoryRestocked: false,
          createdAt: now,
          updatedAt: now,
        });
        subtotal = money(subtotal + group.subtotal);
        tax = money(tax + groupTax);
        deliveryFee = money(deliveryFee + groupDeliveryFee);
        sequence += 1;
      }

      const processingFee = 100;
      const total = money(subtotal + tax + deliveryFee + processingFee);
      createdOrder = {
        _id: marketplaceOrderObjectId,
        userId: customer?._id || null,
        guestSessionHash: customer ? "" : guestSessionHash,
        orderId,
        items: pharmacyOrders.flatMap((order) => order.items.map((item) => ({
          productId: item.productId,
          pharmacyId: order.ownerId,
          pharmacyName: fulfillments.find((fulfillment) => fulfillment.pharmacyId === order.ownerId)?.pharmacyName || "",
          name: item.name,
          category: item.category,
          unit: item.unit,
          quantity: item.quantity,
          price: item.price,
          lineTotal: item.lineTotal,
        }))),
        fulfillments,
        subtotal,
        tax,
        deliveryFee,
        processingFee,
        total,
        status: "Processing",
        paymentMethod: normalizedPayment,
        paymentStatus: normalizedPayment === "cash" ? "Due on delivery" : "Pending gateway confirmation",
        deliveryAddress,
        estimatedDelivery,
        createdAt: now,
        updatedAt: now,
      };

      await marketplaceDb.collection("orders").insertOne(createdOrder, { session });
      await pharmacyDb.collection("orders").insertMany(pharmacyOrders, { session });
      await pharmacyDb.collection("notifications").insertMany(pharmacyOrders.map((order) => ({
        ownerId: order.ownerId,
        type: "order",
        message: `New marketplace order ${order.id} from ${customer?.name || deliveryAddress.fullName}`,
        orderId: order.id,
        read: false,
        color: "#14b8a6",
        createdAt: now,
        updatedAt: now,
      })), { session });
      if (customer) {
        const customerUpdate = { $set: { cartItems: [], updatedAt: now } };
        if (shouldSaveAddress) customerUpdate.$push = { addresses: deliveryAddress };
        await marketplaceDb.collection("users").updateOne(
          { _id: customer._id },
          customerUpdate,
          { session },
        );
      }
    }, {
      readPreference: "primary",
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
  } finally {
    await session.endSession();
  }

  if (!createdOrder) throw new CommerceError("Order creation did not complete", 500, "ORDER_NOT_CREATED");
  return {
    ...createdOrder,
    _id: String(createdOrder._id),
    userId: createdOrder.userId ? String(createdOrder.userId) : null,
    guestSessionHash: undefined,
  };
}
