# DawaConnect Central Medicine Catalogue and Shared Product Images

**Status:** On hold — documented for future implementation  
**Document date:** 21 October 2026  
**Affected modules:** Pharmacy desktop application, Admin module/backend, Marketplace

## 1. Purpose of this document

This document records the proposed solution for standardizing medicine names and product images across DawaConnect. The feature is intentionally not being implemented yet. It is documented so development can resume later without losing the requirements, architectural decisions, risks, or implementation plan.

## 2. Original requirement

At present, every pharmacy adds medicines to its inventory separately. Pharmacy owners can type the medicine name themselves, which creates several problems:

- The same medicine can be entered with different spelling, capitalization, abbreviations, or punctuation.
- Products that are actually identical can appear as different products in marketplace search.
- Price comparison cannot reliably compare products using free-text names.
- Every pharmacy would otherwise need to find and upload its own image for the same medicine.
- Duplicate images would create unnecessary work and storage usage.
- A pharmacy could accidentally attach the wrong image or enter incomplete product information.

The required experience is:

1. DawaConnect maintains a standard catalogue of medicines.
2. A pharmacy searches and selects a medicine from that catalogue.
3. The medicine's public name, strength, form, manufacturer, pack information, and image come from the central catalogue.
4. The pharmacy enters only information that belongs to its own inventory, such as price, stock, batch, expiry date, and supplier.
5. Marketplace customers see the same standard name and image regardless of which pharmacy is selling the item.

## 3. Current project behaviour

The Pharmacy module currently accepts a free-text medicine name in `dawaconnect/src/pages/Inventory.jsx`.

The Admin backend stores pharmacy products directly through `Admin module/server/services/pharmacyService.js` and currently indexes products using the pharmacy owner and product name.

The Marketplace reads the product's own `name` and `image` fields in `dawa-connect-market-place/src/lib/pharmacyCatalog.js`. If no image exists, it uses a fallback symbol.

This means the existing architecture treats every pharmacy's product record as both:

- The identity of the medicine; and
- The pharmacy-specific inventory entry.

Those two responsibilities should be separated.

## 4. Recommended architecture

The solution should contain two different types of data.

### 4.1 Central medicine catalogue

This is the DawaConnect-controlled definition of a sellable medicine product. It owns the standard customer-facing information and shared image.

Examples of catalogue-controlled fields include:

- Brand name
- Generic name and active ingredients
- Strength
- Dosage form
- Route of administration, where relevant
- Pack size
- Manufacturer
- DRAP registration number
- Optional RxNorm identifier
- Optional GTIN/barcode
- Search aliases
- Category
- Approved product image
- Catalogue status

### 4.2 Pharmacy inventory

This represents one pharmacy's commercial and physical stock information for a catalogue item.

Examples of pharmacy-controlled fields include:

- Pharmacy owner ID
- Catalogue medicine ID
- Pharmacy's internal SKU
- Selling price
- Available stock
- Low-stock threshold
- Batch number
- Expiry date
- Supplier

The relationship should be:

```text
DRAP / supplementary sources / Admin approval
                       |
                       v
              Central medicine catalogue
                       |
                       v
          Pharmacy inventory references medicineId
                       |
                       v
      Marketplace displays the standard name and image
```

## 5. Important product identity rule

A medicine cannot be identified safely by its name alone. The exact catalogue identity should normally include:

- Brand
- Active ingredient or ingredients
- Strength
- Dosage form
- Manufacturer
- Pack size
- DRAP registration number when available

For example, these must not automatically become one catalogue record:

- A pack of 20 tablets and a pack of 100 tablets
- A 250 mg product and a 500 mg product
- A tablet and a syrup with the same ingredient
- Two different brands containing the same generic ingredient

Different pack sizes may have different images, barcodes, prices, and registration information.

## 6. Two levels of medicine standardization

The system should preserve two related but different concepts.

### 6.1 Exact sellable product

Example:

```text
Panadol 500 mg Tablets — Pack of 20 — Haleon Pakistan
```

This is what pharmacy inventory and exact price comparisons should reference.

### 6.2 Generic clinical concept

Example:

```text
Paracetamol 500 mg oral tablet
```

This can later support generic search, aliases, and clearly labelled alternative brands. Products with the same ingredient must not be silently treated as interchangeable or substituted without an explicit and medically appropriate design.

## 7. Recommended information sources

### 7.1 DRAP as the Pakistan-specific authority

The Drug Regulatory Authority of Pakistan should be the primary authority for identifying products intended for sale in Pakistan.

DRAP's public registered-drug information can include:

- Brand or proprietary name
- Dosage form
- Composition or active ingredients
- Registration number and date
- Marketing authorization holder
- Manufacturer

Relevant official resources:

