# DawaConnect — Complete Presentation Content and Generation Prompt

**Document purpose:** This document explains the DawaConnect FYP in presentation-ready language. It covers the implemented features of the Marketplace, Pharmacy Desktop Application, Admin Portal, shared backend, analytics/AI layer, databases, and deployment architecture. For every major feature, it also explains why DawaConnect is better than the traditional approach.

**Reference presentation note:** `PAKFASAL_v4.pptx` was used only as a visual and structural reference. Its dark branded backgrounds, large product screenshots, short benefit points, architecture slides, and minimal transitions influenced the recommended presentation style. Its agricultural content is not treated as a DawaConnect requirement.

**Code verification date:** 15 November 2026

---

## 1. Executive summary

DawaConnect is a connected digital medicine-commerce and pharmacy-management ecosystem. It brings three previously disconnected groups onto one platform:

1. **Customers** use the DawaConnect Marketplace to find medicines, compare available pharmacies, choose a delivery destination, place an order, track it, chat with the pharmacy, and review the completed service.
2. **Pharmacy owners** use the Windows desktop application to register their pharmacy, maintain live inventory, process orders, communicate with customers, receive desktop notifications, view reviews, and study monthly analytics and AI-assisted recommendations.
3. **DawaConnect administrators** use the Admin Portal to approve pharmacies, monitor orders and users, handle escalated complaints, control administrator access, and maintain an audit trail.

The modules do not operate as isolated demonstrations. They share real data and form one end-to-end workflow. A medicine added by an approved pharmacy becomes searchable in the Marketplace. A Marketplace checkout creates a pharmacy-specific order. The order reaches the pharmacy application, its status returns to the customer, and both sides can communicate through the same order conversation.

### One-line project statement

> DawaConnect connects customers, verified pharmacies, and platform administrators through live inventory, location-aware ordering, human order chat, pharmacy operations, and privacy-conscious analytics.

---

## 2. The problem DawaConnect solves

### Traditional medicine purchasing problems

- Customers often call or physically visit several pharmacies to ask whether a medicine is available.
- A customer may know the medicine name but not which nearby pharmacy stocks it.
- Online product lists may be outdated, show dummy inventory, or ignore whether the pharmacy can actually deliver to the selected address.
- One mixed cart can hide the fact that products belong to different sellers, making delivery fees, order responsibility, and tracking confusing.
- A customer sitting at work cannot easily order medicines for a home in another area or city if the system only uses the device's current GPS position.
- Guests are often forced to create an account before a simple order can be placed.
- Communication after checkout usually happens through an unstructured phone call or external messaging application with no connection to the order.

### Traditional pharmacy-management problems

- Inventory, orders, and customer conversations are frequently managed in separate registers, spreadsheets, phone calls, or messaging applications.
- A pharmacy owner may not be notified immediately when a new online order arrives.
- Stock decisions are based on memory rather than measured demand.
- Monthly reports show numbers but may not explain what the owner should do next.
- A new pharmacy's location and legitimacy may not be verified before its products become public.

### Traditional platform-administration problems

- Pharmacy approvals, complaints, users, and orders are managed in separate tools.
- It is difficult to determine which administrator performed a sensitive action.
- A platform can accidentally expose unapproved pharmacies or inconsistent inventory.

### DawaConnect's answer

DawaConnect replaces this fragmented process with a single connected flow: **verified pharmacy → live inventory → customer discovery → location-aware checkout → pharmacy fulfilment → order chat → delivery → verified review → analytics and recommendations**.

---

## 3. The three-module ecosystem

| Module | Primary user | Main responsibility | Important outcome |
|---|---|---|---|
| Marketplace | Customer or guest | Search, compare, order, track, chat, find care, and manage a customer account | Customers see real products from approved pharmacies instead of dummy stock |
| Pharmacy Desktop Application | Pharmacy owner/staff | Register, manage inventory, process orders, communicate, receive alerts, and study performance | Pharmacy operations remain synchronized with Marketplace demand |
| Admin Portal and Shared API | DawaConnect administrators | Approve and govern pharmacies, users, orders, complaints, and audit activity | Trust, accountability, and cross-module integration are centrally controlled |

### End-to-end commerce flow

1. A pharmacy registers through the desktop app and confirms its exact map point.
2. An administrator reviews and approves the pharmacy.
3. The pharmacy adds products and maintains their stock and prices.
4. Approved, in-stock products become searchable in the Marketplace.
5. The customer selects a delivery destination and sees whether each pharmacy can deliver there.
6. Products are placed in separate pharmacy carts, so each checkout belongs to one pharmacy.
7. Checkout reserves stock and creates the Marketplace order and corresponding pharmacy order.
8. The pharmacy receives an in-app and Windows notification.
9. The pharmacy processes the order through its operational statuses.
10. The customer receives synchronized tracking information and can use the human order chat.
11. The customer can cancel directly before confirmation or request cancellation through chat during the allowed confirmed stages.
12. After delivery, the registered customer can submit one verified review.
13. Delivered-order data contributes to pharmacy analytics and future stock recommendations.

---

# Part I — Customer Marketplace

## 4. Secure authentication and flexible guest access

### What the feature does

- Customers can create an account using email verification or Google Identity Services.
- Email registration uses a five-minute one-time password sent through Resend from the DawaConnect domain.
- Google sign-up and sign-in establish the same server-managed login session used by the rest of the site.
- After authentication, the customer returns to the page where the authentication journey started.
- Server-issued cookies preserve the signed-in session.
- Guests can still browse, use Find Care, place an order, track that order, and use its chat without being forced to register.
- Registered-only features include the user portal and the AI assistant.

### Why this is better than the traditional approach

- OTP verification reduces fake or mistyped email registrations.
- Google sign-in removes password friction while still creating a real platform identity.
- Returning users do not need to authenticate separately for every protected feature.
- Guest checkout avoids losing urgent medicine orders because of a mandatory account form.
- Access remains controlled: guest tracking and chat depend on a browser-bound guest-order credential rather than a public order number alone.

### Suggested presentation image

Place the Marketplace sign-up/sign-in page on the right and show three short points on the left: **Google or verified email**, **secure session**, and **guest checkout available**.

---

## 5. Live product discovery instead of dummy listings

### What the feature does

- Search results come from inventory entered by registered and approved pharmacies.
- A customer can search medicines, healthcare products, or pharmacies.
- Results can be paginated so the full matching catalogue remains available.
- Pharmacy and product cards show real seller, price, availability, and relevant delivery state.
- Recent searches support quicker repeat discovery.
- Voice input can convert a spoken medicine query into a search intention.

