-- Communication Center Phase 2 — Enterprise Omnichannel
-- Run after Phase 1 migration. Safe to re-run (IF NOT EXISTS guards).

-- Extend enums
DO $$ BEGIN
  ALTER TYPE comm_event_status ADD VALUE IF NOT EXISTS 'processing';
  ALTER TYPE comm_event_status ADD VALUE IF NOT EXISTS 'retrying';
  ALTER TYPE comm_event_status ADD VALUE IF NOT EXISTS 'dead_letter';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE audience_filter_type ADD VALUE IF NOT EXISTS 'bidwar_customers';
  ALTER TYPE audience_filter_type ADD VALUE IF NOT EXISTS 'revenue_above';
  ALTER TYPE audience_filter_type ADD VALUE IF NOT EXISTS 'last_visit_between';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE comm_provider_type ADD VALUE IF NOT EXISTS 'smtp';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- New enums
DO $$ BEGIN CREATE TYPE comm_brand_status AS ENUM ('active','inactive','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_dlt_template_status AS ENUM ('draft','pending_approval','approved','rejected','suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_email_type AS ENUM ('marketing','transactional','service'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_whatsapp_category AS ENUM ('marketing','utility','authentication'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_whatsapp_approval_status AS ENUM ('draft','pending','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_automation_step_type AS ENUM ('send_sms','send_whatsapp','send_email','send_push','create_task','assign_staff','wait','branch'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_automation_run_status AS ENUM ('pending','running','completed','failed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_campaign_recurrence AS ENUM ('none','daily','weekly','monthly'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_delivery_status AS ENUM ('queued','processing','sent','delivered','read','failed','retrying','dead_letter'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_queue_name AS ENUM ('sms_queue','whatsapp_queue','email_queue','push_queue'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_ai_recommendation_type AS ENUM ('best_send_time','campaign_suggestion','segment_suggestion','reactivation'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_workflow_trigger AS ENUM ('lead_created','lead_lost','lead_won','customer_registered','package_purchased','invoice_generated','payment_received','payment_due','wash_due','solar_cleaning_due','amc_due','package_expiry','no_visit_30_days','no_visit_60_days','no_visit_90_days','birthday','anniversary'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Brand columns on Phase 1 tables
ALTER TABLE comm_dlt_entities ADD COLUMN IF NOT EXISTS brand_id INTEGER;
ALTER TABLE comm_templates ADD COLUMN IF NOT EXISTS brand_id INTEGER;
ALTER TABLE comm_providers ADD COLUMN IF NOT EXISTS brand_id INTEGER;
ALTER TABLE comm_audiences ADD COLUMN IF NOT EXISTS brand_id INTEGER;
ALTER TABLE comm_campaigns ADD COLUMN IF NOT EXISTS brand_id INTEGER;
ALTER TABLE comm_campaigns ADD COLUMN IF NOT EXISTS email_template_id INTEGER;
ALTER TABLE comm_campaigns ADD COLUMN IF NOT EXISTS whatsapp_template_id INTEGER;
ALTER TABLE comm_campaigns ADD COLUMN IF NOT EXISTS recurrence comm_campaign_recurrence NOT NULL DEFAULT 'none';
ALTER TABLE comm_customer_consents ADD COLUMN IF NOT EXISTS brand_id INTEGER;
ALTER TABLE comm_customer_consents ADD COLUMN IF NOT EXISTS push_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE comm_events ADD COLUMN IF NOT EXISTS brand_id INTEGER;
ALTER TABLE comm_automations ADD COLUMN IF NOT EXISTS brand_id INTEGER;
ALTER TABLE comm_audit_logs ADD COLUMN IF NOT EXISTS brand_id INTEGER;

-- Phase 2 tables
CREATE TABLE IF NOT EXISTS comm_brands (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  status comm_brand_status NOT NULL DEFAULT 'active',
  logo TEXT,
  primary_color TEXT,
  email_sender TEXT,
  email_reply_to TEXT,
  default_sms_header TEXT,
  default_whatsapp_number TEXT,
  default_support_number TEXT,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS comm_brands_code_company_idx ON comm_brands(code, company_id);

CREATE TABLE IF NOT EXISTS comm_dlt_templates (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER NOT NULL,
  entity_id INTEGER NOT NULL,
  header_id INTEGER NOT NULL,
  template_id TEXT NOT NULL,
  name TEXT NOT NULL,
  template_type dlt_template_category NOT NULL,
  approved_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  status comm_dlt_template_status NOT NULL DEFAULT 'approved',
  approval_date TIMESTAMP,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS comm_dlt_templates_brand_template_idx ON comm_dlt_templates(brand_id, template_id);

CREATE TABLE IF NOT EXISTS comm_timeline (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER,
  customer_id INTEGER,
  lead_id INTEGER,
  channel comm_channel NOT NULL,
  template_id INTEGER,
  campaign_id INTEGER,
  automation_id INTEGER,
  event_id INTEGER,
  message TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL,
  provider TEXT,
  delivery_status comm_delivery_status NOT NULL DEFAULT 'queued',
  read_status BOOLEAN NOT NULL DEFAULT false,
  clicked BOOLEAN NOT NULL DEFAULT false,
  responded BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS comm_timeline_customer_idx ON comm_timeline(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS comm_timeline_brand_idx ON comm_timeline(brand_id);

CREATE TABLE IF NOT EXISTS comm_email_templates (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  email_type comm_email_type NOT NULL DEFAULT 'transactional',
  variables JSONB DEFAULT '[]',
  attachments JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_whatsapp_templates (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER NOT NULL,
  meta_template_name TEXT NOT NULL,
  category comm_whatsapp_category NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  body_preview TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  approval_status comm_whatsapp_approval_status NOT NULL DEFAULT 'approved',
  is_active BOOLEAN NOT NULL DEFAULT true,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_workflows (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  trigger comm_workflow_trigger NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}',
  company_id INTEGER,
  branch_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_workflow_steps (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL,
  step_order INTEGER NOT NULL,
  step_type comm_automation_step_type NOT NULL,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_workflow_runs (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL,
  customer_id INTEGER,
  lead_id INTEGER,
  current_step_id INTEGER,
  status comm_automation_run_status NOT NULL DEFAULT 'pending',
  context JSONB DEFAULT '{}',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error TEXT,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_queue_jobs (
  id SERIAL PRIMARY KEY,
  queue_name comm_queue_name NOT NULL,
  bull_job_id TEXT,
  event_id INTEGER,
  campaign_id INTEGER,
  brand_id INTEGER,
  payload JSONB NOT NULL,
  status comm_delivery_status NOT NULL DEFAULT 'queued',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 4,
  next_retry_at TIMESTAMP,
  last_error TEXT,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS comm_queue_jobs_status_retry_idx ON comm_queue_jobs(status, next_retry_at);

CREATE TABLE IF NOT EXISTS comm_dead_letter (
  id SERIAL PRIMARY KEY,
  queue_job_id INTEGER,
  event_id INTEGER,
  channel comm_channel NOT NULL,
  payload JSONB,
  error TEXT NOT NULL,
  brand_id INTEGER,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_consent_history (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  brand_id INTEGER,
  sms_consent BOOLEAN,
  whatsapp_consent BOOLEAN,
  email_consent BOOLEAN,
  push_consent BOOLEAN,
  consent_source comm_consent_source,
  changed_by INTEGER,
  consent_ip TEXT,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS comm_consent_history_customer_idx ON comm_consent_history(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS comm_ai_recommendations (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER,
  recommendation_type comm_ai_recommendation_type NOT NULL,
  target_entity TEXT,
  target_id INTEGER,
  suggestion JSONB NOT NULL,
  confidence NUMERIC(5,4),
  status TEXT NOT NULL DEFAULT 'pending',
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed default brands (global, company_id NULL)
INSERT INTO comm_brands (name, code, status, primary_color)
SELECT v.name, v.code, 'active', v.primary_color
FROM (VALUES
  ('CWP Detailers', 'cwp', '#1e40af'),
  ('Kleansolar', 'kleansolar', '#059669'),
  ('DCC', 'dcc', '#7c3aed'),
  ('BidWar', 'bidwar', '#dc2626')
) AS v(name, code, primary_color)
WHERE NOT EXISTS (SELECT 1 FROM comm_brands b WHERE b.code = v.code AND b.company_id IS NULL);
