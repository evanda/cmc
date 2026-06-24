# Campus Facilities Maintenance System — Build Plan & Spec

**Document purpose:** A complete, implementation-ready specification for a facility maintenance tool covering a multi-building church campus (church, school, gym, playgrounds, cemetery), its assets and tools, utility points of interest, vendors/services, and a fleet of 3 buses. Web app + Android app (React Native). This doc is written to be fed directly to Claude for implementation — it defines domain vocabulary, a data model, feature specs, architecture, a phased build order, and a standalone map-authoring ("loader") tool.

**How to use this with Claude:** Build in the phase order in §11. For each phase, paste the relevant sections plus the data model (§6). The map system (§5) and the loader tool (§10) are the highest-risk pieces — tackle them as their own milestone, not interleaved with CRUD work.

---

## 1. Framing: this is a CMMS

What you described is, in industry terms, a **CMMS** (Computerized Maintenance Management System) with a light **EAM** (Enterprise Asset Management) flavor for capital planning, plus a **spatial/map** layer that most off-the-shelf CMMS tools do *not* do well. Adopting CMMS vocabulary keeps you and Claude precise:

- **Asset** — a maintainable thing (an AC unit, a roof section, a water fountain, a bus, a ladder).
- **Location** — where an asset lives (Building → Floor → Room/Area).
- **Work Request** — a raw "something's wrong / something's needed" report, often from a non-maintenance person. *(Implemented as a work order in `requested` status, not a separate entity — see §3.1.)*
- **Work Order (WO)** — a triaged, assignable, trackable unit of work. Requests become WOs.
- **Preventive Maintenance (PM)** — recurring scheduled work, triggered by *time* (every 6 months) or by a *meter* (every 5,000 miles).
- **Reactive / Corrective Maintenance** — fix-it-when-it-breaks work.
- **Meter** — a usage counter on an asset (bus odometer, generator run-hours).
- **Vendor** — an external company that performs work or provides a service.
- **PM compliance** — % of scheduled PMs completed on time. The single most useful health metric.

The market is mature (UpKeep, Limble, MaintainX, Fiix, Brightly, eSPACE, FMX), and several vendors target churches specifically. The standard feature backbone everyone ships is: work-order management, a centralized asset registry with full service history, preventive-maintenance scheduling, parts/inventory, vendor management, mobile field access, and cost/performance reporting. Church-focused tools add floor-plan-based task assignment, QR-code asset tagging, asset hierarchies (e.g. *Sanctuary → Choir Loft → Organ*), fleet management for vans/buses, and compliance documentation for insurance audits.

You can ignore the parts of the market you don't need: heavy ERP/accounting integration, IoT/predictive-maintenance sensor pipelines, and room-booking/event-scheduling (a different domain — see §13, out of scope for v1).

---

## 2. What you asked for, mapped to modules

| You said | Module |
|---|---|
| Campus map + building diagrams, scroll/zoom, clickable POIs | **Spatial / Map** (§5) |
| File work orders; comment, assign, complete, cost + estimate | **Work Orders** (§4.2) |
| History of work done | **Asset & Work History** (§4.1, §4.2) |
| Indexes of contacts for services and vendors | **Vendors & Contacts** (§4.5) |
| Financial angle (not full accounting) | **Cost tracking & Reporting** (§4.7, §9) |
| Service schedules / periodic reminders | **Preventive Maintenance engine** (§4.3) |
| Work in a list and a calendar | **Views: List + Calendar** (§4.6) |
| Assets & tools (leaf blower, ladders) | **Asset Registry** (§4.1) |
| Utility POIs (shutoffs, door controller, network, sound) | **Spatial POIs + Asset Registry** (§5, §4.1) |
| Buses needing maintenance | **Fleet** (§4.4) |
| Garbage pickup, services | **Service Contracts / Vendors** (§4.5) |

---

## 3. Features you didn't list but should have

These come straight from how real facility teams (and insurers) operate. Each is cheap to add if the data model anticipates it.

