# Card Show Booking Platform — Architecture & Data Model

## 1. System Overview

A multi-tenant web application supporting four personas: **Organiser**, **Vendor**, **VIP Pass Buyer**, and **General Attendee**. The core mechanic is a floorplan-based booth inventory system with configurable pricing, add-ons, and equipment allocation.

### Recommended stack
- **Frontend:** React (Next.js), built **mobile-first** — every persona (admin, organiser, vendor) primarily uses this on a phone, so layouts, navigation, and forms are designed for a small touch screen first and scaled up for desktop, not the other way around. Concretely: single-column layouts, bottom or hamburger navigation instead of sidebars, large tap targets (44px+), and data-heavy screens (application lists, payment verification queue) rendered as stacked cards rather than wide tables that force horizontal scrolling.
- **Floorplan tool on touch screens:** this is the one feature that genuinely needs extra design attention on mobile. Precisely dropping/dragging a pin, or resizing an island sub-slot, is much harder with a finger than a mouse cursor. Plan for: pinch-to-zoom and pan on the floorplan image, a "confirm placement" step after dropping a pin (rather than relying on drag precision alone), and a numeric nudge control (small arrow buttons to fine-tune position) as a fallback for fiddly adjustments.
- **Backend:** Node.js/TypeScript (NestJS or Express) or a BaaS like Supabase if you want to move faster and defer custom backend work.
- **Database:** PostgreSQL — relational integrity matters here (booth locking, inventory counts, group applications all need transactional guarantees).
- **Auth:** Supabase Auth / Auth0 / Clerk — supports role-based access (organiser vs. vendor vs. attendee) out of the box.
- **Payments (Day 1):** no payment gateway integration. Each `Organiser`/`Show` provides free-text payment instructions (bank transfer, PayNow, Wise, etc.) shown to the vendor at the point they owe money; the vendor uploads a payment proof (screenshot/receipt), and organiser staff manually verify it against their own bank/Wise records before the booth flips to `confirmed`. Stripe (or similar) is a sensible **Phase 2** addition once the manual flow is proven and volume justifies automating it — it slots in later without changing the surrounding application/booth state machine.
- **Floorplan rendering (Day 1):** organiser uploads a floorplan **image** (photo, PDF export, or venue-provided map); booths are represented as **tagged points/hotspots** overlaid on that image using percentage-based (x%, y%) coordinates, not a full drag/draw grid builder. This is a much smaller build — an image-annotation UI (think "tag a person in a photo") rather than a CAD-like builder. Vendors see the same image with clickable pins showing availability. Polygon/shape-based booth outlines can be layered in later without changing the underlying booth-availability logic.
- **Realtime booth locking:** Postgres row locking + a short-lived "hold" (e.g., 10-minute reservation) enforced via a `held_until` timestamp, or a lightweight realtime layer (Supabase Realtime / WebSockets) so vendors see live availability.
- **Multi-tenancy:** row-level organiser scoping in Postgres (an `organiser_id` on every organiser-owned table, enforced via Postgres Row-Level Security) rather than separate databases per organiser — simplest to operate for a platform hosting many organisers' shows over time.

---

## 2. Core Entities & Relationships

