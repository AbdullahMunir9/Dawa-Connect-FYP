# Public healthcare map

Open `/pharmacies/map`, or choose **Find Care** in the navigation. No account is
required for the page or its healthcare API routes.

## Providers and configuration

- **MapLibre GL** renders an interactive vector map with clustered healthcare pins.
- **OpenFreeMap / OpenMapTiles / OpenStreetMap** supplies the basemap. Business POI
  layers are removed, while roads, water and place names remain. Attribution stays
  visible. This basemap does not use the Geoapify quota or require a key.
- **Geoapify** supplies external healthcare listings, Pakistani city/area search,
  and walking/driving directions. Configure `GEOAPIFY_API_KEY` in `.env.local` and
  restart Next.js. The existing Pharmacy key can be shared, but the quota is then
  shared too. No `NEXT_PUBLIC_` secret is used.
- **Pharmacy MongoDB database** supplies approved, non-suspended DAWA Connect
  pharmacies, including facilities that do not exist in external map directories.
  `PHARMACY_DB_NAME` defaults to `Pharmacy`; `MONGODB_URI` stays unchanged.

These are **not Google Places results**. An outbound Google Maps navigation link
is provided for users who want to continue in a navigation app. It is not a data
integration with Google's directory. No provider can guarantee exhaustive listings
or identify businesses that nobody has added to a map or DAWA Connect.

## User workflow

1. Choose **Use my location** (explicit browser permission), or search a Pakistani
   city/neighbourhood. Initial Lahore is only a starting map view, never a fake
   user location. A denied permission leaves area search available.
2. Browse **DAWA Connect pharmacies** separately from **Other healthcare nearby**.
   External means not matched to a loaded approved DAWA Connect record, not a
   verified claim that the business has never registered.
3. Default radius is 10 km. Filters support 2, 5, 10, 20 and 50 km, independently
   toggled pharmacies/hospitals/clinics, and text filtering of loaded healthcare
   results. Restaurants and other business categories cannot be returned as
   healthcare results. Area search deliberately returns localities, not businesses.
4. Select a card or pin to view details. Registered pharmacies link to their actual
   pharmacy page/products. Missing ratings, opening status and phone data are not
   fabricated. Pharmacy open/closed status is the owner's configured status, not
   a guarantee of availability.
5. Start driving/walking directions. Routes are drawn with estimated distance,
   duration and text instructions. Device location is the origin if available;
   otherwise the selected area's centre is used and clearly disclosed.
   This is route planning, not live traffic, voice guidance or emergency navigation.

Marker clustering expands when clicked. Mobile users can switch between list and
map. Location changes, range changes or removal of a selected facility clear stale
directions. Browser requests are cancelled/ignored when superseded.

## Data correctness and limits

- Existing numeric latitude/longitude and database structure are preserved. Profiles
  take precedence over registration coordinates, consistently with the catalog.
- Records without valid coordinates are omitted, never positioned at `(0, 0)` by
  coercing missing fields. Approved records are not subject to the directory's
  100-record cap. Only public pharmacy fields are queried for the map.
- Haversine radius filtering applies equally to registered and external results.
  List distances are straight-line kilometres, not road distances.
- Conservative deduplication prefers a registered pharmacy only when the name or
  phone matches and the external pharmacy lies within 100 metres. Colocated clinics,
  hospitals and different branches are preserved. Membership matches are approximate.
- External search loads up to 100 source results per request. A **Load more
  healthcare** button retrieves further pages; provider coverage and a safety limit
  still apply. Text filters operate on loaded results. No claim of exhaustive
  real-world coverage is made.
- A database or provider failure produces a visible partial-data warning. Neither
  failure causes dummy pharmacies to appear. Database reads have a response deadline
  so external discovery can still work when MongoDB is unavailable.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/healthcare/nearby?lat=&lng=&radius=&offset=` | Approved registered + external healthcare, radius filtering and paging |
| `GET /api/healthcare/areas?q=` | Pakistani city/area search, 3–120 characters |
| `GET /api/healthcare/directions?fromLat=&fromLng=&toLat=&toLng=&mode=` | Driving/walking route, limited to a 150 km start-to-destination distance |
| `GET /api/healthcare/basemap` | Cached POI-filtered OpenFreeMap vector style |
| `GET /api/healthcare/map/[...resource]` | Optional fixed-host Geoapify map asset proxy; not used by the default basemap |

## Privacy, quota and deployment

The feature does not save the visitor's location to a user profile or create
database records. Search and route coordinates are sent through the Marketplace
server to Geoapify. OpenFreeMap receives basemap asset requests for the viewport.
Responses are cached briefly in bounded process memory. Avoid logging precise
location URLs in production, and document these providers in the privacy policy.

Endpoints validate inputs, use fixed provider URLs, sanitize errors, enforce
per-client and global per-process request limits, coalesce duplicate requests and
cache results. For multi-instance production, add shared gateway/Redis limits and
provider quota alerts. Forwarded-IP headers must be managed by a trusted proxy.
Free quotas are provider-defined credits, not a promise of unlimited search/routing.
OpenFreeMap is best-effort public infrastructure, not an SLA-backed service.

Never commit real keys in `.env.example`. Rotate any previously exposed key, then
update it in both modules if they share it. Do not disable TLS validation to fix a
MongoDB connection failure. Check Atlas access/network settings and connectivity.

## Verification

```powershell
npm run test:maps
# Start a dedicated development server for browser checks:
npm run dev -- --port 3100
# In another terminal:
npm run test:maps:e2e
npm run test:maps:live
```

Browser tests use isolated in-browser fixtures for registered/external records and
never seed a real database. The live test uses public Lahore coordinates. The
Playwright configuration uses installed Microsoft Edge on Windows; change the
channel if your environment uses a different installed browser.

Sources: [OpenFreeMap](https://openfreemap.org/),
[MapLibre](https://maplibre.org/maplibre-gl-js/docs/),
[Geoapify Places](https://apidocs.geoapify.com/docs/places/),
[Geoapify Routing](https://apidocs.geoapify.com/docs/routing/).