1. **Lightweight request intake, modeled as a work-order status (not a separate table).** Let any staff member / volunteer submit a request ("AC out in Room 12") via a dead-simple form. **Implemented decision:** rather than a separate `work_requests` table + a convert-to-WO step, a request *is* a work order created in `requested` status; maintenance triages it in place (accept → `open`, decline → `cancelled`). A `BEFORE INSERT` guard forces non-staff inserts clean (sets `requested_by`, strips cost/assignee/schedule), and RLS scopes requesters to their own rows — so you keep the dead-simple intake form, clean list, and requester status-visibility-without-edit-rights, without the second table or the duplicate-row hop. (The separate-table approach only earns its keep with genuinely untrusted reporters; this is single-tenant per deployment, where everyone with access is staff — see §7.6.)
2. **QR-code asset tags (opt-in per asset).** Print a sticker for the assets worth tagging — rooftop AC units, the boiler, major equipment — each encoding a deep link to that asset. Scanning jumps straight to the asset record: who maintains it, its history, or file a work request on the spot. You don't have to tag everything; tag where standing-in-front-of-it lookup is useful. **Design detail:** the sticker encodes a URL like `https://<instance>/a/<qr_token>` (a stable, unguessable slug, not the raw DB id, so codes survive reprints and don't leak ids). Because it's a plain URL, a phone's **native camera** opens it in the browser — so scanning works on day one, before the React Native app exists; the mobile app later handles the same links natively. Complements the map: browse spatially, or scan for direct physical-world access.
3. **Asset hierarchy (parent/child).** *Building → Rooftop Unit RTU-3 → Compressor.* A WO on the compressor rolls up into the RTU's and the building's cost history.
4. **Meter-based scheduling.** Buses (mileage), generators (run-hours), maybe HVAC filters (runtime). Needed for the fleet to be useful.
5. **Inspection rounds / checklist templates.** Recurring walk-throughs ("Monthly safety round," "Weekly bus pre-trip") that produce a checklist instance with pass/fail/photo per item, and auto-spawn WOs for failures.
6. **Warranty tracking + expiry alerts.** Don't pay for a repair that's under warranty. Store warranty end date per asset; alert before expiry.
7. **Vendor Certificate of Insurance (COI) tracking.** Churches care about this for liability — store each vendor's COI and contract expiry, alert before lapse.
8. **Compliance / regulatory items.** Fire extinguishers, fire-alarm test, backflow preventer, elevator (if any), kitchen hood, sprinkler. These are recurring, date-driven, and audit-relevant. Model them as PM schedules flagged `compliance = true` so they surface on a dedicated compliance dashboard.
9. **Capital-replacement forecasting.** This is the home for your "different ages of roof" concern. Store `install_date`, `expected_life_years`, and `replacement_cost` per major asset; generate a forecast of what needs replacing in which year and the projected spend. This is the "financial angle" leadership actually wants.
10. **Labor/time tracking on WOs.** Even rough (hours per WO) — feeds cost reporting and shows where time goes.
11. **Photo documentation.** Before/after photos on WOs and assets. Trivial to add, huge for accountability and insurance.
12. **Document attachments.** Manuals, spec sheets, permits, warranty PDFs, vendor contracts — attached to assets/vendors/WOs.
13. **Lightweight parts/inventory (optional v2).** Filters, belts, bulbs, paint. Track on-hand qty, low-stock alert, and consumption per WO. Skip in v1 unless you actually stock parts.
14. **Audit log.** Who changed what, when. Cheap insurance for a multi-user tool.
15. **Dashboard.** Open WOs, overdue WOs, upcoming PMs, expiring COIs/warranties/compliance, this-month spend. The landing page.

---

## 4. Module specs

### 4.1 Asset Registry

The single source of truth. Every maintainable thing is an asset; "tools" (leaf blower, ladders) are just assets with a `category` of *Tool/Equipment* and no fixed location.

**Per-asset fields:** name, category, parent asset (hierarchy), location, make/model/serial, install/purchase date, purchase cost, expected life (yrs), replacement cost, warranty expiry, criticality (low/med/high), status (active/retired), QR token (nullable — only for tagged assets), notes, photos, attached documents, meters (0..n), linked map POI.

**Asset detail view shows:** identity + specs, full **work history** (every WO, sorted), upcoming PMs, meter readings, documents, location on map, cost-to-date.

**Categories to seed:** HVAC, Roofing, Plumbing (incl. fountains, shutoffs), Electrical, Doors/Access, Windows, Lighting, Fixtures, Flooring/Carpet, Paint/Walls, Restrooms, Network/IT, Sound/AV, Grounds/Playground, Vehicles/Fleet, Tools/Equipment, Utility/Infrastructure, Cemetery.

### 4.2 Work Orders

**Lifecycle:** `Requested → Open → In Progress → On Hold → Completed → (Closed/Verified)`. Plus `Cancelled`.

**Per-WO fields:** title, description, type (reactive / preventive / inspection), priority (low/med/high/urgent), status, requested-by, assignee (internal person and/or vendor), linked asset(s), location, **estimate** (cost), **actual cost** (parts + labor + vendor), labor hours, scheduled date, due date, completed date, comments thread, photos/attachments, completion notes.

**Behaviors:**
- Anyone with access can comment; maintenance can assign/reassign and change status.
- Mark complete captures actual cost, labor hours, completion notes, and (optionally) before/after photos.
- A completed WO permanently joins the linked asset's and location's history.
- Estimate vs actual is stored so variance is reportable.
- WOs can be spawned automatically by the PM engine (§4.3) or by a failed inspection item (§4.8).

