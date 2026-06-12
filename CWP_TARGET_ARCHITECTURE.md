# CWP Detailers — Target Architecture

**Document type:** Target-state architecture vision  
**Horizon:** 3–5 years  
**Audience:** Founders, product, engineering  
**Purpose:** Define the ideal future architecture that all development should converge toward  

This document describes **where CWP is going**, not where it is today. It is the north star for product, operations, and engineering decisions.

---

## Section 1 — Business Vision

### What CWP Actually Is

CWP Detailers is **not a booking app**. It is an **operations platform** for managed field services — the intersection of Urban Company’s marketplace orchestration, franchise territory management, and subscription contract fulfillment.

At its core, CWP coordinates five things that traditional service businesses handle with WhatsApp, Excel, and memory:

1. **Assets** — cars, solar installations, and future equipment that need recurring care  
2. **Contracts** — prepaid or subscription agreements that define what was sold and what remains  
3. **Work** — bookings and jobs that staff execute in the field  
4. **Money** — wallet balances, invoices, and collections aligned to service delivery  
5. **People** — customers who self-serve, staff who deliver, partners who run cities  

### Long-Term Vision

**Year 1 (Varanasi → Patna):** Prove that daily car cleaning, doorstep wash, and solar cleaning can run with minimal manual coordination — customers book and track, staff execute on mobile, admin sees everything, money flows through wallet and invoice.

**Year 2–3 (10 cities):** City partners operate semi-autonomously under platform rules. Super admin sets catalog and policy; partners run ops, staff, and local leads. Platform handles scheduling, billing, notifications, and quality proof automatically.

**Year 4–5 (100 cities / national scale):** CWP becomes the **operating system for premium vehicle and solar care in India** — one customer account, many assets, many contracts, one wallet, full history. Partners plug into a standardized playbook. New service lines (bike, commercial fleet, generator AMC) attach to the same engines without new platforms.

### Platform Pillars

| Pillar | Meaning |
|---|---|
| **Asset Management** | Every serviceable thing is a tracked asset with location, history, and assigned resources |
| **Service Contracts** | Recurring and package services are contracts with credits, frequency, and lifecycle — not ad-hoc subscriptions |
| **Workforce Operations** | Staff see work, prove completion, earn fairly — salaried or per-job |
| **Customer Self-Service** | Customers onboard assets, recharge wallet, schedule washes, view AMC progress, file complaints |
| **Multi-City Franchise Operations** | Territory hierarchy, partner types, scoped permissions, centralized payment settlement (initially) |

**Strategic positioning:** Urban Company’s convenience + franchise accountability + subscription predictability — specialized in car care and solar, not general home services.

---

## Section 2 — Core Business Engines

The platform is built from **seven engines**. Each engine owns a domain. Engines communicate through events and shared entities (Customer, Asset, Contract, Booking, Wallet). No engine duplicates another’s responsibility.

```
                    ┌─────────────────┐
                    │  Notification   │
                    │     Engine      │
                    └────────▲────────┘
                             │ events
    ┌──────────┐    ┌────────┴────────┐    ┌──────────┐
    │ Customer │───▶│    Contract     │───▶│ Booking  │
    │  Engine  │    │     Engine      │    │  Engine  │
    └────┬─────┘    └────────▲────────┘    └────┬─────┘
         │                     │                   │
         ▼                     │                   ▼
    ┌──────────┐    ┌─────────┴─────────┐  ┌──────────┐
    │  Asset   │◀───│     Billing       │◀─│ Workforce│
    │  Engine  │    │     Engine        │  │  Engine  │
    └──────────┘    └───────────────────┘  └──────────┘
```

---

### Customer Engine

**Purpose:** One identity, many relationships.

A customer is a **person or household** with a single login. All cars, solar sites, contracts, bookings, invoices, wallet balance, and complaints hang off that account.

| Capability | Description |
|---|---|
| Unified account | Phone-verified identity; optional email; one profile across all cities |
| Multi-asset ownership | N cars + M solar sites + future assets under one customerId |
| Territory binding | Customer belongs to a **home city/branch**; can request services where assets are located |
| Preference center | Notification channels, language, payment reminders, marketing opt-in |
| Household model (future) | Primary account + linked members (spouse, driver) with scoped access |

