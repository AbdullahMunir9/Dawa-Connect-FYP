# DawaConnect Marketplace Authentication and Authorization

This document describes the marketplace authentication system as implemented in `dawa-connect-market-place`. It covers password registration with email OTP verification, Google Identity Services, login sessions, protected pages and APIs, redirect behavior, logout, database records, rate limits, Resend configuration, testing, and the present security boundaries.

## 1. Authentication versus authorization

Authentication answers: **Who is this user?**

The marketplace supports two authentication methods:

1. Email address and password, with mandatory email OTP verification for new registrations.
2. Continue with Google, using a verified Google ID token.

Authorization answers: **What is this authenticated user allowed to access?**

The marketplace uses the authenticated user's signed session to protect the user portal and user-specific APIs such as addresses, cart synchronization, orders, saved items, prescriptions, complaints, and the AI assistant.

There are no customer roles inside the marketplace at present. A marketplace customer is either active or suspended. Pharmacy and administrator accounts belong to the other applications and do not use this customer session.

## 2. Main components

| Component | Responsibility |
| --- | --- |
| `src/context/AuthContext.js` | Client-side authentication state and calls to login, Google authentication, OTP signup, session checks, and logout. |
| `src/lib/authSession.js` | Creates the seven-day JWT, sets the secure session cookie, and produces the safe user object returned to the browser. |
| `src/proxy.js` | Protects `/dashboard` routes before the page is served. |
| `src/app/api/auth/me/route.js` | Resolves the session cookie into the current database user and rejects missing, invalid, deleted, or suspended accounts. |
| `src/app/api/auth/signup/*` | Starts email registration, verifies OTPs, resends codes, and exposes non-sensitive delivery status. |
| `src/app/api/auth/google/*` | Creates a Google nonce and verifies Google ID tokens. |
| `src/app/api/webhooks/resend/route.js` | Verifies signed Resend webhooks and records delivery, delay, bounce, or failure outcomes. |
| `src/models/User.js` | Permanent marketplace customer record. |
| `src/models/PendingRegistration.js` | Temporary password registration and OTP challenge. |
| `src/models/VerificationRateLimit.js` | MongoDB-backed fixed-window limits for OTP endpoints. |
| `src/lib/authRedirect.mjs` | Preserves a safe internal return path through signup and login. |

## 3. Database structures

### 3.1 `users`

The `User` model is the permanent customer identity.

Important authentication fields:

| Field | Meaning |
| --- | --- |
| `_id` | MongoDB identity used as `userId` in the JWT. |
| `name` | Customer display name. |
| `email` | Normalized lowercase email. It is unique. |
| `password` | Bcrypt password hash. It is excluded from normal queries. Google-only users do not have it. |
| `googleSub` | Stable Google account subject identifier. It is unique, sparse, and excluded from normal queries. |
| `emailVerifiedAt` | Time at which Google or an email OTP verified the address. |
| `picture` | Optional Google profile picture URL. |
| `status` | `active` or `suspended`. |

The model also stores marketplace profile information, cart items, and saved delivery addresses. Passwords and Google subject identifiers are never included in the client-safe user response.

### 3.2 `pendingregistrations`

A password registration does not create a `User` immediately. It first creates a temporary `PendingRegistration` containing:

- a random 256-bit `challengeId`;
- normalized email and submitted profile fields;
- a bcrypt password hash, never the password itself;
- an HMAC-SHA256 OTP hash, never the OTP itself;
- the five-minute OTP expiry;
- the resend cooldown and hourly send counters;
- failed verification attempt count;
- the Resend email ID and delivery status;
- a separate TTL deletion time.

The OTP expiry and database deletion time are deliberately separate. An expired OTP can be replaced using Resend, while MongoDB removes abandoned registration data automatically after the longer cleanup period.

### 3.3 `verificationratelimits`

OTP rate limits are stored in MongoDB so they work across multiple application instances. Identifiers are SHA-256 hashed into fixed time buckets; raw IP addresses and email addresses are not stored in this collection. MongoDB TTL indexes delete expired buckets.

MongoDB creates these collections and indexes automatically when the relevant routes first run. They do not need to be created manually.

## 4. Password registration and email verification

### 4.1 Starting registration

