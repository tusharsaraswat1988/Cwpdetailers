-- Communication Center Phase 3 — Conversational CRM
-- Safe to re-run with IF NOT EXISTS guards.

DO $$ BEGIN CREATE TYPE comm_conversation_status AS ENUM ('open','assigned','pending','resolved','closed','spam'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_message_direction AS ENUM ('incoming','outgoing'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_message_delivery AS ENUM ('pending','sent','delivered','read','replied','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_sla_status AS ENUM ('within_sla','warning','breached'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_tag_source AS ENUM ('auto','manual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_journey_event_type AS ENUM ('lead_created','lead_assigned','lead_won','lead_lost','sms_sent','sms_received','whatsapp_sent','whatsapp_delivered','whatsapp_read','whatsapp_replied','email_sent','email_opened','email_replied','push_sent','in_app_sent','booking_created','invoice_generated','payment_received','package_purchased','service_completed','review_submitted','conversation_opened','conversation_closed','ticket_created','csat_submitted','link_clicked','campaign_converted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_kb_category AS ENUM ('faq','policy','script','response_template'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE comm_ticket_rule_trigger AS ENUM ('complaint_detected','payment_issue','escalation_request','sla_breach'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS comm_conversations (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER,
  customer_id INTEGER,
  lead_id INTEGER,
  primary_channel comm_channel NOT NULL DEFAULT 'whatsapp',
  status comm_conversation_status NOT NULL DEFAULT 'open',
  subject TEXT,
  assigned_to_user_id INTEGER,
  assigned_team_id INTEGER,
  complaint_id INTEGER,
  email_thread_id TEXT,
  is_unknown_contact BOOLEAN NOT NULL DEFAULT false,
  unknown_phone TEXT,
  unknown_email TEXT,
  sla_policy_id INTEGER,
  sla_status comm_sla_status NOT NULL DEFAULT 'within_sla',
  first_response_due_at TIMESTAMP,
  resolution_due_at TIMESTAMP,
  first_response_at TIMESTAMP,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,
  last_message_at TIMESTAMP,
  last_message_preview TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  company_id INTEGER,
  branch_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS comm_conv_customer_idx ON comm_conversations(customer_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS comm_conv_status_idx ON comm_conversations(status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS comm_conv_assigned_user_idx ON comm_conversations(assigned_to_user_id, status);

CREATE TABLE IF NOT EXISTS comm_conversation_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL,
  channel comm_channel NOT NULL,
  direction comm_message_direction NOT NULL,
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  provider_message_id TEXT,
  status comm_message_delivery NOT NULL DEFAULT 'pending',
  sender TEXT,
  receiver TEXT,
  sender_user_id INTEGER,
  reply_to_message_id INTEGER,
  metadata JSONB DEFAULT '{}',
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS comm_conv_msg_conversation_idx ON comm_conversation_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS comm_conv_msg_provider_idx ON comm_conversation_messages(provider_message_id);

CREATE TABLE IF NOT EXISTS comm_conversation_notes (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL,
  author_user_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  mentions JSONB DEFAULT '[]',
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  auto_assign_rules JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS comm_teams_code_company_idx ON comm_teams(code, company_id);

CREATE TABLE IF NOT EXISTS comm_conversation_tags (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  source comm_tag_source NOT NULL DEFAULT 'manual',
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_sla_policies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  first_response_minutes INTEGER NOT NULL DEFAULT 30,
  resolution_minutes INTEGER NOT NULL DEFAULT 1440,
  escalation_minutes INTEGER NOT NULL DEFAULT 60,
  warning_threshold_pct INTEGER NOT NULL DEFAULT 80,
  is_default BOOLEAN NOT NULL DEFAULT false,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_unknown_contacts (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER,
  phone TEXT,
  email TEXT,
  channel comm_channel NOT NULL,
  last_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  linked_customer_id INTEGER,
  linked_lead_id INTEGER,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_ai_assistance (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL,
  summary TEXT,
  sentiment TEXT,
  intent TEXT,
  priority TEXT,
  reply_suggestions JSONB DEFAULT '[]',
  lead_qualification_hints JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_link_tracking (
  id SERIAL PRIMARY KEY,
  tracking_id TEXT NOT NULL UNIQUE,
  campaign_id INTEGER,
  customer_id INTEGER,
  brand_id INTEGER,
  original_url TEXT NOT NULL,
  click_count INTEGER NOT NULL DEFAULT 0,
  visited_at TIMESTAMP,
  converted_at TIMESTAMP,
  conversion_value NUMERIC(10,2),
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_channel_costs (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER,
  brand_id INTEGER,
  channel comm_channel NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  cost_amount NUMERIC(10,4) NOT NULL DEFAULT 0,
  revenue_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  company_id INTEGER,
  recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_knowledge_base (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER,
  title TEXT NOT NULL,
  category comm_kb_category NOT NULL DEFAULT 'faq',
  content TEXT NOT NULL,
  tags JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_csat_responses (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL,
  customer_id INTEGER,
  agent_user_id INTEGER,
  rating INTEGER NOT NULL,
  feedback TEXT,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_ticket_rules (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  trigger comm_ticket_rule_trigger NOT NULL,
  tag_match TEXT,
  intent_match TEXT,
  complaint_type TEXT NOT NULL DEFAULT 'other',
  is_active BOOLEAN NOT NULL DEFAULT true,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_journey_events (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER,
  lead_id INTEGER,
  event_type comm_journey_event_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  entity_type TEXT,
  entity_id INTEGER,
  metadata JSONB DEFAULT '{}',
  brand_id INTEGER,
  company_id INTEGER,
  occurred_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS comm_journey_customer_idx ON comm_journey_events(customer_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS comm_agent_metrics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  period_date TEXT NOT NULL,
  messages_handled INTEGER NOT NULL DEFAULT 0,
  conversations_closed INTEGER NOT NULL DEFAULT 0,
  avg_response_time_sec INTEGER NOT NULL DEFAULT 0,
  csat_avg NUMERIC(3,2),
  revenue_generated NUMERIC(10,2) DEFAULT 0,
  company_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO comm_teams (name, code, description)
SELECT v.name, v.code, v.description FROM (VALUES
  ('Solar Team','solar','Solar cleaning & AMC queries'),
  ('Service Team','service','Car wash & detailing'),
  ('Sales Team','sales','Leads and quotations'),
  ('Support Team','support','General support tickets')
) AS v(name,code,description)
WHERE NOT EXISTS (SELECT 1 FROM comm_teams t WHERE t.code = v.code AND t.company_id IS NULL);

INSERT INTO comm_sla_policies (name, first_response_minutes, resolution_minutes, is_default)
SELECT 'Default SLA', 30, 1440, true
WHERE NOT EXISTS (SELECT 1 FROM comm_sla_policies WHERE is_default = true AND company_id IS NULL);