### Why this is better than the traditional approach

- Customers do not waste time on a catalogue that is disconnected from pharmacy stock.
- One search replaces repeated phone calls to several pharmacies.
- Pagination keeps a large catalogue usable without hiding valid alternatives.
- Voice search helps users who find medicine spellings difficult to type.

### Suggested presentation image

Use a full search-results screenshot showing multiple pharmacy/product cards. Add a small label: **Live inventory from approved pharmacies**.

---

## 6. Delivery-aware pharmacy ranking

### What the feature does

- DawaConnect separates the customer's current device location from the intended delivery destination.
- The destination may be the current position or a searched home, office, area, landmark, or city anywhere in Pakistan.
- Stored pharmacy coordinates and configured delivery radius are used to determine whether the destination is deliverable.
- Pharmacies that stock the product can still be displayed when they are closed or outside the selected delivery radius, but the card clearly explains the limitation.
- The most suitable pharmacy can be emphasized below the search bar using distance, delivery eligibility, and estimated checkout cost rather than hiding the complete result list.

### Why this is better than the traditional approach

- A person in Sahiwal can order for a Lahore home by selecting the Lahore destination instead of being restricted to current GPS coordinates.
- The user can distinguish **has the medicine** from **can deliver it to this address**.
- Price comparison becomes realistic because delivery cost is considered along with product price.
- The system remains transparent by showing alternatives instead of silently discarding them.

### Suggested presentation image

Show the search destination selector and two result cards: one tagged **Delivers here** and another tagged **Outside delivery radius**.

---

## 7. Independent carts and orders for each pharmacy

### What the feature does

- Products from different pharmacies are stored in separate carts.
- The All Carts page presents one card per pharmacy.
- Every cart has its own products, delivery fee, Rs 9 processing fee, checkout, order ID, chat, and tracking history.
- The system does not charge a fictional pharmacy tax.
- A customer opens and checks out one pharmacy cart at a time.

### Why this is better than the traditional approach

- One order has one accountable pharmacy.
- Delivery fees and fulfilment responsibility are clear before payment or confirmation.
- A problem with one pharmacy does not make another pharmacy's order ambiguous.
- Inventory reservation, cancellation, chat authorization, and review eligibility become safer because the order has a single seller.

### Suggested presentation image

Use the All Carts page with two pharmacy cart cards. Add a simple caption: **One pharmacy = one cart = one order**.

---

## 8. Location-aware checkout and delivery validation

### What the feature does

- Checkout supports registered customers and guests.
- Registered customers can select or manage saved addresses.
- Customers can use current location or search a different destination.
- Geoapify converts the selected place into coordinates; the coordinates are used to test the pharmacy's actual delivery radius.
- The checkout shows subtotal, pharmacy delivery fee, and the Rs 9 DawaConnect processing charge.
- Confirming the order reserves product stock to prevent overselling.

### Why this is better than the traditional approach

- Delivery validation is based on the chosen destination, not a vague city text field.
- Remote ordering for another home or family member remains possible.
- Customers see a clear cost breakdown with no artificial pharmacy tax.
- Reserving stock at checkout reduces the chance of confirming an unavailable medicine.

### Suggested presentation image

Show the Delivery Destination card and Order Summary together. Highlight the selected location and delivery-radius confirmation.

---

## 9. Order tracking and cancellation workflow

### What the feature does

- Customers can follow the status of the pharmacy-specific order.
- Typical operational states include Pending/Processing, Confirmed, Packed, Dispatched, Delivered, and Cancelled.
- Before the pharmacy confirms the order, the customer or guest can cancel it directly.
- Direct cancellation restores reserved stock to the pharmacy inventory and records the reason.
- After confirmation, the customer can send a cancellation request through live chat while the order is Confirmed or Packed.
- Cancellation requests are no longer allowed after dispatch or delivery.

### Why this is better than the traditional approach

- The customer does not need to call the pharmacy simply to learn whether the order moved forward.
- Early cancellation is immediate and inventory-safe.
- Later cancellation is a controlled request rather than an uncontrolled status change after pharmacy work has started.
- The process protects both the customer and pharmacy from inconsistent stock and unclear responsibility.

### Suggested presentation image

Use an order-tracking screenshot with a horizontal or vertical status timeline and a small cancellation decision diagram.

---

## 10. Human live order chat with image sharing

### What the feature does

- Customers and pharmacy owners communicate in a private conversation tied to one order.
- The feature is completely human-to-human; it does not use AI to imitate the pharmacy.
- Both parties can exchange text and supported images.
- Images are stored through signed Cloudinary operations rather than inside MongoDB documents.
- The pharmacy can open chat from an ongoing order; the customer can open it from order details/tracking.
- Chat is writable while the order is Processing, Pending, Confirmed, Packed, or Dispatched.
- It becomes read-only after Delivered or Cancelled.
- Registered-customer conversations remain associated with the customer account.
- Guest conversations are browser-authorized and retained for 15 days; the Marketplace warns guests that the history is temporary.

### Why this is better than the traditional approach

- Conversation context stays attached to the exact order.
- A customer can show packaging, a received item, or other relevant visual information without moving to WhatsApp.
- The pharmacy can initiate a useful conversation rather than waiting for the customer.
- Read-only terminal conversations preserve the record without allowing changes after the order is finished.
- Short guest retention balances convenience with data minimization.

### Suggested presentation image

Place Marketplace chat and Pharmacy Desktop chat screenshots side by side, connected by a thin line labelled **same order conversation**.

---

## 11. Find Care healthcare map

### What the feature does

- Find Care is available even to visitors who are not signed in.
- It shows registered DawaConnect pharmacies using their confirmed database coordinates.
- It can also discover external healthcare places such as pharmacies, hospitals, and clinics from map/healthcare data providers.
- Users can filter place type and change the search radius up to 50 km.
- Registered and external locations are visually distinguished.
- Selecting a place opens its details and allows the user to start directions.
- The map is designed to focus on healthcare instead of restaurants and unrelated businesses.

### Why this is better than the traditional approach

- DawaConnect pharmacies remain visible even when they are not separately registered on a commercial map service.
- External care locations prevent the feature from being limited only to platform sellers.
- Healthcare-only filtering removes visual clutter during an urgent search.
- Directions turn discovery into a practical visit route.

### Suggested presentation image

Use a wide map screenshot containing differently styled markers and a visible filter/radius panel.