**Design rule:** Never create duplicate customer records for the same phone. Merge leads into customers on conversion.

---

### Asset Engine

**Purpose:** Assets are first-class entities. The platform is **asset-centric**, not service-centric.

Every booking, contract line, invoice item, photo, and complaint references an **asset**.

#### Asset Types (extensible)

| Type | Key attributes | Service lines |
|---|---|---|
| **Car** | Make, model, color, registration, vehicle type, parking location (lat/lng), home location | Daily cleaning, doorstep wash, detailing |
| **Solar Site** | Panel count, kW capacity, address, inverter ref (future IoT) | One-time clean, AMC |
| **Bike** (future) | Same pattern as car | Wash packages |
| **Generator** (future) | Capacity, fuel type | AMC |
| **Commercial vehicle** (future) | Fleet ID, depot | B2B contracts |

#### Asset responsibilities

- **Location:** Separate *home address* (customer) vs *service location* (where work happens — often car parking spot)  
- **Assignment:** Daily cleaning maps **asset → default staff**; override per date by manager  
- **History:** Immutable timeline of all bookings, photos, ratings, and notes per asset  
- **Status:** Active, paused (contract paused), transferred (sold car → close asset)  

**Design rule:** If it gets cleaned, it is an asset. Bookings without an asset are exceptions (e.g. walk-in one-time with ad-hoc vehicle capture).

---

### Contract Engine

**Purpose:** One generic engine for all recurring and credit-based services.

Daily Car Cleaning, Car Wash Packages, and Solar AMC are **contract templates** — not separate systems.

#### Core concepts

| Concept | Definition |
|---|---|
| **Contract** | Agreement between customer and platform for a service on an asset for a period |
| **Template** | Admin-defined product: "Daily Exterior + 2 washes/month", "10 washes / 6 months", "Solar AMC 12 months" |
| **Frequency** | How often service is due: daily (with off-days), weekly, monthly, per credit |
| **Validity** | startDate → endDate; auto-expire |
| **Credits** | Remaining service units (washes left, cleanings left in AMC) |
| **Wallet link** | Daily cleaning debits wallet per completed service; packages may be prepaid lump sum |
| **Pause / Resume** | Customer or admin pauses; no bookings generated; resume restores schedule |
| **Auto-scheduling** | Contract engine emits **scheduled bookings** based on frequency, off-days, staff map, balance |

#### Contract types mapped to one engine

| Business product | Contract model |
|---|---|
| Daily Car Cleaning | Recurring + wallet debit per day + off-days (Wed) + asset→staff map |
| Car Wash Package | Credit-based (N washes) + validity window + manual or scheduled redemption |
| Solar AMC | Recurring monthly cleaning + credit count (12/year) + solar asset binding |

#### Contract lifecycle

```
draft → active → [paused] → expiring → expired | cancelled
                      ↓
                   missed (operational flag when scheduled work not done)
```

**Design rule:** Never build `daily_subscriptions`, `wash_packages`, and `solar_amc` as three codepaths. One contract table, one scheduler, one credit counter.

---

### Booking Engine

**Purpose:** Universal execution unit for all field work.

A **booking** is a single instance of work: one staff visit, one asset, one time window.

#### Booking sources

| Source | Trigger |
|---|---|
| **Customer-initiated** | One-time doorstep wash, schedule included wash from package |
| **Contract-generated** | Daily tick creates today’s cleaning; AMC creates monthly solar job |
| **Admin-initiated** | Walk-in, phone order, complaint re-clean |
| **Partner-initiated** | City partner creates for local customer |

#### Booking lifecycle

```
created → confirmed → assigned → en_route → in_progress → completed
    │         │           │                      │
    └─────────┴───────────┴── cancelled / rescheduled / missed
```

| State | Meaning |
|---|---|
| **created** | Exists; awaiting confirmation or auto-confirm |
| **confirmed** | Customer and platform committed |
| **assigned** | Staff linked; staff notified |
| **en_route** | Staff marked traveling (optional) |
| **in_progress** | Staff on site; before photo captured |
| **completed** | After photo + proof; triggers billing + notifications |
| **missed** | Scheduled time passed + grace; contract may flag |
| **cancelled** | Customer/admin cancelled before start |

#### Universal booking attributes

