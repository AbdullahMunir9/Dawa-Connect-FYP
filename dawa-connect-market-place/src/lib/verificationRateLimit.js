import "server-only";

import { createHash } from "node:crypto";
import VerificationRateLimit from "@/models/VerificationRateLimit";

export async function consumeVerificationRateLimit({ scope, identifier, limit, windowMs }) {
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const bucketKey = createHash("sha256")
    .update(`${scope}:${String(identifier)}:${bucket}`)
    .digest("hex");
  const expiresAt = new Date((bucket + 2) * windowMs);
  const entry = await VerificationRateLimit.findOneAndUpdate(
    { bucketKey },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const retryAfterSeconds = Math.max(1, Math.ceil(((bucket + 1) * windowMs - now) / 1000));
  return { allowed: entry.count <= limit, retryAfterSeconds, remaining: Math.max(0, limit - entry.count) };
}