The browser sends the profile, email, and password to `POST /api/auth/signup`.

The server then:

1. Trims and validates all values.
2. Normalizes the email to lowercase.
3. Applies the strong-password rule: at least eight characters, one uppercase letter, one number, and one special character.
4. Checks MongoDB-backed email and IP rate limits.
5. Rejects an email already attached to a permanent account.
6. Generates a cryptographically secure six-digit OTP.
7. Generates a random 256-bit challenge ID.
8. Hashes the password with bcrypt using cost 12.
9. Hashes the OTP using HMAC-SHA256 over the challenge ID, normalized email, and OTP, keyed by `EMAIL_OTP_PEPPER`.
10. Stores or replaces the pending registration.
11. Sends the custom DawaConnect email through Resend.
12. Returns only the challenge ID, masked email, expiry, and resend time to the browser.

If Resend rejects the send request, the pending registration is deleted and no account is created.

### 4.2 Why sending alone is not verification

An accepted Resend API call means the message was accepted for delivery. It does not prove that the destination mailbox exists. A receiving mail server can reject the message later. The account is therefore created only when the user enters the OTP received in the mailbox.

### 4.3 OTP rules

- Code length: six numeric digits.
- Expiry: exactly five minutes.
- Incorrect attempts: maximum five per issued code.
- Resend cooldown: 60 seconds.
- Maximum sends: five per email address in one hour.
- Signup requests: five per email address and twenty per IP in one hour.
- Verification requests: thirty per IP in ten minutes.
- Resend requests: twenty per IP in one hour.
- Issuing a new code invalidates the previous code and resets its five-attempt allowance.

### 4.4 Verifying the code

The browser sends `challengeId` and the six-digit code to `POST /api/auth/signup/verify`.

The server:

1. Loads the pending registration and protected hashes.
2. Rejects expired, consumed, bounced, failed, or attempt-locked challenges.
3. Recalculates the OTP HMAC and compares it using a timing-safe comparison.
4. Atomically claims the challenge so concurrent requests cannot create two accounts.
5. Creates the permanent `User` with `emailVerifiedAt` populated.
6. Deletes the pending registration.
7. Creates the same signed session used by normal login and Google login.
8. Returns an HttpOnly session cookie.
9. The client confirms that cookie through `/api/auth/me` and returns the user to the page from which signup started.

### 4.5 Resending a code

`POST /api/auth/signup/resend` enforces the cooldown and hourly limits. It creates a fresh OTP, resets the five-minute expiry and attempt count, and sends a new email. If sending fails, the database update is rolled back so a previously valid code is not unnecessarily invalidated.

### 4.6 Delivery status and bounces

The verification page polls `GET /api/auth/signup/status` for the non-sensitive status of its random challenge. Resend sends signed events to `POST /api/webhooks/resend`.

Handled events are:

- `email.sent`
- `email.delivered`
- `email.delivery_delayed`
- `email.bounced`
- `email.failed`

The webhook route reads the raw request body and verifies its Svix signature through the official Resend SDK before updating MongoDB. A bounced or failed email disables verification and tells the user to correct the address.

## 5. Google registration and login

The Google flow uses Google Identity Services, not a client secret.

1. The browser requests `GET /api/auth/google/nonce`.
2. The server creates a random nonce and places it in a short-lived, HttpOnly, `SameSite=Strict` cookie scoped to the Google auth endpoint.
3. Google returns an ID token to the browser popup callback.
4. The browser sends the token and the `signup` or `login` intent to `POST /api/auth/google`.
5. The server verifies the token signature, audience, issuer behavior through Google's library, expiry, verified email, and nonce.
6. Google accounts are identified by `sub`, not by a changeable display name.
7. A Gmail or Google Workspace address can be treated as authoritative when linking an existing email account; other Google-hosted identities require the safer password path.
8. New Google users receive `emailVerifiedAt` immediately because Google supplied a verified authoritative email.
9. Suspended accounts are rejected.
10. The nonce cookie is cleared, and the normal marketplace session is issued.

Google-only accounts have no password. Attempting password login shows a message directing the user to Continue with Google.

## 6. Password login

`POST /api/auth/login` normalizes the email, loads the password hash explicitly, checks account status, and compares the submitted password using bcrypt. It returns the same generic `Invalid credentials` response for an unknown user or incorrect password.