---

## 12. Medical and pharmacy AI assistant

### What the feature does

- The assistant is available only to registered Marketplace users.
- It is restricted to medicines, pharmacies, human health education, care locations, and DawaConnect usage.
- A local and model-assisted scope classifier rejects unrelated requests consistently, including unrelated Urdu and Roman Urdu prompts.
- It provides educational guidance but does not claim to diagnose or prescribe.
- High-risk medical questions remain in scope; the assistant sets safe boundaries and still explains relevant treatment categories, warning signs, and suitable professional next steps.
- Users can attach up to two images in one message and up to six AI images per day.
- Images may include medicine packaging, reports, relevant medical images, or DawaConnect screenshots.
- Registered users can select a stored prescription directly from their private prescription library.
- Each user can ask up to 20 questions per day.

### AI model strategy

The assistant uses Groq-hosted models with fallback. If one request/model fails, it attempts the next configured model.

**Text model rotation:**

1. `openai/gpt-oss-20b`
2. `qwen/qwen3.6-27b`
3. `openai/gpt-oss-120b`
4. `qwen/qwen3.8-27b`

**Vision-capable fallback list:**

1. `qwen/qwen3.6-27b`
2. `qwen/qwen3.8-27b`

### Why this is better than the traditional approach

- Users receive immediate, understandable educational support instead of searching unrelated web pages.
- Scope control makes the assistant more predictable than a general-purpose chatbot.
- Model fallback improves availability when a provider model is temporarily limited.
- Image and prescription context lets the user ask a clearer question without allowing unlimited storage or use.
- Daily limits protect the startup from uncontrolled API cost and misuse.

### Suggested presentation image

Show the assistant conversation with an image/prescription attachment preview. Include a compact architecture strip: **scope check → safe prompt → model fallback → formatted answer**.

---

## 13. User Portal

### What the feature does

- Provides a personalized dashboard for registered customers.
- Displays real orders and allows sorting from newest to oldest or oldest to newest.
- Manages delivery addresses and their confirmed delivery points.
- Stores bookmarked products in Saved Items; product cards provide a favourite control and a confirmation toast.
- Allows the customer to edit the full name while verified email and Google profile image remain protected.
- Manages up to 15 private prescriptions.
- Allows customers to create and follow support complaints.

### Prescription library

- Accepts JPEG, PNG, WebP, and PDF files up to 4 MB each.
- Stores file assets in Cloudinary and metadata in MongoDB.
- Supports preview, selection in the AI assistant, and permanent deletion.
- Does not use an approval/rejection workflow because the feature is a private customer document library, not a pharmacy authorization process.

### Why this is better than the traditional approach

- Orders, addresses, saved medicines, prescriptions, and complaints are organized under one identity.
- Large files stay out of MongoDB, keeping the database lighter.
- Customers retain control over adding and deleting personal files.
- Protected identity fields reduce accidental account mismatch.

### Suggested presentation image

Use a collage of the User Portal overview, Saved Items, and My Prescriptions pages, with one screen emphasized and the others smaller.

---

## 14. Verified reviews and complaints

### What the feature does

- A registered customer can review a delivered order.
- The review is connected to a real order and marked as a verified purchase.
- The customer chooses a one-to-five-star rating and may add an optional comment.
- Pharmacy rating averages and review counts appear in Marketplace pharmacy data and the Pharmacy Desktop reviews page.
- Complaints can target a pharmacy or DawaConnect support.
- Complaint threads contain messages, state, activity time, and resolution information.

### Why this is better than the traditional approach

- A verified-order rule is more trustworthy than anonymous star ratings.
- Pharmacies receive measurable feedback based on completed service.
- Complaints remain traceable rather than disappearing into a private phone call.
- Admin oversight helps moderate pharmacy-specific complaint handling.

### Suggested presentation image

Show the Marketplace review dialog and the Pharmacy Desktop rating distribution on the same slide.

---

# Part II — Pharmacy Desktop Application

## 15. Verified pharmacy registration and onboarding

### What the feature does

- Pharmacy owners create a secured pharmacy account and verify the email through Resend OTP.
- Registration gathers owner/basic information, pharmacy details, operating information, and required documents in a full-page workflow.
- The address cannot depend only on manually typed text.
- The owner searches an address or nearby landmark, moves a map marker to the exact entrance, and confirms the point.
- The confirmed latitude and longitude are stored for Marketplace maps and delivery calculations.
- Two optional photographs can be added: one inside and one outside the pharmacy.
- Photographs are stored in Cloudinary and can later be replaced in Pharmacy Profile.
- Registration remains pending until an administrator approves it.

### Why this is better than the traditional approach

- Exact coordinates are more useful than an inconsistent written address.
- The same confirmed location powers Find Care and delivery-radius validation.
- Documents and photos give administrators more evidence during review.
- Unapproved pharmacies cannot immediately expose products to customers.

### Suggested presentation image

Use the map-pin registration screen as the main image and small thumbnails of document and pharmacy-photo areas.

---

## 16. Live pharmacy dashboard

### What the feature does

- Summarizes today's orders, pending work, inventory value/health, low-stock items, category distribution, and recent orders.
- Values are derived from the pharmacy's actual data rather than hard-coded demonstration cards.
- Recent operational information gives the owner a starting point after sign-in.

### Why this is better than the traditional approach

- The owner does not need to combine a register, spreadsheet, and phone messages to understand the day.
- Pending work becomes visible immediately.
- Inventory warnings are presented beside order activity, connecting stock with demand.

### Suggested presentation image

Use a full-width dashboard screenshot with three callouts pointing to **orders**, **stock warning**, and **recent activity**.

---

## 17. Inventory workspace

### What the feature does

- Pharmacy staff can add, edit, and remove medicines/products.
- Product records include name, category, unit, price, stock quantity, low-stock threshold, expiry information, and optional operational details.
- Inventory state is synchronized through the shared Pharmacy API.
- Low-stock and expiry-related conditions are visible to the owner.
- Marketplace checkout and cancellation update stock through controlled inventory movements.

### Why this is better than the traditional approach

- A product entered once becomes available to both pharmacy operations and customer search.
- Low-stock thresholds turn inventory into an active warning system.
- Controlled stock changes provide more consistency than manually adjusting a spreadsheet after every online order.
- Central image/catalogue standardization can later remove repeated product image uploads.

### Suggested presentation image

Show the inventory table and Add New Medicine dialog. Avoid presenting the planned shared medicine catalogue as already complete.