### 4.3 Preventive Maintenance (the scheduling engine)

The most valuable and most error-prone piece. Build it deliberately.

**A PM schedule defines:** the asset or location it applies to, a **task template** (title, instructions, checklist), a **trigger**, an **assignee/vendor**, a **lead time** (generate the WO N days before due), and `compliance` / `category` flags.

**Trigger types:**
- **Calendar interval** — every N days/weeks/months/years, optionally anchored (e.g. "first Monday of the month").
- **Meter threshold** — every N miles/hours since last service (requires meter readings, §4.4).
- **Fixed dates** — specific recurring dates (annual fire inspection on a set date).

**Engine job (runs daily):** for each active schedule, compute next-due; if `next_due - today ≤ lead_time` and no open WO already exists for this cycle, generate a WO and notify the assignee. On completion, advance the schedule's anchor (from completion date or from scheduled date — make this configurable; "from completion" prevents drift-stacking).

**Seed PM examples:** HVAC filter swap (quarterly), HVAC service (semi-annual), roof inspection (annual), backflow test (annual, compliance), fire-extinguisher check (monthly, compliance), gutter clean (semi-annual), bus oil change (meter, every 5k mi), playground safety inspection (monthly), carpet cleaning (semi-annual), generator run-test (monthly + run-hours).

### 4.4 Fleet (the 3 buses)

Buses are assets with a `Vehicle` profile and **meters**. Treat them as a filtered view of the asset registry plus vehicle-specific fields.

**Vehicle fields:** VIN, plate, year/make/model, current odometer, fuel type, capacity, registration expiry, insurance expiry, state inspection expiry (renewal reminders), assigned driver/contact.
**Meter-based PMs:** oil/filter, tire rotation, brake inspection — triggered by odometer.
**Pre-trip checklist:** an inspection template (§4.8) for drivers.
**Renewal reminders:** registration / insurance / inspection due dates surface on the dashboard like compliance items.

### 4.5 Vendors, Service Contracts & Contacts

**Vendors** (companies that *do work*): name, category/trade, primary contact (name, phone, email), address, hourly/visit rate, notes, **COI expiry**, **contract expiry**, attached documents (contract, COI, W-9), linked WOs, total spend-to-date.

**Service contracts / recurring services** (garbage pickup, pest control, landscaping, elevator service, alarm monitoring): vendor, service description, schedule/cadence, monthly/annual cost, contract start/end, renewal reminder.