```
Organiser (Organisation — the entity running shows)
 ├── staff Users (organiser staff accounts, e.g. admin/coordinator roles within this organisation)
 └── Show (1:many)

User  [ONE account per person, platform-level — backed by Supabase Auth, works across every role]
 ├── profile: name, contact_email, phone  (shared regardless of which roles this person holds)
 └── UserRole (1:many — a single person can hold multiple roles at once, e.g. vendor AND attendee)

UserRole
 ├── user_id
 ├── role: `platform_admin | organiser_staff | vendor | attendee`
 ├── organiser_id (nullable — set only for `organiser_staff`, scoping which organiser they belong to; every other role is platform-wide)
 └── granted_by, granted_at  — `vendor`/`attendee` are self-serve at signup; `platform_admin`/`organiser_staff` are only ever granted by an existing admin/organiser, never self-selected

VendorFieldPolicy  [set by a user holding the platform_admin role — not editable by organisers]
 ├── field_name (e.g. business_name, contact_email, phone, mailing_address, tax_id, bank/payment_details, past_application_history)
 └── default_visibility: `hidden_from_other_organisers | visible_to_all_organisers | platform_admin_only`

VendorFieldConsent  [per-vendor override, optional]
 ├── user_id, organiser_id, field_name
 └── granted (bool) — lets a vendor explicitly share a field with a specific organiser even if the platform default hides it (e.g. "share my show history with this organiser")

Show
 ├── organiser_id
 ├── active_floorplan_version_id
 ├── payment_instructions (free text — bank/PayNow/Wise details shown to vendors/buyers when payment is owed)
 ├── FloorplanVersion (1:many — full history, only one is "active" at a time)
 ├── BoothType (1:many)
 ├── ReleasePhase (1:many)  [controls when/how booths become bookable]
 ├── Booth (1:many) ──> BoothType (many:1)
 │                 └──> BoothGroup (many:1, nullable — for islands)
 ├── AddOn (1:many)
 ├── InventoryItem (1:many)  [tables, chairs, etc.]
 ├── PassType (1:many)  [vendor / VIP / attendee]
 └── Application (1:many)

BoothType
 ├── category: `island | standard | corner`  (drives which application/allocation flow a Booth of this type uses)
 ├── base_price, dimensions, default_inventory, default_passes_included
 └── island_layout_template (nullable — only set when category=island; JSON array of default sub-zone shapes)

ReleasePhase
 ├── show_id, name
 ├── ReleasePhaseAssignment (1:many — explicit picks: this phase includes Booth X, Booth Y, Island Z, selected by their `organiser_ref`, not just "all booths of type standard")
 ├── starts_at, ends_at
 ├── allocation_mode: `immediate_selection | organiser_allocated`
 └── selection_fee_amount  (only charged when allocation_mode = immediate_selection)

ReleasePhaseAssignment
 └── phase_id, booth_id (nullable) or booth_group_id (nullable) — one of the two is set per row

FloorplanVersion
 ├── show_id, image_url, uploaded_at, uploaded_by
 └── status: `draft (being reconciled) | active (live) | archived (superseded)`

Booth  [the atomic allocatable unit — a standalone standard/corner booth, OR one sub-slot within an island]
 ├── booth_type_id, release_phase_id (nullable until released)
 ├── organiser_ref  (organiser-defined unique code per show, e.g. "A1", "CORNER-04" — what the phase-assignment and manual-assignment tools key off of)
 ├── parent_group_id (nullable — set when this Booth is a sub-slot inside an island)
 ├── map_x, map_y, map_width, map_height  (width/height optional — points for standard booths, areas for island footprints/sub-zones)
 ├── layout_source: `template | custom`  (whether a sub-slot still matches the island's default layout or was repositioned by its subvendor)
 └── status: `available | held | pending_payment | confirmed | blocked`

BoothGroup ("Island")
 ├── organiser_ref  (organiser-defined unique code per show, e.g. "ISLAND-3")
 ├── footprint (area tagged on the main floorplan — the island's overall bounds)
 ├── island_layout_template (copied from BoothType at creation; defines default sub-zone count/shapes)
 ├── Booth (1:many — the generated sub-slots)
 ├── BoothGroupMembership (1:many)
 └── status: `forming | complete | primary_dropped (flagged for organiser intervention) | expired`

BoothGroupMembership
 ├── island_group_id, user_id  (a User holding the `vendor` role)
 ├── role: `primary (coordinator, assigns slots, pays for the island) | sub (assigned occupant — manages own booth content, not position/payment)`
 └── joined_at, invited_by, assigned_booth_id (nullable until primary assigns them a sub-slot)

Application
 ├── applicant_user_id  (a User currently holding the `vendor` role)
 ├── ApplicationBooth (many:many join — one or more Booth rows: multiple standard/corner booths, or a single island sub-slot)
 ├── preferred_booth_ids (nullable — ranked preferences, used only when allocation_mode = organiser_allocated and no booth_id is set yet)
 ├── selected AddOns (many:many)
 ├── requested PassType allocations
 ├── status (pending / awaiting_allocation / approved / rejected / awaiting_payment / confirmed)
 ├── assigned_manually_by (nullable — organiser staff user, set when an organiser directly assigns a booth outside the normal phase flow)
 └── PaymentRecord (1:1 or 1:many)

VendorProfile  [extra fields that only exist once a User holds the `vendor` role — business info, not needed for attendee-only users]
 ├── user_id
 ├── business_name, tax_id, mailing_address, bank/payment_details, etc.  (these are exactly the fields VendorFieldPolicy/VendorFieldConsent govern visibility for)
 ├── Application (1:many, spans multiple organisers/shows — reused every time this person applies, no re-entry)
 └── PassAssignment (1:many)

PassAssignment
 ├── PassType
 ├── owner: user_id  (any User — the `vendor`/`attendee` role determines how they got it, but ownership is just a User reference)
 └── linked_booth_id (nullable — vendor passes tie back to a booth)

InventoryItem
 ├── name (table, chair, power outlet, etc.)
 ├── total_quantity
 ├── allocated_per_booth_type (default allocation)
 └── AllocationRecord (many:many via Booth)

PaymentRecord
 ├── amount, currency
 ├── method: `manual (bank transfer / PayNow / Wise / other, per organiser's own instructions)`
 ├── proof_url (vendor-uploaded screenshot/receipt)
 ├── status: `awaiting_proof | proof_submitted | verified | rejected | waived`
 ├── verified_by, verified_at  (organiser staff who manually checked it against their own bank/Wise records)
 ├── waived_by, waived_at, waived_reason  (nullable — set when organiser comps the charge entirely, e.g. sponsor booths, promotional slots)
 └── linked Application or PassAssignment
```

### Key field notes
- **Booth.status**: `available | held | pending_payment | confirmed | blocked`
- **Booth.held_until**: nullable timestamp — clears the hold if a vendor abandons checkout.
- **Booth.map_x / Booth.map_y**: percentage coordinates (0–100) locating the booth's pin on the active `FloorplanVersion`, so the tag position stays correct regardless of image display size. Islands additionally use `map_width`/`map_height` since they occupy an area, not a point. **Booth.map_label** holds the visible booth number/name on the pin.
- **BoothGroup.status**: an island only becomes `confirmed` once all member sub-slots are filled or a deadline is reached (configurable: strict-all-or-nothing vs. partial-fill-allowed).
- **BoothType.applicable_pass_types**: defines how many vendor passes a booth of this type grants by default, and whether extra passes can be purchased as an add-on.
- **ReleasePhase.allocation_mode**: `immediate_selection` lets a vendor click an available booth and be allocated on the spot (paying `selection_fee_amount` on top of the booth price); `organiser_allocated` lets vendors apply/express interest, and the organiser manually assigns specific booths once the phase's `ends_at` passes.
- **Island payments**: an island's `ApplicationBooth` join links a single `Application` (owned by the `primary` member) to *all* the island's sub-slot Booths, and its `PaymentRecord` covers the whole island. Subvendors never generate their own Application/PaymentRecord for the booth itself — they're `BoothGroupMembership` rows the primary manages.
- **Refunds**: no automated refund engine in v1 — `PaymentRecord.status` includes a `refunded` value the organiser sets manually, but calculating amounts/eligibility is a per-organiser policy decision handled outside the system, not something the platform enforces.
- Every organiser-owned table (Show, Booth, Application, etc.) carries an `organiser_id`, either directly or via its parent Show — this is what Postgres RLS policies key off of.

---

## 3. Persona → Module Mapping

**One signup/login for everyone.** There's a single `User` account and auth flow (via Supabase Auth) shared by all five personas — signup collects just name, email/phone, and password. What someone can *do* is entirely governed by which `UserRole` rows they hold, not which account type they created. In practice: at signup, a person picks "I'm a vendor" or "I'm attending as a guest," which self-grants the corresponding role and (for vendors) creates a `VendorProfile`. `organiser_staff` and `platform_admin` are never self-selected — they're granted by an existing admin/organiser via invite. A person can hold more than one role on the same account at once — e.g. run their own shows as `organiser_staff` *and* apply as a `vendor` to someone else's show — without creating a second account.

**Role switcher (UI implication):** since a person can hold multiple roles, the mobile app needs a lightweight context switcher — e.g. a profile menu showing "Vendor" / "Organiser: [organiser name]" as tappable contexts — rather than assuming one dashboard per account. Whichever context is active determines what the bottom nav and home screen show. If someone holds only one role, this is invisible (no switcher needed, they just land in that context).

### Platform Admin Console (new — app-level, above all organisers)
- Organiser onboarding/offboarding, billing/plan management per organiser
- **Vendor field-sharing policy editor**: toggle each vendor profile field between hidden-from-other-organisers / visible-to-all-organisers / admin-only — this is the single source of truth every organiser's view of a vendor is filtered through
- View/audit vendor consent overrides
- Platform-wide reporting (across all organisers)

### Organiser Console
- Show setup wizard (dates, venue, floorplan image upload, payment instructions text)
- Booth type editor (name, category [island/standard/corner], base price, dimensions, default inventory, default passes included; island types also define a default sub-zone layout template)
- Floorplan tagging tool — click a point on the uploaded image to drop a standard/corner booth pin, or draw an area for an island footprint (auto-generates sub-slot pins from that booth type's layout template); edit/drag pins afterward
- Release phase manager — group booths (by type or hand-picked) into phases with a start/end window and choose `immediate_selection` (+ selection fee) or `organiser_allocated` per phase
- Manual allocation screen — for organiser-allocated phases, review submitted applications/preferences once the phase closes and assign each to a specific booth
- **Direct booth assignment** — organiser can assign any booth (by its `organiser_ref`) to a vendor at any time, bypassing the normal phase/application flow entirely (e.g. sponsor placements, VIP vendor relationships, fixing a mistake)
- **Fee waiver** — organiser can mark any application's payment as `waived` with a reason, skipping the proof-upload step entirely
- **Payment verification queue** — review each submitted payment proof against the organiser's own bank/Wise records, mark `verified` or `rejected` with a note
- Add-on manager (e.g., "corner booth fee," "electricity fee") with pricing rules
- Inventory manager (set total tables/chairs available, track allocation vs. remaining)
- Application review queue (approve/reject, manual overrides)
- Reporting dashboard (revenue, booth occupancy %, outstanding payments, pass sales)

### Vendor Portal
- Signup/login (self-grants the `vendor` role on your account, creates a `VendorProfile`)
- Browse show floorplan — live pin status, filter by booth type, greyed-out until a booth's `ReleasePhase` is open
- **Immediate-selection phases**: click an available booth (standard/corner) → pay booth price + selection fee → instantly allocated
- **Organiser-allocated phases**: submit an application with ranked booth preferences → wait for organiser to assign a specific booth after the phase closes → pay once assigned
- **Island application (as primary/coordinator)**: claim an island footprint, pay for the whole island up front, invite subvendors, and assign each one to a specific sub-slot (drag-to-assign on the island layout); monitor overall fill status
- **Island application (as subvendor)**: accept an invite from a primary vendor, manage own booth content/info within the sub-slot assigned to you — position and payment are handled by the primary, not self-service
- Select add-ons during application
- Request vendor passes (bounded by booth type's allowance + purchasable extras)
- Application status tracker + **payment instructions display + proof upload** (screenshot/receipt against the organiser's stated bank/PayNow/Wise details)
- View/download confirmed booth details, pass QR codes

### VIP Pass Sales
- Public storefront page per show
- Tiered pass selection (price, perks, quantity limits)
- Signup (self-grants the `attendee` role — no separate profile table needed, the base User record is enough) or guest checkout, then payment instructions + proof upload (same manual flow as vendors for Day 1)
- Pass delivery (QR code / ticket record) issued once organiser verifies proof

### General Attendee
- Lightweight signup (or guest) + free/paid ticket selection
- Same ticketing infrastructure as VIP, different PassType tier

---

## 4. Multi-Tenancy Model

Since the platform will host a sequence of events (major shows ~6 months apart, with smaller shows interspersed) and let vendors reuse the same account across all of them, tenancy works at two levels:

- **Organiser (Organisation)**: the entity running shows — owns Shows, staff accounts, branding, and payout settings. An organiser can run any number of shows over time (`Show.organiser_id`), so a "major show" and its interspersed "smaller shows" are just multiple Show rows under the same organiser, ordered by date. No separate "series" entity is needed for Day 1 — it can be added later purely as a reporting/grouping convenience if needed.
- **Every `User` is platform-level; only the `organiser_staff` role is organiser-scoped**: a vendor (or attendee) signs up once and can apply to any show, across any organiser, without re-entering their business profile — because their role, not a separate account type, determines what they can do. This is what makes "vendors reuse the application" work — their `VendorProfile`, application history, and pass history persist across events on the one account. `organiser_staff`, by contrast, always carries an `organiser_id` on its `UserRole` row, so that role only grants access within one organiser.
- **Data isolation**: enforced via `organiser_id` + Postgres Row-Level Security, so a user acting under an `organiser_staff` role only ever sees their own organiser's shows/applications/payments, while vendor-facing queries span organisers (a vendor's own applications list can show entries from multiple organisers).
- **Organiser staff access** is scoped per `UserRole.organiser_id`, so a support person granted `organiser_staff` for Organiser A can't see Organiser B's data even if they later also apply as a vendor somewhere else — the role, not the account, carries the boundary.
- **Field-level vendor data sharing**: when Organiser A views a vendor's profile or application, the API response is filtered through `VendorFieldPolicy` (platform-wide default per field, set only by the Platform Admin) plus any `VendorFieldConsent` the vendor granted specifically to that organiser. In practice this means a single "get vendor profile" query always runs through a permission filter before returning fields — never returning the raw row. This also matters for Singapore's PDPA: the vendor's consent trail (who can see what) needs to be auditable, not just enforced.

---

## 5. Floorplan Versioning & Booth Persistence

**The `Booth` row is always the source of truth — never the image.** Booth number, type, island grouping, status, and every application/payment tied to it live independently of which image is currently displayed. Re-uploading a floorplan image never deletes or orphans a booth.

What re-uploading *does* trigger is a **reconciliation pass**, because a booth's `map_x`/`map_y` were tagged against a specific image:

1. Organiser uploads a new image → creates a new `FloorplanVersion` with status `draft`. The currently-live version stays `active` and untouched — vendors keep seeing the old one throughout.
2. The tagging tool overlays all existing booth pins (at their existing % coordinates) on top of the new draft image, so the organiser can see at a glance whether anything drifted.
3. Organiser goes through and, per pin: confirms it's still correctly placed, drags it to the correct spot, or marks the booth as removed (only allowed if it has no active application — otherwise it's flagged for manual resolution rather than silently deleted).
4. Only when the organiser explicitly **publishes** the draft does it flip to `active` (and the previous version flips to `archived`, kept for history — not deleted, since a booth's position at the time a vendor applied is part of the record).

This means: a cosmetic re-upload (same layout, better scan quality) is a fast rubber-stamp reconciliation. A structural change (booths added/moved/removed) forces the organiser to consciously touch every affected pin rather than accidentally shipping a floorplan where booth 12's pin is now sitting on top of booth 15.

---

## 6. Islands (Primary + Subvendors) & Phased Release

### Islands
An island is tagged on the floorplan as one **area** (not a point) via `BoothGroup.footprint`. When an organiser creates it, the island's `BoothType.island_layout_template` (a default arrangement, e.g. "4 equal quadrants" or "6 wedges") auto-generates that many `Booth` sub-slots, each positioned relative to the island's footprint with `layout_source = template`.

- The **primary vendor** claims the island, pays for the entire island up front (one `Application`, one `PaymentRecord` covering every sub-slot), and has full control over assignment — inviting subvendors and dragging each one onto a specific sub-slot. The system still enforces that no sub-slot extends past the island's footprint or overlaps another, but *who* goes *where* is entirely the primary's call, not the subvendor's.
- **Subvendors** accept an invite and manage their own booth content within whatever slot the primary assigns them — they don't independently apply, pay, or reposition their slot.
- **If the primary drops out**, the island doesn't auto-cancel or auto-promote a subvendor — `BoothGroup.status` flips to `primary_dropped` and surfaces on the organiser's review queue for manual resolution (reassign a new primary, cancel and re-release the island, refund at the organiser's discretion, etc.). There's no automated refund calculation in v1 — refund policy is entirely organiser-controlled and handled outside the system.

### Phased Release
Booths don't all become bookable at once. Every `Booth` and `BoothGroup` (island) carries an organiser-defined `organiser_ref` (e.g. "A1", "ISLAND-3") — the organiser picks specific ones by that reference and assigns them into a `ReleasePhase` (via `ReleasePhaseAssignment`), rather than the system releasing "all standard booths" as a block. This means an organiser can, say, release booths A1–A20 in phase 1 and hold B1–B20 back for phase 2, even if they're the same booth type. Each phase has a time window and one of two allocation modes:

- **`immediate_selection`**: the floorplan behaves like ticket-selling seat maps — a vendor sees live availability, clicks an open booth, and is allocated on the spot (booth flips to `held`/`pending_payment` immediately, reserving it for them), paying the booth price plus the phase's `selection_fee_amount` via the manual proof-upload flow. Requires the same short-hold-then-confirm mechanic already planned for booth locking, with the hold extended long enough to realistically complete a bank transfer rather than the few minutes a live checkout would need.
- **`organiser_allocated`**: vendors don't see exact booth positions to claim — they submit an `Application` with optional ranked `preferred_booth_ids`, and no `Booth` is attached yet. Once `ReleasePhase.ends_at` passes, the organiser works through the manual allocation screen, assigning each application to a specific booth (informed by, but not bound to, stated preferences). Only then does payment get requested.

A single show can run both simultaneously on different booth subsets — e.g., islands released as `organiser_allocated` (since coordination matters more than speed) while standard booths open as `immediate_selection` once islands are locked in.

**Adjacency for multi-booth normal vendors**: a vendor applying for several standard/corner booths together has no adjacency guarantee under `organiser_allocated` — placement is entirely the organiser's discretion. To *guarantee* adjacent booths, the vendor pays `selection_fee_amount` per booth and self-selects them via an `immediate_selection` phase, picking physically adjacent booths themselves on the floorplan. This reuses the exact same mechanic as the two allocation modes above — no separate "adjacency" flag needed in the data model.

**Organiser override path**: both allocation modes are the *default* vendor-facing flow, not the only path. An organiser can, at any point, directly assign a specific booth to a vendor by its `organiser_ref` (regardless of what phase it's in or whether it's even released yet) and mark that application's fee as `waived` — useful for sponsor placements, VIP relationships, or correcting a mistake, without needing to route it through a release phase or the payment-proof flow at all. This should log who did it and why (ties into the `AuditLog` from the Platform Admin section), since it's a real permission bypass and worth being able to explain later.

---

## 7. Key Flows Worth Designing Carefully

1. **Booth hold → payment → confirm**: prevent double-booking with a short reservation window during checkout.
2. **Island group formation**: lead vendor creates/claims an island, invites others via email/link, group locks in once full or expires and releases held booths.
3. **Pass allocation tied to booth type**: e.g., a "double booth" might include 2 vendor passes by default, with extras purchasable — this needs to be a rule engine, not hardcoded.
4. **Inventory decrement**: when a booth is confirmed, tables/chairs allocated to it are deducted from the show's total pool; organiser dashboard shows remaining stock in real time.
5. **Payment reconciliation (Day 1 = manual)**: vendor/buyer sees the organiser's payment instructions, pays outside the app (bank transfer/PayNow/Wise), uploads a proof, and organiser staff manually cross-check it against their own account before confirming. This is exactly the "verify payment screenshot against Wise records" step from the very first version of this idea — it just now happens inside the web app's review queue instead of over WhatsApp.

---

## 8. Open Decisions to Nail Down Before Building

- Can vendors modify an application after submission, or must they withdraw and reapply?
- Do VIP/attendee passes need seat/session selection, or are they general admission?
- Should a vendor's application history/reputation across past shows (with any organiser) be visible to a new organiser reviewing their application?
- When a primary vendor drops out and the island is reassigned/re-released, do already-placed subvendors get first refusal on staying, or does the whole island reset to empty?

---

## Suggested Next Step

With the floorplan simplified to image-upload + point-tagging, the two natural next prototypes — either is a reasonable starting point:
1. **Organiser floorplan tagging tool**: upload an image, click to drop booth pins, assign booth number/type — this unblocks all downstream booth data.
2. **Vendor floorplan view + application flow**: the same image rendered read-only with live availability, leading into the apply/hold/pay flow.
