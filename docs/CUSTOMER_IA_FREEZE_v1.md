# Customer Website — Information Architecture Freeze v1.0

**Status:** FROZEN — no IA redesign unless explicitly requested.

## Bottom Navigation

| Tab | Route | Label |
|-----|-------|-------|
| Home | `/customer/dashboard` | Home |
| My Plans | `/customer/plans` | My Plans |
| Schedule (FAB) | `/customer/schedule` | Schedule |
| Assets | `/customer/assets` | Assets |
| Account | `/customer/account` | Account |

## Page Titles

| Route | App bar title |
|-------|---------------|
| `/customer/assets` | My Vehicles & Solar Sites |
| `/customer/schedule` | Schedule |
| `/customer/schedule/:id` | Scheduled Service |
| `/customer/plans` | My Plans |
| `/customer/history` | Service History |

## Home Widget

- **Current Plan** (Phase B)

## Banned Customer-Facing Terms

Wallet · Book · Booking · Recharge Wallet · Transaction History

## Approved Terms

Schedule · Scheduled Service · My Plans · One-Time Visit · Use This Plan · Service History · Renew Plan · My Vehicles & Solar Sites

## Legacy Route Aliases

| Legacy | Canonical |
|--------|-----------|
| `/customer/wallet` | `/customer/plans` |
| `/customer/services` | `/customer/plans` |
| `/customer/bookings` | `/customer/schedule` |
| `/customer/bookings/:id` | `/customer/schedule/:id` |
| `/customer/book` | `/customer/schedule` |
| `/customer/complaints` | `/customer/support` |

## Implementation Phases

A — Navigation shell, routes, terminology  
B — Home dashboard  
C — Assets  
D — Schedule journey  
E — Plan Detail  
F — Service History  
G — Account refinements
