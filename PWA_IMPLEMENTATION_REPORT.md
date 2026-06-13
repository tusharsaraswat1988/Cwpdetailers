# PWA Implementation Report

**Project:** CWP Detailers + Kleansolar (`artifacts/cwp-platform`)  
**Date:** 2026-06-13  
**Scope:** Installable PWA UX upgrade (not offline-first)

---

## Summary

The production SPA (`cwp-platform`) now ships as an installable Progressive Web App across all portals via a single build. `vite-plugin-pwa` generates the service worker, primary manifest, and precached app shell. Portal-specific manifests support scoped install experiences for customer, staff, admin (mobile), and franchisee (mobile) portals.

---

## A. Installable PWA Features

### 1. Files Modified

| File | Change |
|------|--------|
| `artifacts/cwp-platform/vite.config.ts` | Added `VitePWA` plugin, Workbox config, manifest |
| `artifacts/cwp-platform/index.html` | PWA meta tags, viewport-fit, theme-color, apple-touch-icon |
| `artifacts/cwp-platform/package.json` | Added `workbox-window`, `generate-pwa-icons` script |
| `artifacts/cwp-platform/tsconfig.json` | Included `vite-env.d.ts` |
| `artifacts/cwp-platform/public/favicon.svg` | CWP-branded sun icon on cyan background |
| `artifacts/cwp-platform/public/offline.html` | Static offline fallback page |
| `artifacts/cwp-platform/public/manifest-customer.json` | Updated with PNG icons, scoped install |
| `artifacts/cwp-platform/public/manifest-staff.json` | Updated with PNG icons, scoped install |
| `artifacts/cwp-platform/public/manifest-admin.json` | **New** — admin portal manifest |
| `artifacts/cwp-platform/public/manifest-franchisee.json` | **New** — franchisee portal manifest |
| `artifacts/cwp-platform/scripts/generate-pwa-icons.mjs` | **New** — icon generation script |
| `artifacts/cwp-platform/src/main.tsx` | Service worker registration via `virtual:pwa-register` |
| `artifacts/cwp-platform/src/App.tsx` | Global `OfflineScreen` overlay |
| `artifacts/cwp-platform/src/vite-env.d.ts` | **New** — PWA / install prompt types |
| `artifacts/cwp-platform/src/lib/pwa/usePortalManifest.ts` | **New** — dynamic manifest + theme-color per portal |
| `artifacts/cwp-platform/src/lib/pwa/usePwaInstall.ts` | **New** — install prompt state + localStorage dismiss |
| `artifacts/cwp-platform/src/lib/useMediaQuery.ts` | **New** — mobile viewport detection |
| `artifacts/cwp-platform/src/components/pwa/PwaInstallBanner.tsx` | **New** — install banner UI |
| `artifacts/cwp-platform/src/components/pwa/OfflineScreen.tsx` | **New** — in-app offline overlay |
| `artifacts/cwp-platform/src/components/layout/CustomerLayout.tsx` | Portal manifest + install banner |
| `artifacts/cwp-platform/src/components/layout/StaffLayout.tsx` | Portal manifest + install banner |
| `artifacts/cwp-platform/src/components/layout/AdminLayout.tsx` | Portal manifest + mobile-only install banner |
| `artifacts/cwp-platform/src/components/layout/FranchiseeLayout.tsx` | Portal manifest + mobile-only install banner |
| `artifacts/cwp-platform/src/components/layout/PanelShell.tsx` | Safe-area bottom padding on mobile |
| `artifacts/cwp-platform/src/pages/Landing.tsx` | Main-site install banner + safe-area header |

### 2. Dependencies Added

| Package | Version | Role |
|---------|---------|------|
| `workbox-window` | `^7.3.0` | Client-side service worker registration (required by `vite-plugin-pwa`) |

**Already present (now wired):**

| Package | Version |
|---------|---------|
| `vite-plugin-pwa` | `^1.3.0` |
| `@vite-pwa/assets-generator` | `^1.0.2` |
| `sharp` | `^0.35.1` (used by icon generation script) |

### 3. Manifest Configuration

#### Primary manifest (generated: `manifest.webmanifest`)

| Field | Value |
|-------|-------|
| `name` | CWP Detailers + Kleansolar |
| `short_name` | CWP |
| `start_url` | `/` |
| `scope` | `/` |
| `display` | `standalone` |
| `display_override` | `standalone`, `browser` |
| `theme_color` | `#00cccc` |
| `background_color` | `#f5f6f8` |
| `orientation` | `any` |

