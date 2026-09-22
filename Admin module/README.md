# DawaConnect Admin Console

Platform administration for DawaConnect: pharmacy onboarding, order oversight, complaints,
customer management and an audit trail. Vite + React 19 frontend, Express 5 + Mongoose API.

## Run

```powershell
npm install
npm run server      # Express API on http://localhost:5000
npm run dev         # Vite UI on http://localhost:5173 (separate terminal)
```

`.env` (see `.env.example`):

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MarketPlace database (customers, orders, admins, complaints, audit log) |
| `PHARMACY_MONGODB_URI` | Pharmacy database (pharmacy accounts, profiles, inventory, fulfilment orders) |
| `JWT_SECRET` | ≥ 32 random characters; the API refuses to start without it |
| `JWT_EXPIRES_IN` | Token lifetime (default `8h`) |
| `CORS_ORIGIN` | Comma-separated browser origins allowed to call the API (default `http://localhost:5173`) |
| `PORT` | Express API port (default `5000`) |
| `NODE_ENV` | Use `production` on the deployed API |
| `PHARMACY_PRODUCTS_COLLECTION` | Optional Pharmacy products collection override |
| `VITE_API_BASE_URL` | Public API URL compiled into the Admin browser bundle |

Frontend: `VITE_API_BASE_URL` (default `http://localhost:5000/api`).

Use the root `.env` as the canonical local configuration. Never commit `.env`,
`server/.env`, or environment-specific Vite files. In production, configure API
secrets in the hosting platform and set `CORS_ORIGIN` to the exact Admin HTTPS origin.

The first admin to register becomes an approved **super admin**; everyone after that is
`pending` until a super admin approves them under **Admins**.

## What's inside

```
server/
  index.js                 Express app, CORS allow-list, health endpoint
  env.js                   Loads .env before any other module
  middleware/auth.js       JWT sign/verify, requireAuth, requireSuperadmin
  models/                  Mongoose views of both databases (Complaint, AuditLog own their collections)
  routes/adminRoutes.js    signup / login / me / admin management
  routes/userRoutes.js     dashboard, badges, customers, pharmacies (approve/reject/suspend), orders
  routes/complaintRoutes.js  complaints inbox + oversight, replies, status
  routes/auditRoutes.js    audit log queries
src/
  lib/api.js               axios client + typed endpoint helpers (token attached automatically)
  context/                 Auth, Theme (light/dark/system), Toasts, sidebar Badges
  components/ui/           Button, Badge, Card, inputs, DataTable, Drawer, Modal, ConfirmDialog, charts
  components/layout/       AppShell (sidebar/topbar), PageHeader, Stat
  features/                PharmacyDrawer (360°), CustomerDrawer (360°)
  pages/                   Dashboard, Orders, Complaints, Pharmacies, Approvals, Customers, AuditLog, Admins, Auth
```

## Rules the code protects

- **Every `/api/users`, `/api/complaints`, `/api/audit` route requires a valid admin JWT**; admin
  management routes additionally require `role: superadmin`.
- Pharmacy lifecycle is derived from the two legacy fields and written back consistently:
  approve → `status=approved, approvalStatus=approved`; reject → `status=rejected, approvalStatus=unapproved`
  plus `rejectionReason`; suspend → `status=suspended, approvalStatus=unapproved` plus `suspensionReason`.
  The Marketplace only lists `approvalStatus=approved` and `status≠suspended`; the pharmacy app shows the
  admin's reason on its blocked screens.
- Customer status is written lowercase (`active` / `suspended`) to match the Marketplace `User` schema.
- The Admin module never creates indexes on the Pharmacy database (`autoIndex: false`) — the pharmacy
  desktop app owns them and would fail to start on a conflicting spec.
- Every state-changing action is recorded in `MarketPlace.auditlogs` with actor, target and reason.
- Customer 360° deliberately excludes cart contents and prescriptions.

## Complaints

Single shared collection `MarketPlace.complaints` (schema in `server/models/Complaint.js`, mirrored by
the Marketplace `Complaint` model and the pharmacy app's `db.js`):

| Flow | `source` | `target` | Handled in |
|---|---|---|---|
| Customer → pharmacy | `customer` | `pharmacy` | Pharmacy desktop app (visible read-only here under **Oversight**) |
| Customer → DawaConnect | `customer` | `admin` | This console (**Inbox**) |
| Pharmacy → DawaConnect | `pharmacy` | `admin` | This console (**Inbox**) |

Replies from admins notify pharmacies through `Pharmacy.notifications`; customers see replies on
their Marketplace **Support & Complaints** page.

## Checks

```powershell
npm run lint
npm run build
```