---

## 18. Pharmacy order control center

### What the feature does

- Displays orders belonging to the signed-in pharmacy.
- Staff can inspect customer/delivery information and ordered items.
- Status changes move the order through Confirmed, Packed, Dispatched, Delivered, or Cancelled as permitted.
- Status is synchronized back to Marketplace tracking and admin oversight.
- The pharmacy can open the customer chat directly from an order.
- A pending cancellation request can be reviewed while the order is Confirmed or Packed.

### Why this is better than the traditional approach

- The pharmacy works from one actionable order queue.
- The customer and administrator see the same operational status.
- Cancellation is governed by order state instead of an informal phone promise.
- Direct order-to-chat navigation removes confusion about which customer message belongs to which purchase.

### Suggested presentation image

Use the Orders Control Center with an open order detail panel and visible status controls.

---

## 19. Real-time and Windows desktop notifications

### What the feature does

- New orders create real notification records and unread counts.
- Socket.IO pushes new-order events to the desktop application.
- An in-app toast and notification panel are updated.
- When the application is not focused, Windows can show a native desktop alert with optional sound.
- The application can remain available in the system tray and optionally start with Windows.
- Mark All Read synchronizes the read state instead of merely hiding a hard-coded badge.

### Why this is better than the traditional approach

- Pharmacy staff do not need to refresh a web page repeatedly.
- An order can be noticed even while another application is open.
- Real unread counts are more trustworthy than decorative alert badges.
- Background/tray behavior makes the desktop application suitable for daily counter use.

### Suggested presentation image

Show the in-app notification list and a Windows toast mockup beside it.

---

## 20. Live Customer Chat for pharmacy owners

### What the feature does

- Lists real conversations for pharmacy orders.
- The pharmacy can initiate/open chat from its order list.
- Shows order reference, customer identity or guest label, current order state, unread activity, text, and images.
- Supports image preview and full-size viewing.
- Allows pharmacy handling of customer cancellation requests in the same conversation.
- Becomes read-only when the order reaches a terminal state.

### Why this is better than the traditional approach

- Pharmacy staff do not need a personal WhatsApp account for order support.
- Conversation authorization is based on pharmacy ownership of the order.
- Both sides see the same message history and order context.

### Suggested presentation image

Use the Pharmacy Live Customer Chat page with one conversation and an image message visible.

---

## 21. Monthly analytics and forecasting

### What the feature does

- Calculates delivered orders, revenue, units sold, cancellation rate, daily activity, category performance, popular products, slow-moving products, and live inventory health.
- Forecasts demand using delivered sales and the project's weekly replenishment assumption.
- Suggests product-level forecast units and weekly stock targets.
- Analyses privacy-qualified city zones to show delivery opportunities and possible radius scenarios.
- Exact customer addresses and competitor identities are not sent to the pharmacy analytics screen.
- Does not currently calculate profit, received-stock expense, damaged/expired cost, or supplier lead time because those were intentionally excluded from the present FYP scope.

### Why this is better than the traditional approach

- Stock decisions are connected to measured sales rather than memory alone.
- The owner sees which products deserve attention before the next month begins.
- Explicit exclusions prevent the report from pretending to calculate unavailable cost data.
- Privacy thresholds reduce the risk of exposing individual customer locations.

### Suggested presentation image

Use the Monthly Analytics page with revenue cards, demand graph, top products, forecast, and delivery-opportunity section.

---

## 22. Hybrid analytics and AI recommendation report

### What the feature does

The feature is deliberately hybrid:

1. **Deterministic analytics code** calculates all figures.
2. Only sanitized, aggregated facts are sent to the narrative service.
3. A Groq-hosted `openai/gpt-oss-20b` model converts the facts into a structured owner-friendly explanation.
4. The model is instructed not to modify calculated figures.
5. The response is schema-validated before it is shown or stored.
6. If the AI provider fails, a deterministic template creates an understandable fallback report.

The report contains:

- Executive summary
- Sales insights
- Inventory actions
- Delivery opportunities
- Risks and limitations
- Next-month action plan
- Evidence references tied back to calculated facts

Reports can be downloaded as **PDF** or **Excel**.

### Monthly automation

- A self-hosted n8n workflow runs on an Oracle Cloud VM.
- Docker Compose runs n8n, PostgreSQL, and Caddy.
- Caddy provides HTTPS for `n8n.dawaconnect.store`.
- The workflow calculates the previous month, requests eligible pharmacy reports from the backend, downloads the report PDF, sends it through Resend, and records delivery state.
- Lease, idempotency, retry, recovery, and maximum-attempt logic reduce duplicate or lost report deliveries.

### Why this is better than the traditional approach

- The AI explains verified numbers instead of inventing the numbers itself.
- Pharmacy owners receive actions, not only charts.
- A fallback keeps the report usable when the AI API is unavailable.
- PDF/Excel downloads support offline review and record keeping.
- Monthly email automation delivers the report without requiring the owner to remember to generate it.

### Suggested presentation image

Use a split slide: analytics screen on one side and a clean flow on the other: **orders → calculations → sanitized facts → AI narrative → validation → PDF/Excel/email**.

---

## 23. Reviews, complaints, and pharmacy profile

### What the feature does

- Reviews & Ratings shows the real average, star distribution, and verified customer comments.
- Complaints contains pharmacy-addressed customer complaints and a path for the pharmacy to contact DawaConnect administrators.
- Pharmacy Profile manages business information, opening state/hours, delivery radius, and inside/outside photographs.
- Approved identity and location data support Marketplace visibility.

### Why this is better than the traditional approach

- The pharmacy receives structured service feedback rather than scattered comments.
- Complaint discussions are visible to the appropriate party and can be overseen by administrators.
- A maintained profile supplies Marketplace customers with trustworthy, reusable information.

### Suggested presentation image

Use the rating distribution as the main screenshot with smaller profile-photo and complaint-thread panels.

---

# Part III — Admin Portal and Shared Backend

## 24. Administrator authentication and role control

### What the feature does

- Administrators authenticate separately from customers and pharmacy owners.
- The first trusted administrator can act as super-admin.
- New administrator accounts wait for approval.
- Sensitive administrator-management actions are restricted to the super-admin.
- JWT authentication protects Admin API operations.

### Why this is better than the traditional approach

- Platform administration is not exposed through customer authentication.
- New staff do not automatically receive full control.
- Role separation reduces accidental or unauthorized governance changes.

### Suggested presentation image

