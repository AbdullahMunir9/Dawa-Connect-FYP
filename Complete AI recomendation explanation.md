# Complete AI recomendation explanation

Last updated: 31 October 2026

## 1. Purpose of this document

This document explains the complete DawaConnect Pharmacy Analytics, AI Recommendation, Report Export, and Monthly Email Automation feature from beginning to end.

It is written in plain language so that a pharmacy owner, student, developer, project supervisor, or another AI assistant can understand:

- what problem the feature solves;
- where its data comes from;
- which calculations are performed by normal code;
- what the AI is and is not allowed to do;
- how PDF and Excel reports are produced;
- how Oracle Cloud, n8n, and Resend will automate monthly delivery;
- how privacy, security, retries, and duplicate prevention work;
- what has already been implemented;
- what is still planned;
- how the remaining development should be completed and tested.

This document is the full feature explanation. The more technical implementation log remains in `ANALYTICS_AI_DEVELOPMENT.md`.

---

## 2. The feature in one simple explanation

Every pharmacy already creates useful business data while using DawaConnect. Orders show what was sold, inventory shows what is currently in stock, and delivery addresses show where completed orders came from.

This feature turns that existing data into a monthly management report.

The system first uses ordinary backend code to calculate trusted facts such as:

- monthly revenue;
- delivered and cancelled orders;
- units sold;
- best-selling and slow-selling products;
- current low-stock products;
- estimated demand for the next month;
- a suggested weekly stock target;
- a suggested immediate reorder quantity;
- privacy-safe delivery opportunities in the pharmacy's city.

After the calculations are complete, an AI model receives only a carefully selected set of summarized facts. The AI explains those facts in clear language. It does not calculate the official figures and cannot silently change them.

The pharmacy can view the results in the desktop Analytics page and manually download a PDF or Excel report. The final automation phase will also email each pharmacy its finalized PDF once every month through an Oracle-hosted n8n workflow and Resend.

In short:

```text
Pharmacy activity
      ↓
Trusted calculations made by backend code
      ↓
Safe summarized facts
      ↓
AI explanation or rules-based fallback
      ↓
Analytics page + PDF + Excel
      ↓
n8n monthly automation
      ↓
Email sent through Resend
```

---

## 3. Why the system is hybrid instead of completely AI-based

This is called a **hybrid analytics and AI system** because it combines normal deterministic code with a language model.

Deterministic code means that the same database data and rules produce the same numerical result. For example, if five delivered orders contain a total of twelve units, ordinary code reliably calculates twelve units. A language model should not be asked to guess that number.

The AI is used only for the work it is good at: turning verified facts into an understandable explanation and action plan.

The division of responsibility is:

| Responsibility | Performed by |
| --- | --- |
| Count orders and products | Backend calculation code |
| Calculate revenue | Backend calculation code |
| Calculate forecasts and stock targets | Backend calculation code |
| Apply delivery-zone privacy rules | Backend calculation code |
| Choose the official email recipient | Backend and verified pharmacy account |
| Explain the calculated facts | AI model |
| Validate the AI response | Backend validation code |
| Produce a safe report if AI fails | Rules-based template |
| Schedule monthly processing | n8n |
| Send the email | Resend |

This design prevents an AI hallucination from becoming an official financial or inventory figure.

---

## 4. Current implementation status

### Already implemented and tested

- Measured monthly pharmacy analytics.
- Revenue, order, product, payment, and inventory summaries.
- Inventory movement history for new stock changes.
- Weekly demand forecasting and stock recommendations.
- Privacy-safe city and delivery-radius opportunity analysis.
- Sanitized AI input generation.
- Groq AI narrative generation.
- Strict AI output validation.
- Deterministic report fallback when the AI provider fails.
- Saved narrative reports with provider and version information.
- Pharmacy Analytics page presentation.
- Manual PDF report generation and download.
- Manual Excel workbook generation and download.
- Authentication that prevents one pharmacy from accessing another pharmacy's analytics.
- Scenario tests for high data, low data, no orders, low stock, dormant products, and sufficient or insufficient city data.
- Production testing of both the Groq and template-fallback paths.
- Immutable completed-month PDF artifacts stored privately in MongoDB GridFS.
- SHA-256 integrity checks when a finalized PDF is read.
- Permanent monthly email-delivery records with separate test and production channels.
- Service-token authentication and temporary per-delivery leases for n8n.
- Initialize, claim, prepare, PDF, accepted, and failed automation endpoints.
- Retry classification and permanent duplicate prevention.
- Signed Resend delivery-event webhook handling using the raw request body.
- Oracle deployment files for PostgreSQL, n8n, and Caddy.
- A reusable no-email database integration-check script.

### Remaining deployment and workflow work

