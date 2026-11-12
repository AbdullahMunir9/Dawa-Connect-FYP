export const DAILY_AI_IMAGE_LIMIT = 6;
export const MAX_AI_IMAGES_PER_MESSAGE = 2;
export const MAX_AI_IMAGE_BYTES = 1_250_000;
export const ALLOWED_AI_IMAGE_MIME_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

function hasExpectedSignature(buffer, mimeType) {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return buffer.length >= signature.length && signature.every((byte, index) => buffer[index] === byte);
  }
  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

export function validateAiImages(images) {
  if (images == null) return [];
  if (!Array.isArray(images)) {
    throw new Error("Images must be provided as a list.");
  }
  if (images.length > MAX_AI_IMAGES_PER_MESSAGE) {
    throw new Error(`You can attach no more than ${MAX_AI_IMAGES_PER_MESSAGE} images to one message.`);
  }

  return images.map((image, index) => {
    const dataUrl = typeof image?.dataUrl === "string" ? image.dataUrl.trim() : "";
    const match = DATA_URL_PATTERN.exec(dataUrl);
    if (!match) {
      throw new Error(`Image ${index + 1} must be a JPEG, PNG or WebP image.`);
    }

    const [, mimeType, encoded] = match;
    const buffer = Buffer.from(encoded, "base64");
    if (!buffer.length || buffer.length > MAX_AI_IMAGE_BYTES) {
      throw new Error(
        `Each image must be ${Math.floor(MAX_AI_IMAGE_BYTES / 1_000_000)} MB or smaller after compression.`,
      );
    }
    if (!hasExpectedSignature(buffer, mimeType)) {
      throw new Error(`Image ${index + 1} does not match its declared file type.`);
    }

    return { dataUrl, mimeType, byteLength: buffer.length };
  });
}

