# Communication Center — API Reference

REST API reference for Communication Center Phase 1 and Phase 2. All routes mount under `/api`, require authentication, and are guarded by `guardResource("communications")`.

**Base URL:** `https://<your-api-host>/api`

**Tenant scoping:** Filtered by authenticated user's `company_id` and `branch_id`.

---

## Permission Actions

| HTTP Method | Default Action | Overrides |
|-------------|----------------|-----------|
| GET | view | — |
| POST | create | preview endpoints → view |
| PUT/PATCH | edit | `/consents/:id` PUT → edit |
| DELETE | delete | — |

Notable POST→edit overrides: `/campaigns/:id/send`, `/campaigns/:id/schedule`, `/jobs/process`, `/queue/process`.

---

## Phase 1 Endpoints

### DLT & Templates

| Method | Path | Action | Required Body Fields | Notes |
|--------|------|--------|---------------------|-------|
| GET | `/communications/dlt/entities` | view | — | List DLT PE entities |
| POST | `/communications/dlt/entities` | create | `name`, `entityId` | Audit: `dlt_entity.create` |
| PATCH | `/communications/dlt/entities/:id` | edit | partial | |
| GET | `/communications/dlt/headers` | view | — | |
| POST | `/communications/dlt/headers` | create | `entityId`, `headerId`, `name` | |
| GET | `/communications/templates` | view | — | |
| POST | `/communications/templates` | create | `name`, `body` | Auto-extracts `variables` |
| PATCH | `/communications/templates/:id` | edit | partial | Re-extracts variables if body changes |
| GET | `/communications/template-variables` | view | — | Returns `{{placeholder}}` catalog |

**Create template example:**

```json
{
  "name": "Payment Reminder SMS",
  "channel": "sms",
  "category": "transactional",
  "dltTemplateId": "1234567890123456789012345",
  "headerId": 1,
  "body": "Dear {{customerName}}, Rs.{{amountDue}} is due."
}
```

### Providers

| Method | Path | Action | Required Body Fields | Notes |
|--------|------|--------|---------------------|-------|
| GET | `/communications/providers` | view | — | Config redacted; returns `configKeys` |
| POST | `/communications/providers` | create | `name`, `providerType`, `channel` | Audit: `provider.create` |
| PATCH | `/communications/providers/:id` | edit | partial | |

**Provider types:** `fast2sms`, `msg91`, `twilio`, `resend`, `smtp`, `firebase`, `whatsapp_business`

```json
{
  "name": "Primary Fast2SMS",
  "providerType": "fast2sms",
  "channel": "sms",
  "config": { "apiKey": "...", "senderId": "CWPDBL" },
  "isPrimary": true,
  "priority": 10
}
```

### Audiences

| Method | Path | Action | Required Body Fields | Notes |
|--------|------|--------|---------------------|-------|
| GET | `/communications/audiences` | view | — | |
| POST | `/communications/audiences` | create | `name`, `filterDefinition` | Returns `estimatedCount` |
| POST | `/communications/audiences/preview` | view | `filterDefinition` | Returns `{ count, sample }` |
| GET | `/communications/audience-filters` | view | — | Filter catalog with params |

**Filter definition shape:**

```json
{
  "type": "group",
  "operator": "AND",
  "children": [
    { "type": "filter", "filter": "payment_due" },
    { "type": "smart_segment", "segmentKey": "high_value_cwp" }
  ]
}
```

### Campaigns

| Method | Path | Action | Required Body Fields | Notes |
|--------|------|--------|---------------------|-------|
| GET | `/communications/campaigns` | view | — | |
| POST | `/communications/campaigns` | create | `name`, `channel`, `templateId` | `scheduledAt` → status `scheduled` |
| POST | `/communications/campaigns/:id/send` | edit | — | Returns queued/consentBlocked counts |
| POST | `/communications/campaigns/:id/schedule` | edit | `scheduledAt` | Enqueues system job |
| POST | `/communications/campaigns/preview` | view | `templateBody` | Optional `recipient` context |
| GET | `/communications/campaigns/:id` | view | — | Includes attribution + ROI |
| GET | `/communications/campaigns/:id/attribution` | view | — | 30-day window detail |
| POST | `/communications/campaigns/:id/attribution/process` | create | — | Run attribution job |

### Automations (Phase 1)

