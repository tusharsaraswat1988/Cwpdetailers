# CWP Detailers — Universal Design System Specification

**Project:** CWP Detailers (Admin Portal, Staff App, Customer Web/PWA/App, Branch Manager, Franchisee)  
**Version:** 1.0.0 (DTCG 2025.10 Compliant & Material Design 3 Standardized)  
**Status:** Active Canonical Specification  
**Authority:** Derived using Universal Design System Methodology (`.agents/skills/universal-design-system/SKILL.md`)  
**Living PRD Reference:** `docs/product/CWP_NOIDA_MULTI_CITY_PRD.md` (`UDS-001`, `UDS-002`, `UDS-003`, `UDS-004`)  

---

## 1. System Vision & Purpose

The CWP Detailers Universal Design System provides a coherent, scalable, accessible, and high-performance design foundation across the entire CWP platform ecosystem:
- **Admin Management Portal:** Enterprise operations, dispatch, multi-city franchise control, billing ledger, analytics.
- **Staff Field Application:** High-contrast mobile PWA / Android app for cleaners and technicians in outdoor/basement working conditions.
- **Customer Application:** Trust-building, visual, frictionless mobile/web booking and subscription management for car cleaning and solar panel maintenance.

### Core Philosophy: "One Brand Foundation, Three Distinct Operational Personalities"
Rather than forcing a flat, generic theme across all surfaces, the CWP Design System standardizes underlying token primitives, typography, semantic status models, and Material Design 3 iconography while intentionally adapting **density, touch scale, and visual hierarchy** to the exact operational context of each user role.

---

## 2. Design Principles

### Principle 1: Role-Adapted Coherence
Every surface feels unmistakably part of the CWP Detailers platform (sharing primary brand blue `#1677FF`, midnight `#0B1D36`, and emerald `#16A34A`), but layouts are engineered for the specific user's environment:
- **Admin:** Dense, keyboard-navigable, table-first, high data visibility.
- **Staff:** Outdoor high-contrast, minimum 48px touch targets, single active task focus, colloquial Hindi-first.
- **Customer:** Scannable white surfaces, 16:10 visual cards, 4-tier mobile navigation, zero visual clutter.

### Principle 2: Truthful & Multi-Modal State Communication
Never communicate state or status using color alone. Every status badge, alert, or indicator must pair:
1. High-contrast accessible color (`contrast >= 4.5:1`).
2. Explicit text label (e.g., "सिंक पेंडिंग" / "Pending Sync", "Completed", "Delayed").
3. Official Material Design 3 Symbol (e.g., `check_circle`, `schedule`, `warning`, `sync`).

### Principle 3: Frictionless Task Velocity
- Admin users can filter 100+ rows and trigger bulk assignments in < 3 clicks.
- Cleaners can check in, capture shutter-time GPS proof, and complete a vehicle clean in < 15 seconds.
- Customers can select a service tier, address, and book a visit in < 4 steps.

