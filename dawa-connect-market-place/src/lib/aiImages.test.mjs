import assert from "node:assert/strict";
import test from "node:test";
import {
  DAILY_AI_IMAGE_LIMIT,
  MAX_AI_IMAGES_PER_MESSAGE,
  validateAiImages,
} from "./aiImages.mjs";

const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xdb]).toString("base64")}`;
const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64")}`;

test("accepts up to two supported images", () => {
  const result = validateAiImages([{ dataUrl: jpeg }, { dataUrl: png }]);
  assert.equal(result.length, MAX_AI_IMAGES_PER_MESSAGE);
  assert.deepEqual(result.map(({ mimeType }) => mimeType), ["image/jpeg", "image/png"]);
  assert.equal(DAILY_AI_IMAGE_LIMIT, 6);
});

test("rejects more than two images", () => {
  assert.throws(
    () => validateAiImages([{ dataUrl: jpeg }, { dataUrl: jpeg }, { dataUrl: jpeg }]),
    /no more than 2 images/i,
  );
});

test("rejects unsupported and forged image data", () => {
  assert.throws(
    () => validateAiImages([{ dataUrl: "data:image/gif;base64,R0lGODlh" }]),
    /JPEG, PNG or WebP/i,
  );
  assert.throws(
    () => validateAiImages([{ dataUrl: "data:image/png;base64,SGVsbG8=" }]),
    /does not match/i,
  );
});