| Method | Path | Action | Required Body Fields | Notes |
|--------|------|--------|---------------------|-------|
| GET | `/communications/automations` | view | — | Single-step rules |
| POST | `/communications/automations` | create | `name`, `trigger`, `channel`, `templateId` | |
| PATCH | `/communications/automations/:id` | edit | partial | |
| GET | `/communications/automation-triggers` | view | — | 8 legacy triggers |

**Triggers:** `payment_due`, `wash_due`, `package_expiry`, `birthday`, `lead_follow_up`, `invoice_generated`, `payment_received`, `amc_reminder`

### Timeline, Analytics & Audit

| Method | Path | Action | Query Params | Notes |
|--------|------|--------|--------------|-------|
| GET | `/communications/timeline` | view | `customerId`, `leadId` | Phase 1 — reads `comm_events`, max 200 |
| GET | `/communications/analytics` | view | `days=30` | Channel/campaign analytics |
| GET | `/communications/dashboard` | view | `days=30` | Dashboard cards + charts |
| GET | `/communications/audit-logs` | view | — | Last 100 entries |

### Consent & Smart Segments

| Method | Path | Action | Required Body Fields | Notes |
|--------|------|--------|---------------------|-------|
| GET | `/communications/consents/:customerId` | view | — | Defaults if no record |
| PUT | `/communications/consents/:customerId` | edit | consent booleans | Records IP; audit: `consent.update` |
| GET | `/communications/smart-segments` | view | — | System + custom segments |
| POST | `/communications/smart-segments` | create | `name`, `segmentKey`, `configJson` | Audit: `segment.create` |
| POST | `/communications/smart-segments/preview` | view | `segmentKey` | Optional `combineWith` filter |

**Update consent example:**

```json
{
  "smsConsent": true,
  "whatsappConsent": true,
  "emailConsent": false,
  "consentSource": "walk_in",
  "birthDate": "1985-06-15"
}
```

### Jobs & WhatsApp Test

| Method | Path | Action | Body | Notes |
|--------|------|--------|------|-------|
| POST | `/communications/jobs/process` | edit | — | Processes `comm_*` system jobs + attribution |
| POST | `/communications/whatsapp/test-send` | create | `phone`, `templateBody` | Optional `templateName`, `recipient` |

**Jobs response:** `{ processed, results: [{ jobId, ok, error? }] }`

---

## Phase 2 Endpoints

### Brands

| Method | Path | Action | Required Body Fields | Notes |
|--------|------|--------|---------------------|-------|
| GET | `/communications/brands` | view | — | Auto-seeds cwp/kleansolar/dcc/bidwar |
| POST | `/communications/brands` | create | `name`, `code` | Audit: `brand.create` |
| PATCH | `/communications/brands/:id` | edit | partial | Audit: `brand.update` |

```json
{
  "name": "CWP Detailers",
  "code": "cwp",
  "primaryColor": "#1e40af",
  "emailSender": "CWP Detailers <noreply@cwpdetailers.com>",
  "defaultSmsHeader": "CWPDBL"
}
```

### DLT Governance

| Method | Path | Action | Required Body Fields | Notes |
|--------|------|--------|---------------------|-------|
| GET | `/communications/dlt/templates` | view | — | Query: `brandId` |
| POST | `/communications/dlt/templates` | create | `brandId`, `entityId`, `headerId`, `templateId`, `name`, `approvedContent` | |
| POST | `/communications/dlt/validate` | create | `brandId`, `channel` | Pre-send validation chain |

**Validate response (pass):** `{ "valid": true, "step": "send" }`

**Validate response (block):** `{ "valid": false, "step": "consent", "error": "SMS consent not granted" }`

Validation steps: `brand` → `template` → `header` → `entity` → `template_type` → `consent` → `send`

### Email & WhatsApp Template Centers

| Method | Path | Action | Required Body Fields | Notes |
|--------|------|--------|---------------------|-------|
| GET | `/communications/email/templates` | view | — | Query: `brandId` |
| POST | `/communications/email/templates` | create | `brandId`, `name`, `subject`, `htmlContent` | `emailType`: marketing/transactional/service |
| GET | `/communications/whatsapp/templates` | view | — | Query: `brandId` |
| POST | `/communications/whatsapp/templates` | create | `brandId`, `metaTemplateName`, `bodyPreview` | Meta-approved templates |