**Contacts** (a lighter directory): utilities (power/water/gas account #s + outage lines), insurance agent, denominational/diocese facilities contact, locksmith, emergency plumber, etc. Some contacts aren't vendors you assign work to — keep a simple contact index alongside the vendor table.

### 4.6 Views: List + Calendar

- **List view** of work (WOs + upcoming PMs): filter by status, priority, building, asset category, assignee, vendor, date range; sort; saved filters; bulk actions (assign, close).
- **Calendar view** of scheduled/planned work: month/week/agenda. Each entry links to its WO/PM. Color by status or category. Drag-to-reschedule is a nice-to-have, not v1.
- **Map view** (§5) as a third lens: click a building/POI → see its open WOs and assets.

### 4.7 Cost tracking (the "financial angle," kept light)

Not accounting — just enough to answer "what are we spending and on what." Every WO carries estimate + actual (parts/labor/vendor). From those plus asset metadata you derive: spend by building / category / vendor / asset / month, estimate-vs-actual variance, cost-to-date per asset, and the capital-replacement forecast (§9). Optionally a simple annual budget figure per category to show budget-vs-actual. No invoicing, no GL, no payroll.

### 4.8 Inspections & Checklists

**Checklist template:** ordered items, each pass/fail/NA + optional photo + note. **Inspection run:** an instance against a location/asset/vehicle at a point in time, producing a record and auto-spawning WOs for failed items. Drive recurring inspections through the PM engine (a PM whose task is "run checklist X"). Covers safety rounds, playground inspections, bus pre-trips, monthly building walk-throughs.

---

## 5. Spatial system — one map, stitched interior, floor switcher

This is the differentiator and the hardest part. **Revised model: a single geographic map, not two.** Both the campus and every building interior live in the *same* real-world coordinate space. The interior floorplans are georeferenced (placed at their true position/scale/rotation over the grounds) and organized into **levels**, so you scroll freely across the whole campus interior and switch floors up/down — exactly how indoor maps work in malls, airports, and Apple/Google Maps. (The formal version of this is the OGC/Apple **IMDF** model: a venue contains *levels*, each level contains features. You don't need the full standard, just its "Level" concept.)

This both gives you the stitched, scroll-anywhere interior you want **and** simplifies the build: one renderer, one coordinate system, one POI table — no separate image-plane subsystem.

### 5.1 The single map (MapLibre GL JS)

One MapLibre map, your `bub` stack. Layered, from bottom to top:

- **Base:** georeferenced satellite/aerial image of the grounds (single georeferenced image source, or tiled to **PMTiles** if large — same toolchain as `bub`).
- **Building footprints:** GeoJSON polygons, clickable.
- **Interior floor overlays:** each floorplan drawing placed as a MapLibre **`image` source** — which takes four real-world corner coordinates, so a drawing is positioned, scaled, and rotated onto the actual building footprint. Each overlay is tagged with `building` + `level`.
- **POIs:** GeoJSON points (shutoffs, HVAC, network, sound, fountains, etc.), each tagged with `level` (and `null`/`0` for exterior/site POIs).

### 5.2 Floor switching (the up/down axis)

A **level switcher** control (e.g. `Site · B1 · 1 · 2 · 3`). The active level drives a filter applied to both the floor-overlay layers and the POI layer: show only overlays/POIs whose `level` matches (plus always-on exterior POIs at "Site"). Switching levels swaps which building interiors and POIs are visible while you stay panned/zoomed where you are — so you can be looking at the east end of campus, flip from floor 1 to floor 2, and see that area's upstairs.

Implementation: this is a thin layer of your own code — a `level` property plus MapLibre `setFilter`/filter expressions. Community plugins exist (`maplibre-gl-indoor`, `maplibre-gl-indoorequal`) but they're built around OSM `indoor=` **vector** schemas and, in the case of indoorequal, a hosted tile service + API key. For hand-drawn **raster** floorplans in a self-hostable per-church app, rolling the level filter yourself is simpler and dependency-free. Borrow their UX, not their data model.

### 5.3 Stitching reality (worth knowing up front)

Your floorplans are drawings, not survey-accurate CAD. Georeferencing them onto satellite imagery will be approximate — that's fine. These overlays are **navigational aids** ("where's the main water shutoff?"), not engineering drawings, so "good enough" placement is the goal. Practical notes:

- Each building's drawing is placed independently in the loader (§10); the campus "stitch" emerges from each piece sitting in its true spot.
- For a multi-story building, reuse the same footprint corners across that building's levels so floor 2 sits directly above floor 1.
- The `image` source does a 4-corner (quad) placement — enough to position/scale/rotate/skew a drawing. If a particular drawing is badly distorted, just re-crop/redraw it rather than chasing a perfect warp.
- If a single drawing is huge, tile it (raster pyramid / PMTiles); typical church floorplans are fine as one optimized image.

### 5.4 POIs — now one coordinate system

A **POI** is a clickable marker linked to a domain object (asset, utility point, building, area). With the unified model there's just one kind:

- `geometry`: GeoJSON point in lng/lat.
- `level`: which floor it's on (`null`/`0` = exterior/site, `1`, `2`, `B1`…).
- `poi_type`: shutoff, door_controller, network_hardware, sound_system, hvac, fountain, fire_extinguisher, playground, building, area, etc.
- `linked_asset_id` (nullable), `label`, `notes`, `icon`.

Clicking any POI opens its linked asset/utility detail, where you can file a WO, see history, etc. No more dual pixel/geo coordinate handling.

### 5.5 Utility POIs specifically called out

Water shutoffs, door controllers, network hardware, sound system: model each as an asset (category Utility/Infrastructure or Network/Sound) **and** a POI on its floor. The value is "where is the main water shutoff?" answerable in 5 seconds on a phone during an emergency — so make these high-criticality and easy to find/filter. With the stitched interior, someone can pan to the right building, drop to the right floor, and spot it in context. For assets you've QR-tagged (§3), scanning the sticker jumps straight there instead — the map and QR are complementary ways to reach the same asset record.

---

## 6. Data model

Relational (Postgres). Core tables (abbreviated; add `id`, `created_at`, `updated_at`, `created_by`, soft-delete where useful):

```
buildings(id, name, description, footprint_geojson, address)
floors(id, building_id, name, level,                        -- level: int, e.g. -1=B1, 0/1=ground, 2...
       floorplan_image_url, geo_corners_geojson,            -- 4 real-world corners for MapLibre image source
       rotation_deg)                                        -- optional, if you store rotation separately
locations(id, building_id, floor_id, name, type)            -- room/area within a floor

asset_categories(id, name, parent_id)
assets(id, name, category_id, parent_asset_id, location_id,
       make, model, serial, install_date, purchase_cost,
       expected_life_years, replacement_cost, warranty_expiry,
       criticality, status, qr_token, notes)              -- qr_token: nullable slug encoded in the sticker
asset_documents(id, asset_id, kind, url, label)
asset_photos(id, asset_id, url, caption, taken_at)

meters(id, asset_id, type, unit)                            -- odometer, run-hours
meter_readings(id, meter_id, value, reading_date, recorded_by)

vehicles(id, asset_id, vin, plate, year, make, model,
         registration_expiry, insurance_expiry, inspection_expiry, driver_contact_id)

pois(id, building_id, floor_id, level, geometry_geojson,    -- single lng/lat coord system; level for floor filtering
     poi_type, linked_asset_id, label, icon, notes)

-- NOTE (implemented): there is no separate work_requests table. Intake is a
-- work order created in 'requested' status (see §3.1); triage advances it in
-- place (accept → open, decline → cancelled). A BEFORE INSERT guard forces
-- non-staff inserts clean (requested_by = self; cost/assignee/schedule nulled).
work_orders(id, title, description, type, priority, status,         -- status starts 'requested' for self-reported intake
            requested_by, assignee_user_id, vendor_id,
            linked_asset_id, location_id,
            estimate_cost, actual_parts_cost, actual_labor_cost, actual_vendor_cost,
            labor_hours, scheduled_date, due_date, completed_date,
            completion_notes, source_pm_id)
work_order_comments(id, work_order_id, author_user_id, body, created_at)
work_order_attachments(id, work_order_id, url, kind, caption)

pm_schedules(id, name, asset_id, location_id, task_template_id,
             trigger_type, interval_value, interval_unit,
             meter_id, meter_threshold, anchor_date, advance_from,
             lead_time_days, assignee_user_id, vendor_id,
             is_compliance, category, active)
task_templates(id, name, instructions, checklist_template_id)

checklist_templates(id, name)
checklist_items(id, template_id, position, prompt, requires_photo)
inspection_runs(id, template_id, location_id/asset_id/vehicle_id, performed_by, performed_at)
inspection_results(id, run_id, item_id, result, note, photo_url, spawned_wo_id)

vendors(id, name, category, contact_name, phone, email, address,
        rate, coi_expiry, contract_expiry, notes)
vendor_documents(id, vendor_id, kind, url, label)
service_contracts(id, vendor_id, description, cadence, cost, period_unit,
                  start_date, end_date, renewal_reminder_days)
contacts(id, name, org, role, phone, email, account_number, notes)  -- utilities etc.

users(id, name, email, role)                                -- role: admin/tech/requester/trustee/vendor
audit_log(id, actor_user_id, entity, entity_id, action, diff, created_at)
```

Reporting is mostly **views/queries** over `work_orders` + `assets` (no separate cost tables needed for v1).

---

## 7. Technical architecture

Designed for a **solo developer** shipping fast, given your existing React/Vite/Vercel/MapLibre fluency.

### 7.1 Shape

- **Monorepo** (pnpm + Turborepo): `apps/web`, `apps/mobile`, `apps/loader`, `packages/shared` (TypeScript types, API client, validation schemas, business logic like the PM next-due calculator). Sharing types and the PM engine across web/mobile/loader is the main payoff.
- **Web frontend:** React + Vite + TypeScript + Tailwind, TanStack Query for server state, MapLibre GL JS. Deploy on **Vercel** (you know it).
- **Mobile:** **React Native via Expo** — fastest solo path, OTA updates, Expo push notifications, camera + QR scanning built in (WO photos and asset-tag scans). Caveat below.
- **Backend:** **Supabase** (managed Postgres + Auth + Storage + Row-Level Security + Realtime + `pg_cron` + Edge Functions). This is the pragmatic default: it gives you a real relational DB (you need joins and the scheduler), file storage for photos/manuals/floorplan images/tiles, auth with roles via RLS, and a cron mechanism for the PM engine — without standing up your own server.
  - *Alternative if you want full control:* Postgres + a Node/Fastify API on Fly.io or Railway, plus S3-compatible storage. More code, more ops, more flexibility. Given solo constraints, start with Supabase; the `packages/shared` boundary keeps you portable later.

### 7.2 The mobile map caveat (important)

MapLibre **GL JS** (web) and React Native are different runtimes. On mobile you have two options:
1. **`@maplibre/maplibre-react-native`** — native MapLibre bindings for RN. Best performance, but a second map codebase to maintain and its API differs from GL JS.
2. **WebView-hosted map** — render your existing GL JS map component inside a WebView. One map codebase, "good enough" performance, simpler. Recommended for v1 given you're solo; revisit native if it feels sluggish.

Because the interior is now part of the *same* MapLibre map (§5), there's one map component to deal with on mobile — a real simplification. Render that single component in a WebView (option 2) for v1; budget the map-on-mobile decision as its own small spike.

### 7.3 Offline (the real mobile challenge)

A maintenance person inside a cinder-block building may have no signal. Decide early how much offline you need:
- **v1 (pragmatic):** online-first with graceful queueing of WO creates/comments/photos; cache the asset list and maps. PMTiles maps work offline once cached.
- **v2 (true offline-first):** local SQLite (e.g. WatermelonDB or Expo SQLite) with a sync layer to Supabase. Significant complexity — only invest if on-campus connectivity is genuinely bad. **(Open question — see §14.)**

### 7.4 Notifications & the scheduler

- **Scheduler:** a daily `pg_cron` job (or scheduled Edge Function) runs the PM engine (§4.3), generates due WOs, and queues notifications. Also checks expiries (warranty, COI, contract, vehicle registration/insurance/inspection, compliance) and raises dashboard alerts + reminders.
- **Notifications:** email via Resend/Postmark; push via Expo. Notify assignee on WO assignment, requester on status change, admins on overdue/expiring items.

### 7.5 Auth & roles (RLS-enforced)

- **Admin / Facilities Director** — full access, config, reports, costs.
- **Technician** — assigned WOs, asset history, file/complete WOs, log meters/inspections.
- **Requester (staff/volunteer)** — submit requests, view own request status. No cost visibility.
- **Trustee / Viewer** — read-only dashboards, reports, capital forecast (the financial audience).
- **Vendor (optional)** — see only WOs assigned to them, add comments/costs. Skip in v1 if not needed.

### 7.6 Church-agnostic by design (single-tenant per deployment)

You may give this to friends for their churches, but you won't run two churches in one instance. That points to **single-tenant-per-deployment**, which is *much* simpler than SaaS multi-tenancy — and the rule that makes it work is: **nothing about any one church is hardcoded; everything church-specific is data or config.**

- **No `org_id` everywhere.** Skip tenant-scoping on every table and the RLS gymnastics that go with it. Each church gets its own database + its own deployment, so isolation is physical, not row-level. (This also keeps each church's data genuinely private from the others — a real selling point.)
- **One `settings` row.** A single-row `org_settings` table holds the church name, logo, address, locale, units (miles/km, currency), timezone, and theme. The UI reads church identity from there — never from a constant in the source.
- **First-run setup flow.** A setup wizard (or seed script) initializes a fresh instance: create the first admin, set church name/branding, and load default seed data. This is the "hand it to a friend" path — they deploy, run setup, start adding buildings.
- **Ship sensible defaults as templates.** Seed default asset categories, common PM schedules (HVAC, roof, backflow, fire extinguisher…), compliance items, and checklist templates so a new church isn't staring at a blank slate. This is a big part of the value you'd be giving friends.
- **All campus/spatial data is per-instance content.** Buildings, floors, georeferenced maps, POIs, assets, vendors — all entered per church via the app + loader tool. The codebase ships with *zero* church-specific data.
- **Mobile distribution wrinkle.** One app binary can't bake in each church's backend URL. Options: (a) a first-launch "enter your instance URL" screen, or (b) a per-church build via Expo env/config. For friends-scale, the instance-URL screen is simplest; revisit if you ever list it publicly.
- **Deployment per church:** its own Supabase project + Vercel project (+ Expo config). A short setup README turns "give it to a friend" into a repeatable checklist.

Net: design as a normal single-tenant app, but treat *every* church-specific value as configuration/content. That keeps friend #2's setup to "deploy + run wizard," with no code changes — without paying the multi-tenant tax now.

**Testing & supporting multiple facilities (without going multi-tenant).** You'll want to work with several facilities in dev — and to reproduce a friend's setup when supporting them. That's a *data-lifecycle* need, not a tenancy need, and it's solved more cheaply than row-level multi-tenancy (which only buys "many facilities co-resident in one instance with isolation" — a thing you've said you don't want in prod). Build instead:

- **Seedable facility fixtures** + a `reset && seed <name>` dev command. Keep 2–3 distinct sample campuses (a tiny one, a large multi-building one, an edge-casey one) to exercise the map, hierarchy, and scheduler.
- **Facility export/import** — serialize an entire facility (org settings, buildings, floors, georeferenced maps + image assets, POIs, assets, vendors, PM schedules) to a portable bundle (zip of JSON + image files). This one feature triples as your **support-repro tool** (a user exports, you import into a scratch instance to debug), your **backup/restore**, and the **"starter campus" you hand a new friend**.
- **Cheap throwaway instances** — local Supabase/Docker or Supabase branching, so you can stand up "their facility" in isolation rather than co-mingling it with your data.

Keep the hedge from above: `facilities`/`org_settings` is a single first-class row *with an id*, and export/import operates on "a facility." That gives you a clean, portable facility concept today without threading `facility_id` through every table.

**The one trigger for actually going multi-tenant:** if *you* decide to centrally host many friends' facilities yourself (one instance you operate, many orgs). That's a business/ops decision, not a dev-convenience one — don't let the convenience of testing pull production into that complexity. If it ever happens, promote then: add `facility_id` FKs, scope every query, add tenant RLS. Because the facility entity + export/import already exist, that's a contained migration, not a rebuild.

---

## 8. API sketch

REST (or Supabase auto-generated + a few RPC/Edge Functions for non-CRUD logic):

```
GET/POST  /assets            GET /assets/:id (incl. history, PMs, meters)
GET/POST  /work-orders       PATCH /work-orders/:id  (status/assign/cost)
                             (intake = POST a WO in 'requested' status; triage = PATCH status open/cancelled)
                             POST  /work-orders/:id/comments
                             POST  /work-orders/:id/attachments
GET/POST  /pm-schedules      (engine runs server-side on cron)
GET/POST  /meters/:id/readings
GET/POST  /vendors           /service-contracts   /contacts
GET/POST  /buildings /floors /locations /pois
GET       /calendar?from&to   (WOs + projected PMs)
GET       /reports/cost?group_by=building|category|vendor|asset&from&to
GET       /reports/capital-forecast
GET       /reports/pm-compliance
GET       /dashboard          (open/overdue WOs, upcoming PMs, expiries, MTD spend)
POST      /inspections/runs
```

Custom server logic worth isolating in `packages/shared` + Edge Functions: **PM next-due calculation**, **capital-forecast projection**, **expiry sweep**. (Request intake needs no conversion logic — it's a WO created in `requested` status, triaged via a status change.)

---

## 9. Reporting & the capital forecast

Reports v1:
- **Open / overdue / completed WO counts**, average time-to-complete.
- **PM compliance rate** (% PMs done on time) — the headline maintenance metric.
- **Spend** by building / category / vendor / asset / month; **estimate-vs-actual variance**.
- **Expiry board** — warranties, vendor COIs, service contracts, vehicle reg/insurance/inspection, compliance items, all with countdowns.
- **Capital-replacement forecast** — for major assets, `install_date + expected_life_years` → projected replacement year; sum `replacement_cost` by year to produce a multi-year capital plan. This directly answers "the roofs are different ages — when and how much?" and is the report leadership will care about most.

---

## 10. Standalone map-authoring ("loader") tool

A separate admin web app (`apps/loader`) that turns your raw imagery into the data the main app consumes. It is **not** shipped to end users. Output: image assets + JSON, written to storage and the DB.

### 10.1 Campus map (geographic)
1. Upload the satellite image.
2. **Georeference** it: place ≥3 ground control points (click a spot on the image, then set its real lat/long — corners of a known building, a street intersection). The tool computes the transform. (The Allmaps/IIIF georeferencing approach in the MapLibre ecosystem is a good reference pattern.)
3. Either store the image as a georeferenced overlay, or **tile it to PMTiles** (reuse your `bub` tiling toolchain — `gdal2tiles`/`rio-tiler` → PMTiles) for smooth zoom + offline.
4. **Digitize footprints & POIs:** draw building polygons, drop outdoor POI points, fill metadata (type, linked asset). Export GeoJSON.

### 10.2 Floorplans (georeferenced interior overlays)
Now that interiors share the geographic plane (§5), the loader places each drawing *on the map* rather than authoring a separate pixel canvas:
1. Upload a floorplan drawing and pick its building + level.
2. Show it as a draggable, semi-transparent overlay on top of the satellite base. **Position, scale, rotate, and corner-stretch** it until walls line up with the building footprint — capturing the four real-world corner coordinates (the MapLibre `image`-source quad).
3. For multi-story buildings, reuse the prior floor's corners as the starting placement so floors stack vertically aligned.
4. **Drop POIs** by clicking on the placed overlay (they're captured as lng/lat with the floor's `level`); fill metadata; link to assets.
5. (If a drawing is huge) generate a raster pyramid / PMTiles.
6. Export: floor record (`floorplan_image_url`, `geo_corners_geojson`, `level`) + POIs as GeoJSON with `level`.

This is the same georeferencing machinery as the satellite step (§10.1) — one mental model, one toolset, no separate image-plane editor to build or maintain.

### 10.3 Build it as
A small React + MapLibre app sharing `packages/shared` types so its exports drop straight into the main DB. Keep it crude — it's an internal digitizing tool. It can write directly to Supabase (admin-gated) rather than producing files you hand-import, which is less error-prone.

---

## 11. Phased build order

**Phase 0 — Foundation.** Monorepo, Supabase project, auth + roles (RLS), schema (§6), seed asset categories, single-row `org_settings`/`facilities`. Buildings / floors / locations CRUD. **Dev:** seedable facility fixtures + `reset && seed <name>` (see §7.6).

**Phase 1 — MVP (the core loop).** Asset Registry (incl. tools, `qr_token` + printable QR labels generated from the web app — scannable via native camera deep links from day one). Work Orders incl. lightweight request intake (a WO created in `requested` status; triaged in place — see §3.1): create, assign, comment, status, complete-with-cost (estimate + actual + labor). Vendor & Contact directory. List view + Calendar view. Basic dashboard. *Web first.* This is a usable tool on its own.

**Phase 2 — Spatial.** Loader tool (§10). Single MapLibre map: satellite base + building footprints + georeferenced interior floor overlays + POIs, with a **level switcher** for floor up/down. Map view wired into WOs (click a POI/building → its assets and open WOs). **Facility export/import** (§7.6) — once the spatial schema settles, since maps/images are the hardest part to serialize; gives you backup, support-repro, and starter-campus bundles.

**Phase 3 — Proactive.** PM scheduling engine (calendar + meter triggers) + auto-WO generation + reminders. Inspections/checklists. Fleet (vehicles, meters, renewals, pre-trip). Compliance dashboard. Expiry sweeps (warranty/COI/contract).

**Phase 4 — Insight & mobile.** Reporting (cost, PM compliance, capital forecast). Mobile app (Expo): requests, WO field actions, photos, in-app QR scanning, push, the map in a WebView. Offline strategy per §7.3. Optional: parts/inventory, vendor portal.

Rationale: Phase 1 delivers value without the risky map/scheduler work; the map (Phase 2) and the scheduling engine (Phase 3) are the two hard milestones and are isolated so a stumble in one doesn't block the rest.

---

## 12. Tech stack summary

| Concern | Choice | Why |
|---|---|---|
| Web FE | React + Vite + TS + Tailwind + TanStack Query | Your existing stack |
| Maps | MapLibre GL JS only (campus + georeferenced interior overlays + level switcher) | One renderer, one coord system; reuses `bub` |
| Mobile | React Native + Expo | Solo velocity, push, camera + QR, OTA |
| Map (mobile) | Single MapLibre map in a WebView v1; native later | One codebase first |
| Tenancy | Single-tenant per deployment; church = config/content | Friend-deployable without multi-tenant tax |
| Backend | Supabase (Postgres, Auth, Storage, RLS, pg_cron, Edge Fns) | Relational + scheduler + storage + auth, minimal ops |
| Hosting | Vercel (web), Supabase (data), Expo (mobile) | Familiar, low-ops |
| Tiles/offline | PMTiles | Offline maps; reuse `bub` toolchain |
| Notifications | Resend/Postmark (email) + Expo push | Simple, solo-friendly |
| Monorepo | pnpm + Turborepo, `packages/shared` | Share types + PM engine across apps |

---

## 13. Explicitly out of scope (v1)

- **Room booking / event scheduling** — a different domain; many church suites bundle it, but it bloats the build. Note it as a *possible future module*, not v1.
- **Full accounting / GL / invoicing / payroll.** Cost tracking stops at WO estimate-vs-actual and the capital forecast.
- **IoT / predictive maintenance / sensor ingestion.**
- **Parts/inventory** — defer to v2 unless you actually stock parts.

---

## 14. Open questions to resolve before building

1. **Users & concurrency:** how many people (staff, volunteers, trustees, vendors) will touch this? Drives auth/role investment.
2. **On-campus connectivity:** is signal reliable inside the buildings? This decides whether you need true offline-first (§7.3) — a major scope lever.
3. **Volunteer requests:** will non-maintenance people submit requests, or just paid staff? Affects the request-intake UX and roles.
4. **Buses & DOT:** do the buses fall under any DOT/state inspection regime you must document? Affects fleet compliance fields.
5. **Hosting budget:** comfortable on Supabase's managed tier, or do you want self-hosted Postgres for control/cost?
6. **~~Reusability / productization~~ — RESOLVED.** Friend-deployable, single-tenant per instance, church-as-config (see §7.6). No multi-tenant work; just keep church-specific values out of code.
7. **Cemetery:** is it purely a map POI/grounds-maintenance area, or do you need plot-level records (a whole separate sub-domain)? Assume the former unless you say otherwise.

---

*Notes on sourcing: feature backbone and church-specific patterns (work-request intake, QR/floorplan-based asset access, asset hierarchies, fleet, COI/compliance tracking, capital forecasting) are drawn from current CMMS and church-facility-management products (Limble, MaintainX, Fiix, FMX, eSPACE, Maintainly, Brightly). The unified, floor-switchable interior follows standard indoor-mapping practice — MapLibre GL JS with georeferenced raster `image` overlays organized by level (the OGC/Apple IMDF "Level" model), with floor filtering rolled directly rather than via OSM-vector indoor plugins.*
