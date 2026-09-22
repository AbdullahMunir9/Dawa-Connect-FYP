# DawaConnect repository and deployment security

This workspace contains three applications. Real credentials belong only in local
`.env` / `.env.local` files or in the deployment platform's encrypted environment
settings. Every `.env.example` is safe to commit and contains placeholders/defaults,
not working credentials.

## Applications

### Marketplace (`dawa-connect-market-place`)

Server-side secrets/configuration:

- `MONGODB_URI`
- `JWT_SECRET` (at least 32 random characters)
- `GROQ_API_KEY`
- `GEOAPIFY_API_KEY`
- `GOOGLE_CLIENT_ID` (public identifier, but centrally configured)
- `PHARMACY_DB_NAME`, `GROQ_CHAT_MODELS`, `AI_USAGE_TIMEZONE`

For Vercel or another web host, configure these in that application's environment
settings. Do not upload `.env.local`.

### Pharmacy desktop (`dawaconnect`)

Development configuration is documented in its `.env.example`. The current desktop
architecture connects directly to MongoDB and can call SMTP/OpenAI/Geoapify from the
Electron main process.

**Production warning:** an Electron package is controlled by the end user. Environment
variables, bundled source and runtime network credentials on that machine cannot be
treated as server secrets. The production desktop app must eventually call an
authenticated DawaConnect backend for MongoDB operations, OTP email and AI requests.
Do not bundle Atlas, SMTP or unrestricted provider credentials in an installer.
Restrict any unavoidable client-side map key by API, origin/application and quota.

### Admin (`Admin module`)

Deploy the Express API and Vite frontend as separate services or as one deliberately
configured service. API secrets are `MONGODB_URI`, `PHARMACY_MONGODB_URI` and
`JWT_SECRET`. `VITE_API_BASE_URL` is public and is compiled into the browser bundle.
Production `CORS_ORIGIN` must contain only the exact HTTPS Admin frontend origin(s).

## Before the first GitHub push

1. Rotate the MongoDB password, Geoapify key, AI keys and JWT secrets that have ever
   appeared in terminals, screenshots, chat, Git history or copied environment files.
2. Confirm ignored files with `git status --ignored` and scan staged content with a
   secret scanner such as Gitleaks before every release.
3. Keep GitHub push protection and secret scanning enabled.
4. Give database users only the permissions each deployed service requires.
5. Use separate development and production credentials, restrict Atlas Network Access,
   and never disable TLS certificate validation.
6. Configure secrets in the deployment provider; `.env.example` is documentation only.

## Repository layout warning

`dawa-connect-market-place` and `dawaconnect` currently contain their own `.git`
directories, while this parent folder is not a Git repository. If the parent is made a
repository without resolving that, Git records the inner repositories as embedded
repositories instead of committing all of their files. Choose either:

- a monorepo: preserve the existing repository history/remotes, then remove/move the
  two inner `.git` directories before `git init` at the parent; or
- a parent repository with real Git submodules, each backed by its own remote.

Do not delete the nested `.git` directories until that choice and any history backup
are confirmed.
