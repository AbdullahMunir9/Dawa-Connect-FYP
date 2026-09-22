# DawaConnect – Pharmacy Module (FYP)

## Desktop App (Electron + Vite)

This project has been converted from a browser CRA app to an Electron desktop app using `electron-vite`.

## 🚀 How to Run

### Prerequisites
Make sure you have these installed on your computer:
- **Node.js** (v16 or above) → Download from https://nodejs.org
- **npm** (comes with Node.js)

### Steps to Run

1. **Extract the ZIP** to any folder on your computer

2. **Open VS Code** → File → Open Folder → select the `dawaconnect` folder

3. **Open Terminal** in VS Code → Terminal → New Terminal

4. **Install dependencies** (run this once):
   ```
   npm install
   ```
   Wait for it to finish (1-2 minutes).

5. **Configure MongoDB Atlas connection** in `.env`:
   ```
   MONGODB_URI=your-connection-string
   PHARMACY_DB_NAME=Pharmacy
   MARKETPLACE_DB_NAME=MarketPlace
   ```

   Configure SMTP for OTP email delivery:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM=your-email@gmail.com
   ```

   Copy `.env.example` to `.env`; never commit the populated `.env`. The Git
   ignore rules exclude environment files, generated `out/` bundles and installers.
   MongoDB, SMTP and AI credentials are acceptable for local FYP development but
   must move behind an authenticated server API before distributing the desktop app.

6. **Start in desktop dev mode:**
   ```
   npm run dev
   ```

The Electron desktop window will open automatically.

### Required map-confirmed location during registration

Step 2 uses address search, not device geolocation. Google configuration and
device location permission are not required for this flow.

1. Search a pharmacy address or nearby landmark, including its city in Pakistan.
2. Choose a result, then click or drag the pin to the pharmacy entrance.
3. Press **Confirm exact location**. Reverse geocoding fills the read-only address,
   area, city and province/territory fields from the final pin.
4. Continue with registration. Moving the pin or starting a new search clears
   confirmation and the derived address, so the owner must confirm again.

Get a free key from [Geoapify MyProjects](https://myprojects.geoapify.com/), then
add it to `dawaconnect/.env` and fully restart `npm run dev`:

```dotenv
GEOAPIFY_API_KEY=your-geoapify-key
```

The main process calls the fixed Geoapify search/reverse endpoints and does not
return the key to the renderer. No requests are made per keystroke or during pin
dragging; they happen only on Search and Confirm. Attribution is shown in the UI.
Internet access and a valid configured key are required; failures block
confirmation rather than allowing a manually typed address as a substitute.
For packaged installations, supply the environment variable before launching;
the source `.env` is not bundled. Desktop-installed secrets are not tamper-proof;
for broad distribution, put these calls behind an authenticated backend with
shared quota controls rather than distributing a production service key.

Confirmation is bound to the desktop window in the main process, expires after
one hour, and is checked at registration. The backend uses its confirmed address
instead of trusting renderer-provided address text. The transient confirmation
token is not stored in MongoDB. Existing numeric `latitude`, `longitude`, and
GeoJSON `location.coordinates: [longitude, latitude]` remain unchanged in users
and profiles. Existing registrations are not migrated.

Reverse geocoding cannot guarantee a building/shop number or all locality names.
Missing locality fields remain empty, with a UI explanation; coordinates are
always required. The owner is responsible for positioning the pin accurately.

API references: [Address search](https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/)
and [Reverse geocoding](https://apidocs.geoapify.com/docs/geocoding/reverse-geocoding/).

Run focused offline validation with `node --test electron/locationSearch.test.mjs`.

## 📦 Build Desktop App

Create production bundles:

```bash
npm run build
```

Build a Windows installer (`.exe`/NSIS):

```bash
npm run build:win
```

---

## 🔑 Login
- Register a pharmacy first from **"Register here"**
- Then sign in with the same email and password

---

## 📦 Features Included

| Module | Features |
|--------|---------|
| 🔐 Auth | Login, Register (3-step), Forgot Password with OTP |
| 📊 Dashboard | Live stats, charts, alerts, recent orders |
| 💊 Inventory | Add/Edit/Delete medicines, bulk upload, expiry alerts, low stock |
| 🛒 Orders | View/manage orders, status updates, auto-invoice |
| 📈 Analytics | Revenue charts, forecasting (AI), top sellers, PDF/Excel reports |
| 🏪 Marketplace | Browse & list medicines across pharmacies |
| ↩️ Returns | Return requests, approve/reject refunds |
| 🚨 Recalls | Issue medicine recalls, batch management |
| 💳 Payments | Payment reconciliation tracking |
| 💬 Chat | Live customer support chat |
| 👥 Staff | Add/manage pharmacy staff |
| ⭐ Reviews | Customer ratings & review monitoring |
| 🔔 Notifications | Real-time alerts for orders, stock, expiry |
| 🏥 Profile | Pharmacy settings, delivery config, tax setup |

---

## 🛠 Troubleshooting

**If `npm install` fails:**
```
npm install --legacy-peer-deps
```

**If the desktop window does not open in dev mode:** stop the command and run `npm run dev` again.

**If you see any errors:** Delete the `node_modules` folder and run `npm install` again.