- customerId, assetId, contractId (nullable for one-time)  
- serviceSkuId (what was sold)  
- territoryId (city/zone)  
- assignedStaffId  
- scheduledAt, location (lat/lng)  
- beforePhotoUrls[], afterPhotoUrls[]  
- status, audit events  
- amount (computed from pricing engine at creation)  

**Design rule:** One booking table, one state machine, one staff app flow — regardless of car wash vs solar vs daily clean.

---

### Billing Engine

**Purpose:** Wallet-first money movement aligned to service delivery.

Indian customers understand **recharge and consume**. Daily cleaning fits this natively. Packages and AMC fit as **prepaid credits + optional top-up**.

#### Wallet architecture

| Component | Role |
|---|---|
| **Wallet** | Per-customer balance in INR (GST-inclusive display) |
| **Ledger** | Append-only transactions: credit (recharge, refund), debit (service completed), adjustment |
| **Hold** (future) | Reserve balance when booking confirmed; release on cancel |
| **Low balance threshold** | Configurable (e.g. 7 days of daily rate remaining) |

#### Daily cleaning under wallet model

1. Customer recharges wallet (cash/UPI recorded by admin, or Razorpay online)  
2. Contract active → daily scheduler creates booking if balance ≥ 1 day rate  
3. Staff completes job → **auto-debit** one day’s rate from wallet  
4. Balance < threshold → **low balance alert** (SMS + WhatsApp + in-app)  
5. Balance = 0 → **auto-pause contract**; no new bookings until recharge  
6. Customer recharges → **auto-resume** if contract still valid  

#### Package and AMC billing

| Product | Billing pattern |
|---|---|
| Wash package | Upfront payment → credits loaded; each completion decrements credit; optional wallet for overage |
| Solar AMC | Upfront or installment → 12 credits; monthly auto-booking consumes 1 credit |
| One-time wash | Pay at booking (wallet or gateway) or invoice after completion |

#### GST

- **Display:** All customer-facing prices GST-inclusive (₹100 means ₹84.75 + ₹18 GST)  
- **Invoice:** Line items show base + GST breakdown for ITC customers with GSTIN  
- **Territory:** GSTIN of billing entity may vary by state (future multi-entity)  

#### Invoice generation

| Trigger | Action |
|---|---|
| Wallet recharge | Receipt / tax invoice on request |
| Package purchase | Invoice at purchase |
| B2B / GST customer | Formal invoice with GSTIN |
| Auto (configurable) | Invoice on booking complete for non-wallet one-time |

**Design rule:** Wallet ledger is source of truth for balance. Never update balance without a ledger entry.

---

### Workforce Engine

**Purpose:** Right person, right skill, right pay, right proof.

#### Staff models

| Model | Definition | Pay |
|---|---|---|
| **Salaried** | Fixed monthly; duty hours; attendance-linked | Salary − leave deductions + incentives |
| **Per job** | Paid per completed booking by service type | Rate card × jobs + petrol |
| **Hybrid** | Base salary + per-job bonus above threshold | Combined |

#### Core capabilities

| Capability | Description |
|---|---|
| **Qualification matrix** | Staff tagged: daily_cleaning, doorstep_wash, solar, detailing — only assign matching work |
| **Territory binding** | Staff belongs to zone/city; operating radius optional |
| **Default asset assignment** | Daily cleaning: staff ↔ asset map; temporary override per date |
| **Availability** | Salaried: duty calendar; per-job: accept/decline or auto-assign |
| **Attendance** | Check-in/out; geo optional for salaried base pay |
| **Earnings dashboard** | Staff sees jobs done, rates, petrol, deductions, net payable |
| **Petrol policy** | Included in rate OR ₹X/km from depot to job (logged distance) |
| **Verification** | Document upload → admin approve → account activated |
| **Training** (future) | Modules + exam → certification badge on profile |

#### Assignment logic (priority order)

1. Default asset→staff map (daily cleaning)  
2. Staff qualification + zone + availability  
3. Load balancing (max jobs/day)  
4. Proximity (future: nearest available)  
5. Manual override by partner/admin  

**Design rule:** Staff never see other staff’s earnings. Partners see their city’s staff, not national.

---

### Notification Engine

**Purpose:** Every business event reaches the right person on the right channel.

#### Architecture