### Principle 4: Material Design 3 Iconography Standard
Strict adherence to official Google Material Design 3 icon standards (https://m3.material.io/styles/icons/overview):
- Use the official Material Symbols Outlined set (`opsz: 20..24`, `wght: 400..500`, `fill: 0..1`).
- No mixed icon sets (no mixing random outline/solid packs).
- Zero emoji used as user-interface action or status icons.

### Principle 5: Accessibility by Default (WCAG 2.2 Level AA)
- Minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text / graphical borders.
- Minimum interactive touch target of 44×44px (elevated to 48×48px for mobile staff field actions).
- Explicit visible focus rings (`ring-2 ring-primary ring-offset-2`) on all interactive controls.
- Full keyboard navigation (Tab, Enter, Escape, Arrow keys) across all dialogs, comboboxes, and menus.

---

## 3. Design Tokens Architecture (DTCG 2025.10 Compliant)

The token system follows a strict 4-layer taxonomy:
```
1. Primitives (Raw values)
   └── 2. Semantics (Intent-based roles: color.action.primary, color.status.success)
       └── 3. Role-Specific Variants (Admin, Staff, Customer overrides)
           └── 4. Component Implementations (CSS Variables & Tailwind v4 Utilities)
```

### 3.1 Color Foundations

#### A. Core Primitives
- **Brand Blue:** `#1677FF` (`hsl(215, 100%, 54%)`)
- **Brand Dark:** `#0B1D36` (`hsl(216, 66%, 13%)`)
- **Brand Accent Teal:** `#00CCCC` (`hsl(180, 100%, 40%)`)
- **Neutral 50 (Canvas Light):** `#F8FAFC` (`hsl(210, 40%, 98%)`)
- **Neutral 100 (Surface Tint):** `#F1F5F9` (`hsl(214, 32%, 95%)`)
- **Neutral 200 (Border Subtle):** `#E2E8F0` (`hsl(214, 32%, 91%)`)
- **Neutral 300 (Border Strong):** `#CBD5E1` (`hsl(213, 27%, 84%)`)
- **Neutral 400 (Muted Icon):** `#94A3B8` (`hsl(215, 20%, 65%)`)
- **Neutral 500 (Muted Text):** `#64748B` (`hsl(215, 16%, 47%)`)
- **Neutral 800 (Text Secondary):** `#1E293B` (`hsl(217, 33%, 17%)`)
- **Neutral 900 (Text Primary):** `#0F172A` (`hsl(222, 47%, 11%)`)

#### B. Semantic Status Roles
| Status | Tone | Color Hex | HSL Value | M3 Icon | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Completed / Verified** | Success | `#16A34A` | `142 72% 36%` | `check_circle` | Completed wash/clean, paid invoice, approved KYC |
| **In Progress / En Route** | Progress | `#2563EB` | `217 91% 60%` | `pending` / `directions_car` | Active technician journey, cleaning underway |
| **Scheduled / Confirmed** | Info | `#0284C7` | `199 89% 48%` | `calendar_today` | Future appointment, confirmed route |
| **Pending / Syncing / Paused** | Warning | `#D97706` | `38 92% 44%` | `schedule` / `sync` | Offline queue item, paused job, pending payment |
| **Cancelled / Missed / Rejected** | Destructive | `#DC2626` | `0 72% 51%` | `cancel` / `error` | Customer cancelled, missed job, overdue dues |
| **Draft / Closed / Inactive** | Neutral | `#64748B` | `215 16% 47%` | `drafts` / `block` | Draft quotation, closed support ticket |

---

## 4. Typography Scale & Hierarchy

### Font Families
- **Display Headings:** `Outfit`, sans-serif (Weights: 600 Semibold, 700 Bold)
- **Body & Controls:** `Plus Jakarta Sans`, sans-serif (Weights: 400 Regular, 500 Medium, 600 Semibold)
- **Monospace & Aligned Numbers:** `font-variant-numeric: tabular-nums` for prices, timestamps, coordinates.

### Scale Table
| Role | Size | Line Height | Weight | Tracking | Primary Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Hero** | 32px (2rem) | 38px (1.2) | 700 Bold | -0.02em | Landing hero, Admin login banner |
| **Screen Title (H1)** | 24px (1.5rem) | 30px (1.25) | 600 Semibold | -0.015em | Screen headers (Admin, Customer, Staff) |
| **Section Header (H2)**| 18px–20px | 26px (1.3) | 600 Semibold | -0.01em | Dashboard sections, Modal headers |
| **Card Title (H3)** | 16px (1rem) | 22px (1.35) | 600 Semibold | 0 | Service card titles, Table headers |
| **Body Default** | 14px–15px | 20px–22px | 400 Regular | 0 | Descriptions, table cell data, dialog body |
| **Caption / Helper** | 12px–13px | 18px (1.4) | 400 Regular | +0.01em | Helper text, validation hints, timestamps |
| **Micro Badge** | 11px | 14px | 600 Semibold | +0.02em | Status badge pills, tag chips |

---

## 5. Spacing, Sizing & Layout Grid

### Base 4px / 8px Metric Grid
- `space-1` (4px): Micro icon spacing, tight status badge padding.
- `space-2` (8px): Stack gap between title and subtitle, compact chip gap.
- `space-3` (12px): Internal card padding (Admin dense), form field gap.
- `space-4` (16px): Standard mobile page gutter, standard card padding.
- `space-5` (20px): Customer card padding, modal section gap.
- `space-6` (24px): Desktop admin container padding, section divider gap.
- `space-8` (32px): Primary dashboard section separation.

### Interactive Target Dimensions
- **Admin Portal:** Compact 36px control height (`h-9`), dense 32px sm buttons (`h-8`).
- **Customer Portal:** Standard 44px–48px control height (`h-11` / `h-12`), 44px minimum tap area.
- **Staff Field Portal:** Oversized 48px–52px control height (`h-12` / `h-13`), 48px minimum touch target for wet/gloved hands.

---

## 6. Elevation, Borders & Surface Layering

| Elevation | Shadow Token | Border | Usage |
| :--- | :--- | :--- | :--- |
| **Level 0 (Flat)** | `none` | `1px solid var(--border)` | Inset tables, form inputs, secondary panels |
| **Level 1 (Card Micro)** | `0 1px 3px 0 rgba(15,23,42,0.04)` | `1px solid #E2E8F0` | Default customer & staff cards, list rows |
| **Level 2 (Hover/Raised)** | `0 4px 12px -2px rgba(15,23,42,0.07)` | `1px solid #CBD5E1` | Interactive card hover, floating bottom bars |
| **Level 3 (Overlay/Modal)**| `0 10px 25px -3px rgba(15,23,42,0.12)` | `1px solid #CBD5E1` | Dialogs, bottom sheets, dropdown menus |

---

## 7. Material Design 3 Iconography Standard

### Rules of Engagement
1. **Source of Truth:** Official Material Symbols Outlined.
2. **Standard Implementation:** Through `<MaterialSymbol name="..." />` or typed `react-icons/md` SVG components.
3. **Optical Sizing Scale:**
   - **Micro (16px–18px):** Status badges, inline table indicators, breadcrumbs.
   - **Base (20px):** Form input leading icons, compact button icons.
   - **Default (24px):** Navigation items, action bar triggers, list item leading icons.
   - **Prominent (32px):** Metric cards, quick action tiles.
   - **Hero (48px):** Empty state hero illustrations, camera viewfinder targets.
4. **Consistency Enforcement:**
   - Stroke Weight: 400 (Regular) for inactive/content, 500 (Medium) for active navigation.
   - Fill: 0 (Outlined) for default; 1 (Filled) strictly for active selected states.
   - Alignment: Centered in 1:1 square bounding box (`flex items-center justify-center`).

---

## 8. Forms & Data-Entry Standards

1. **Clear Top-Aligned Labels:** Always provide a permanent visible label; never rely on placeholders alone.
2. **Contextual Help Integration:** Form fields with operational significance (e.g. GSTIN, GeoFence Radius, Base Pricing) must include an accessible `(i)` `ContextHelp` popover.
3. **Searchable Combobox for Multi-Item Lists:** Any select input containing > 6 items (cities, branches, vehicle models, zones) must use the accessible `SearchableCombobox` with auto-focus dynamic search and keyboard navigation.
4. **Deterministic Error Handling:** Form error text must render immediately beneath the affected input in `#DC2626` (`text-destructive text-xs mt-1.5`) paired with `aria-invalid="true"`.

---

## 9. Accessibility & Governance

1. **Contrast Checking:** Automated verification using axe-core and Vitest ensures 100% compliance with WCAG 2.2 AA.
2. **Screen Reader Semantics:** Every button without visible text must have an explicit `aria-label`. Decorative icons must have `aria-hidden="true"`.
3. **Keyboard Operability:** All modals, sheets, dropdowns, and comboboxes support Escape to close, Tab to navigate, and Enter/Space to select.
4. **No Breaking Logic Changes:** Visual and architectural upgrades must never modify backend endpoints, payload schemas, or financial/operational calculations.
