import test from "node:test";
import assert from "node:assert/strict";
import { authPageHref, safeAuthRedirect } from "./authRedirect.mjs";

test("keeps a local return path, including its query and hash", () => {
  assert.equal(
    safeAuthRedirect("/search?query=panadol#results"),
    "/search?query=panadol#results"
  );
});

test("rejects external, malformed, and recursive auth destinations", () => {
  assert.equal(safeAuthRedirect("https://example.com"), "/");
  assert.equal(safeAuthRedirect("//example.com/account"), "/");
  assert.equal(safeAuthRedirect("/login?next=/dashboard"), "/");
  assert.equal(safeAuthRedirect("/signup"), "/");
});

test("creates an encoded authentication link", () => {
  assert.equal(
    authPageHref("/signup", "/product/medicine-1?tab=details"),
    "/signup?next=%2Fproduct%2Fmedicine-1%3Ftab%3Ddetails"
  );
});