- [DRAP Pharmaceutical Drugs and registered product databases](https://www.dra.gov.pk/therapeutic-goods/drugs/pharmaceuticals/)
- [DRAP e-Services Portal](https://e.dra.gov.pk/)

At the time this document was created, no documented public developer API had been identified for the DRAP Registered Drugs Index. DawaConnect should not depend on unauthorized scraping. Before automated import, the team should request an approved API or export from DRAP, or use an official downloadable dataset where permitted.

### 7.2 RxNorm as a supplementary normalization source

The US National Library of Medicine provides the free RxNorm API. It can help with normalized generic names, ingredients, strengths, dose forms, identifiers, aliases, and approximate name matching.

- [RxNorm API](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html)
- [RxNorm name matching](https://lhncbc.nlm.nih.gov/RxNav/APIs/api-RxNorm.findRxcuiByString.html)

RxNorm is not a replacement for DRAP because it is focused largely on US terminology and products. Pakistan-specific brands may be absent. Its recommended role is supplementary normalization, not authoritative Pakistan product registration.

### 7.3 DailyMed as a limited supplementary media source

DailyMed provides official US Structured Product Label data and an API that can expose labeler-submitted media.

- [DailyMed web services](https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm)
- [DailyMed media endpoint](https://dailymed.nlm.nih.gov/dailymed/webservices-help/v2/spls_setid_media_api.cfm)

DailyMed must not be considered a complete source of Pakistani retail package images because:

- It primarily covers products labelled for the US market.
- Pakistani brands are frequently missing.
- A media item might be a label diagram or pill image rather than a retail package photograph.
- An image must be matched to the exact product, formulation, and package.

### 7.4 Manufacturer or authorized distributor images

The safest source for Pakistani product packaging is the manufacturer or an authorized distributor. DawaConnect should obtain permission to store and display these images.

Images must not be scraped or hotlinked from unrelated online pharmacies. Such images may be copyrighted, may change without notice, may be blocked, or may identify a different pack or formulation.

## 8. Image storage strategy

Images should be stored once in Cloudinary and referenced by the central catalogue. They should not be stored as MongoDB binary data or Base64 strings.

MongoDB should contain only small metadata fields such as:

```js
image: {
  secureUrl: "https://res.cloudinary.com/...",
  publicId: "medicine-catalog/panadol-500mg-20",
  source: "Manufacturer",
  rightsConfirmed: true,
  lastVerifiedAt: ISODate("...")
}
```

Cloudinary should hold the actual image and deliver optimized variants for catalogue cards and product details. DawaConnect already uses Cloudinary for pharmacy photos, so the existing backend integration can be extended with a separate medicine catalogue folder and validation rules.

Recommended image rules:

- Upload through the backend; never expose the Cloudinary secret in the desktop or browser applications.
- Accept only supported image MIME types.
- Enforce file-size and dimension limits.
- Keep the source and permission status for each image.
- Use a neutral medicine placeholder when an approved image is unavailable.
- Never display an approximate image belonging to a different strength, form, brand, or pack.
- Support image replacement/versioning because product packaging can change.

## 9. Proposed database models

The final schema should follow the project's existing MongoDB conventions. The following is the intended logical structure.

### 9.1 `medicine_catalog` collection

```js
{
  _id: ObjectId,

  displayName: "Panadol 500 mg Tablets — Pack of 20",
  brandName: "Panadol",
  genericName: "Paracetamol",

  ingredients: [
    {
      name: "Paracetamol",
      strength: "500 mg"
    }
  ],

  dosageForm: "Tablet",
  route: "Oral",
  packSize: "20 tablets",
  manufacturer: "Haleon Pakistan Limited",

  drapRegistrationNumber: "...",
  rxCui: null,
  gtin: null,

  category: "Analgesic",
  aliases: [
    "Panadol 500",
    "Panadol tablet",
    "Paracetamol 500 mg"
  ],
  normalizedSearchTerms: [
    "panadol",
    "paracetamol",
    "500mg",
    "tablet"
  ],

  image: {
    secureUrl: "https://res.cloudinary.com/...",
    publicId: "medicine-catalog/panadol-500mg-20",
    source: "Manufacturer",
    rightsConfirmed: true
  },

  status: "active",
  reviewStatus: "approved",
  createdBy: ObjectId,
  reviewedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

Suggested statuses include `draft`, `pending_review`, `active`, `retired`, and `rejected`.

The DRAP registration number should be uniquely indexed when reliably available. A carefully designed compound identity key will also be needed for records without that identifier.

### 9.2 Pharmacy `products` collection

```js
{
  _id: ObjectId,
  ownerId: ObjectId,
  medicineId: ObjectId,

  pharmacySku: "MED-00041",
  price: 320,
  stock: 48,
  threshold: 10,

  batchNumber: "B24091",
  expiryDate: Date,
  supplier: "Authorized Distributor",

  createdAt: Date,
  updatedAt: Date
}
```

A unique index should prevent the same pharmacy from accidentally creating duplicate inventory entries for the same catalogue item and batch, while still allowing separate batches when the inventory model supports them.

## 10. Pharmacy application experience

The existing free-text medicine field should eventually be replaced with catalogue autocomplete.

Proposed flow:

1. Pharmacy selects **Add Medicine**.
2. Pharmacy searches by brand, generic name, strength, manufacturer, registration number, or barcode.
3. The backend searches the central catalogue.
4. Results show enough information to distinguish exact products, including image, strength, form, pack size, and manufacturer.
5. Pharmacy selects the exact item.
6. Catalogue-controlled information becomes read-only.
7. Pharmacy enters price, stock, threshold, batch, expiry, supplier, and optional internal SKU.
8. The inventory record stores `medicineId` rather than a manually entered public identity.

Example result:

```text
[Image] Panadol 500 mg Tablets
        Paracetamol 500 mg | Pack of 20
        Haleon Pakistan Limited
```

### Missing medicine workflow

If a medicine cannot be found, the pharmacy should use **Request a medicine** rather than creating a public free-text record.

A request could contain:

- Brand name from packaging
- Strength and dosage form
- Manufacturer
- DRAP registration number
- GTIN/barcode
- Optional reference photographs of the package

The request should enter an admin review queue. Only an approved catalogue record should become publicly searchable. Reference photographs supplied for verification should not automatically become marketplace images unless their ownership and accuracy are confirmed.

## 11. Admin module responsibilities

The Admin module should provide catalogue management rather than requiring direct database edits.

Recommended features:

- Search and filter catalogue records
- Create and edit a catalogue medicine
- Review pharmacy-submitted medicine requests
- Detect possible duplicates
- Verify DRAP registration information
- Upload, replace, or remove the shared Cloudinary image
- Record image source and usage permission
- Approve, reject, retire, or restore catalogue items
- Review proposed matches while migrating legacy pharmacy inventory
- Maintain an audit trail for important changes

Only authorized admin roles should be allowed to create or approve public catalogue items.

## 12. Proposed backend endpoints

Exact routes can be adjusted to the Admin backend's current route conventions.

### Pharmacy-facing

```text
GET  /pharmacy/medicine-catalog?search=...
GET  /pharmacy/medicine-catalog/:medicineId
POST /pharmacy/medicine-requests
POST /pharmacy/products
PUT  /pharmacy/products/:productId
```

New product creation should eventually require `medicineId`. The server must load the catalogue record itself and must not trust catalogue names or image URLs sent by the pharmacy client.

### Admin-facing

```text
GET    /admin/medicine-catalog
POST   /admin/medicine-catalog
GET    /admin/medicine-catalog/:medicineId
PUT    /admin/medicine-catalog/:medicineId
POST   /admin/medicine-catalog/:medicineId/image
DELETE /admin/medicine-catalog/:medicineId/image
GET    /admin/medicine-requests
POST   /admin/medicine-requests/:requestId/approve
POST   /admin/medicine-requests/:requestId/reject
```

### Marketplace-facing

Marketplace product queries should join or resolve each pharmacy product through `medicineId`. Search should consider catalogue names and aliases but return the exact pharmacy inventory availability and price.

## 13. Marketplace behaviour

The Marketplace should display catalogue-controlled information consistently across every pharmacy:

- Standard display name
- Brand and generic name
- Strength and dosage form
- Pack size
- Manufacturer
- Approved shared image

Pharmacy-specific information remains different:

- Pharmacy name
- Price
- Stock availability
- Deliverability
- Distance
- Open/closed status

Exact product grouping and price comparison must use `medicineId`, not case-insensitive name matching. Generic alternatives, when added later, should be a separate clearly labelled feature.

## 14. Search recommendations

Catalogue search should support:

- Exact brand name
- Generic/ingredient name
- Known aliases and common spellings
- Strength with or without spaces, such as `500mg` and `500 mg`
- Dosage form
- Manufacturer
- DRAP registration number
- GTIN/barcode when available

Normalization should handle capitalization, whitespace, punctuation, and common abbreviations. Fuzzy matching can suggest likely records, but the pharmacy must select the exact medicine; the system must not silently choose one.

MongoDB Atlas Search autocomplete can be evaluated when the catalogue becomes large. A simpler indexed search may be sufficient for the first version.

## 15. Migration of existing products

Existing pharmacy products must not be deleted or automatically mapped using name similarity alone.

Recommended migration:

1. Create the catalogue and supporting indexes.
2. Populate an initial set of verified medicines.
3. Add nullable `medicineId` to existing product records.
4. Build an admin matching screen showing suggested catalogue matches.
5. Use normalized names only to create suggestions.
6. Require admin confirmation before assigning `medicineId`.
7. Let Marketplace temporarily fall back to legacy `name` and `image` fields when `medicineId` is absent.
8. Require `medicineId` for all newly created products once the catalogue workflow is stable.
9. Remove the legacy fallback only after all active products have been reviewed.

This staged migration avoids breaking existing inventory and marketplace orders.

## 16. Performance and storage considerations

The proposed design reduces duplication rather than increasing database weight:

- One Cloudinary asset is reused by every pharmacy selling the catalogue item.
- MongoDB stores only the image URL/public ID and medicine reference.
- Pharmacy records no longer repeat full medicine metadata.
- Catalogue API results can be cached.
- Marketplace aggregation can batch-load catalogue records instead of issuing one query per product.
- Cloudinary can generate small card thumbnails and larger detail images from the same original.

A catalogue image should not be copied into every inventory record. If a historical order needs to retain exactly what was purchased, the order can keep a small immutable product snapshot containing the display name, strength, pack size, and image URL used at checkout.

## 17. Security, quality, and legal considerations

- Cloudinary credentials remain only on the backend.
- Pharmacy and Marketplace clients receive URLs, never upload secrets.
- Admin uploads require authentication, authorization, MIME validation, and size limits.
- DRAP registration data should be verified using an approved source.
- External datasets must be used according to their licensing and terms.
- Image permission/source must be recorded.
- DawaConnect must not claim that RxNorm or DailyMed proves a product is registered for sale in Pakistan.
- A wrong medicine image is more dangerous than a missing image; use a neutral placeholder whenever the exact image is uncertain.
- Prescription medicine listing, advertising, substitution, and online sale behaviour must follow applicable Pakistani regulations before production launch.

## 18. Suggested implementation phases

### Phase 1 — Foundation

- Create catalogue, request, and audit data structures.
- Add admin catalogue CRUD and image upload.
- Add an initial curated set of common verified medicines.

### Phase 2 — Pharmacy integration

- Add catalogue autocomplete to Pharmacy inventory.
- Add exact-product selection and read-only medicine details.
- Add missing-medicine request workflow.
- Require `medicineId` for new inventory entries.

### Phase 3 — Marketplace integration

- Resolve names and images through the catalogue.
- Search catalogue fields and aliases.
- Group exact products by `medicineId`.
- Update price comparison to use standard product identity.

### Phase 4 — Migration and hardening

- Match and migrate legacy products.
- Add duplicate detection and audit history.
- Add monitoring, caching, and stronger catalogue search.
- Remove legacy free-text product creation.

### Phase 5 — Optional future improvements

- GTIN/barcode scanning in the Pharmacy desktop app
- Approved DRAP data synchronization if an official integration becomes available
- Manufacturer data feeds
- Clearly labelled generic alternatives
- Multiple verified product views, such as package front and back
- Packaging history and image version tracking

## 19. Acceptance criteria for the future implementation

The feature can be considered complete when:

- A pharmacy cannot publish an arbitrary medicine name as a new marketplace identity.
- A pharmacy can quickly search and select an exact catalogue product.
- Pharmacy inventory stores a valid `medicineId`.
- The same catalogue item displays the same name and image for every pharmacy.
- Price comparison groups only truly identical catalogue items.
- Images are stored once in Cloudinary rather than duplicated per pharmacy.
- A missing catalogue item follows an admin approval workflow.
- Existing products continue working during migration.
- Admins can verify, approve, retire, and audit catalogue items.
- No backend secrets are exposed to the Electron application or Marketplace browser.

## 20. Decisions to make before implementation resumes

1. Can DRAP provide DawaConnect with an approved API or data export?
2. Who will supply and approve Pakistani package images?
3. Will the first catalogue cover all available medicines or begin with a curated common set?
4. Should separate stock batches be separate inventory records or child batch records under one pharmacy product?
5. Which admin roles can create, approve, edit, and retire catalogue items?
6. What uniqueness rule will be used when a DRAP registration number or GTIN is unavailable?
7. How long should retired catalogue products remain visible in historical orders?
8. Will package photographs submitted in medicine requests be retained after review?

## 21. Final recommendation

When work resumes, implement a DawaConnect-owned central catalogue backed primarily by verified DRAP product information. Use RxNorm only for supplementary generic normalization, and use DailyMed media only for exact matches where usage and product identity are suitable. Store one approved image per exact catalogue product in Cloudinary and make every pharmacy inventory entry reference that catalogue item.

This architecture provides consistent customer-facing medicine information, substantially improves marketplace search and price comparison, reduces duplicate work, and creates a safe foundation for future barcode and medicine-alternative features.
