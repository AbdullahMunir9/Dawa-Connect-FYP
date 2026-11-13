import test from "node:test";
import assert from "node:assert/strict";
import { MAX_PRESCRIPTION_BYTES, validatePrescriptionFile } from "./prescriptionFiles.mjs";

test("accepts genuine JPEG, PNG, WebP and PDF signatures", () => {
  const samples = [
    ["scan.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])],
    ["scan.png", "image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["scan.webp", "image/webp", Buffer.from("RIFF0000WEBP")],
    ["scan.pdf", "application/pdf", Buffer.from("%PDF-1.7")],
  ];
  for (const [name, mimeType, buffer] of samples) assert.equal(validatePrescriptionFile({ name, mimeType, buffer }).ok, true);
});

test("rejects disguised, unsupported and oversized files", () => {
  assert.equal(validatePrescriptionFile({ name: "fake.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not-an-image") }).ok, false);
  assert.equal(validatePrescriptionFile({ name: "script.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") }).ok, false);
  assert.equal(validatePrescriptionFile({ name: "large.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(MAX_PRESCRIPTION_BYTES + 1) }).ok, false);
});
