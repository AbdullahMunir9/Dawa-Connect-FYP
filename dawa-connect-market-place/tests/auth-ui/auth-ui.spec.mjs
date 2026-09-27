import { expect, test } from "@playwright/test";

const user = {
  id: "test-user-id",
  name: "Test User",
  email: "test@example.com",
  status: "active",
  phone: "",
  city: "Lahore",
  picture: "",
  emailVerified: true,
  addresses: [],
};

test("Google button remains mounted while auth fields are hovered and focused", async ({ page }) => {
  await page.route("**/api/auth/google/nonce", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ configured: true, clientId: "test-client-id", nonce: "test-nonce" }),
  }));
  await page.route("https://accounts.google.com/gsi/client", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: `
      window.google = { accounts: { id: {
        initialize(options) { window.__googleCallback = options.callback; },
        renderButton(target) {
          window.__googleRenderCount = (window.__googleRenderCount || 0) + 1;
          const button = document.createElement("button");
          button.id = "mock-google-button";
          button.type = "button";
          button.textContent = "Continue with Google";
          target.appendChild(button);
        }
      } } };
    `,
  }));

  await page.goto("/login");
  const googleButton = page.locator("#mock-google-button");
  await expect(googleButton).toBeVisible();

  for (const selector of ["#login-email", "#login-password", "#login-email"]) {
    await page.locator(selector).hover();
    await page.locator(selector).focus();
  }

  await expect(googleButton).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__googleRenderCount)).toBe(1);
});

test("Google signup returns to the page that requested authentication", async ({ page }) => {
  let authenticated = false;
  await page.route("**/api/auth/me", (route) => route.fulfill({
    status: authenticated ? 200 : 401,
    contentType: "application/json",
    body: JSON.stringify(authenticated ? { user } : { message: "Not authenticated" }),
  }));
  await page.route("**/api/auth/google/nonce", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ configured: true, clientId: "test-client-id", nonce: "test-nonce" }),
  }));
  await page.route("**/api/auth/google", (route) => {
    authenticated = true;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user }),
    });
  });
  await page.route("https://accounts.google.com/gsi/client", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: `
      window.google = { accounts: { id: {
        initialize(options) { window.__googleCallback = options.callback; },
        renderButton(target) {
          const button = document.createElement("button");
          button.id = "mock-google-button";
          button.type = "button";
          button.textContent = "Continue with Google";
          button.onclick = () => window.__googleCallback({ credential: "test-credential" });
          target.appendChild(button);
        }
      } } };
    `,
  }));
  await page.route("**/api/chat", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ limit: 20, remaining: 20, used: 0 }),
  }));

  await page.goto("/signup?next=%2Fassistant");
  await page.locator("#mock-google-button").click();

  await expect(page).toHaveURL(/\/assistant$/);
  await expect(page.locator('[aria-label="Conversation"]')).toBeVisible();
});

test("assistant does not force the document or conversation to the bottom", async ({ page }) => {
  await page.route("**/api/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ user }),
  }));
  await page.route("**/api/chat", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ limit: 20, remaining: 20, used: 0 }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "text/plain; charset=utf-8",
      headers: { "X-AI-Limit": "20", "X-AI-Remaining": "19" },
      body: "This is a deliberately long streamed-style answer. ".repeat(20),
    });
  });

  await page.goto("/assistant");
  const viewport = page.getByTestId("messages-viewport");
  await expect(viewport).toBeVisible();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await viewport.evaluate((element) => element.scrollTop)).toBe(0);

  await page.getByRole("button", { name: /Dosage basics/ }).first().click();
  await page.waitForTimeout(1_000);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await viewport.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(page.getByRole("button", { name: "Jump to the latest message" })).toBeVisible();
});
