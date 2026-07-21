# Experience Contract (Frozen)

**Status:** Frozen prior to production API integration  
**Machine types:** `content/experienceContract.ts` + `content/heroTypes.ts`  
**Rule:** Section components are **presentation-only**. APIs and CMS never change JSX structure — only adapters map into these view-models.

---

## 1. Architectural rules

1. **Presentation-only components** — receive view-models (`*View` types). No `useHomepagePlans`, `fetch`, or DTO imports inside section files.
2. **Adapters own mapping** — e.g. `adapters/mapHomepagePlans.ts` converts `HomepagePlanCard[]` → `PlanCardView[]`.
3. **Same props shape in every UI state** — loading / empty / error / skeleton wrap the section; they do not invent alternate prop trees.
4. **Defaults are valid contracts** — static defaults used today must satisfy Required fields so adapters can replace fields without redesign.
5. **Journey order is frozen** — see Journey Map (Phase 4). Do not reorder sections to fit an API.

### UI state envelope

```ts
type ExperienceSectionState<T> = {
  status: "idle" | "loading" | "success" | "empty" | "error";
  data: T | null;
  errorMessage?: string;
};
```

| State | Presentation behaviour |
|--------|-------------------------|
| **loading** | Show skeleton matching section layout (no layout shift) |
| **skeleton** | Same as loading — reserved for first paint / Suspense fallbacks |
| **empty** | Keep section chrome (eyebrow/title); show calm empty copy; no fake cards unless marked `isPlaceholder` |
| **error** | Keep chrome; inline non-blocking message; optional retry callback from parent/adapter |
| **success** | Render `data` |

Parents (orchestrators / containers) own fetching. Sections only render.

---

## 2. Ownership legend

| Owner | Meaning |
|--------|---------|
| **CMS** | Homepage sections / copy / media URLs via catalog homepage CMS (`HomepageSection`, brand CMS) |
| **API** | Live catalog/pricing/ops data (`HomepagePlanCard`, solar slabs, etc.) |
| **Branding** | `BrandingProvider` (name, phone, address, logos) |
| **Client** | Computed in browser (calculator math, division, session) |
| **Static** | Checked-in defaults until CMS/API wired — still must match contract |
| **Hybrid** | CMS copy + API numbers (adapter merges) |

---

## 3. Shared chrome

### 3.1 MarketingNav → `MarketingNavView`

| | |
|--|--|
| **Required** | `links[]` (`id`, `label`, `href`) |
| **Optional** | — (brand mark comes from Branding, not this contract) |
| **Loading** | Nav chrome + logo skeleton; links may use static defaults |
| **Empty** | Hide link row; keep logo + auth CTAs |
| **Error** | Fall back to static `links` |
| **Skeleton** | Pulsing link placeholders (desktop only) |
| **CMS** | Optional override of link labels/hrefs (`sectionKey: nav`) |
| **API** | None |
| **Branding** | Logo, brandName, tagline, supportPhone |

### 3.2 Hero → `HeroContentBundle` (`heroTypes.ts`)

| | |
|--|--|
| **Required** | `selector`, `vehicle`, `solar`; per journey: `contentKey`, `headline.before/emphasis`, `subheading`, `trustPills` (≥1), `ctas` (≥1), `media`, `tintClass` |
| **Optional** | `locale`, `locationLabel`, `socialProof`, `liveChip`, `stats`, `headline.eyebrow/after`, CTA `variant/external`, media dimensions / video fields |
| **Loading** | Hero layout skeleton: headline bars + media rectangle |
| **Empty** | Not allowed for hero — adapter must supply static fallback bundle |
| **Error** | Static `defaultHeroContent` |
| **Skeleton** | Media shimmer (`cwp-skeleton`); text bars |
| **CMS** | Copy, media URLs, CTAs, pills (`sectionKey: hero` / A-B variant) |
| **API** | Optional live chip / weekly stats later — mapped into `liveChip` / `stats` strings only |
| **Client** | Division selection via `ExperienceProvider` (not hero props) |

### 3.3 Contact → `ContactView`

| | |
|--|--|
| **Required** | `eyebrow`, `title`, `subtitle`, `phoneDisplay`, `phoneTel`, `addressLine` |
| **Optional** | — |
| **Loading** | Text skeleton |
| **Empty** | Hide phone if missing; keep area fallback line |
| **Error** | Static Varanasi defaults |
| **Skeleton** | Two-line pulse |
| **CMS** | Optional subtitle |
| **API** | None |
| **Branding** | `supportPhone`, `address` (primary source) |