- Creation of the Oracle Cloud VM and reserved public IP.
- DNS configuration for `n8n.dawaconnect.store`.
- Deployment of the prepared PostgreSQL, n8n, and Caddy stack on Oracle.
- n8n workflow creation.
- Resend PDF attachment delivery.
- Resend dashboard webhook registration and signing-secret configuration.
- End-to-end production testing and activation.

The planned items must not be described as already implemented until their code, deployment, and tests have been completed.

---

## 5. Where the source data comes from

The feature uses information that DawaConnect already creates during normal operation.

### 5.1 Orders

Marketplace checkout creates pharmacy-specific orders. One order belongs to one pharmacy. The pharmacy application later updates the order status.

Orders provide information such as:

- order date;
- pharmacy owner;
- products and quantities;
- item prices;
- subtotal;
- tax;
- delivery fee;
- total amount;
- payment method;
- order status;
- delivery city and privacy-controlled location information.

Only delivered orders count as completed sales and product demand. Cancelled orders are useful for operational statistics but do not count as revenue or sold units.

### 5.2 Pharmacy inventory

Inventory provides:

- product name;
- category;
- selling price;
- current stock;
- low-stock threshold;
- product creation information.

The current stock shown in a historical report is clearly labelled as a live balance. It is not falsely presented as the exact stock that existed at the end of an old month.

### 5.3 Inventory movement ledger

New inventory changes are recorded as movements. Examples include:

- opening stock when a product is created;
- manual stock adjustment;
- stock reserved by checkout;
- stock restored after cancellation.

The movement ledger makes future stock analysis more reliable. It cannot recreate stock changes from before the ledger was introduced, so reports disclose that limitation.

### 5.4 Pharmacy profile

The pharmacy profile supplies information such as:

- pharmacy name;
- city;
- latitude and longitude;
- current delivery radius;
- account approval state;
- verified owner email.

The future monthly email system will use only the verified email stored on the approved pharmacy account. n8n and the AI will not be allowed to invent or replace the recipient.

---

## 6. Important calculation rules

These rules are fixed and must remain consistent across the Analytics page, AI input, PDF, Excel, and monthly email.

1. Only orders with the final status `Delivered` count toward completed revenue and sold quantity.
2. Cancelled orders are excluded from revenue and product-demand calculations.
3. Product revenue means the delivered product subtotal.
4. Delivery fees, tax, product revenue, and gross collected are kept separate.
5. Average order value is calculated using delivered orders, not all placed orders.
6. Dates and monthly boundaries use `Asia/Karachi`.
7. The AI never becomes the source of an official number.
8. Missing or weak data produces a warning or low-confidence result, not an invented value.
9. The authenticated pharmacy identity is taken from the server session. The client cannot request another owner's report by supplying an owner ID.
10. No profit calculation is included.
11. Supplier purchase cost and received-stock expense are not included.
12. Damaged and expired inventory workflows are outside the present scope.
13. Supplier lead time is outside the present scope.
14. Stock recommendations are expressed in units, not purchasing cost or expected profit.

---

## 7. Measured monthly analytics

Measured analytics describe what the database says actually happened.

For a selected month, the backend calculates:

- orders placed;
- delivered orders;
- cancelled orders;
- cancellation percentage;
- delivered product revenue;
- delivery fees;
- tax;
- gross collected amount;
- average delivered order value;
- units sold;
- product sales ranking;
- daily sales activity;
- hourly order activity;
- payment-method totals;
- order-status distribution;
- current inventory health;
- comparison with the previous month;
- six-month historical revenue trend;
- data-quality warnings.

### Example

Suppose a pharmacy receives three orders:

- Order A is delivered with a product subtotal of PKR 1,000.
- Order B is cancelled with a product subtotal of PKR 500.
- Order C is delivered with a product subtotal of PKR 800.

The report counts:

- orders placed: 3;
- delivered orders: 2;
- cancelled orders: 1;
- product revenue: PKR 1,800.

The cancelled PKR 500 is not included as completed revenue.

### Monthly snapshots

A snapshot freezes the measured analytics for a completed calendar month. The current month and future months cannot be finalized because their data is not complete.

The snapshot records:

- pharmacy owner;
- report month;
- analytics calculation version;
- full calculated analytics;
- creation and finalization times.

A unique database rule prevents the same pharmacy, month, and calculation version from producing duplicate snapshots.

---

## 8. Forecasting and stock recommendations

The forecast is produced by normal code, not by the AI model.

The pharmacy operating assumption is that stock is reviewed and replenished weekly. Therefore, recommendations focus on how many units should be available rather than supplier expenses or monthly profit.

For each product, the engine can calculate:

- forecast units for the next calendar month;
- expected demand over seven days;
- safety stock;
- recommended weekly stock target;
- current weeks of stock cover;
- suggested immediate reorder quantity;
- expected product revenue based on the current selling price;
- low, medium, or high confidence;
- an action status.