#### Portal manifests (static, swapped at runtime via `usePortalManifest`)

| Portal | File | `start_url` | `scope` | `theme_color` |
|--------|------|-------------|---------|---------------|
| Customer | `manifest-customer.json` | `/customer/dashboard` | `/customer/` | `#00cccc` |
| Staff | `manifest-staff.json` | `/staff/dashboard` | `/staff/` | `#21252e` |
| Admin | `manifest-admin.json` | `/admin/dashboard` | `/admin/` | `#00cccc` |
| Franchisee | `manifest-franchisee.json` | `/franchisee/dashboard` | `/franchisee/` | `#21252e` |

All manifests include 192×192, 512×512, and maskable 512×512 PNG icons.

### 4. Icons Generated

CWP branding: cyan (`#00CCCC`) background with white sun motif.

| Asset | Path | Size |
|-------|------|------|
| Standard icon | `public/pwa/icon-192.png` | 192×192 |
| Standard icon | `public/pwa/icon-512.png` | 512×512 |
| Maskable icon | `public/pwa/maskable-icon-512.png` | 512×512 (80% safe zone) |
| Apple touch icon | `public/pwa/apple-touch-icon.png` | 180×180 |
| Source SVG | `public/pwa/icon-source.svg` | 512×512 vector |
| Favicon | `public/favicon.svg` | Updated branded SVG |

Regenerate icons: `pnpm --filter @workspace/cwp-platform run generate-pwa-icons`

### 5. Install Prompt Implementation

**Components:** `PwaInstallBanner`, `usePwaInstall`

**Behavior:**

- Listens for `beforeinstallprompt`, stores deferred prompt
- Shows banner only after first user interaction (`pointerdown` or `keydown`)
- Provides **Install** button (calls `prompt()`), **Not now** dismiss, and close (×) dismiss
- Dismissal persisted in `localStorage` key `cwp-pwa-install-dismissed-{portalKey}`
- Hidden when already running in standalone display mode
- Portal keys: `main`, `customer`, `staff`, `admin`, `franchisee`

**Portal placement:**

| Portal | Install banner |
|--------|----------------|
| Main website (`Landing`) | Always (when installable) |
| Customer | Always (when installable) |
| Staff | Always (when installable) |
| Admin | Mobile viewport only (`max-width: 1023px`) |
| Franchisee | Mobile viewport only |

**Note:** `beforeinstallprompt` is browser-controlled. The banner appears only when the browser deems the app installable (HTTPS, valid manifest, active SW, engagement heuristics). Automated desktop Chrome testing did not fire this event.

### 6. Service Worker Configuration

| Setting | Value |
|---------|-------|
| Plugin | `vite-plugin-pwa` v1.3.0 |
| Mode | `generateSW` (Workbox) |
| Registration | `registerType: "autoUpdate"` via `registerSW({ immediate: true })` |
| Output | `dist/public/sw.js`, `dist/public/workbox-dcde9eb3.js` |
| Dev SW | Enabled (`devOptions.enabled: true`) |

### 7. Mobile App Experience

| Feature | Implementation |
|---------|----------------|
| Viewport | `viewport-fit=cover` in `index.html` |
| Safe area | Existing `.safe-area-top`, `.safe-area-bottom`, `.pb-safe` utilities; applied on `PanelShell` mobile main |
| Standalone | `display: standalone` in all manifests |
| Theme / splash | `theme-color`, `background_color`, `apple-mobile-web-app-*` meta tags |
| Browser chrome | `100dvh` layouts in `AppShell` / `PanelShell` |
| Android install | Maskable icon + 192/512 PNGs meet Chromium install criteria |

---

## B. Offline Features

**Explicitly NOT implemented:** offline booking, wallet, billing, contracts, scheduling, or data sync.

### Allowed offline behavior

| Feature | Implementation |
|---------|----------------|
| Static asset caching | Workbox precache of JS, CSS, HTML, PNG, SVG, JSON, fonts |
| App shell caching | `index.html` + bundled assets precached (26 entries, ~1.65 MB) |
| Offline fallback page | `public/offline.html` — CWP branding, connection message, Retry button |
| In-app offline overlay | `OfflineScreen` — shown when `navigator.onLine` is false |

### Caching strategy

