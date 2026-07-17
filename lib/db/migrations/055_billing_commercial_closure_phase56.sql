-- Phase 5.6: Billing & Commercial Closure
-- Starts when Job ops_status = ready_for_billing.
-- Reuses invoices / payments; adds job linkage + commercial lifecycle + audit timeline.
-- Does NOT create accounting ledger, GST returns, or payment gateway tables.

DO $$ BEGIN
  CREATE TYPE invoice_commercial_status AS ENUM (
    'draft',
    'issued',
    'payment_pending',
    'paid',
    'commercially_closed',
    'voided'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invoice_billing_mode AS ENUM (
    'subscription_visit',
    'one_time',
    'prepaid_fulfillment',
    'manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE billing_commercial_timeline_event_type AS ENUM (
    'COMMERCIAL_PREVIEWED',
    'INVOICE_DRAFT_CREATED',
    'INVOICE_ISSUED',
    'INVOICE_PAYMENT_PENDING',
    'INVOICE_PAID',
    'INVOICE_VOIDED',
    'INVOICE_CANCELLED',
    'CREDIT_NOTE_CREATED',
    'ENTITLEMENT_CONSUMED',
    'COMMERCIAL_CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS execution_id INTEGER,
  ADD COLUMN IF NOT EXISTS commercial_status invoice_commercial_status,
  ADD COLUMN IF NOT EXISTS billing_mode invoice_billing_mode,
  ADD COLUMN IF NOT EXISTS commercially_closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS entitlement_consumed BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill commercial_status from legacy invoice status for existing rows
UPDATE invoices
SET commercial_status = CASE
  WHEN status = 'draft' THEN 'draft'::invoice_commercial_status
  WHEN status = 'cancelled' THEN 'voided'::invoice_commercial_status
  WHEN status = 'paid' THEN 'commercially_closed'::invoice_commercial_status
  WHEN status IN ('sent', 'overdue') THEN 'payment_pending'::invoice_commercial_status
  ELSE 'payment_pending'::invoice_commercial_status
END
WHERE commercial_status IS NULL;

ALTER TABLE invoices
  ALTER COLUMN commercial_status SET DEFAULT 'draft',
  ALTER COLUMN commercial_status SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_execution_id ON invoices (execution_id);
CREATE INDEX IF NOT EXISTS idx_invoices_commercial_status ON invoices (commercial_status);
CREATE INDEX IF NOT EXISTS idx_invoices_billing_mode ON invoices (billing_mode);

-- One active tax invoice per job (voided/cancelled may be superseded)
CREATE UNIQUE INDEX IF NOT EXISTS invoices_execution_tax_unique
  ON invoices (execution_id)
  WHERE execution_id IS NOT NULL
    AND document_type = 'tax_invoice'
    AND status <> 'cancelled'
    AND commercial_status <> 'voided';

CREATE TABLE IF NOT EXISTS billing_commercial_timeline (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER,
  execution_id INTEGER,
  event_type billing_commercial_timeline_event_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  actor_id INTEGER,
  actor_name TEXT,
  metadata JSONB DEFAULT '{}',
  company_id INTEGER,
  franchisee_id INTEGER,
  branch_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_commercial_timeline_invoice
  ON billing_commercial_timeline (invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_commercial_timeline_execution
  ON billing_commercial_timeline (execution_id);
CREATE INDEX IF NOT EXISTS idx_billing_commercial_timeline_event
  ON billing_commercial_timeline (event_type);
