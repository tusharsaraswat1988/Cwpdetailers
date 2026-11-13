# Real-Time Technician GPS Tracking Architecture & Privacy Assessment
**Platform:** CWP Detailers Multi-City Platform  
**Document ID:** `TRACK-002` / Phase 17 Architecture Specification  
**Canonical Path:** `docs/architecture/REAL_TIME_GPS_TRACKING_ARCHITECTURE.md`  
**Status:** Approved Architecture Foundation  
**Last Updated:** 2026-11-13  
**Authors:** CWP Architecture & Core Systems Engineering Team  

---

## 1. Executive Summary

As part of Phase 17, CWP Detailers assessed the requirements and architectural patterns for real-time field staff and vehicle location tracking across multi-city operations (Varanasi, Noida, and expansion hubs).

Tracking field staff in motion presents distinct challenges compared to standard consumer delivery apps (e.g., food or ride-hailing):
1. **Operational Environment:** Vehicle cleaning and detailing staff operate heavily inside enclosed and underground residential parking garages (Basement B1, B2, B3) where satellite GPS signals are severely degraded or absent.
2. **Battery & Device Longevity:** Staff carry standard commercial Android smartphones throughout 8-to-10 hour shifts without dedicated vehicle charging mounts.
3. **Privacy by Design & DPDP Compliance:** Cleaners are salaried or hybrid employees, not continuously tracked fleet assets. Continuous background tracking outside active en-route travel breaches privacy, drains device batteries, and violates India's Digital Personal Data Protection (DPDP) Act.
4. **Data Transmission Cost & Architecture:** Continuous duplex WebSockets streaming creates unnecessary server connection overhead during stationary work, while unthrottled polling burdens API gateways.

**Core Architecture Decision for Phase 17:**  
CWP adopts an **Adaptive En-Route Telemetry Model** utilizing state-triggered periodic HTTPS location pings combined with server-side distance/ETA derivation and automatic tracking termination. Continuous streaming WebSockets are deferred until Phase 18 dedicated dispatcher map consoles.

---

## 2. Protocol Evaluation: WebSockets vs. Server-Sent Events (SSE) vs. Adaptive Polling

| Evaluation Dimension | WebSockets (Bidirectional) | Server-Sent Events (SSE) | Adaptive Polling (HTTPS) | Recommendation for CWP |
| :--- | :--- | :--- | :--- | :--- |
| **Connection Overhead** | High (Stateful persistent socket per client, sticky load balancer requirement) | Medium (Long-lived unidirectional HTTP/2 stream, simpler proxy traversal) | Very Low (Stateless standard HTTP, fully CDN/cache compatible) | **Adaptive Polling for Customer, REST Ping for Staff** |
| **Battery Consumption (Mobile)** | High (Constant keep-alive pings prevent mobile radio from entering deep sleep) | Medium (Better than WebSockets; requires active connection maintenance) | Low (Mobile radio awakens only during scheduled transmissions, returns to low-power state) | **Adaptive Polling** minimizes battery drain |
| **Tunneling & Firewall Traversal** | Often blocked or dropped by corporate proxies, carrier NATs, or VPNs | Standard HTTP/HTTPS; traverses 99% of networks smoothly | Standard HTTPS REST; zero proxy or firewall issues | **Adaptive Polling** has highest network resilience |
| **Offline Recovery & Reconnection** | Complex reconnection logic, message queue replay buffers required | Built-in browser retry protocol with Last-Event-ID | Trivial (Idempotent timestamped POST requests with local queue fallback) | **Adaptive Polling** matches offline basement model |
| **Server Concurrency Scalability** | Requires distributed Pub/Sub (Redis/BullMQ) to bridge multi-pod clusters | Scalable over HTTP/2, but ties up server worker threads if un-pooled | Extremely scalable; horizontally stateless across server instances | **Adaptive Polling** preserves backend simplicity |

### Architectural Decision:
- **Staff Client -> Backend:** Periodic REST Location Pings (`POST /api/service-executions/:id/location-ping`) triggered **only** while in the explicit `en_route` operational state. Interval: 30 seconds while traveling.
- **Customer App -> Backend:** Adaptive Polling (`GET /api/bookings/:id/tracking`) using TanStack React Query with `refetchInterval: 30000` while `isEnRoute === true`. Automatically paused when tab is inactive and disabled immediately upon job start (`in_progress`) or completion.
- **Future Dispatcher Console (Admin Phase 18):** Low-overhead Server-Sent Events (SSE) for supervisor real-time bird's-eye cluster monitoring.

---

## 3. Mobile Device Geolocation & Capacitor Capabilities

### 3.1 Web & Hybrid App Realities
Field staff access CWP through a responsive Progressive Web App (PWA) with planned Capacitor Android wrapper:
- **HTML5 Geolocation API (`navigator.geolocation.watchPosition`):**  
  - High accuracy GPS mode (`enableHighAccuracy: true`) provides sub-10 meter resolution outdoors.
  - In deep basements or urban canyons, accuracy degrades to 150m–1000m (cellular tower triangulation).
  - Background execution is aggressively throttled or terminated by Android OEM battery optimization (Doze Mode, Samsung Knox, Xiaomi MIUI Battery Saver).
