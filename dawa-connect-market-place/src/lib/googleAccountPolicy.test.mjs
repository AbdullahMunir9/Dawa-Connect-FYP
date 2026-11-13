import test from "node:test";
import assert from "node:assert/strict";
import { decideGoogleAccountAction } from "./googleAccountPolicy.mjs";

test("an existing Google identity always signs in", () => {
  assert.deepEqual(decideGoogleAccountAction({ hasGoogleMatch: true }), { action: "sign_in" });
});

test("a verified new Google identity creates an account without page-dependent intent", () => {
  assert.deepEqual(
    decideGoogleAccountAction({ identitySub: "google-1", authoritativeEmail: true }),
    { action: "create_and_sign_in" },
  );
});

test("a matching authoritative email links safely and a mismatched Google subject is rejected", () => {
  assert.deepEqual(decideGoogleAccountAction({
    hasEmailMatch: true,
    identitySub: "google-1",
    authoritativeEmail: true,
  }), { action: "link_and_sign_in" });

  assert.equal(decideGoogleAccountAction({
    hasEmailMatch: true,
    linkedGoogleSub: "google-2",
    identitySub: "google-1",
    authoritativeEmail: true,
  }).action, "reject");
});

test("a non-authoritative Google email cannot create or take over an account", () => {
  assert.equal(decideGoogleAccountAction({ authoritativeEmail: false }).action, "reject");
  assert.equal(decideGoogleAccountAction({
    hasEmailMatch: true,
    identitySub: "external-1",
    authoritativeEmail: false,
  }).action, "reject");
});