Show the Admin login page beside a small role diagram: **Super-admin → approved admins → pending admins**.

---

## 25. Admin dashboard and operational oversight

### What the feature does

- Shows pharmacy approval counts, orders, customers, complaints, revenue/order trends, order status distribution, city activity, top pharmacies, recent orders, and recent admin actions.
- Orders page displays Marketplace master orders and their pharmacy fulfilment/status information.
- Customers page supports search, account inspection, suspension, and reactivation.
- Pharmacies page shows registered pharmacies with live profile, product, inventory, order, complaint, and feedback context.

### Why this is better than the traditional approach

- Administrators obtain a single operational picture rather than checking each module separately.
- Order and inventory context helps investigate complaints and unusual activity.
- Account suspension can protect the platform without deleting historical records.

### Suggested presentation image

Use the Admin dashboard full-width, with three small callouts for approvals, trend charts, and recent activity.

---

## 26. Pharmacy approval and moderation

### What the feature does

- Administrators review pending pharmacy registrations.
- Approval makes the pharmacy's valid inventory eligible for Marketplace visibility.
- Rejection records a clear reason that the pharmacy can address.
- Approved pharmacies can later be suspended or restored.
- Pharmacy details, documents, coordinates, products, photos, and operational history can be inspected before a decision.

### Why this is better than the traditional approach

- Sellers cannot self-publish without platform review.
- A recorded rejection reason is more actionable than silent rejection.
- Suspension provides a reversible safety control while preserving evidence.

### Suggested presentation image

Show the Approvals table and pharmacy detail drawer with Approve/Reject actions.

---

## 27. Complaints, audit log, and shared services

### What the feature does

- The Admin complaint inbox receives platform escalations from customers and pharmacies.
- Administrators can also view pharmacy-handled complaint threads for moderation oversight.
- Audit Log records state-changing admin actions with actor, target, time, and reason/context.
- The Express backend serves the Admin UI and acts as the shared production API for the Pharmacy application.
- Socket.IO supports chat and real-time pharmacy notifications.
- Server-only services hold MongoDB, Cloudinary, Resend, Geoapify, chat-signing, JWT, and analytics credentials.

### Why this is better than the traditional approach

- Escalations are handled in a traceable inbox.
- Audit records improve accountability for approvals, suspensions, complaint decisions, and admin changes.
- Keeping secrets on the backend prevents the Pharmacy `.exe` from containing database passwords and private API keys.
- A shared API gives the desktop app and Admin Portal one governed source of business logic.

### Suggested presentation image

Use the Complaint inbox and Audit Log side by side. Add a footer statement: **Every sensitive action is attributable**.

---

# Part IV — Data, architecture, security, and deployment

## 28. Database organization

DawaConnect uses MongoDB Atlas with two logical databases. Collections are created automatically when the application first writes valid data; empty databases/collections may not appear before that first write.

### MarketPlace database — customer and commerce domain

- Customer users, authentication identity, saved addresses, and session-related account data
- Pending email registrations and verification rate limits
- Marketplace orders with delivery address, items, fees, and pharmacy fulfilment references
- Saved products/favourites
- Recent searches
- Prescription metadata and Cloudinary asset references
- Complaints and messages
- AI daily question/image usage counters

### Pharmacy database — pharmacy operations domain

- Pharmacy owner accounts and approval status
- Pharmacy profiles, coordinates, opening information, delivery radius, and Cloudinary photo references
- Products/inventory
- Pharmacy orders and inventory movements
- Notifications
- Verified reviews
- Pharmacy-facing complaints/support data
- Chat conversations, messages, attachment metadata, and cleanup records
- Analytics/report automation state and generated report artefact references

### Why the split is useful

- Customer commerce and pharmacy operations can evolve without turning one collection set into an unmanageable structure.
- IDs and order references connect the domains without duplicating large assets.
- Images and documents remain in Cloudinary; MongoDB stores searchable metadata and secure references.

---

## 29. Technology architecture

### Frontends

- **Marketplace:** Next.js 16, React 19, Tailwind CSS, deployed on Vercel at `dawaconnect.store`
- **Pharmacy Desktop:** Electron, React, Vite/electron-vite, packaged as a Windows installer
- **Admin Portal:** React, Vite, Tailwind CSS, deployed on Vercel at `admin.dawaconnect.store`

### Backend and real-time layer

- Next.js server routes handle Marketplace-specific operations.
- Express 5 API on Render at `api.dawaconnect.store` handles administration, Pharmacy APIs, shared chat, notifications, analytics, and automation endpoints.
- Socket.IO carries real-time order chat and pharmacy notification events.

### Data and external services

- MongoDB Atlas: structured application data
- Cloudinary: pharmacy photos, prescription files, AI image inputs where required, and live-chat images
- Google Identity Services: Google authentication
- Resend: OTP and automated report email delivery
- Geoapify and map data/services: address search, reverse geocoding, and delivery destinations
- MapLibre/Leaflet: interactive map interfaces
- Groq: Marketplace AI model access and pharmacy analytics narrative generation
- n8n on Oracle Cloud: monthly report workflow automation
- PostgreSQL: n8n's persistent workflow state
- Caddy: HTTPS reverse proxy for the self-hosted n8n service

### Architecture flow for a presentation diagram

```text
Marketplace (Vercel) ─┐
                      ├── Next.js APIs / Express API (Render) ── MongoDB Atlas
Admin Portal (Vercel) ┤                   │
                      │                   ├── Socket.IO chat + notifications
Pharmacy Desktop ─────┘                   ├── Cloudinary media
                                          ├── Resend email
                                          ├── Geoapify/maps
                                          └── Groq AI

Oracle VM: n8n + PostgreSQL + Caddy ── monthly report APIs ── Resend
```

---

## 30. Security, privacy, and reliability decisions

- Passwords are hashed rather than stored in plain text.
- Email OTPs expire after five minutes and verification attempts are rate-limited.
- Google identity tokens are verified server-side.
- Signed, HTTP-only session cookies protect Marketplace authentication.
- Guest order access uses a browser-bound secret whose hash is stored, not a publicly guessable order ID alone.
- Chat tokens are short-lived and signed with a separate shared secret.
- Chat authorization verifies customer/order or pharmacy/order ownership.
- Cloudinary credentials remain server-side; uploads and downloads use controlled endpoints/signatures.
- CORS restricts browser origins allowed to call sensitive services.
- Admin, customer, and pharmacy roles have separate authorization paths.
- AI receives sanitized aggregated analytics rather than raw customer addresses.
- Narrative output is validated, and a deterministic fallback is available.
- n8n report delivery uses idempotency, leases, retry/recovery schedules, and delivery-status webhooks.
- Audit logs record important administrative mutations.