Possible action statuses include:

- `reorder_now`;
- `adequate`;
- `watch_overstock`;
- `no_demand_data`.

### Weighted demand history

Recent demand is more useful than old demand. The newest three eligible demand months are weighted:

- newest month: 50%;
- second-newest month: 30%;
- third-newest month: 20%.

If the selected month is still in progress, demand is normalized using the elapsed days. A minimum denominator prevents an unusually busy first day from creating an extreme monthly forecast.

### Confidence

Confidence depends on the amount and quality of evidence.

For example:

- one month with one sale produces low confidence;
- several months with stable demand can produce medium confidence;
- high confidence also requires enough inventory movement history.

A product with no recent demand receives a zero-demand or insufficient-data explanation. The system does not recommend stock merely because the product exists.

### Backtesting

The engine checks past forecasts against past real demand. This helps measure whether the forecast method has historically been close to the actual result.

The report can include measures such as:

- mean absolute error, or MAE;
- weighted absolute percentage error, or WAPE.

These measurements help communicate forecast quality. They do not turn a forecast into a guarantee.

---

## 9. City and delivery-radius opportunity analysis

The city-opportunity feature checks privacy-safe demand around the pharmacy.

It does not tell the pharmacy that expanding its radius will definitely create a certain amount of revenue. It only reports observed delivered-order activity in eligible city zones.

### How privacy is protected

- Only delivered orders from the pharmacy's city are considered.
- Coordinates must be valid.
- Orders are grouped into coarse geographic cells of approximately two kilometres.
- A cell is shown only if it contains enough orders.
- A cell must contain orders belonging to more than one pharmacy.
- Exact customer coordinates are never shown.
- Customer names and addresses are never shown.
- Competitor identities are never shown.
- Zone-level revenue is not shown.
- Rare address labels are hidden.

The default privacy rule requires at least five delivered orders from at least two pharmacies before a zone may be published.

### Radius scenarios

The engine compares the pharmacy's current delivery radius with bounded alternatives such as:

- current radius plus 2 km;
- current radius plus 5 km;
- current radius plus 10 km.

No scenario goes beyond the Marketplace maximum of 50 km.

The system does not modify the pharmacy profile automatically. A pharmacy owner must review the evidence and make the decision.

---

## 10. Preparing safe data for the AI

The AI does not receive the full analytics object or database records.

An allowlist sanitizer selects only approved aggregate facts. An allowlist means that a value is excluded unless the code specifically permits it.

The safe AI input can contain:

- report month;
- measured order counts;
- measured revenue totals;
- previous-month comparisons;
- top product summaries;
- calculated forecasts;
- calculated stock recommendations;
- confidence levels;
- privacy-approved city-zone results;
- data-quality warnings.

The AI input does not contain:

- raw order documents;
- customer names;
- customer emails or phone numbers;
- delivery street addresses;
- exact customer coordinates;
- pharmacy passwords;
- database connection strings;
- API keys;
- competitor identities;
- unrelated database fields.

Each approved fact receives a stable key, label, value, display value, type, and category.

Example:

```json
{
  "key": "summary.deliveredOrders",
  "label": "Delivered orders",
  "value": 42,
  "display": "42 orders",
  "format": "integer",
  "category": "sales"
}
```

This fact catalogue becomes the evidence source for the AI narrative.

---

## 11. What the AI narrative layer does

The current provider is Groq, using a server-side model configured by environment variables. A future Hugging Face model can replace the provider without changing the rest of the feature, provided that it follows the same input and output contract.

The AI receives strict instructions to:

- explain only the supplied facts;
- never recalculate official values;
- never change calculated figures;
- never invent missing information;
- preserve uncertainty and warnings;
- avoid guaranteed sales or delivery claims;
- avoid profit claims;
- avoid purchase-cost recommendations;
- avoid patient-specific medical advice;
- return structured JSON rather than Markdown or HTML.

The report contains six parts:

1. Executive summary.
2. Sales insights.
3. Inventory actions.
4. Delivery opportunities.
5. Risks and limitations.
6. Next-month action plan.

Each narrative recommendation includes:

- a title;
- an explanation;
- a priority of high, medium, or low;
- one or more fact keys that support it.

---

## 12. Why the AI response is not trusted automatically

Even when an AI provider offers structured output, the DawaConnect backend independently checks the response.

The validator rejects output containing:

- missing required report sections;
- unexpected extra report fields;
- wrong data types;
- empty or excessively large sections;
- invalid priorities;
- unknown evidence keys;
- duplicate evidence keys;
- HTML;
- unsupported numerical claims in narrative text.