| Strategy | Targets |
|----------|---------|
| **Precache** (`precacheAndRoute`) | App shell: `index.html`, bundled JS/CSS, icons, manifests, `offline.html`, `favicon.svg` |
| **Navigation fallback** | Unmatched navigations while offline → `/offline.html` (denylist: `/api`) |
| **CacheFirst** (runtime) | `fonts.googleapis.com`, `fonts.gstatic.com` (1-year expiry) |
| **No runtime cache** | API routes (`/api/*`) — always network |

### Offline screen content

- CWP sun icon branding
- “Connection lost” heading
- Message that live bookings, wallet, and billing require connectivity
- Retry button (`window.location.reload()` on static page; same on React overlay)

---

## 8. Desktop Testing Results

**Environment:** Windows 10, Chrome (Cursor embedded browser), `vite preview` on `http://localhost:4173`

| Test | Result |
|------|--------|
| Production build | **Pass** — completed in ~38s |
| Landing page load | **Pass** |
| `manifest.webmanifest` linked | **Pass** — `http://localhost:4173/manifest.webmanifest` |
| `theme-color` meta | **Pass** — `#00cccc` |
| Service worker registration | **Pass** — active `sw.js` |
| `offline.html` standalone page | **Pass** — branding, message, Retry button visible |
| PWA icons (`/pwa/icon-192.png`) | **Pass** — HTTP 200 |
| Install banner UI | **Not triggered** — `beforeinstallprompt` did not fire in automated browser (expected) |
| Admin desktop layout | **Not regression tested in browser** — code limits install banner to mobile viewport only |

---

## 9. Android Testing Results

**Status: NOT TESTED**

No physical Android device or emulator was used in this verification pass.

**Installability checklist (static analysis — not runtime verified on Android):**

- [x] HTTPS required in production (Render serves HTTPS)
- [x] Valid manifest with `name`, `short_name`, `start_url`, `scope`, `display: standalone`
- [x] Icons 192×192 and 512×512 PNG
- [x] Maskable icon with safe-zone padding
- [x] Service worker registered on desktop preview (proxy for SW generation correctness)
- [ ] Actual “Add to Home screen” flow on Android — **not verified**
- [ ] Standalone launch from home screen on Android — **not verified**
- [ ] Offline navigation fallback on Android — **not verified**

---

## 10. Build Results

```text
Command: PORT=21456 BASE_PATH=/ pnpm --filter @workspace/cwp-platform run build

vite v7.3.2 building client environment for production...
✓ 3265 modules transformed.
dist/public/manifest.webmanifest          0.63 kB
dist/public/index.html                    1.36 kB │ gzip:   0.61 kB
dist/public/assets/index-CZHD-wrM.css   127.25 kB │ gzip:  20.25 kB
dist/public/assets/workbox-window...      5.75 kB │ gzip:   2.36 kB
dist/public/assets/index-DwrK23IX.js  1,508.04 kB │ gzip: 409.62 kB
✓ built in ~38s

PWA v1.3.0
mode      generateSW
precache  26 entries (1648.46 KiB)
files generated
  dist/public/sw.js
  dist/public/workbox-dcde9eb3.js
```

**Typecheck:** `tsc -p tsconfig.json --noEmit` — **Pass** (0 errors)

**Chunk size warning:** Main JS bundle > 500 kB (pre-existing; not introduced by PWA work).

---

## Portal Install Experience Summary

| Portal | Installable | App-like UX | Notes |
|--------|-------------|-------------|-------|
| Main website | Yes (primary manifest) | Landing + standalone meta | Install banner on landing |
| Customer | Yes (scoped manifest) | `AppShell` + bottom nav, safe areas | Full mobile PWA layout |
| Staff | Yes (scoped manifest) | `PanelShell` mobile header | Install banner always when eligible |
| Admin | Yes on mobile | Desktop sidebar unchanged | Banner gated to `max-width: 1023px` |
| Franchisee | Yes on mobile | Desktop sidebar unchanged | Banner gated to `max-width: 1023px` |

---

## Deployment Notes

1. Build requires `PORT` and `BASE_PATH` env vars (existing requirement).
2. Service worker and manifest are served from the same origin as the SPA (`render.yaml` static publish path: `artifacts/cwp-platform/dist/public`).
3. Portal manifest paths are absolute (`/manifest-customer.json` etc.) — compatible with `BASE_PATH=/`.
4. After deploy, verify install prompt on a real Android device and iOS Safari (Add to Home Screen uses apple-touch-icon + meta tags).

---

*Report generated after implementation. Claims are limited to tests actually performed.*