```
Business Event → Notification Router → Template Engine → Channel Adapters → Delivery Log
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
                  SMS                    WhatsApp                      Email
                 (MSG91)                  (MSG91)                    (Resend)
                    │                         │                         │
                    └─────────────────────────┼─────────────────────────┘
                                              ▼
                                    Push (FCM) + In-App
```

#### Event catalog (examples)

| Event | Customer | Staff | Partner | Admin |
|---|---|---|---|---|
| Booking confirmed | ✓ | ✓ | — | — |
| Staff assigned | ✓ | ✓ | — | — |
| Service completed | ✓ | — | — | — |
| Low wallet balance | ✓ | — | — | — |
| Wash credits due | ✓ | — | — | — |
| Payment reminder | ✓ | — | ✓ | ✓ |
| Complaint filed | ✓ | — | ✓ | ✓ |
| Missed service | ✓ | ✓ | ✓ | ✓ |
| Contract expiring | ✓ | — | ✓ | — |

#### Design principles

- **Template-driven:** Admin configures message templates per event × channel  
- **Preference-aware:** Customer opts out of marketing; transactional always allowed  
- **Idempotent:** Same event doesn’t spam (dedupe key per booking+event)  
- **Delivery log:** Sent, delivered, failed, retry — for support debugging  
- **Quiet hours:** No SMS 10pm–8am except urgent  

**Design rule:** No module sends SMS directly. All go through Notification Engine.

---

## Section 3 — Territory Architecture

### Hierarchy

```
India (platform)
 └── State (GST / compliance grouping)
      └── City (commercial unit — e.g. Varanasi, Patna)
           └── Zone (operational cluster — e.g. Lanka, Sigra, BHU Campus)
                └── Partner (franchisee or CWP-owned)
                     └── Staff (field workforce)
```

### Why zones matter

Cities are too large for one operations manager to mentally map. **Zones** enable:

- Staff routes grouped geographically (daily cleaning efficiency)  
- Lead assignment by area  
- Pricing micro-adjustments (premium zones)  
- SLA and complaint routing to nearest partner staff  
- Analytics: revenue and completion rate per zone  

Varanasi might launch with **one city, two zones**. Patna might launch with **three zones**. At 100 cities, zones prevent operational chaos without splitting the legal entity per neighborhood.

### Expansion example

| City | Launch model | Zones (initial) | Partner |
|---|---|---|---|
| **Varanasi** | CWP direct (Tushar = admin + implicit partner) | Lanka-South, Central, Assi-BHU | None or self-partner |
| **Patna** | Type 1 City Partner onboarded | Boring Road, Kankarbagh, Bailey Road | Patna Partner + staff hired locally |
| **Lucknow** (future) | Same playbook | 3–5 zones | City partner after Patna playbook proven |

**Customer experience:** Customer selects city at registration or asset location determines city. Services only offered where territory is **active** (catalog + staff + pricing configured).

**Design rule:** Every booking, contract, staff member, and lead carries `territoryId` (city + zone). Filters and permissions use territory, not free-text city names.

---

## Section 4 — Partner Architecture

### Partner hierarchy

| Type | Name | Model | Status |
|---|---|---|---|
| **Type 1** | City Partner | Owns city ops under CWP brand; hires staff; manages leads & complaints | **Current target** |
| **Type 2** | Independent Service Partner | Individual or small team; platform assigns overflow bookings | Future |
| **Type 3** | Car Wash Center Partner | Physical center; urgent/walk-in capacity on platform credentials | Future |

### Type 1 — City Partner (current)

**Who:** Entrepreneur runs Patna (or any city) under CWP playbook.

| Responsibility | Platform | Partner |
|---|---|---|
| Brand & catalog | Sets national service definitions | Uses as-is; local pricing within bands |
| Staff hiring & KYC | Verification workflow | Recruits; submits docs |
| Daily operations | Auto-scheduling engine | Handles exceptions, reassignments |
| Leads & complaints | CRM tools | First-line response |
| Customer payments | Collects to CWP account (Phase 1) | Views city metrics; no settlement initially |
| Quality | Photo proof standards | Monitors completion rates |

**Permissions:** Scoped to `cityId` + `partnerId`. Cannot see other cities. Cannot change global catalog. Can assign staff, resolve complaints, view city P&L (when finance module exists).

### Type 2 — Independent Service Partner (future)

**Who:** Skilled technician registered as partner-individual.

