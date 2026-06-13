# Communication Center — Security Model (Phase 3)

Security architecture for Communication Center Phase 3 Conversational CRM: role-based access for conversation operations, webhook authentication, internal note privacy, tenant isolation, audit trail, and backward-compatible integration with Phase 1/2 security controls.

---

## Table of Contents

1. [Security Overview](#security-overview)
2. [Phase 3 Role Definitions](#phase-3-role-definitions)
3. [Permission Matrix](#permission-matrix)
4. [Platform Role Mapping](#platform-role-mapping)
5. [API Authorization](#api-authorization)
6. [Webhook Security](#webhook-security)
7. [Data Privacy](#data-privacy)
8. [Tenant & Brand Isolation](#tenant--brand-isolation)
9. [Audit Trail](#audit-trail)
10. [Backward Compatibility](#backward-compatibility)
11. [Operational Security Checklist](#operational-security-checklist)

---

## Security Overview

```mermaid
flowchart TB
    subgraph Public["Public Endpoints"]
        WH[WhatsApp Webhook]
        SMS[SMS Webhook]
        Email[Email Webhook]
        Link[/r/:trackingId]
    end

    subgraph Auth["Authenticated Endpoints"]
        Guard[guardResource communications]
        Inbox[Inbox & Conversations]
        Analytics[CRM Analytics]
        KB[Knowledge Base]
    end

    subgraph Controls["Security Controls"]
        RBAC[Role Permissions]
        Tenant[company_id scope]
        Brand[brand_id filter]
        Audit[comm_audit_logs]
        Notes[Internal note isolation]
    end

    WH -->|Verify token| WH
    SMS & Email -->|companyId param| Tenant
    Link --> Audit

    Inbox & Analytics & KB --> Guard --> RBAC
    Guard --> Tenant --> Brand
    Inbox --> Audit
    Inbox --> Notes
```

Phase 3 inherits the Phase 1/2 security foundation (`guardResource("communications")`) and adds conversation-specific endpoint overrides plus public webhook routes with their own verification model.

---

## Phase 3 Role Definitions

Phase 3 introduces three conceptual operational roles for Conversational CRM teams. These extend — not replace — Phase 2 roles (Communication Admin, Campaign Manager, Support Agent, Viewer).

### Conversation Manager

**Purpose:** Oversee inbox operations, assignment, escalations, and team performance.

**Capabilities:**

- View all inbox filters including `unassigned`, `escalated`, `unknown`
- Assign conversations to agents and teams
- Add/remove manual tags
- Add internal notes with mentions
- View SLA dashboard and CRM analytics
- Manage knowledge base articles
- View team performance metrics
- Close conversations

**Restrictions:**

- Cannot modify provider credentials or DLT governance (Phase 1 admin)
- Cannot delete audit logs

**Risk level:** Medium — controls customer-facing response routing.

### Conversation Agent

**Purpose:** Handle assigned conversations and respond to customers.

**Capabilities:**

- View `my_queue` and `all` inbox filters
- Read conversation threads and AI suggestions
- Send replies via configured channels
- Add internal notes
- Close conversations (triggers CSAT survey)
- View knowledge base articles

**Restrictions:**

- Cannot assign conversations to other agents (unless also Manager)
- Cannot view profitability reports
- Cannot create knowledge base articles
- Cannot modify SLA policies or ticket rules

**Risk level:** Medium — direct customer communication access.

### Conversation Supervisor

**Purpose:** Monitor SLA compliance, team performance, CSAT, and escalations.

**Capabilities:**

- View all inbox filters especially `escalated`
- View SLA dashboard and CRM analytics bundle
- View team performance and CSAT dashboards
- View campaign profitability and link stats
- Assign escalated conversations
- View audit logs for conversation actions

**Restrictions:**

- Typically read-only on conversation content (operational policy)
- Cannot modify provider/brand configuration

**Risk level:** Low–Medium — oversight and reporting.

---

## Permission Matrix

Phase 3 uses the existing `communications` resource with actions: `view`, `create`, `edit`, `delete`.

### Phase 3 Capability Matrix

| Capability | Conv. Manager | Conv. Agent | Conv. Supervisor | Comm. Admin |
|------------|:-------------:|:-----------:|:----------------:|:-----------:|
| View inbox | ✓ | ✓ (my_queue+) | ✓ | ✓ |
| View conversation detail | ✓ | ✓ | ✓ | ✓ |
| Reply to conversation | ✓ | ✓ | — | ✓ |
| Assign conversation | ✓ | — | ✓ (escalated) | ✓ |
| Close conversation | ✓ | ✓ | — | ✓ |
| Internal notes | ✓ | ✓ | view only | ✓ |
| Manual tags | ✓ | ✓ | — | ✓ |
| AI suggestions | ✓ | ✓ | ✓ | ✓ |
| SLA dashboard | ✓ | — | ✓ | ✓ |
| CRM analytics | ✓ | — | ✓ | ✓ |
| Team performance | ✓ | — | ✓ | ✓ |
| CSAT dashboard | ✓ | — | ✓ | ✓ |
| Profitability | — | — | ✓ | ✓ |
| Knowledge base read | ✓ | ✓ | ✓ | ✓ |
| Knowledge base write | ✓ | — | — | ✓ |
| Link tracking create | ✓ | — | ✓ | ✓ |
| CSAT submit (customer) | public* | public* | public* | public* |

*CSAT submission endpoint is authenticated as `create` — customer-facing survey may need a separate public token mechanism in production.

### Required Permission Actions

| Action | Phase 3 Endpoints |
|--------|-------------------|
| `view` | Inbox, conversations, journey, SLA, analytics, KB list, teams |
| `create` | CSAT submit, link track, KB create, performance compute |
| `edit` | Reply, assign, close, notes, tags, profitability record |
| `delete` | Tag removal (DELETE endpoint) |

---

## Platform Role Mapping

Map Phase 3 conceptual roles to platform RBAC:

| Conceptual Role | Platform Role(s) | communications Permissions |
|-----------------|------------------|----------------------------|
| Conversation Manager | `admin`, `manager` | view, create, edit |
| Conversation Agent | `manager`, custom `conv_agent` | view, edit |
| Conversation Supervisor | `admin`, custom `conv_supervisor` | view (+ edit for assign) |
| Communication Admin | `admin`, `superadmin` | view, create, edit, delete |

### Default Seed (Implemented)

```typescript
// admin / superadmin
communications: ["view", "create", "edit", "delete"]

// manager
communications: ["view", "create", "edit"]

// franchisee
communications: ["view", "create"]

// staff, customer
// (no communications permissions)
```

### Implementing Custom Conversation Roles

```sql
INSERT INTO permissions (role, resource, action, allow) VALUES
  ('conv_agent', 'communications', 'view', true),
  ('conv_agent', 'communications', 'edit', true),
  ('conv_supervisor', 'communications', 'view', true),
  ('conv_supervisor', 'communications', 'edit', true),
  ('conv_manager', 'communications', 'view', true),
  ('conv_manager', 'communications', 'create', true),
  ('conv_manager', 'communications', 'edit', true);
```

Extend `ProtectedRoute` on `/admin/communications` and sidebar permission checks:

```typescript
roles={["admin", "superadmin", "manager", "conv_agent", "conv_manager", "conv_supervisor"]}
permission={{ resource: "communications", action: "view" }}
```

---

## API Authorization

All Phase 3 authenticated routes mount under `guardResource("communications")` in `routes/index.ts`.

### Phase 3 Endpoint Overrides

| Endpoint Pattern | Method | Action |
|------------------|--------|--------|
| `/conversations/:id/reply` | POST | edit |
| `/conversations/:id/assign` | POST | edit |
| `/conversations/:id/close` | POST | edit |
| `/conversations/:id/notes` | POST | edit |
| `/inbox` | GET | view |
| `/journey` | GET | view |
| `/crm/analytics` | GET | view |

### Method → Action Default

| HTTP Method | Permission Action |
|-------------|-------------------|
| GET | view |
| POST | create |
| PUT, PATCH | edit |
| DELETE | delete |

Tag removal (`DELETE /conversations/:id/tags/:tag`) requires `delete` permission — only Communication Admin by default.

### Tenant Scoping

`req.scope?.companyId` from `tenantStamp` middleware filters:

- Inbox lists and counts
- Analytics reports
- Knowledge base
- Team performance

User identity `req.user?.id` scopes `my_queue` filter.

---

## Webhook Security

Webhook routes in `communications-webhooks.ts` mount **before** auth middleware — publicly accessible.

### WhatsApp (Meta)

**Verification (GET):**

```typescript
verifyWhatsAppWebhook(mode, token, challenge)
// Validates hub.verify_token against WHATSAPP_VERIFY_TOKEN env var
// Returns challenge on success, null → 403 on failure
```

**Inbound (POST):**

- No signature validation in Phase 3 (recommended: add `X-Hub-Signature-256` HMAC verification)
- Always returns 200 on WhatsApp to prevent retry storms (errors logged)
- `companyId` query param scopes tenant — **validate this matches registered tenant**

### SMS Webhook

- Accepts `{ phone, message, messageId }` JSON body
- No authentication — **protect via provider IP allowlist or shared secret header** (recommended enhancement)
- `companyId` query param for tenant scope

### Email Webhook

- Accepts `{ from, to, subject, body, threadId, customerId }` 
- Same shared-secret recommendation as SMS

### Link Redirect (`/r/:trackingId`)

- Public by design (embedded in campaign messages)
- No PII exposed in redirect — only increments click count
- Rate limiting recommended to prevent enumeration

```mermaid
flowchart LR
    Meta[Meta] -->|verify token| WH[WhatsApp GET]
    Provider[SMS/Email] -->|POST + companyId| WH2[Webhook POST]
    User[Customer] -->|GET| Link[/r/:id]
    
    WH -->|403 if invalid| Block[Blocked]
    WH2 -->|400 if missing fields| Block
```

### Recommended Hardening

| Control | Priority |
|---------|----------|
| `WHATSAPP_APP_SECRET` signature validation | High |
| SMS shared secret header | High |
| Email relay authentication | High |
| Rate limit on `/r/:trackingId` | Medium |
| Validate `companyId` against registered tenants | Medium |
| IP allowlist for provider callbacks | Medium |

---

## Data Privacy

### Internal Notes

- Stored in `comm_conversation_notes` — **never** sent via `channelService`
- Not included in customer-facing channels
- Displayed only in admin UI with visual distinction (dashed border)
- Audit logged as `conversation.note`

### AI Assistance Data

- Generated from message content stored in `comm_ai_assistance`
- Not transmitted externally in Phase 3
- Future LLM integration requires PII redaction policy

### Unknown Contacts

- `comm_unknown_contacts` may hold phone/email before CRM match
- Restrict `unknown` inbox filter to authorized roles
- Link to customer record before exposing full CRM context

### CSAT Responses

- `feedback` field may contain customer PII
- Scoped by `company_id`
- Linked to `agent_user_id` for performance review — handle per HR policy

---

## Tenant & Brand Isolation

| Scope | Field | Applied In |
|-------|-------|------------|
| Tenant | `company_id` | All comm_conversations, inbox, analytics |
| Brand | `brand_id` | Inbox filter param, KB, journey, link tracking |
| Branch | `branch_id` | Conversation metadata, auto-ticket creation |
| User | `assigned_to_user_id` | my_queue filter |

Webhook `companyId` query parameter must align with conversation `company_id` on creation.

Cross-tenant data access is prevented by `inboxService` conditions and `tenantStamp` on write endpoints.

---

## Audit Trail

Phase 3 conversation actions logged via `logCommAudit`:

| Action | Trigger |
|--------|---------|
| `conversation.reply` | Agent reply sent |
| `conversation.close` | Conversation closed |
| `conversation.note` | Internal note added |
| `conversation.assign` | Manual assignment |
| `ticket.auto_create` | Ticket automation rule matched |
| `kb.create` | Knowledge base article created |

Audit entries include `userId`, `companyId`, `brandId`, `resourceId`, and `payload`.

Stored in `comm_audit_logs` (Phase 1) — same table used across all Communication Center phases.

---

## Backward Compatibility

Phase 3 security extends Phase 1/2 without modification:

| Phase 1/2 Control | Phase 3 Behavior |
|-------------------|------------------|
| `guardResource("communications")` | Same guard wraps Phase 3 router |
| Consent service | Outbound replies use Phase 1 `channelService` with consent checks |
| DLT validation | SMS replies subject to Phase 1 DLT rules |
| Brand isolation | `brand_id` on conversations and KB |
| Audit logs | Same `logCommAudit` function |
| Provider secrets | No new credential stores |

Existing roles (`admin`, `manager`) automatically gain Phase 3 inbox access if they have `communications:view`.

---

## Operational Security Checklist

### Pre-Production

- [ ] Set `WHATSAPP_VERIFY_TOKEN` to strong random value (not default `cwp_verify`)
- [ ] Configure webhook `companyId` per tenant
- [ ] Review role permissions for conversation access
- [ ] Enable database backups before migration
- [ ] Test permission denial returns 403 for unauthorized roles

### Production

- [ ] Monitor `comm_audit_logs` for unusual reply volumes
- [ ] Review escalated/SLA breach queue daily
- [ ] Rotate webhook verify tokens periodically
- [ ] Implement provider signature validation
- [ ] Document internal note policy for agents
- [ ] Restrict profitability data to supervisor/admin roles

### Incident Response

| Incident | Response |
|----------|----------|
| Webhook spam | Rate limit, rotate tokens, IP block |
| Unauthorized reply | Review audit log `conversation.reply`, revoke user access |
| Cross-tenant leak | Verify `company_id` filters, audit webhook `companyId` |
| PII in AI summary | Disable AI panel until redaction implemented |

---

## Related Documentation

- [Phase 2 Security Model](./COMMUNICATION_CENTER_SECURITY_MODEL.md)
- [Phase 3 Architecture](./COMMUNICATION_CENTER_PHASE3_ARCHITECTURE.md)
- [Inbox Module](./COMMUNICATION_CENTER_INBOX_MODULE.md)
- [Migration Plan Phase 3](./COMMUNICATION_CENTER_MIGRATION_PLAN_PHASE3.md)
