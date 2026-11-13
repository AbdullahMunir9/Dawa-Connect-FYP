export const MAX_PRESCRIPTIONS = 15;
export const MAX_PRESCRIPTION_BYTES = 4 * 1024 * 1024;

export const PRESCRIPTION_TYPES = Object.freeze({
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf",
});

function matchesMagicBytes(buffer, mimeType) {
  if (mimeType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  if (mimeType === "application/pdf") return buffer.subarray(0, 5).toString() === "%PDF-";
  return false;
}

export function validatePrescriptionFile({ name, mimeType, buffer }) {
  if (!name || !buffer?.length) return { ok: false, message: "Choose a prescription file to upload." };
  if (!PRESCRIPTION_TYPES[mimeType]) return { ok: false, message: "Only JPEG, PNG, WebP and PDF prescriptions are supported." };
  if (buffer.length > MAX_PRESCRIPTION_BYTES) return { ok: false, message: "Prescription files must be 4 MB or smaller." };
  if (!matchesMagicBytes(buffer, mimeType)) return { ok: false, message: "The selected file does not match its declared file type." };
  return { ok: true, extension: PRESCRIPTION_TYPES[mimeType] };
}