### Workflows (Multi-Step Automation)

| Method | Path | Action | Required Body Fields | Notes |
|--------|------|--------|---------------------|-------|
| GET | `/communications/workflows` | view | — | Query: `brandId` |
| GET | `/communications/workflows/:id` | view | — | Includes ordered steps |
| POST | `/communications/workflows` | create | `brandId`, `name`, `trigger` | Optional `steps[]` |
| POST | `/communications/workflows/:id/run` | create | recipient context | Starts run |
| GET | `/communications/workflows/:id/runs` | view | — | Last 50 runs |

**Step types:** `send_sms`, `send_whatsapp`, `send_email`, `send_push`, `wait`, `branch`, `create_task`, `assign_staff`

**Workflow triggers (18):** `lead_created`, `lead_lost`, `lead_won`, `customer_registered`, `package_purchased`, `invoice_generated`, `payment_received`, `payment_due`, `wash_due`, `solar_cleaning_due`, `amc_due`, `package_expiry`, `no_visit_30_days`, `no_visit_60_days`, `no_visit_90_days`, `birthday`, `anniversary`

**Create workflow example:**

```json
{
  "brandId": 1,
  "name": "Payment Due Nurture",
  "trigger": "payment_due",
  "steps": [
    { "stepOrder": 1, "stepType": "send_sms", "config": { "templateId": 12 } },
    { "stepOrder": 2, "stepType": "wait", "config": { "waitMinutes": 1440 } },
    { "stepOrder": 3, "stepType": "send_whatsapp", "config": { "whatsappTemplateId": 3 } },
    { "stepOrder": 4, "stepType": "send_email", "config": { "emailTemplateId": 7 } }
  ]
}
```

**Run workflow body:**

```json
{
  "customerId": 101,
  "customerName": "Rajesh Kumar",
  "phone": "9876543210",
  "email": "rajesh@example.com",
  "amountDue": "2500",
  "invoiceNumber": "INV-2026-001"
}
```

### Timeline, Queue & Dead Letter

| Method | Path | Action | Query/Body | Notes |
|--------|------|--------|------------|-------|
| GET | `/communications/timeline/customer/:customerId` | view | `brandId`, `limit`, `cursor` | Paginated `comm_timeline` |
| GET | `/communications/timeline/analytics` | view | `brandId` | delivered/read/clicked/failed counts |
| GET | `/communications/queue/stats` | view | — | queued/processing/retrying/failed/deadLetter |
| POST | `/communications/queue/process` | edit | `{ limit: "50" }` | Process message queue |
| GET | `/communications/queue/dead-letter` | view | `brandId` | Last 100 DLQ entries |

**Timeline pagination response:**

```json
{
  "items": [{ "id": 501, "channel": "sms", "message": "...", "deliveryStatus": "delivered" }],
  "nextCursor": 450,
  "hasMore": true
}
```

### Consent History & AI

| Method | Path | Action | Notes |
|--------|------|--------|-------|
| GET | `/communications/consents/:customerId/history` | view | Append-only consent log |
| GET | `/communications/ai/recommendations` | view | Schema placeholder — no AI impl yet |

---

## Common Response Objects

### CommEvent (timeline/events)

```json
{
  "id": 1001,
  "brandId": 1,
  "campaignId": 42,
  "customerId": 101,
  "channel": "sms",
  "renderedBody": "Dear Rajesh Kumar...",
  "status": "sent",
  "externalId": "f2s-abc123",
  "sentAt": "2026-03-10T09:15:00.000Z",
  "companyId": 1
}
```

**Event statuses:** `pending`, `queued`, `processing`, `sent`, `delivered`, `read`, `failed`, `skipped`, `clicked`, `converted`, `consent_blocked`, `retrying`, `dead_letter`

### Campaign Send Result

```json
{ "campaignId": 42, "queued": 138, "consentBlocked": 4, "failed": 0 }
```

### Queue Stats

```json
{ "queued": 12, "processing": 2, "retrying": 3, "failed": 1, "deadLetter": 5 }
```

---

## Error Responses

| Status | When |
|--------|------|
| `400` | Missing required fields |
| `403` | Permission denied |
| `404` | Resource not found |
| `500` | Server error or send failure |

```json
{ "error": "name, channel, templateId required" }
```