- Platform generates booking → partner accepts → completes → paid per job  
- No staff roster; partner is the worker  
- Useful for sparse zones or specialty services  

**Permissions:** Own jobs only; earnings view; limited customer PII (name, address, phone for job).

### Type 3 — Car Wash Center Partner (future)

**Who:** Existing physical car wash with idle bays.

- Customer books urgent slot → routed to center if staff field capacity full  
- Center fulfills under CWP branding; revenue share model  
- Integrates online demand with offline capacity  

**Permissions:** Center calendar, slot inventory, local staff sub-accounts optional.

### Partner onboarding flow (Type 1)

```
Super Admin creates City + Partner record
    → Partner agreement signed (digital)
    → Partner account created
    → Partner adds staff (pending verification)
    → Super Admin / delegated verifier approves staff
    → Catalog & pricing activated for city
    → Leads route to partner
    → Go live
```

---

## Section 5 — Customer Experience Architecture

### Ideal journey map

```
Discover (web/SEO/referral)
    → Register (phone OTP)
    → Profile (name, email, home city)
    → Add Asset(s) (car details + parking pin OR solar panels + site pin)
    → Choose service (one-time / contract)
    → Pay or recharge wallet
    → Track bookings & history
    → Renew / top-up / complain as needed
```

### Registration

- Phone OTP primary; password optional  
- City selection (or inferred from location)  
- Terms + notification consent  

### Asset onboarding

| Asset | Steps |
|---|---|
| Car | Make, model, color, registration → pin parking location on map → optional photo |
| Solar | Panel count, kW, address pin → optional site photo |

Multiple assets supported in one session. Primary asset flagged for dashboard default.

### Booking

| Flow | UX |
|---|---|
| One-time doorstep wash | Select asset → service + addons → date/time → confirm → pay/wallet |
| Schedule package wash | Select asset → "use 1 credit" → pick slot if staff check needed |
| Daily cleaning signup | Select asset → choose plan → recharge wallet (min 1 month) → staff assigned by ops |
| Solar one-time | Select site → panel count → price computed → book |
| Solar AMC | Select site → 6/12 month plan → pay → monthly jobs auto-scheduled |

### Service history

- Per asset timeline: date, service type, staff name, before/after photos, rating  
- Calendar view for daily cleaning (green done, red missed, grey scheduled)  
- Download/share proof for resale or dispute  

### Complaints

- From booking or general → category → description → photos  
- Status: open → partner reviewing → resolved → customer confirms  
- SLA timer visible to customer  

### Wallet

- Balance prominent on dashboard  
- Recharge (UPI/cash recorded/admin link)  
- Transaction history  
- Low balance banner with one-tap recharge  

### AMC visibility (solar & packages)

- Progress bar: **8 of 12 cleanings completed**  
- Next scheduled date  
- History with photos  
- Renew CTA before expiry  

---

## Section 6 — Staff Experience Architecture

**Principle:** Mobile-first PWA → native app. Staff live on phone in the field.

### Daily car cleaning flow

```
06:30 — Push: "12 cars scheduled today"
    → Open app → ordered route list (by zone proximity)
    → Tap car #1 → map navigate to parking pin
    → Arrive → geo check (optional at scale) → "Start"
    → Capture BEFORE photo (camera, no gallery)
    → Perform clean
    → Capture AFTER photo
    → Mark Complete → auto: wallet debit, customer notify, next car
    → End of day → earnings summary
```

**Exception paths:** Car not found, customer refused, rain — remark + skip/partial with manager notification.

### Doorstep wash flow

```
Notification: new job assigned (or accepted from pool)
    → View: customer, car, service, addons, address, time window
    → Navigate → Start → Before photo
    → Complete service (checklist per SKU)
    → After photo → Complete
    → Optional: customer rating prompt
```

**Package wash:** Same flow; system decrements contract credit on complete.

### Solar cleaning flow

```
Assigned monthly AMC job OR one-time booking
    → Site address + panel count + access notes
    → Navigate → Before photo (array/panels visible)
    → Clean → After photo
    → Complete → AMC credit −1; customer notified
    → Future: optional kW reading field
```

### Staff app modules

| Module | Purpose |
|---|---|
| Today | Active job queue |
| Schedule | Upcoming 7 days |
| Earnings | Jobs × rate, petrol, net |
| Attendance | Salaried check-in |
| Profile | Docs, qualifications |

