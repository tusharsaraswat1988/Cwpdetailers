-- Communication Center Phase 1 Enhancement Migration
-- Run via: pnpm --filter @workspace/db run push
-- Or apply manually against PostgreSQL

-- Extend comm_event_status enum
ALTER TYPE comm_event_status ADD VALUE IF NOT EXISTS 'consent_blocked';

-- Consent source enum
DO $$ BEGIN
  CREATE TYPE comm_consent_source AS ENUM ('walk_in', 'website', 'lead_form', 'invoice', 'manual', 'import');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Customer consents
CREATE TABLE IF NOT EXISTS comm_customer_consents (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  sms_consent BOOLEAN NOT NULL DEFAULT false,
  whatsapp_consent BOOLEAN NOT NULL DEFAULT false,
  email_consent BOOLEAN NOT NULL DEFAULT false,
  consent_source comm_consent_source NOT NULL DEFAULT 'manual',
  consent_date TIMESTAMP NOT NULL DEFAULT NOW(),
  consent_ip TEXT,
  birth_date DATE,
  anniversary_date DATE,
  notes TEXT,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS comm_customer_consents_customer_idx ON comm_customer_consents(customer_id);
CREATE INDEX IF NOT EXISTS comm_customer_consents_company_idx ON comm_customer_consents(company_id);

-- Smart segments
CREATE TABLE IF NOT EXISTS comm_smart_segments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  segment_key TEXT NOT NULL,
  config_json JSONB NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS comm_smart_segments_key_company_idx ON comm_smart_segments(segment_key, company_id);
CREATE INDEX IF NOT EXISTS comm_smart_segments_active_idx ON comm_smart_segments(active);

-- Campaign attribution
CREATE TABLE IF NOT EXISTS comm_campaign_attribution (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  booking_id INTEGER,
  invoice_id INTEGER,
  revenue_amount NUMERIC(10,2) NOT NULL,
  attributed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  company_id INTEGER
);
CREATE INDEX IF NOT EXISTS comm_attr_campaign_idx ON comm_campaign_attribution(campaign_id);
CREATE INDEX IF NOT EXISTS comm_attr_customer_idx ON comm_campaign_attribution(customer_id);
CREATE INDEX IF NOT EXISTS comm_attr_campaign_customer_idx ON comm_campaign_attribution(campaign_id, customer_id);

-- Campaign cost for ROI
ALTER TABLE comm_campaigns ADD COLUMN IF NOT EXISTS cost_amount NUMERIC(10,2) DEFAULT 0;

-- Event indexes for analytics at scale
CREATE INDEX IF NOT EXISTS comm_events_campaign_idx ON comm_events(campaign_id);
CREATE INDEX IF NOT EXISTS comm_events_customer_idx ON comm_events(customer_id);
CREATE INDEX IF NOT EXISTS comm_events_status_idx ON comm_events(status);
CREATE INDEX IF NOT EXISTS comm_events_created_idx ON comm_events(created_at);
CREATE INDEX IF NOT EXISTS comm_events_company_created_idx ON comm_events(company_id, created_at);