Campaign send and workflow run may return descriptive 500 messages (e.g. `"Workflow not found or inactive"`).

---

## Complete Endpoint Index

| # | Method | Path | Phase |
|---|--------|------|-------|
| 1 | GET | `/communications/dlt/entities` | 1 |
| 2 | POST | `/communications/dlt/entities` | 1 |
| 3 | PATCH | `/communications/dlt/entities/:id` | 1 |
| 4 | GET | `/communications/dlt/headers` | 1 |
| 5 | POST | `/communications/dlt/headers` | 1 |
| 6 | GET | `/communications/templates` | 1 |
| 7 | POST | `/communications/templates` | 1 |
| 8 | PATCH | `/communications/templates/:id` | 1 |
| 9 | GET | `/communications/template-variables` | 1 |
| 10 | GET | `/communications/providers` | 1 |
| 11 | POST | `/communications/providers` | 1 |
| 12 | PATCH | `/communications/providers/:id` | 1 |
| 13 | GET | `/communications/audiences` | 1 |
| 14 | POST | `/communications/audiences` | 1 |
| 15 | POST | `/communications/audiences/preview` | 1 |
| 16 | GET | `/communications/audience-filters` | 1 |
| 17 | GET | `/communications/campaigns` | 1 |
| 18 | POST | `/communications/campaigns` | 1 |
| 19 | POST | `/communications/campaigns/:id/send` | 1 |
| 20 | POST | `/communications/campaigns/:id/schedule` | 1 |
| 21 | POST | `/communications/campaigns/preview` | 1 |
| 22 | GET | `/communications/campaigns/:id` | 1 |
| 23 | GET | `/communications/campaigns/:id/attribution` | 1 |
| 24 | POST | `/communications/campaigns/:id/attribution/process` | 1 |
| 25 | GET | `/communications/automations` | 1 |
| 26 | POST | `/communications/automations` | 1 |
| 27 | PATCH | `/communications/automations/:id` | 1 |
| 28 | GET | `/communications/automation-triggers` | 1 |
| 29 | GET | `/communications/timeline` | 1 |
| 30 | GET | `/communications/analytics` | 1 |
| 31 | GET | `/communications/dashboard` | 1 |
| 32 | GET | `/communications/audit-logs` | 1 |
| 33 | POST | `/communications/jobs/process` | 1 |
| 34 | GET | `/communications/consents/:customerId` | 1 |
| 35 | PUT | `/communications/consents/:customerId` | 1 |
| 36 | GET | `/communications/smart-segments` | 1 |
| 37 | POST | `/communications/smart-segments` | 1 |
| 38 | POST | `/communications/smart-segments/preview` | 1 |
| 39 | POST | `/communications/whatsapp/test-send` | 1 |
| 40 | GET | `/communications/brands` | 2 |
| 41 | POST | `/communications/brands` | 2 |
| 42 | PATCH | `/communications/brands/:id` | 2 |
| 43 | GET | `/communications/dlt/templates` | 2 |
| 44 | POST | `/communications/dlt/templates` | 2 |
| 45 | POST | `/communications/dlt/validate` | 2 |
| 46 | GET | `/communications/email/templates` | 2 |
| 47 | POST | `/communications/email/templates` | 2 |
| 48 | GET | `/communications/whatsapp/templates` | 2 |
| 49 | POST | `/communications/whatsapp/templates` | 2 |
| 50 | GET | `/communications/workflows` | 2 |
| 51 | GET | `/communications/workflows/:id` | 2 |
| 52 | POST | `/communications/workflows` | 2 |
| 53 | POST | `/communications/workflows/:id/run` | 2 |
| 54 | GET | `/communications/workflows/:id/runs` | 2 |
| 55 | GET | `/communications/timeline/customer/:customerId` | 2 |
| 56 | GET | `/communications/timeline/analytics` | 2 |
| 57 | GET | `/communications/queue/stats` | 2 |
| 58 | POST | `/communications/queue/process` | 2 |
| 59 | GET | `/communications/queue/dead-letter` | 2 |
| 60 | GET | `/communications/consents/:customerId/history` | 2 |
| 61 | GET | `/communications/ai/recommendations` | 2 |

**Source files:** `artifacts/api-server/src/routes/communications.ts`, `communications-phase2.ts`

---

*Last updated: June 2026 — Communication Center API Reference Phase 1 + 2*