---

## Section 7 — Automation Architecture

**Goal:** Urban Company–level automation with franchise accountability. Manual intervention only for exceptions.

### Automation catalog

| Automation | Trigger | Action |
|---|---|---|
| **Daily cleaning scheduler** | Cron 05:00 IST | For each active daily contract: if not off-day, balance OK, staff mapped → create booking |
| **Off-day skip** | Wed (configurable) | No booking; log skip reason |
| **Wallet low alert** | Balance < N days rate | Notify customer + admin |
| **Auto-pause contract** | Balance = 0 | Pause contract; notify |
| **Auto-resume** | Recharge crosses threshold | Resume; schedule tomorrow |
| **Wash credit reminder** | Package has unused credits nearing expiry | Notify customer to schedule |
| **Included wash due** | Daily package includes 2 washes/month unused | Remind + offer schedule slot |
| **Staff assignment** | Booking created | Auto-assign by map/rules or queue for partner |
| **Booking confirmed notify** | Booking confirmed | Customer + staff SMS/WA |
| **Completion notify** | Booking completed | Customer + invoice/receipt |
| **Missed detection** | Grace passed | Mark missed; notify customer, staff, partner |
| **Auto-invoice** | Completion + config | Generate invoice/receipt |
| **Renewal reminder** | Contract T−30, T−7, T−1 | Customer notify |
| **Complaint SLA** | Open > 24h | Escalate to admin |

### Scheduler architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Job Orchestrator                        │
│  (cron + idempotent job records + retry)                 │
└────────────┬────────────────────────────────────────────┘
             │
    ┌────────┼────────┬────────────┬──────────────┐
    ▼        ▼        ▼            ▼              ▼
 Daily    Missed   Renewal    Low balance    Report
 tick     checker  reminders   checker       jobs