On success, the server issues the normal marketplace session. Existing accounts created before OTP verification was introduced can still log in even if `emailVerifiedAt` is empty. New password accounts cannot be created without OTP verification. A future migration can require legacy accounts to verify their address without locking them out unexpectedly.

## 7. Session management

### 7.1 JWT contents

`authSession.js` signs an HS256 JWT containing:

- `userId`
- `email`
- `name`
- issued-at time
- seven-day expiry

The signature uses `JWT_SECRET`, which must contain at least 32 characters.

### 7.2 Cookie properties

The token is stored as `auth_token` with:

- `HttpOnly`: JavaScript cannot read it;
- `Secure` in production: it is sent only over HTTPS;
- `SameSite=Lax`: provides practical CSRF protection for the current same-site API design;
- `Path=/`: it is available to the marketplace;
- seven-day maximum age.

The token is never stored in local storage.

### 7.3 Client session initialization

`AuthProvider` calls `/api/auth/me` when the application loads. The endpoint verifies the signature, loads the current user from MongoDB, rejects deleted or suspended accounts, and returns only the safe user view.

Authentication requests use a revision counter so an older session request cannot finish later and overwrite a newly authenticated user. After login, Google authentication, or OTP verification, the client calls `/api/auth/me` again before navigating. This confirms that the new HttpOnly cookie is usable.

### 7.4 Logout

`POST /api/auth/logout` expires the `auth_token` cookie. The client clears its user state and returns home.

JWT sessions are stateless. Logout removes the browser cookie but does not maintain a server-side token revocation list. Password changes and “log out all devices” would require a token version or session collection in a future enhancement.

## 8. Return-to-page redirects

Login and signup links include a `next` query value containing the page that requested authentication. After success, the user returns there instead of always entering the portal.

`authRedirect.mjs` accepts only same-application paths beginning with a single `/`. It rejects absolute URLs, protocol-relative URLs, malformed destinations, and recursive `/login` or `/signup` destinations. This prevents open-redirect attacks.

Examples:

```text
/assistant -> signup -> OTP -> /assistant
/product/medicine-1 -> login -> /product/medicine-1
/search?query=panadol -> Google login -> /search?query=panadol
```

## 9. Authorization enforcement

### 9.1 Protected pages

`proxy.js` protects `/dashboard` and its child routes. It verifies the JWT before allowing the request. Unauthenticated requests are redirected to `/login` with the original path preserved in `next`.

The dashboard client layout also waits for `AuthProvider`. If `/api/auth/me` does not return an active user, it returns the user to login.

The AI assistant page itself is public so guests can see the sign-in explanation, but its conversation interface and `/api/chat` require an authenticated active user.

### 9.2 Protected APIs

User-specific API routes read and verify the HttpOnly JWT before accessing customer records. These include:

- cart synchronization;
- customer addresses;
- saved products;
- recent searches associated with an account;
- orders and customer order history;
- prescriptions;
- complaints;
- AI chat and its daily quota.

The user ID comes from the verified JWT, not from an arbitrary request-body user ID. Resource queries then scope records to that user. Authentication failures return HTTP 401; suspended-account checks return HTTP 403 where the route loads account status.

Public catalog, healthcare map, pharmacy listing, product, search, and guest checkout/order capabilities remain accessible according to their own route rules.

## 10. Required environment variables

Real secrets belong in `.env.local` for development and in the deployment platform's secret manager for production. `.env.local` is ignored by Git. `.env.example` contains placeholders only.

| Variable | Purpose | Secret? |
| --- | --- | --- |
| `MONGODB_URI` | Marketplace MongoDB connection. | Yes |
| `JWT_SECRET` | Signs marketplace JWT sessions; minimum 32 characters. | Yes |
| `GOOGLE_CLIENT_ID` | Google Identity Services web client ID. | No |
| `RESEND_API_KEY` | Sends transactional verification email. | Yes |
| `RESEND_FROM_EMAIL` | Branded sender, intended as `DawaConnect <noreply@dawaconnect.store>`. | No |
| `RESEND_WEBHOOK_SECRET` | Verifies signed Resend webhook requests. | Yes |
| `EMAIL_OTP_PEPPER` | Independent HMAC key for OTP hashes; minimum 32 characters. | Yes |
| `EMAIL_OTP_EXPIRY_MINUTES` | Documents the required five-minute policy. The implemented security policy is fixed at five minutes. | No |

