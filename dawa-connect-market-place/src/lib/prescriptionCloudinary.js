import "server-only";
import crypto from "node:crypto";

function config() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) { const error = new Error("Prescription storage is not configured."); error.status = 503; throw error; }
  return { cloudName, apiKey, apiSecret };
}

function sign(params, apiSecret) {
  const payload = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "").sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("&");
  return crypto.createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}

export async function uploadPrescription({ buffer, mimeType, publicId }) {
  const { cloudName, apiKey, apiSecret } = config();
  const timestamp = Math.floor(Date.now() / 1000);
  const eager = mimeType === "application/pdf" ? "pg_1,c_limit,w_1600,h_1600,q_auto,f_jpg" : "c_limit,w_1600,h_1600,q_auto,f_jpg";
  const signed = { eager, public_id: publicId, timestamp, type: "authenticated" };
  const form = new FormData();
  form.set("file", new Blob([buffer], { type: mimeType }), "prescription");
  Object.entries(signed).forEach(([key, value]) => form.set(key, String(value)));
  form.set("api_key", apiKey); form.set("signature", sign(signed, apiSecret));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data?.error?.message || "Cloudinary could not store the prescription."); error.status = 502; throw error; }
  return { publicId: data.public_id, assetId: data.asset_id, secureUrl: data.secure_url, previewUrl: data.eager?.[0]?.secure_url || data.secure_url, resourceType: data.resource_type || "image", deliveryType: data.type || "authenticated", format: data.format, bytes: data.bytes };
}

export async function destroyPrescription(publicId) {
  if (!publicId) return;
  const { cloudName, apiKey, apiSecret } = config();
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = { invalidate: true, public_id: publicId, timestamp, type: "authenticated" };
  const form = new URLSearchParams();
  Object.entries(signed).forEach(([key, value]) => form.set(key, String(value)));
  form.set("api_key", apiKey); form.set("signature", sign(signed, apiSecret));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !["ok", "not found"].includes(data.result)) throw new Error(data?.error?.message || "Cloudinary could not delete the prescription.");
}
