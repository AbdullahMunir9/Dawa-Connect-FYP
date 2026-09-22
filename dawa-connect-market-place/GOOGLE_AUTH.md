# Marketplace Google authentication

The Marketplace login and registration pages use the current Google Identity
Services web button. The browser receives a short-lived Google ID token and sends
the complete token to `POST /api/auth/google`; it never trusts decoded browser data.
The server verifies signature, issuer, expiry and audience with Google's official
Node.js auth library, checks a one-time nonce, then creates the existing seven-day
HTTP-only Marketplace session cookie.

## Google Cloud setup

1. Create or select a project in Google Cloud Console.
2. Configure the OAuth consent screen/Google Auth Platform branding.
3. Create an OAuth client of type **Web application**.
4. Add development JavaScript origins:
   - `http://localhost:3000`
   - any other exact local port you intentionally use, such as `http://localhost:3100`
5. Add the exact production HTTPS origin when it exists.
6. Put the Web client ID in `.env.local`:

   ```env
   GOOGLE_CLIENT_ID=123456789-example.apps.googleusercontent.com
   ```

7. Restart Next.js. No Google client secret is used for this ID-token button flow.

Do not add paths such as `/login` to Authorized JavaScript origins. Origins contain
only scheme, host and optional port. This implementation uses the popup/callback
flow, so it does not need an OAuth redirect URI.

## Account behaviour

- Registration creates a passwordless Marketplace user identified by Google's
  stable `sub` claim. Phone and city can be completed later through the profile and
  saved-address flows.
- Login only accepts an already registered/linked Google identity. A new visitor is
  directed to the registration page instead of silently creating an account.
- A Gmail or verified Google Workspace identity may safely link to an existing
  password account with the same normalized email. Google accounts backed by a
  third-party email are not automatically linked; the planned email OTP flow will
  provide that second challenge.
- Suspended Marketplace users stay suspended regardless of their login provider.
- Password login remains available. A Google-only account is instructed to use the
  Google button if it submits the password form.

## Security details

- `googleSub` is unique, sparse and hidden from ordinary model projections.
- Google ID tokens are verified on the server for the configured audience.
- A cryptographic nonce is stored in a short-lived, HTTP-only, SameSite=Strict
  cookie and must match the token before it is consumed.
- Cross-site browser requests are rejected and attempts are rate limited per IP.
- The ID token is used only to establish a local session; it is not stored and is
  not an access token for Google APIs.
- The Google client ID is public by design. `JWT_SECRET` remains private.

## Verification

```powershell
npm run test:auth
npm run build
```

An actual Google popup can only be tested after a real Web client ID and matching
Authorized JavaScript Origin are configured.