### Why this is better than a simple prototype

A simple FYP could place MongoDB and API credentials directly in every frontend. DawaConnect instead uses server-side APIs, signed access, separated roles, controlled media storage, and auditable state changes. These choices make the project closer to a deployable startup architecture.

---

## 31. Clearly identified future enhancement: shared medicine catalogue

This feature is planned and should not be presented as already implemented.

### Planned idea

- Create a curated catalogue of approximately 1,000 common medicines and pharmacy items in Pakistan.
- Store one standard image per product/variant in a dedicated Cloudinary product environment.
- Store catalogue metadata such as generic name, category, and unit in the backend database.
- When a pharmacy types a medicine name, show autocomplete suggestions.
- Selecting a catalogue medicine fills the standard image, category, and unit.
- The pharmacy can still edit the display name, category, and unit and must enter its own price and stock.
- Thousands of pharmacies would reuse one image reference instead of uploading thousands of copies of the same Panadol image.

### Expected advantage

- Consistent product imagery and naming
- Lower duplicated storage and upload effort
- Faster pharmacy inventory entry
- Better cross-pharmacy comparison and analytics

---

## 32. Overall comparison with the traditional approach

| Traditional approach | DawaConnect approach | Improvement |
|---|---|---|
| Call or visit pharmacies one by one | Search live inventory across approved pharmacies | Faster discovery and fewer unnecessary visits |
| Mixed multi-seller cart | Independent cart and order per pharmacy | Clear fees, responsibility, tracking, and chat |
| Delivery based only on current GPS or city text | User-selected destination coordinates plus pharmacy radius | Supports remote ordering and accurate eligibility |
| Phone/WhatsApp support disconnected from order | Authorized human chat tied to the order | Better context, privacy, and traceability |
| Manual pharmacy register/spreadsheet | Connected inventory and order control center | Shared, current operational data |
| Owner repeatedly checks for orders | Real-time in-app and Windows notifications | Faster response |
| Guess next month's stock | Demand calculations, forecasts, and validated AI narrative | Evidence-based planning |
| Anonymous reviews | Review available after a delivered registered order | More trustworthy feedback |
| Pharmacy publishes immediately | Admin approval and suspension controls | Greater platform trust |
| Admin changes without history | Permanent audit log | Accountability |
| Credentials inside desktop application | Desktop calls a secured backend API | Secrets are not distributed to users' computers |

---

# Part V — Recommended presentation storyboard

The reference presentation uses short text, one dominant screenshot, dark branded backgrounds, and occasional architecture/process slides. The following 28-slide structure gives DawaConnect the same rhythm without copying the reference content.

| Slide | Title | Main content | Recommended visual |
|---|---|---|---|
| 1 | DawaConnect | Connected medicine commerce and pharmacy intelligence | Logo, short tagline, dark blue-to-teal background |
| 2 | Why DawaConnect? | Availability uncertainty, fragmented ordering, manual pharmacy work | Three problem cards or realistic pharmacy/customer photo |
| 3 | One platform, three users | Marketplace, Pharmacy Desktop, Admin Portal | Three connected module cards |
| 4 | From search to delivery | Complete 10-step commerce flow | Simple horizontal process diagram |
| 5 | Secure access without unnecessary friction | Google, OTP, session, guest checkout | Authentication screenshot |
| 6 | Search real pharmacy stock | Product discovery, pagination, voice search | Marketplace search screenshot |
| 7 | Choose the right pharmacy | Delivery eligibility, distance, total checkout cost | Search/delivery tags screenshot |
| 8 | One pharmacy, one cart, one order | Independent carts and transparent fees | All Carts screenshot |
| 9 | Deliver here—not only where I am | Current or remote destination and radius check | Checkout location screenshot |
| 10 | Track and control the order | Status timeline and cancellation rules | Tracking screenshot plus tiny state diagram |
| 11 | Human support inside the order | Text/image chat, signed-in and guest access | Customer and pharmacy chat screens |
| 12 | Find Care near you | Pharmacies, hospitals, clinics, filters, directions | Wide healthcare map screenshot |
| 13 | Focused health AI, not a general chatbot | Scope, models, limits, images, prescriptions, safety | AI assistant screenshot plus fallback strip |
| 14 | A useful customer portal | Orders, addresses, saved products, settings | User Portal overview screenshot |
| 15 | Private prescription library | 15-file limit, Cloudinary, AI selection | Prescription page and assistant selector |
| 16 | Trust after delivery | Verified reviews and complaint threads | Review dialog and pharmacy ratings |
| 17 | Register a real pharmacy location | Email verification, map pin, documents, photos, approval | Registration map screenshot |
| 18 | Pharmacy operations at a glance | Live dashboard metrics and recent work | Pharmacy dashboard screenshot |
| 19 | Inventory connected to customers | Product CRUD, stock, low-stock and expiry awareness | Inventory screenshot |
| 20 | Process every order clearly | Order states, details, chat, cancellation request | Pharmacy order center screenshot |
| 21 | Never miss a new order | Real-time sync, Windows alerts, tray/background mode | Notifications screenshot |
| 22 | Understand the month | Revenue, units, demand, product and city-zone analysis | Analytics screenshot |
| 23 | From numbers to an action plan | Deterministic calculations plus validated AI narrative | Hybrid AI architecture diagram |
| 24 | Reports arrive automatically | PDF, Excel, n8n, Oracle, Resend, retry/recovery | Automation pipeline diagram |
| 25 | Govern the platform | Admin dashboard, customers, orders, pharmacy oversight | Admin dashboard screenshot |
| 26 | Approvals, complaints, and accountability | Pharmacy approval, moderation, audit log | Admin approval/audit collage |
| 27 | Technology and data architecture | Frontends, APIs, MongoDB, Socket.IO, Cloudinary, external services | Clean architecture diagram |
| 28 | Why DawaConnect matters | Benefits, future shared medicine catalogue, closing | Impact statements and logo |

### Optional final viva slide

Add a hidden or appendix slide named **Technical Decisions & Limitations** containing current exclusions: no online payment gateway, no profit calculation, no supplier lead-time model, no automated prescription approval, and shared medicine catalogue still in development. This demonstrates honest engineering scope control during questioning.

---

## 33. Screenshot and image checklist