Never reuse `JWT_SECRET` as `EMAIL_OTP_PEPPER`. Generate independent random values of at least 32 bytes.

## 11. Resend and DNS setup

1. Add `dawaconnect.store` in the Resend Domains dashboard.
2. Add the exact DKIM and SPF records Resend provides to the DNS host for the domain.
3. Add a DMARC record appropriate for the domain's email policy.
4. Wait for Resend to mark sending as verified.
5. Create a production API key and store it only as `RESEND_API_KEY`.
6. Set `RESEND_FROM_EMAIL` to `DawaConnect <noreply@dawaconnect.store>`.
7. Deploy the marketplace over HTTPS.
8. In Resend, create a webhook pointing to:

```text
https://dawaconnect.store/api/webhooks/resend
```

9. Subscribe it to sent, delivered, delivery delayed, bounced, and failed events.
10. Copy the webhook signing secret to `RESEND_WEBHOOK_SECRET`.

The sender address does not need a human-monitored inbox to send mail, but a support or reply-to mailbox should be used later for messages to which customers are expected to reply.

## 12. Error handling and privacy

- OTPs, password values, password hashes, JWTs, API keys, Google tokens, and webhook secrets must never be logged.
- API responses never return password or OTP hashes.
- Delivery status uses a random high-entropy challenge ID and does not expose the full email address.
- The browser receives only a masked email after starting verification.
- Database TTL indexes clean up temporary challenges and rate-limit buckets.
- Resend errors are converted into user-safe messages; detailed provider output is limited to server logs.
- A successful send request is described as “code sent,” not “email address exists.” Only entering the received OTP verifies control of the mailbox.

## 13. Tests

Run authentication unit tests:

```powershell
npm run test:auth
```

They cover Google identity normalization, safe redirects, the five-minute OTP policy, OTP generation and HMAC verification, email normalization, and masking.

Run browser authentication tests while the development server is running on port 3100:

```powershell
npm run dev -- --port 3100
npm run test:auth-ui
```

They cover Google-button stability, Google return redirects, the password/OTP interface and return redirect, and AI assistant scroll behavior.

Build the production application:

```powershell
npm run build
```

A live Resend delivery test cannot pass until the domain, API key, sender, OTP pepper, and public webhook are configured.

## 14. Deployment checklist

- [ ] `dawaconnect.store` is verified for sending in Resend.
- [ ] SPF and DKIM show verified.
- [ ] DMARC exists and is monitored.
- [ ] Production `MONGODB_URI` points to the Marketplace database.
- [ ] `JWT_SECRET` is long, random, and different from every other application.
- [ ] `EMAIL_OTP_PEPPER` is long, random, and different from `JWT_SECRET`.
- [ ] `RESEND_API_KEY` is present only in server environment variables.
- [ ] `RESEND_FROM_EMAIL` uses the verified domain.
- [ ] The public Resend webhook URL is configured.
- [ ] `RESEND_WEBHOOK_SECRET` matches that webhook.
- [ ] Google authorized JavaScript origins include the production HTTPS origin.
- [ ] MongoDB network rules permit the deployed server.
- [ ] HTTPS is active so the production session cookie is Secure.
- [ ] The deployment uses Node.js 22 LTS (the local Node.js 23 runtime emits experimental module warnings).
- [ ] Signup, resend, wrong-code, expired-code, bounce, Google login, logout, and protected-route redirects are tested in production.

## 15. Current boundaries and future authentication work

The following are intentionally not implemented by this registration change:

- Forgot-password and password-reset email flow. The present “Forgot password?” control is not yet connected.
- Changing an authenticated user's email address.
- Linking or unlinking Google from account settings.
- Multi-factor authentication after login.
- Server-side JWT revocation or “log out all devices.”
- Mandatory verification migration for password accounts created before the OTP system.

These should reuse the same principles: single-use random challenges, short expiries, hashed secrets, rate limits, generic responses where account enumeration matters, signed provider webhooks, and server-side authorization on every state-changing operation.