```

**Design rule:** Every automated action is idempotent (safe to re-run). Job log retained for audit.

---

## Section 8 — Multi-City Scalability

### Scaling stages without redesign

| Stage | Cities | Architecture stress | Response |
|---|---|---|---|
| **Seed** | 1 (Varanasi) | None | Single branch; admin operates all |
| **Early** | 2–3 (Patna) | Partner permissions | Type 1 partner; territory scoping |
| **Regional** | 10 | Pricing, staff, leads per city | Zone layer; partner dashboard |
| **National** | 100 | Data volume, notification cost, support | Read replicas, event queue, tier-2 support tools |

### What scales horizontally (no redesign)

| Layer | Scale approach |
|---|---|
| API servers | Stateless; scale instances |
| Database | Read replicas; partition by territoryId if needed |
| File storage | CDN + object storage (Cloudinary/S3) |
| Notifications | Queue + worker pool |
| Schedulers | Single leader election or external cron hitting idempotent endpoints |

### What is configured, not coded, per city

- Service catalog availability  
- Pricing (within national bands)  
- Zones and staff roster  
- Partner assignment  
- Local GST entity (future)  
- Marketing landing content  

### Anti-patterns to avoid

- Hardcoding city names in business logic  
- Separate databases per city  
- Separate apps per city  
- Partner-specific code forks  

**Design rule:** New city = new rows in territory + partner + pricing config, not new deployment.

---

## Section 9 — MVP vs Scale Architecture

Strict prioritization. **P0 is Varanasi launch only.**

| Capability | P0 Varanasi MVP | P1 Post-Launch | P2 Patna Expansion | P3 National Scale |
|---|---|---|---|---|
| Customer registration + login | ✓ | OTP hardening | — | SSO, household |
| Single city (Varanasi) | ✓ | — | Patna territory | Multi-city self-serve |
| Car asset CRUD | ✓ | Parking pin map | — | Fleet assets |
| Solar site CRUD | ✓ | — | — | IoT kW |
| One-time doorstep wash booking | ✓ | Addons | — | — |
| Wash packages (credits) | Basic | Full UX | — | — |
| Daily cleaning contract | ✓ | Wash quota in package | — | — |
| Solar AMC contract | ✓ | Customer AMC dashboard polish | — | — |
| Wallet + manual recharge | ✓ | Auto-debit on complete | Online recharge | Holds, refunds |
| Admin invoice + PDF | ✓ | Auto-invoice | — | Multi-GSTIN |
| Staff mobile job list | ✓ | UX polish | — | Offline queue |
| Before/after photos | ✓ | Enforce before start | — | AI quality check |
| SMS notifications (critical) | ✓ | WhatsApp templates | — | Push + preferences |
| In-app notifications | ✓ | — | — | — |
| Daily auto-scheduler | ✓ | Wed off-day | — | ML demand |
| Vehicle→staff map | ✓ | Day override UI | — | Auto-route |
| Staff verification + login | ✓ | — | — | Training module |
| Admin ops dashboard | ✓ | — | — | — |
| Complaints | ✓ | SLA automation | Partner queue | — |
| City partner portal | ✗ | Optional | ✓ Type 1 Patna | Type 2/3 |
| Zones | ✗ | Varanasi 2 zones | Patna zones | Full |
| Geofencing | ✗ | Pilot | Rollout | — |
| Razorpay | ✗ | ✓ | — | Subscriptions |
| Coupons | ✗ | ✓ | — | Referral |
| CRM / Leads | ✗ | Enable if sales | Partner leads | Marketing automation |
| Churned campaigns | ✗ | ✗ | ✓ | — |
| Franchise settlement | ✗ | ✗ | Design | ✓ |
| Analytics BI | Basic KPIs | ✗ | City P&L | National |
| PWA installable | ✗ | ✓ | — | Native app |
| Multi-language | ✗ | Hindi | — | Regional |
| B2B corporate | ✗ | ✗ | ✗ | ✓ |

**P0 exclusion rule:** If Varanasi can launch without it, it is not P0.

---

## Section 10 — Technical Architecture Principles

Non-negotiable principles for all future development:

| # | Principle | Implication |
|---|---|---|
| 1 | **Asset-first design** | Every feature asks: which asset? No orphan bookings. |
| 2 | **Contract-first recurring services** | One engine for daily, package, AMC — templates differ, engine same |
| 3 | **Wallet-first billing** | Balance + ledger; debit on delivery; pause when empty |
| 4 | **Multi-city ready** | territoryId on all entities; no city string logic |
| 5 | **Mobile-first workforce** | Staff UX designed for 5" screen in sunlight |
| 6 | **Automation over manual** | If ops does it daily, automate within 2 releases |
| 7 | **Event-driven notifications** | Business events → notification router; no direct SMS calls |
| 8 | **Proof of service** | Before/after photos required for completion (configurable per SKU) |
| 9 | **Tenant isolation** | Partner/staff/customer see only their scope — always |
| 10 | **GST-inclusive customer pricing** | Display = pay; invoice shows breakdown |
| 11 | **Idempotent automation** | Schedulers safe to retry; job log for audit |
| 12 | **Reuse over rewrite** | Extend engines; don’t fork for new service lines |
| 13 | **Configuration over code** | New city = config rows, not deploy |
| 14 | **API contract-first** | OpenAPI → typed clients; single source of truth |
| 15 | **Progressive enhancement** | MVP manual where needed (admin records cash); automate next |

---

## Section 11 — Final Architecture Recommendation

### System blueprint

```
                         ┌──────────────────────────────────────┐
                         │           PUBLIC CHANNELS             │
                         │  Web · PWA · (future Native App)      │
                         └─────────────────┬────────────────────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
     ┌────────────────┐         ┌────────────────┐         ┌────────────────┐
     │   CUSTOMER     │         │    STAFF       │         │ ADMIN/PARTNER  │
     │   PORTAL       │         │    PORTAL      │         │   CONSOLE      │
     └───────┬────────┘         └───────┬────────┘         └───────┬────────┘
             │                          │                          │
             └──────────────────────────┼──────────────────────────┘
                                        │
                                        ▼
                         ┌──────────────────────────────────────┐
                         │         API GATEWAY + AUTH            │
                         │   RBAC · Territory Scope · Sessions   │
                         └─────────────────┬────────────────────┘
                                           │
     ┌─────────────┬─────────────┬─────────┴─────────┬─────────────┬─────────────┐
     ▼             ▼             ▼                   ▼             ▼             ▼
