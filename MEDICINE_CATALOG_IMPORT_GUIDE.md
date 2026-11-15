# DawaConnect Medicine Catalogue: Production Data and Image Guide

## What is implemented

DawaConnect now separates a medicine from a pharmacy's stock record.

- The Pharmacy MongoDB database contains one `medicineCatalog` document per standardized medicine/SKU.
- The dedicated Cloudinary account contains one shared image per catalogue document.
- A pharmacy searches the catalogue while adding inventory.
- Selecting a result fills the name, category, unit, medicine details and shared image.
- The owner may then customize the displayed name, category and unit.
- Catalogue selection is optional. An owner may add a completely custom medicine or general product, such as Pampers.
- Image selection is independent. A custom product may use a shared image result, or use the neutral fallback when no verified image exists.
- Price, stock quantity, low-stock threshold and expiry are pharmacy-specific and may be left empty. Empty numeric values are stored as zero.
- Supplier and batch number are no longer collected by the active inventory form.
- The Marketplace displays the shared image in product results, pharmacy inventory, product details, favourites, carts and checkout.

The pharmacy's inventory row does **not** contain the image file. It contains the central catalogue id plus a small snapshot and Cloudinary URL. Therefore 1,000 pharmacies selling the same catalogue item still use one stored image.

## Database structure

### `Pharmacy.medicineCatalog`

Important fields:

- `catalogKey`: stable unique identity, preferably based on the DRAP registration number.
- `displayName`, `brandName`, `genericName`.
- `strength`, `dosageForm`, `packSize`, `manufacturer`.
- `category`, `unit`, `aliases` and normalized `searchText`.
- `drapRegistrationNumber`.
- `status`: `draft`, `active`, or `retired`.
- `source`: where the reviewed metadata came from.
- `image`: Cloudinary URL/public id, dimensions, source URL, rights confirmation, and upload date.

### `Pharmacy.products`

Important fields:

- `ownerId`: pharmacy owner.
- Nullable `catalogMedicineId` and `catalogKey`: optional link to the shared data catalogue.
- Nullable `catalogImageId` and `catalogImageKey`: optional, independent link to the shared image catalogue.
- `catalogSnapshot`: customer-facing catalogue fields at the time it was added.
- `imageUrl`: reusable Cloudinary delivery URL, not the image binary.
- Editable pharmacy fields: `name`, `category`, `unit`, `price`, `stock`, `threshold`, and `expiry`.

## Render variables

Use these canonical names on the Admin/Render backend:

```ini
MEDICINE_CATALOG_CLOUDINARY_CLOUD_NAME=your_catalog_cloud_name
MEDICINE_CATALOG_CLOUDINARY_API_KEY=your_catalog_api_key
MEDICINE_CATALOG_CLOUDINARY_API_SECRET=your_catalog_api_secret
MEDICINE_CATALOG_CLOUDINARY_FOLDER=dawaconnect/medicine-catalog
```

For compatibility, the backend also understands the `PRODUCT_CATALOG_CLOUDINARY_*`, `PRODUCT_CLOUDINARY_*`, and `CATALOG_CLOUDINARY_*` prefixes. No Cloudinary secret is placed in the Pharmacy `.exe` or Vercel Marketplace. Both clients receive only public delivery URLs from the backend.

## Preparing the first 1,000 records

Do not define an image-bearing row only as “Paracetamol”. A product image represents a particular retail product, so each such record should identify at least:

1. Brand/display name.
2. Generic/active ingredient.
3. Strength.
4. Dosage form.
5. Pack size.
6. Manufacturer/marketing authorization holder.
7. DRAP registration number when available.
8. Category and inventory unit.
9. Source and review date.
10. Exact matching image plus image permission/source.

Suggested preparation process:

1. Build a candidate list from actual demand: common pharmacy inventory, Marketplace searches and completed orders.
2. Verify registration metadata against DRAP's official product information or a DRAP-approved export. The public registry currently carries restrictions/disclaimers, so obtain permission before automated bulk extraction.
3. Ask manufacturers or authorized distributors for a product-data/image pack and written permission for Marketplace display.
4. Match each image to the exact brand, strength, form and pack size. Never reuse a similar package image.
5. Have a pharmacist or qualified reviewer verify the sheet.
6. Import records first as `draft`; switch only reviewed rows to `active`.

RxNorm can help normalize generic ingredient terminology, but it is US-oriented and must not replace DRAP verification for Pakistani products. DailyMed images are also US-label assets and should not be presented as Pakistani packaging unless the exact product and usage rights match.

## Import file

The importer accepts JSON or CSV. A documented JSON example is in:

`Admin module/data/medicine-catalog.sample.json`

For CSV, use these column names:

```text
displayName,brandName,genericName,strength,dosageForm,packSize,manufacturer,category,unit,drapRegistrationNumber,aliases,status,sourceName,sourceUrl,sourceNotes,sourceReviewedAt,imageFile,imageSourceUrl,imageRightsConfirmed
```

Separate aliases with `|`. `imageFile` may be relative to the catalogue file or to the folder supplied through `--images-dir`.

## Validate without changing anything

From `Admin module`:

```powershell
npm run catalog:import -- --file data/medicine-catalog.json --images-dir data/medicine-images --dry-run
```

The dry run checks required fields, normalization and duplicate catalogue identities. It does not write to MongoDB or Cloudinary.

## Perform the import

```powershell
npm run catalog:import -- --file data/medicine-catalog.json --images-dir data/medicine-images
```

The importer:

1. Validates every row before making changes.
2. Refuses an image unless `imageRightsConfirmed` is `true`.
3. Uploads the exact local image to the dedicated Cloudinary folder.
4. Upserts MongoDB by `catalogKey`, making the process safe to rerun.
5. Reports created, updated, and uploaded counts.

Do not commit the licensed image folder or secrets to Git unless the image licence explicitly permits redistribution.

## Admin API

Authenticated admins can list catalogue records. Superadmins can create/edit metadata and upload/remove images:

- `GET /api/admin/medicine-catalog`
- `POST /api/admin/medicine-catalog`
- `PATCH /api/admin/medicine-catalog/:id`
- `POST /api/admin/medicine-catalog/:id/image`
- `DELETE /api/admin/medicine-catalog/:id/image`

Image upload requires the `x-image-rights-confirmed: true` header. The bulk importer is preferred for the initial 1,000 records.

## Pharmacy flow

1. Owner clicks **Add Medicine**.
2. Typing two or more characters calls the authenticated catalogue search endpoint.
3. Results show image, standard name, generic name, strength, form, manufacturer and pack size.
4. Owner either selects a catalogue result or continues with a custom product.
5. A selected result auto-fills brand/name, generic name, category and unit; the editable inventory values remain under the owner’s control.
6. Owner may independently search the shared image catalogue. If no image is selected, the Marketplace uses the neutral product fallback.
7. Owner optionally supplies price, stock, alert threshold and expiry.
8. The backend re-reads any selected catalogue records rather than trusting image data sent by the desktop app.
9. The inventory row is saved with nullable data/image references and public delivery URL only—never the image binary.
10. Missing product data or images can be requested from the Pharmacy Complaints page.

## Operational rule

Never scrape arbitrary retailer images, copy search-engine images, or generate fake medicine packaging. If an authorized exact image is unavailable, keep the row as a metadata-only draft or use DawaConnect's neutral placeholder until a verified asset is obtained.