Use real, current screenshots wherever possible. Before capturing, use test data that contains no real patient, address, secret, API key, or private prescription information.

### Marketplace screenshots

- Home page and main search
- Search results with deliverable/outside-radius tags
- All Carts page
- Checkout destination and cost summary
- Order tracking and cancellation control
- Live chat with a harmless sample image
- Find Care map with filters
- AI assistant with image/prescription selector
- User Portal, Saved Items, My Prescriptions, and review dialog

### Pharmacy Desktop screenshots

- Registration map pin and details
- Dashboard
- Inventory and Add New Medicine modal
- Order detail/status controls
- Live Customer Chat with attachment button
- Notifications and desktop preferences
- Monthly Analytics and AI recommendation report
- Reviews & Ratings
- Pharmacy Profile photos

### Admin screenshots

- Admin dashboard
- Pharmacy approvals/detail drawer
- Orders oversight
- Customers page
- Complaints inbox
- Audit Log

### Non-screenshot visuals

- DawaConnect logo and desktop icon
- One tasteful photograph of a Pakistani pharmacy counter/customer interaction
- Custom diagrams for module flow, architecture, hybrid analytics, and monthly automation
- Avoid generic American hospital imagery, excessive medical crosses, or random pill photos that do not match the product UI

---

## 34. DawaConnect presentation design system

### Format

- 16:9 widescreen
- 28 main slides
- Dark section-opening slides and lighter screenshot-focused feature slides
- Maximum three concise benefit points on most feature slides
- Large readable headings and short supporting sentences

### Suggested colours

- Deep navy: `#14265C`
- DawaConnect blue: `#1D4ED8`
- Teal: `#0D9488`
- Bright cyan accent: `#5EEAD4`
- Off-white: `#F8FAFC`
- Slate text: `#334155`
- Amber warning/highlight: `#F59E0B`
- Red only for errors/cancellations: `#EF4444`

### Typography

- Headings: **Poppins**, **Aptos Display**, or **Montserrat**
- Body: **Inter**, **Aptos**, or **Calibri**
- Use bold numbers and short labels rather than long paragraphs on slides

### Visual style

- Use rounded screenshot frames with subtle shadows.
- Add faint contour/map lines, network nodes, or pill-shaped gradients to dark backgrounds.
- Use one dominant screenshot on most feature slides.
- Use thin connectors and simple outlined icons.
- Keep generous empty space; do not fill every corner.
- Maintain consistent slide numbers and section labels.

### Minimal animation rules

- Use **Fade** as the default transition, 0.3–0.5 seconds.
- Use **Morph** only for the end-to-end workflow, map journey, or architecture progression.
- Fade the headline and screenshot together; reveal the three benefit points as one group or in one short sequence.
- Do not use bounce, spin, fly-in from multiple directions, sound effects, or continuous motion.
- Do not animate tables row by row.
- Keep all automatic transitions disabled so the presenter controls the pace.

---

# Part VI — Master prompt for generating the presentation

Copy the following prompt into a presentation generator such as Microsoft PowerPoint Copilot, Canva, Gamma, Beautiful.ai, or another model that supports slide generation. Attach this document and the current application screenshots when the tool allows file uploads.