The pharmacy interface displays the exact backend fact values as evidence beside the explanation. It does not trust a number merely because the AI wrote it in a sentence.

### Input digest and version tracking

The backend produces a SHA-256 digest of the sanitized input. Think of this as a fingerprint of the facts supplied to the AI.

A saved narrative is reused only when all of the following still match:

- pharmacy owner;
- report month;
- calculation version;
- prompt version;
- sanitized-input digest.

The saved report also records:

- provider;
- model;
- generation method;
- generation time;
- fallback reason, if any.

This makes the result traceable when providers, prompts, or calculation rules change.

---

## 13. The deterministic fallback report

The monthly report must remain useful if Groq is unavailable, slow, rate-limited, incorrectly configured, or returns invalid output.

For this reason, the backend includes a rules-based report generator. It uses the same verified fact catalogue and produces the same six-section report structure.

The fallback:

- does not require an AI API;
- passes the same validation rules;
- does not invent missing figures;
- clearly records that it was generated by the template method;
- allows PDF and Excel exports to continue working.

A provider failure must never delete or replace a previously saved valid report with an invalid response.

---

## 14. Pharmacy Analytics page

The Pharmacy desktop Analytics page displays measured facts, forecasts, city opportunities, and the validated recommendation report.

The page keeps measured and forecast values visually separate. This helps pharmacy owners understand the difference between:

- what happened;
- what the rules estimate may happen;
- what action the report suggests considering.

The pharmacy owner can:

- select a report month;
- view monthly performance;
- inspect product performance;
- review forecast and stock targets;
- review privacy-safe city demand;
- generate the recommendation narrative;
- regenerate it after the server-controlled cooldown;
- download a PDF;
- download an Excel workbook.

All protected requests use the existing pharmacy session. No MongoDB URI or AI key is included in the Electron application.

---

## 15. PDF and Excel reports

### PDF

The PDF is the readable management report. It includes:

- pharmacy name;
- report month;
- measured summary figures;
- executive summary;
- sales insights;
- inventory actions;
- delivery opportunities;
- risks and limitations;
- next-month action plan;
- exact supporting evidence;
- product performance;
- weekly restock plan;
- city-opportunity explanation;
- data-quality warnings;
- disclaimer;
- page numbers.

### Excel

The Excel workbook is intended for deeper review and auditing. It includes:

1. Overview.
2. Daily Sales.
3. Products.
4. Forecast.
5. City Opportunity.
6. Narrative.
7. Evidence.

Raw orders and customer-level information are not exported.

### Manual download flow

The backend generates the report, and Electron opens the normal Windows Save dialog. The file is saved only to the location chosen by the pharmacy owner.

The existing authenticated endpoints are:

```text
GET /api/pharmacy/analytics/export/pdf?month=YYYY-MM
GET /api/pharmacy/analytics/export/xlsx?month=YYYY-MM
```

---

## 16. Immutable monthly report artifact

Manual exports currently calculate the latest valid report when requested. Automated email needs a stronger historical guarantee.

For a completed month, the automation now generates one final PDF and stores it as an immutable artifact. Immutable means that the file is not silently changed after it is finalized.

This provides four benefits:

1. Every retry sends the same PDF.
2. The pharmacy can later download the same report it received by email.
3. A later database change does not alter an already issued historical report.
4. The Resend idempotency request remains identical during retries.

The implemented artifact metadata is:

```js
{
  artifactId,
  ownerId,
  month,
  snapshotId,
  narrativeReportId,
  calculationVersion,
  promptVersion,
  provider,
  generatedAt,
  pdfFileId,
  pdfSha256
}
```

The PDF is stored in a private MongoDB GridFS bucket. GridFS is a MongoDB mechanism for storing files in chunks. It avoids creating a public PDF link and allows the backend to stream the file to an authenticated request.

Only one artifact should exist for the same pharmacy, month, and report version.

---

## 17. Monthly report delivery records

The system needs a permanent record for every pharmacy/month email. This is more reliable than depending only on the temporary history inside n8n or Resend.

The implemented collection is `monthlyReportDeliveries`.

Example:

```js
{
  deliveryId,
  ownerId,
  month,
  channel: "email",
  artifactId,
  recipientEmail,
  pharmacyName,
  status: "pending",
  attempts: 0,
  leaseUntil: null,
  idempotencyKey,
  resendEmailId: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  createdAt,
  updatedAt,
  acceptedAt: null,
  deliveredAt: null
}
```

Possible statuses are:

- `pending`: waiting to be processed;
- `processing`: temporarily claimed by n8n;
- `accepted`: Resend accepted the email request;
- `delivered`: Resend later confirmed delivery;
- `retryable_failed`: a temporary problem occurred;
- `permanent_failed`: retrying will not solve the problem;
- `bounced`: the receiving mail server rejected the message.