### 3.4 MarketingFooter → `MarketingFooterView`

| | |
|--|--|
| **Required** | `blurb`, `explore[]`, `legal[]` |
| **Optional** | — |
| **Loading** | Footer structure + skeleton columns |
| **Empty** | Legal links must never empty — static legal routes required |
| **Error** | Static legal + explore |
| **Skeleton** | Column pulses |
| **CMS** | Blurb, explore labels |
| **API** | None |
| **Branding** | brandName, tagline, logo |

### 3.5 AppCallout → `AppCalloutView` (embedded, not a page section)

| | |
|--|--|
| **Required** | `message` |
| **Optional** | `href` (default `/register`), `ctaLabel` |
| **Loading / skeleton** | Inline single-line pulse inside parent section |
| **Empty** | Omit callout entirely |
| **Error** | Omit or static message |
| **CMS** | Per-section callout strings |
| **API** | None |

### 3.6 BeforeAfterSlider → `MediaAssetView`

| | |
|--|--|
| **Required** | `src`, `alt` |
| **Optional** | `width`, `height` |
| **Loading / skeleton** | Aspect box + shimmer |
| **Empty / error** | Hide slider; parent gallery shows tiles only or static asset |
| **CMS** | Image URL + alt |
| **API** | None (unless media service later — still map to `src`/`alt`) |

---

## 4. Vehicle experience → `VehicleExperienceContract`

### 4.1 MorningStory ★ (signature) → `MorningStoryView`

| | |
|--|--|
| **Required** | `copy` (`signatureLabel`, `eyebrow`, `title`), `benefits[]` (≥1), `timeline[]` (≥1: `id`, `time`, `title`, `body`, `icon`), `effortLabel`, `effortValue`, `appCallout` |
| **Optional** | `copy.desc` |
| **Loading** | Two-column skeleton (text + card) |
| **Empty** | N/A — static fallback required |
| **Error** | Static default story |
| **Skeleton** | Timeline row pulses |
| **CMS** | All copy, benefits, timeline text, effort strings, app callout |
| **API** | None (do not live-bind “jobs happening now” here) |

### 4.2 HowItWorks → `HowItWorksView`

| | |
|--|--|
| **Required** | `copy` (eyebrow, title), `steps[]` (exactly 4 preferred; min 3): `id`, `n`, `title`, `body`, `media`, `appCallout` |
| **Optional** | `copy.desc` |
| **Loading** | 2×2 card skeletons |
| **Empty** | Keep title; show “Process coming soon” — rare |
| **Error** | Static steps + local images |
| **Skeleton** | Image + title pulses |
| **CMS** | Copy, step text, media URLs |
| **API** | None |

### 4.3 Packages → `PackagesView`

| | |
|--|--|
| **Required** | `copy`, `plans[]` (≥1): `id`, `tag`, `title`, `priceFrom`, `period`, `body` |
| **Optional** | `highlight`, `href`, `appCallout`, `secondaryCta` |
| **Loading** | Three plan-card skeletons |
| **Empty** | Chrome + “Plans unavailable — contact us”; keep Contact CTA path |
| **Error** | Static indicative plans (current defaults) |
| **Skeleton** | Price + title bars |
| **CMS** | Eyebrow/title/desc, tags, bodies |
| **API** | **Primary later:** `GET /catalog/homepage-plans` → adapter → `PlanCardView` (`HomepagePlanCard`) |
| **Hybrid** | CMS copy + API `price` / `name` / `features` |

**Adapter note:** Format `price` as `priceFrom` display string; map `isHighlighted` → `highlight`; never pass raw `HomepagePlanCard` into the section.

### 4.4 Gallery → `GalleryView`

| | |
|--|--|
| **Required** | `copy`, `beforeAfter` (`src`, `alt`), `tiles[]` (≥1 with `tag`) |
| **Optional** | tile dimensions |
| **Loading** | Before/after aspect skeleton + horizontal tile pulses |
| **Empty** | Hide section if no media after error+fallback failure |
| **Error** | Bundled landing JPGs |
| **Skeleton** | `cwp-skeleton` on media |
| **CMS** | Media URLs, alts, tags, copy |
| **API** | Optional future media library — still `MediaAssetView` |