┌─────────┐  ┌─────────┐  ┌───────────┐      ┌───────────┐  ┌─────────┐  ┌─────────┐
│ CUSTOMER│  │  ASSET  │  │ CONTRACT  │      │  BOOKING  │  │ BILLING │  │WORKFORCE│
│ ENGINE  │  │ ENGINE  │  │  ENGINE   │      │  ENGINE   │  │ ENGINE  │  │ ENGINE  │
└────┬────┘  └────┬────┘  └─────┬─────┘      └─────┬─────┘  └────┬────┘  └────┬────┘
     │            │             │                  │             │            │
     └────────────┴──────┬──────┴──────────────────┴──────┬──────┴────────────┘
                         │                                  │
                         ▼                                  ▼
              ┌─────────────────────┐            ┌─────────────────────┐
              │  TERRITORY ENGINE   │            │ NOTIFICATION ENGINE │
              │  India→City→Zone    │            │ SMS·WA·Email·Push   │
              └─────────────────────┘            └─────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   JOB ORCHESTRATOR  │
              │  Schedulers · Cron  │
              └─────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │ PostgreSQL · Storage│
              │  · Payment Gateway  │
              └─────────────────────┘
```

### Interaction flows

#### Flow A — Daily cleaning (fully automated)

```
Contract Engine (active daily contract, asset mapped to staff)
    → Job Orchestrator (05:00: skip Wed, check wallet)
    → Booking Engine (create scheduled booking)
    → Notification Engine (staff: today's list; customer: optional)
    → Workforce Engine (staff completes + photos)
    → Booking Engine (complete)
    → Billing Engine (wallet debit + ledger entry)
    → Notification Engine (customer: done + photos)
```

#### Flow B — Customer books one-time wash

```
Customer Portal
    → Asset Engine (select car)
    → Booking Engine (create + price from catalog)
    → Billing Engine (wallet charge or pay link)
    → Workforce Engine (assign staff)
    → Notification Engine (confirmations)
    → [same completion flow as A]
```

#### Flow C — Solar AMC monthly job

```
Contract Engine (AMC active, next due = today)
    → Job Orchestrator (monthly tick)
    → Booking Engine (create solar job on solar asset)
    → Workforce Engine (solar-qualified staff assigned)
    → [completion decrements AMC credit]
    → Customer Portal (AMC progress updated)
```

#### Flow D — Patna partner operates city

```
Territory Engine (scope = Patna)
    → Partner Console (leads, complaints, staff, bookings)
    → All engines respect partnerId + cityId scope
    → Billing Engine (payments still to CWP — Phase 1)
    → Analytics (city KPIs only)
```

### Data ownership summary

| Entity | Owner engine | Key relationships |
|---|---|---|
| Customer | Customer Engine | 1:N assets, 1:1 wallet, 1:N contracts |
| Asset | Asset Engine | N:1 customer; 1:N bookings; 0:1 default staff |
| Contract | Contract Engine | N:1 customer, N:1 asset, 1:N bookings generated |
| Booking | Booking Engine | N:1 asset, N:1 contract?, N:1 staff |
| Wallet transaction | Billing Engine | N:1 customer; links to booking/invoice |
| Staff | Workforce Engine | N:1 territory; qualification tags |
| Notification | Notification Engine | N:1 user; triggered by events |

### 3–5 year convergence path

| Year | Focus |
|---|---|
| **Y1** | Unify on asset + contract + wallet models; Varanasi live; Patna partner |
| **Y2** | Full automation suite; Razorpay; zones; partner settlement design |
| **Y3** | 10 cities; Type 2 partners; PWA/native; Hindi; B2B pilot |
| **Y4** | 50+ cities; new asset types; IoT solar; route optimization |
| **Y5** | National catalog; platform API for partners; white-label optional |

### Final statement

CWP’s target architecture is a **unified field-service operating system**: customers own assets and contracts, wallets fund daily consumption, contracts spawn bookings, staff prove delivery, billing follows automatically, and notifications bind the loop — all scoped by territory and partner.

Build toward this blueprint incrementally. **P0 proves the loop in Varanasi.** Every subsequent release extends the same engines rather than inventing parallel systems.

---

*Companion documents:*  
- `MASTER_PLAN.md` — business plan and phased roadmap  
- `CWP_ARCHITECTURE_AUDIT.md` — current-state forensic audit and gap analysis  

*This document is the target state. Implementation should converge here over 3–5 years.*