A unique database index on pharmacy, month, and channel prevents duplicate monthly delivery records.

---

## 18. Who is eligible to receive a monthly report

The backend, not n8n, decides which pharmacies are eligible.

The initial rules should require:

- an existing pharmacy account;
- an approved account;
- an active/non-suspended account;
- a verified owner email;
- a valid completed report month.

The first production version should still send a report for a month with no orders. That report is useful because it clearly reports the lack of activity and avoids leaving the owner unsure whether automation failed.

n8n will not accept a freely typed recipient email. It will receive the trusted verified address selected by the backend.

---

## 19. Automation API

n8n needs a small server-to-server API. These endpoints will be separate from normal pharmacy-session endpoints.

Implemented endpoints:

```text
POST /api/automation/monthly-reports/initialize
POST /api/automation/monthly-reports/claim
POST /api/automation/monthly-reports/:deliveryId/prepare
GET  /api/automation/monthly-reports/:deliveryId/pdf
POST /api/automation/monthly-reports/:deliveryId/accepted
POST /api/automation/monthly-reports/:deliveryId/failed
```

### Initialize

Creates missing delivery records for eligible pharmacies and a completed month. Running it twice must not create duplicates.

### Claim

Claims a small batch of work, such as five pharmacies. A temporary lease prevents two workflow executions from processing the same record at the same time.

If n8n crashes, the lease eventually expires so another execution can safely continue the work.

### Prepare

Creates or reuses:

- the closed-month snapshot;
- the validated narrative;
- the immutable PDF artifact.

It returns only trusted email metadata and an authorized report reference.

### PDF

Streams the already stored PDF to the authenticated n8n request.

### Accepted

Stores the Resend email ID and marks the request as accepted.

### Failed

Records a safe error code and whether the failure may be retried.

The automation API must never accept a client-supplied pharmacy owner ID or arbitrary recipient as authority for a report.

---

## 20. Server-to-server security

The Oracle n8n instance and Render backend will share a dedicated secret:

```ini
REPORT_AUTOMATION_SECRET=
```

n8n will send it through HTTPS:

```http
Authorization: Bearer <REPORT_AUTOMATION_SECRET>
```

The backend will:

- compare the secret safely;
- reject missing or incorrect credentials;
- apply rate limiting;
- avoid revealing whether a particular pharmacy exists;
- return generic authentication errors;
- log safe operational information without logging the secret.

This secret must never appear in:

- Git;
- browser JavaScript;
- a `NEXT_PUBLIC_*` variable;
- the Pharmacy Electron installer;
- screenshots or documentation containing real values.

n8n will not be given MongoDB, Groq, Cloudinary, or pharmacy login credentials.

---

## 21. Why n8n is being used

n8n is not the analytics engine and is not the source of truth. It is the workflow coordinator.

Its responsibilities are:

- start the workflow on schedule;
- request eligible work from DawaConnect;
- process a controlled batch;
- download the finalized PDF;
- call Resend;
- report success or failure to the backend;
- retry temporary failures;
- produce an operational execution history.

Keeping calculations in the DawaConnect backend means that a workflow edit cannot change official revenue or forecasts.

---

## 22. Oracle Cloud architecture

n8n will be self-hosted on an Oracle Cloud Ubuntu VM.

The planned architecture is:

```text
Internet
   ↓ HTTPS on port 443
Caddy reverse proxy
   ↓ private Docker network
n8n
   ↓ private Docker network
PostgreSQL
```

### Oracle VM

Recommended starting size:

- Ubuntu 24.04 LTS;
- Ampere A1 Flex;
- 1 OCPU;
- 6 GB RAM;
- reserved public IPv4;
- SSH key login.

### Network rules

- Port 22: only the administrator's public IP.
- Port 80: public, for HTTPS certificate setup and redirect.
- Port 443: public, for HTTPS.
- Port 5678: not publicly exposed.
- Port 5432: not publicly exposed.

### DNS

The planned n8n address is:

```text
https://n8n.dawaconnect.store
```

An `A` record will point `n8n.dawaconnect.store` to the Oracle reserved public IP.

---

## 23. Docker services

Three containers will be used.

### Caddy

Caddy receives public HTTPS traffic, manages the TLS certificate, and forwards approved traffic to n8n.

### n8n

n8n stores workflows, encrypted credentials, and execution state. Only Caddy can reach its internal port.

### PostgreSQL

PostgreSQL stores n8n's production workflow data. It is preferred over the default SQLite database for a long-running production automation service.

Persistent Docker volumes will be used for:

- PostgreSQL data;
- n8n data;
- Caddy certificate data;
- Caddy configuration data.

Container versions will be pinned rather than silently following an untested newest version.

---

## 24. n8n security and credentials