### 4.5 Testimonials → `TestimonialsView`

| | |
|--|--|
| **Required** | `copy`, `items[]` (≥1): `id`, `name`, `area`, `quote` |
| **Optional** | `rating`, `avatarUrl` |
| **Loading** | Two quote-card skeletons |
| **Empty** | Hide section (do not invent fake names) |
| **Error** | Static curated quotes |
| **Skeleton** | Quote line pulses |
| **CMS** | **Primary:** `HomepageSection` `sectionKey: testimonials` (or vehicle-specific key) |
| **API** | None required; CMS content JSON mapped by adapter |

### 4.6 FAQ → `FaqView`

| | |
|--|--|
| **Required** | `copy`, `items[]` (≥1): `id`, `question`, `answer` |
| **Optional** | — |
| **Loading** | Accordion row skeletons |
| **Empty** | Hide section |
| **Error** | Static FAQ |
| **Skeleton** | Trigger bar pulses |
| **CMS** | FAQ items JSON |
| **API** | None |

### 4.7 ExperienceCTA (vehicle) → `ExperienceCtaView`

| | |
|--|--|
| **Required** | `eyebrow`, `headline`, `sub`, `primary`, `secondary` |
| **Optional** | `whatsappEnabled` (default true) |
| **Loading** | Dark band + text skeleton |
| **Empty** | N/A — static fallback |
| **Error** | Static CTA |
| **Skeleton** | Headline bars |
| **CMS** | Headlines / button labels |
| **API** | None |
| **Branding** | WhatsApp / tel number |

---

## 5. Solar experience → `SolarExperienceContract`

### 5.1 Education → `EducationView`

| | |
|--|--|
| **Required** | `copy`, `points[]` (≥1), `bars[]` (≥1): `id`, `label`, `pct`, `tone` |
| **Optional** | — |
| **Loading** | Text + bar track skeletons |
| **Empty** | N/A |
| **Error** | Static education |
| **Skeleton** | Bar width pulses |
| **CMS** | Copy, points, bar labels/pcts |
| **API** | None |

### 5.2 Proof → `ProofView`

| | |
|--|--|
| **Required** | `copy`, `bullets[]`, `chart.days[]` (`day`, `expectedKwh`, `actualKwh`), `chart.caption`, `chart.badge`, `totals.*` |
| **Optional** | — |
| **Loading** | Chart area skeleton |
| **Empty** | N/A |
| **Error** | Static illustrative week |
| **Skeleton** | Bar chart pulses |
| **CMS** | Copy, bullets, caption; optional chart series |
| **API** | Future anonymized sample series only — map into `ProofChartDayView` (never raw inverter DTO) |

### 5.3 Calculator ★ (signature) → `CalculatorConfigView` + client `CalculatorResultView`

| | |
|--|--|
| **Required (config)** | `copy`, `cities[]` (`key`, `label`, `tariff`, `sunHours`, `dustIndex`), `defaultCityKey`, `defaultKw`, `kwMin`, `kwMax`, `requireInteraction` |
| **Required (result)** | Computed client-side: dust, loss %, kWh, annual ₹, recommendedDays, labels |
| **Optional** | — |
| **Loading** | Inputs enabled with default city list; results panel idle |
| **Empty** | Cities must fall back to static `CITY_PROFILES` |
| **Error** | Static city tariffs; show non-blocking toast/banner |
| **Skeleton** | Results cards pulse after first interaction while recalculating (optional) |
| **CMS** | Calculator headline/desc |
| **API** | **Optional later:** city tariff/sun/dust config endpoint → `CalculatorCityView[]` |
| **Client** | **Primary:** `estimateSolarLoss` math stays client-side |

**Adapter note:** API must not replace the interactive UI with a server-rendered quote. Only calibrate inputs (`tariff`, `sun`, `dustIndex`).

### 5.4 HowWeClean → `HowWeCleanView`

| | |
|--|--|
| **Required** | Same shape as HowItWorks: `copy`, `steps[]`, `appCallout` |
| **Optional** | — |
| **Loading / skeleton / empty / error** | Same patterns as HowItWorks |
| **CMS** | Copy + step media |
| **API** | None |

### 5.5 Packages (solar) → `PackagesView`

