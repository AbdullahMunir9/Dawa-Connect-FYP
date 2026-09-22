import test from "node:test";
import assert from "node:assert/strict";
import { googleIdentityFromPayload } from "./googleIdentity.mjs";

test("accepts an email-verified Gmail identity and uses sub as its identity", () => {
  const identity = googleIdentityFromPayload({
    sub: "google-account-123",
    email: " User.Name+care@GMAIL.com ",
    email_verified: true,
    name: "A User",
  });
  assert.equal(identity.sub, "google-account-123");
  assert.equal(identity.email, "user.name+care@gmail.com");
  assert.equal(identity.authoritativeEmail, true);
});

test("accepts a verified Workspace identity as authoritative", () => {
  const identity = googleIdentityFromPayload({
    sub: "workspace-123",
    email: "owner@clinic.example",
    email_verified: true,
    hd: "clinic.example",
  });
  assert.equal(identity.authoritativeEmail, true);
});

test("keeps a verified third-party Google account non-authoritative", () => {
  const identity = googleIdentityFromPayload({
    sub: "external-123",
    email: "owner@yahoo.example",
    email_verified: true,
  });
  assert.equal(identity.authoritativeEmail, false);
});

test("rejects unverified, malformed, and incomplete identities", () => {
  assert.equal(googleIdentityFromPayload({ sub: "1", email: "a@gmail.com", email_verified: false }), null);
  assert.equal(googleIdentityFromPayload({ sub: "1", email: "invalid", email_verified: true }), null);
  assert.equal(googleIdentityFromPayload({ email: "a@gmail.com", email_verified: true }), null);
});