The deployment needs a permanent `N8N_ENCRYPTION_KEY`. n8n uses it to encrypt stored credentials.

If this key is lost, restored workflow credentials may become unreadable. It must therefore be protected and included in encrypted backups.

n8n will contain two relevant credentials:

### DawaConnect Reports API credential

```text
Authorization: Bearer <REPORT_AUTOMATION_SECRET>
```

### Resend Monthly Reports credential

```text
Authorization: Bearer <DEDICATED_RESEND_API_KEY>
```

The Resend key used for monthly reports should be separate from other keys where possible. Secrets will be stored through n8n's credential manager rather than typed directly into workflow nodes.

The n8n owner account should use a strong unique password and multi-factor authentication. Security audits and controlled updates should be performed regularly.

---

## 25. Monthly n8n workflow

The recommended schedule is the second day of every month at 9:00 AM Pakistan time. It processes the previous completed calendar month.

The workflow will perform the following steps:

1. **Schedule Trigger** starts the workflow.
2. **Calculate previous month** produces a value such as `2026-10`.
3. **Initialize** asks the backend to create missing eligible delivery records.
4. **Claim batch** requests a small number of pending records.
5. **Loop Over Items** handles each pharmacy separately.
6. **Prepare** asks the backend to finalize/reuse the snapshot, narrative, and PDF.
7. **Download PDF** receives the private report as binary data.
8. **Build email** uses a fixed DawaConnect template and trusted backend metadata.
9. **Send through Resend** sends one email with one PDF attachment.
10. **Record acceptance** saves the Resend ID in the backend.
11. **Handle error** records a retryable or permanent failure.
12. **Claim next batch** continues until no work remains.
13. **Completion summary** records or alerts the administrator about the run.

The AI-generated narrative is inside the validated PDF. The AI does not create the recipient, sender, subject, or arbitrary email HTML.

---

## 26. Resend email delivery

The sender can be:

```text
DawaConnect Reports <reports@dawaconnect.store>
```

The domain `dawaconnect.store` has already been verified in Resend.

Each email will contain:

- a short fixed greeting;
- pharmacy name;
- report month;
- a short explanation of the attachment;
- a support or portal link;
- the finalized PDF attachment.

The Excel workbook remains a manual Analytics-page download in the first version.

Reports must be sent individually because each email has a pharmacy-specific attachment. The recipient will be the backend-selected verified owner email.

---

## 27. Duplicate prevention

Duplicate protection exists at multiple levels.

### Database unique record

Only one email delivery record may exist for a pharmacy, report month, and email channel.

### Claim lease

Only one active worker can process a claimed delivery during its lease.

### Immutable PDF

Retries reuse the same stored report bytes.

### Resend idempotency key

A stable key can follow this shape:

```text
monthly-report/<ownerId>/<month>/<artifactId>
```

If the network response is lost after Resend accepted the message, the same key can be retried without intentionally creating another message.

The DawaConnect database remains the permanent source of truth because external idempotency storage is time-limited.

---

## 28. Retry and failure policy

Temporary failures should be retried. Permanent errors should be recorded and brought to an administrator's attention.

### Retryable examples

- network timeout;
- HTTP 408;
- HTTP 429 rate limiting;
- HTTP 5xx server error;
- temporary Render, Oracle, MongoDB, or Resend outage.

### Permanent examples

- invalid recipient format;
- invalid service credential;
- unverified sender domain;
- malformed email request;
- missing or unauthorized report;
- a rejected pharmacy account.

Suggested retry delays are:

- first retry: 15 minutes;
- second retry: 1 hour;
- third retry: 6 hours;
- final automatic retry: the next day.

The exact retry count and timing will be configured and tested during workflow development.

---

## 29. Resend delivery-status webhooks

When Resend accepts an API request, it does not yet prove that the receiving mail server delivered the message.

The backend now contains a signed Resend webhook endpoint that can update the delivery record for events such as:

- delivered;
- bounced;
- delivery delayed;
- recipient complaint.

The backend verifies Resend's signature against the exact raw request body before trusting an event. The stored `resendEmailId` connects the webhook event to the correct monthly delivery record. The webhook still has to be created in the Resend dashboard and its signing secret added to Render before live events can arrive.

This produces a more accurate history than treating API acceptance as final delivery.

---

## 30. Test mode and safe rollout

The first workflow runs must not email every pharmacy.

The backend will support:

```ini
REPORT_EMAIL_TEST_MODE=true
REPORT_EMAIL_TEST_RECIPIENT=<developer-test-email>
```

In test mode, the backend keeps the real pharmacy identity and report but replaces the outgoing recipient with the approved test address. This replacement happens on the backend so an accidental n8n edit cannot bypass it.

The rollout stages are:

1. One known pharmacy and one completed month.
2. One pharmacy with no orders.
3. Duplicate workflow execution.
4. Simulated temporary and permanent failures.
5. Small batch of internal/test recipients.
6. Production batch with monitoring.
7. Automatic monthly schedule activation.

---

## 31. Complete test checklist

### Analytics tests

- Delivered orders count toward revenue.
- Cancelled orders do not count toward revenue or demand.
- Previous-month comparison is correct.
- Pakistan month boundaries are correct.
- Product ranking and units are correct.
- Empty months remain understandable.

### Forecast tests

- Recent months receive the correct weights.
- A partial month is normalized safely.
- Low stock produces an evidence-based recommendation.
- A dormant product does not receive invented demand.
- Confidence falls when history is insufficient.
- Backtesting excludes an incomplete target month.

### City-opportunity tests

- Invalid coordinates are rejected.
- Wrong-city orders are excluded.
- Privacy thresholds hide small zones.
- Exact customer and competitor details are absent.
- Radius scenarios never exceed 50 km.
- Insufficient evidence produces no unsupported expansion claim.

### AI tests

- Raw customer/order data is excluded from AI input.
- Provider instructions prohibit recalculation.
- Unknown evidence keys are rejected.
- Unsupported numerical prose is rejected.
- HTML and malformed JSON are rejected.
- Groq success produces all six sections.
- Groq failure produces the template fallback.
- Regeneration cooldown works.

### Report tests

- PDF has a valid file structure.
- Excel opens and contains all seven sheets.
- An unauthenticated user receives HTTP 401.
- One pharmacy cannot export another pharmacy's report.
- Filenames and response headers are safe.

### Automation tests

- Invalid automation secret receives HTTP 401.
- Current/future months are rejected.
- Unapproved pharmacies are excluded.
- Unverified emails are excluded.
- Initialize can run twice without duplicates.
- Two workers cannot claim the same active record.
- An expired lease can be reclaimed.
- Prepare reuses the same artifact.
- Unauthenticated PDF download is rejected.
- Resend acceptance stores the email ID.
- Same idempotency key does not intentionally send twice.
- Temporary failures are retried.
- Permanent failures stop retrying.
- n8n restart does not lose pending work.
- Resend webhook signature is verified.
- Delivered and bounced events update the correct record.
- Test mode never emails a real pharmacy recipient.
- Production mode sends the exact frozen PDF.

---

## 32. Backups and disaster recovery

The feature depends on both DawaConnect data and n8n operational data.

The backup plan should include:

- MongoDB collections containing snapshots, narratives, artifacts, and delivery records;
- MongoDB GridFS files containing finalized PDFs;
- PostgreSQL dump for n8n;
- n8n persistent data volume;
- the `N8N_ENCRYPTION_KEY` stored separately and securely;
- Oracle deployment configuration;
- Caddy configuration;
- a record of pinned container versions.

A backup is not considered complete until a restoration test proves that workflows and credentials can be recovered.

---

## 33. Monitoring and maintenance

The following should be monitored:

- Oracle VM availability and disk space;
- Docker container health;
- Caddy HTTPS certificate health;
- n8n failed executions;
- Render backend availability;
- MongoDB connectivity;
- Groq fallback frequency;
- Resend acceptance, delivery, and bounce rates;
- deliveries stuck in `processing`;
- permanent monthly email failures.

n8n, PostgreSQL, Caddy, Node dependencies, and report providers must be updated in a controlled way. Before an infrastructure update:

1. create a backup;
2. read release notes;
3. update one component at a time;
4. run a test workflow;
5. verify report download and email delivery;
6. retain a rollback plan.

---

## 34. Environment variables

### Already used on the Admin/Pharmacy Render backend

```ini
ANALYTICS_AI_PROVIDER=groq
ANALYTICS_AI_API_KEY=<server-only-key>
ANALYTICS_AI_MODEL=openai/gpt-oss-20b
ANALYTICS_AI_TIMEOUT_MS=25000
ANALYTICS_AI_REGENERATION_COOLDOWN_SECONDS=300
RESEND_API_KEY=<server-only-resend-key>
RESEND_FROM_EMAIL="DawaConnect <noreply@dawaconnect.store>"
```

The existing Resend key is used by pharmacy authentication emails. A separate Resend key should be created for n8n monthly reports where possible.

### Planned Render variables

```ini
REPORT_AUTOMATION_SECRET=<long-random-secret>
REPORT_AUTOMATION_BATCH_SIZE=5
REPORT_AUTOMATION_LEASE_MINUTES=20
REPORT_EMAIL_FROM="DawaConnect Reports <reports@dawaconnect.store>"
REPORT_EMAIL_TEST_MODE=true
REPORT_EMAIL_TEST_RECIPIENT=<approved-test-address>
```

### Planned Oracle/n8n deployment variables