| | |
|--|--|
| **Required / optional / states** | Same as vehicle `PackagesView` |
| **CMS** | Segment copy |
| **API** | **Primary later:** solar rate card / slabs (`useSolarRateCard`) → adapter builds `priceFrom` / `period` / titles for home/society/plant cards |
| **Hybrid** | CMS labels + API minimum billing / per-panel |

**Adapter note:** Slab DTOs (`SolarSlab`) never enter the component. Emit `PlanCardView` only. Site-visit-only slabs → `priceFrom: "Custom"`.

### 5.6 Gallery (solar) → `GalleryView`

Same contract as vehicle gallery (different default assets).

### 5.7 Testimonials / FAQ / CTA (solar)

Same shapes as vehicle (`TestimonialsView`, `FaqView`, `ExperienceCtaView`) with solar CMS keys / static defaults.

---

## 6. ExperienceProvider (not a section — behavioural contract)

| Concern | Owner | Notes |
|--|--|--|
| `division` | Client | `vehicle` \| `solar` |
| Persistence | Client | `sessionStorage` key `cwp:division` |
| URL sync | Client | `?division=` via `history.replaceState` |
| Analytics | Client | `trackLandingEvent` |
| Personalization | CMS later | `contentVariant`, `locale` on provider — selects which contract bundle adapters load |

Provider does **not** fetch catalog data. Containers/adapters do.

---

## 7. Adapter layer (required before API wiring)

Suggested location: `features/landing/adapters/`

| Adapter | Input (API/CMS) | Output (contract) |
|--|--|--|
| `mapHeroBundle` | CMS `hero` JSON | `HeroContentBundle` |
| `mapVehiclePackages` | `HomepagePlanCard[]` | `PackagesView` |
| `mapSolarPackages` | solar rate card + CMS labels | `PackagesView` |
| `mapTestimonials` | `HomepageSection` content | `TestimonialsView` |
| `mapFaq` | CMS FAQ JSON | `FaqView` |
| `mapGallery` | CMS media | `GalleryView` |
| `mapCalculatorCities` | config API \| static | `CalculatorConfigView["cities"]` |
| `mapContact` | Branding | `ContactView` |

Each adapter returns `ExperienceSectionState<T>` so orchestrators can pass a single envelope into presentational sections.

---

## 8. Non-goals (explicitly out of contract)

- Raw `HomepagePlanCard`, `SolarSlab`, `HomepageSection` inside experience components  
- Redesigning journey order for API convenience  
- Server-side calculator replacing client interaction  
- Reintroducing removed sections (LiveActivity, Stats strip, standalone AppPromo) without a new contract revision  

---

## 9. Revision policy

1. **Additive optional fields** — allowed without journey redesign.  
2. **Removing/renaming required fields** — requires contract version bump + explicit product approval.  
3. **New sections** — new `*View` type + Journey Map update + this document.  
4. **API changes** — adapters only; contract unchanged.

**Contract version:** `1.0.0` (frozen Phase 4 → pre-API)

---

## 10. Section index (quick reference)

| Section | Type | CMS | API |
|--|--|--|--|
| Nav | `MarketingNavView` | Optional | — |
| Hero | `HeroContentBundle` | Primary | Optional stats/chip |
| MorningStory | `MorningStoryView` | Primary | — |
| HowItWorks | `HowItWorksView` | Primary | — |
| Vehicle Packages | `PackagesView` | Hybrid | `homepage-plans` |
| Vehicle Gallery | `GalleryView` | Primary | — |
| Vehicle Testimonials | `TestimonialsView` | Primary | — |
| Vehicle FAQ | `FaqView` | Primary | — |
| Education | `EducationView` | Primary | — |
| Proof | `ProofView` | Primary | Optional sample series |
| Calculator | `CalculatorConfigView` | Copy | Optional city config |
| HowWeClean | `HowWeCleanView` | Primary | — |
| Solar Packages | `PackagesView` | Hybrid | solar rate card |
| Solar Gallery | `GalleryView` | Primary | — |
| Solar Testimonials | `TestimonialsView` | Primary | — |
| Solar FAQ | `FaqView` | Primary | — |
| CTA | `ExperienceCtaView` | Primary | — |
| Contact | `ContactView` | Optional | Branding |
| Footer | `MarketingFooterView` | Optional | Branding |