- **Capacitor Native Background Geolocation:**  
  - Requires explicit foreground service with persistent sticky notification (`"CWP Staff App — Active Service En Route"`).
  - Without a foreground service, the OS kills background location tracking within 60–180 seconds of screen lock.

### 3.2 Battery Optimization & GPS Sampling Strategy
Continuous GPS polling at 1 Hz drains a typical 4,000 mAh smartphone battery by 12–18% per hour. CWP enforces the following battery-conscious sampling rules:
1. **Zero Tracking at Rest:** No location coordinates are collected when the technician is not marked `en_route` to a service.
2. **Adaptive Motion Frequency:**
   - En route (>500m from destination): GPS sampled every 30 seconds.
   - Proximity arrival (within 200m of society/bay): Frequency shifts to 15 seconds to detect arrival.
   - Arrival / Checked-in: Tracking immediately stops.

---

## 4. Multi-Tenant Isolation & City/Branch Boundaries

Location data is classified as sensitive operational and personal data:
1. **City and Branch Scoping:** Location ping ingestion validates that the reporting staff member belongs to the active branch and city authorized for that booking (`rowInScope` & `tenantScope.ts`).
2. **Customer IDOR Isolation:** Customers may **strictly and exclusively** view the location and ETA of the technician assigned to their own active booking (`customerId === req.user.id`). Any attempt to query tracking for another booking returns HTTP 404 or HTTP 403 Forbidden.
3. **Supervisor Scoping:** Supervisors can only see live telemetry of technicians assigned to routes in their authorized operating branches (`req.scope.branchIds`). Central Superadmins maintain multi-city visibility.

---

## 5. Staff Privacy, Consent & Retention Governance

In accordance with India's DPDP Act and labor privacy ethics:
1. **Consent Gate:** Staff must provide explicit in-app consent before location permissions are enabled. The terms explicitly state that location is accessed solely during active travel to scheduled appointments.
2. **No Off-Shift or Break Tracking:** Check-out or end of shift invalidates all location ingestion.
3. **Automatic Termination on Job Completion:** The moment an execution status changes to `started`, `completed`, `cancelled`, or `missed`, the tracking session is permanently terminated. Any subsequent location pings for that execution ID are strictly rejected.
4. **Automated 7-Day Retention Purge:** Detailed breadcrumb location logs in `service_execution_location_logs` are retained for a maximum of 7 days for dispute resolution, after which an automated database worker truncates the high-frequency coordinates, preserving only the checked-in timestamp and geofence verification flag on the execution record.

---

## 6. ETA Calculation Heuristics (Honest & Non-Fabricated)

Fabricating a false precise ETA (e.g. "Arriving in exactly 7 minutes" without GPS telemetry) destroys customer trust and triggers support escalations.

### CWP Non-Fabrication Guarantee:
1. **Valid Coordinates Required:** Distance is computed via the Haversine formula against the customer's verified residential address / society latitude and longitude.
2. **Threshold Checks:**
   - If staff coordinates are missing or `(0, 0)`: ETA is returned as `null`.
   - If distance is greater than 50 km (abnormal): ETA is returned as `null`.
   - If distance is valid: Travel time is calculated using a conservative urban velocity curve (20 km/h) plus a mandatory 5-minute parking/gate check-in buffer:
     $$\text{ETA (minutes)} = \max\left(5, \left\lceil \frac{\text{Distance (km)}}{20} \times 60 \right\rceil + 5\right)$$
3. **Reassuring Fallback Message:** When ETA cannot be reliably computed, the API and UI display:  
   *"Technician is on the way. Tracking details will update upon arrival."*

---

## 7. Offline & Poor Network Resilience

When a cleaner enters a basement parking area or dead zone:
1. Pings are queued locally in `IndexedDB` / SQLite via `offlineQueuePolicy`.
2. Upon network reconnection, cached breadcrumbs are flushed in a single batch.
3. If an en-route technician arrives at a basement bay with no signal, single-tap offline check-in with basement reason code (`underground_basement_no_signal`) records the arrival timestamp without halting field execution.

---

## 8. Implementation Roadmap

- **Phase 17 (Delivered):**
  - Database schema columns: `technicianEnRouteAt`, `enRouteAt`, `estimatedArrivalAt`, `etaMinutes`, `lastLocationUpdateAt`, `lastKnownLatitude`, `lastKnownLongitude`.
  - Backend endpoints: `POST /api/service-executions/:id/en-route`, `POST /api/service-executions/:id/location-ping`, `GET /api/bookings/:id/tracking`.
  - Customer UX: Pulsing En-Route Hero banner, call technician button, arrival ETA, last update time, and reassuring fallback message.
  - Staff UX: "En Route" action button on assigned jobs.
- **Phase 18 (Planned):**
  - Interactive Leaflet/Mapbox live route view in Customer App for premium detailing services.
  - Dispatcher Map View in Admin Portal visualizing active technician clusters by residential society.