```ini
N8N_DOMAIN=n8n.dawaconnect.store
N8N_VERSION=<tested-pinned-version>
N8N_ENCRYPTION_KEY=<long-random-key>
POSTGRES_DB=n8n
POSTGRES_USER=n8n
POSTGRES_PASSWORD=<long-random-password>
GENERIC_TIMEZONE=Asia/Karachi
```

Real values belong in secret environment files or platform settings. `.env.example` must contain placeholders only.

---

## 35. What is deliberately outside the current scope

The following are not part of the current feature:

- profit or gross-margin calculation;
- supplier purchase expense;
- received-stock expense;
- damaged-stock workflow;
- expired-stock workflow;
- supplier lead-time forecasting;
- automatic purchasing from suppliers;
- automatic delivery-radius changes;
- AI access to raw customer information;
- AI control over official calculations;
- emailing the Excel workbook automatically;
- training or hosting a custom Hugging Face model in the first release.

A custom Hugging Face narrative model can be evaluated later. The current provider adapter and prompt-version design intentionally allow that provider to be changed without rebuilding the calculation, report, or automation layers.

---

## 36. Remaining development phases

### Phase 1: Immutable report artifact — implemented

- Add artifact metadata storage.
- Add private PDF file storage.
- Generate a completed-month PDF once.
- Reuse the same artifact for later downloads and email retries.
- Add unique indexes and tests.

### Phase 2: Delivery records and automation API — implemented

- Add the delivery collection.
- Add permanent duplicate protection.
- Add service-token authentication.
- Implement initialize, claim, prepare, PDF, accepted, and failed endpoints.
- Add rate limits, leases, safe errors, and tests.

### Phase 3: Oracle infrastructure — deployment files ready; server deployment pending

- Create the VM and reserved IP.
- Configure DNS and firewall rules.
- Install Docker.
- Deploy PostgreSQL, n8n, and Caddy.
- Configure HTTPS, persistent storage, owner account, and backups.

### Phase 4: n8n workflow — pending Oracle deployment

- Create DawaConnect and Resend credentials.
- Build the scheduled batch workflow.
- Attach the binary PDF.
- Add idempotency, retry branches, and completion summary.
- Add an error workflow.

### Phase 5: Delivery webhooks and monitoring — backend implemented; Resend registration pending

- Add the verified Resend webhook endpoint.
- Track delivered, delayed, bounced, and complained events.
- Add administrative visibility for failed deliveries.

### Phase 6: Production rollout

- Test with one pharmacy.
- Test no-data and fallback reports.
- Test duplicates, retries, and restart recovery.
- Run a controlled batch.
- Disable test mode.
- Activate the monthly schedule.
- Monitor the first complete production run.

---

## 37. Final end-to-end example

Assume it is 2 November 2026 at 9:00 AM Pakistan time.

1. n8n calculates that the completed report month is October 2026.
2. n8n authenticates to the DawaConnect backend.
3. The backend finds approved active pharmacies with verified emails.
4. The backend creates any missing October delivery records.
5. n8n claims five records.
6. For the first pharmacy, the backend creates or reuses the October snapshot.
7. The backend calculates/reuses the trusted forecast and city opportunity.
8. The backend creates or reuses the validated Groq narrative.
9. If Groq fails, the backend creates the rules-based fallback narrative.
10. The backend produces and stores one finalized October PDF.
11. n8n downloads that PDF through the protected endpoint.
12. n8n sends it to the backend-selected verified email through Resend.
13. Resend returns an email ID.
14. n8n records the email as accepted in DawaConnect.
15. n8n moves to the next pharmacy.
16. If a temporary error occurs, the record is retried later.
17. If n8n stops, expired claims are safely recovered.
18. Resend later sends a signed delivery webhook.
19. DawaConnect marks the email as delivered or bounced.
20. The pharmacy can download the same historical report from the Analytics page.

At no point does n8n calculate revenue, the AI choose an email address, or the desktop application receive a database/API secret.

---

## 38. Final design principles

The complete feature must continue to follow these principles:

1. **The database and calculation engine own the facts.**
2. **The AI explains facts but does not create official figures.**
3. **Every AI explanation is validated and evidence-bound.**
4. **A deterministic fallback keeps the feature available without AI.**
5. **Historical monthly reports are frozen and reproducible.**
6. **The backend chooses the verified recipient.**
7. **n8n coordinates work but is not the source of truth.**
8. **Resend delivers emails but DawaConnect keeps the permanent delivery record.**
9. **Retries must not create duplicate emails.**
10. **Customer-level and secret data never enter the AI or n8n workflow.**
11. **Recommendations support the owner; they do not automatically change inventory or delivery settings.**
12. **Every development phase must be explained, tested, and documented before moving to the next phase.**

