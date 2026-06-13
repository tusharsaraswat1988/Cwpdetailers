# Communication Center — Phase 1 Enhancement

Extends the existing Communication Center with consent management, smart segments, revenue attribution, WhatsApp activation, and dashboard analytics.

## Setup

```bash
pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts exec tsx src/seed-permissions.ts   # if permissions not yet seeded
```

Optional manual SQL: `lib/db/migrations/001_comm_phase1_enhancement.sql`

## Features

### 1. Consent Management

- Table: `comm_customer_consents`
- API: `GET/PUT /api/communications/consents/:customerId`
- UI: Customer Detail → Communication Preferences (toggle SMS / WhatsApp / Email)
- Campaign send skips customers without consent → status `consent_blocked`
- Analytics: Consent Rate %, Skipped Due To Consent

### 2. Smart Segments

- Table: `comm_smart_segments` (15 system segments auto-seeded)
- API: `GET /api/communications/smart-segments`, `POST .../preview`
- UI: Audiences tab → Smart Segments sub-tab
- Combine segments with custom filters (AND)

### 3. Revenue Attribution

- Table: `comm_campaign_attribution`
- 30-day attribution window after campaign send
- Attributes bookings and invoices to campaigns
- ROI = Revenue / Campaign Cost (`comm_campaigns.cost_amount`)
- API: `GET /api/communications/campaigns/:id`, `GET .../attribution`

### 4. WhatsApp Provider

- Provider: `artifacts/api-server/src/lib/communications/providers/whatsappProvider.ts`
- Supports template, utility, service, and text messages
- Env: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- API: `POST /api/communications/whatsapp/test-send`
- Timeline logs: `whatsapp_sent`, `whatsapp_delivered`, `whatsapp_failed`

### 5. Dashboard

- API: `GET /api/communications/dashboard?days=30`
- Cards: Total Campaigns, Messages Sent, Revenue, ROI, Consent Rate, Active Automations
- Charts: Daily Messages, Daily Revenue, Channel Performance, Campaign ROI

## Cron / Jobs

Process scheduled campaigns and attribution:

```bash
POST /api/communications/jobs/process
```

Recommended: Render Cron Job every 5 minutes hitting this endpoint.

## Audit Events

- `consent.update`
- `segment.create`
- `campaign.launch`
- `whatsapp.send`
- `whatsapp.test_send`

## Performance

- SQL `COUNT(*)` for audience preview (no full table load)
- Batch consent loading (5000 IDs per query)
- Campaign batch processing (100 recipients per batch)
- Indexes on `comm_events` and `comm_campaign_attribution`