```text
Create a professional 16:9 final-year-project presentation titled:

“DawaConnect — Connected Medicine Commerce, Pharmacy Operations, and Intelligent Analytics”

Audience:
- University FYP evaluators, software engineering faculty, healthcare/pharmacy stakeholders, and early-stage startup reviewers in Pakistan.

Primary objective:
- Explain the real implemented DawaConnect system clearly.
- Demonstrate how the Marketplace, Pharmacy Desktop Application, Admin Portal, shared backend, live chat, maps, AI assistant, and pharmacy recommendation system form one connected workflow.
- For every major feature, state why it improves on the traditional phone-call, physical-visit, spreadsheet, or disconnected-app approach.

Important source rule:
- Treat the attached DawaConnect feature document as the factual source of truth.
- Treat PAKFASAL_v4.pptx only as a visual and pacing reference. Do not copy its agricultural content, wording, logo, screenshots, or green branding.
- Do not invent DawaConnect features, statistics, partnerships, clinical outcomes, users, revenue, medicine data, or regulatory approvals.
- Clearly label the shared standardized medicine-image catalogue as “Planned / Future Enhancement,” not implemented.

Design direction:
- Create a modern DawaConnect identity using deep navy (#14265C), strong blue (#1D4ED8), teal (#0D9488), cyan accent (#5EEAD4), off-white (#F8FAFC), and slate (#334155).
- Use dark blue-to-teal section backgrounds with subtle topographic/map contour lines, network connections, and soft medical-commerce shapes.
- Use Poppins or Montserrat for headings and Inter or Aptos for body text.
- Maintain generous whitespace, rounded screenshot frames, subtle shadows, thin outlined icons, and high contrast.
- Do not use a red-cross-heavy design or generic hospital template.
- Use authentic Pakistani context where a supporting photo is needed.

Content density:
- Create 28 main slides.
- Each normal feature slide should have one strong headline, one short explanatory sentence, and no more than three concise benefit points.
- Put detailed technical explanation in speaker notes, not crowded slide paragraphs.
- Use one large real application screenshot on most feature slides. Do not fabricate UI screenshots when supplied screenshots exist.
- Use clean diagrams on workflow and architecture slides.

Required slide sequence:
1. Title — DawaConnect, tagline “Search. Connect. Deliver. Improve.”
2. Why DawaConnect? — medicine availability uncertainty, fragmented ordering, manual pharmacy work.
3. One platform, three users — Marketplace customer, pharmacy owner, administrator.
4. End-to-end workflow — verified pharmacy to live inventory to search to one-pharmacy cart to checkout to fulfilment to chat to delivery to review to analytics.
5. Secure access — Google Identity, five-minute email OTP, server session, and guest checkout.
6. Live product search — real approved pharmacy inventory, pagination, recent and voice search.
7. Delivery-aware choice — selected destination, delivery radius, distance, closed/outside-radius labels, and optimal pharmacy recommendation.
8. Independent carts — one pharmacy equals one cart and one order; transparent delivery plus Rs 9 processing and no pharmacy tax.
9. Flexible checkout — current location or a different home/office/city with coordinate-based validation.
10. Tracking and cancellation — direct cancellation before confirmation with stock restoration; chat request during Confirmed/Packed; no request after Dispatched/Delivered.
11. Human live order chat — text and images, customer and pharmacy, guest 15-day retention, read-only after terminal status.
12. Find Care map — registered pharmacies plus external pharmacies, hospitals, and clinics; filters, radius up to 50 km, and directions.
13. Focused AI assistant — medicine/health/pharmacy scope, 20 questions/day, 6 images/day, 2 images/message, prescription selection, safe educational boundaries, and multi-model fallback.
14. User Portal — orders, addresses, saved items, complaints, identity settings.
15. Private prescriptions — maximum 15, Cloudinary storage, preview/delete, use in AI assistant.
16. Verified trust — delivered-order reviews and traceable complaint threads.
17. Pharmacy registration — OTP, documents, compulsory map point, exact coordinates, optional inside/outside photos, admin approval.
18. Pharmacy dashboard — live operational summary.
19. Inventory workspace — product CRUD, stock, low-stock threshold, expiry awareness, Marketplace synchronization.
20. Order control — status workflow, customer/order details, chat, and cancellation request handling.
21. Notifications — Socket.IO, in-app unread counts, Windows toast, sound, tray/background mode.
22. Monthly analytics — revenue, delivered orders, units, demand, product performance, forecast, and privacy-qualified city opportunities.
23. Hybrid AI recommendation — deterministic numbers, sanitized facts, Groq narrative, schema validation, evidence, and deterministic fallback.
24. Automated reports — PDF/Excel, n8n on Oracle VM, PostgreSQL, Caddy HTTPS, Resend email, idempotency and retry/recovery.
25. Admin operations — dashboard, customers, pharmacies, orders, and cross-module oversight.
26. Trust and governance — pharmacy approval/rejection/suspension, complaints, admin roles, and audit log.
27. Technology architecture — Next.js/Vercel Marketplace, Electron Pharmacy app, React/Vercel Admin, Express/Socket.IO on Render, MongoDB Atlas, Cloudinary, Geoapify/maps, Groq, Resend, and n8n/Oracle.
28. Impact and roadmap — summarize benefits, show the planned shared medicine catalogue, and close with “DawaConnect: one connected journey from medicine search to smarter pharmacy decisions.”

Traditional comparison requirement:
- On relevant slides, include a compact “Before DawaConnect / With DawaConnect” contrast.
- Examples: phone calls versus live search; mixed seller order versus pharmacy-specific cart; current GPS only versus selected delivery destination; WhatsApp versus order-authorized chat; spreadsheets versus synchronized inventory; guesswork versus calculated forecasts; anonymous reviews versus verified delivered-order reviews.

Technical accuracy requirements:
- Marketplace AI text models: openai/gpt-oss-20b, qwen/qwen3.6-27b, openai/gpt-oss-120b, qwen/qwen3.8-27b.
- Vision fallback models: qwen/qwen3.6-27b and qwen/qwen3.8-27b.
- Pharmacy analytics narrative currently defaults to Groq openai/gpt-oss-20b.
- The AI assistant provides educational information and must not be described as a doctor, diagnosis engine, or prescription service.
- The live order chat is human-to-human and contains no AI agent.
- DawaConnect currently uses a Rs 9 processing charge and no pharmacy tax.
- Do not claim profit calculation, supplier lead-time prediction, damaged/expired loss accounting, online payment, or completed shared medicine catalogue.

Animation and transition rules:
- Use a subtle Fade transition across most slides, 0.3 to 0.5 seconds.
- Use Morph only for the workflow, map journey, and architecture progression.
- Reveal a headline, screenshot, and maximum three benefit points with one calm sequence.
- No bounce, spin, zoom bursts, sound, looping animation, or decorative motion.
- Slides advance manually.

Image rules:
- Prioritize supplied DawaConnect screenshots.
- Crop screenshots cleanly and preserve readable UI.
- Use no screenshots containing API keys, environment variables, passwords, real private addresses, or real prescriptions.
- Use only one or two supporting stock photographs in the entire deck.
- Use icons and diagrams for the rest.

Speaker notes:
- Add 60–120 words of speaker notes to each slide.
- Speaker notes should explain how the feature works, how modules exchange data, and why the design decision is better than the traditional process.
- On architecture slides, explain server-side secret management and why the Electron application calls an API rather than connecting directly to MongoDB.

Final quality checks:
- Correct spelling: DawaConnect, Marketplace, pharmacy, prescription, longitude, latitude, recommendation.
- Keep headings concise and benefit-focused.
- Ensure screenshots are not stretched.
- Ensure every feature is described as implemented, planned, or intentionally out of scope.
- End with a confident but evidence-based conclusion, not fabricated business metrics.
```

---

## 35. Shorter prompt when the presentation tool has a small prompt limit

```text
Generate a modern 28-slide, 16:9 FYP presentation for “DawaConnect — Connected Medicine Commerce, Pharmacy Operations, and Intelligent Analytics.” Use the attached DawaConnect feature document as factual truth and PAKFASAL_v4.pptx only as a visual/pacing reference. Use deep navy, DawaConnect blue, teal, cyan, off-white, subtle contour/network backgrounds, rounded real screenshots, generous whitespace, and at most three short benefits per feature slide.

Cover: problem; three connected modules; end-to-end workflow; Google and OTP auth plus guest checkout; live product search and delivery-aware optimal pharmacy; independent per-pharmacy carts/orders; remote destination checkout; tracking and cancellation; human text/image order chat; Find Care healthcare map; scoped multi-model health AI with daily limits and prescriptions; User Portal; saved items; verified reviews/complaints; pharmacy map-based registration and approval; dashboard; inventory; orders; Windows notifications; monthly analytics/forecasting; deterministic calculations plus validated Groq narrative and fallback; PDF/Excel reports; n8n/Oracle/Resend monthly automation; Admin dashboard, approvals, moderation and audit; architecture; security; impact and future shared medicine catalogue.

On relevant slides include “Traditional approach vs DawaConnect.” Use Fade transitions (0.3–0.5 sec), Morph only for workflow/map/architecture, no flashy animation. Do not invent metrics or features. Label the shared medicine-image catalogue as planned. The AI is educational, not diagnostic; live order chat is human-only; processing is Rs 9 with no pharmacy tax. Add concise speaker notes explaining each feature and its advantage.
```

---

## 36. Recommended closing statement

> DawaConnect is not only an online medicine catalogue. It is a connected operational system in which approved pharmacy inventory becomes customer-searchable, each pharmacy owns its own order, delivery is validated against the customer's chosen destination, both parties communicate inside the order, administrators preserve trust, and measured sales become practical pharmacy recommendations.

