---
name: Express Static Route Ordering
description: Static API routes must be defined before parameterized routes in Express routers.
---

# Express Static Route Ordering

**Rule:** In Express routers, define static routes (e.g., `/health`, `/daily-tick`, `/expiring-soon`) **before** parameterized routes (e.g., `/:id`).

**Why:** Express matches routes top-to-bottom. If `/:id` is defined first, a request to `/health` will be treated as `id = "health"`, and `parseInt("health")` returns `NaN`, causing a database query error.

**How to apply:**
- Audit any Express router file with both static and parameterized routes
- Move static routes (GET, POST, PATCH) that don't use path parameters above the first `/:id` route
- This applies to both top-level routes and nested sub-routers
