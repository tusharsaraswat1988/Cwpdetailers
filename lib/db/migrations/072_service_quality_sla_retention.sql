-- Migration 072: Service Quality, SLA Management & Customer Retention (PRD v2.1)

-- 1. Upgrade dcms_visit_feedback with detailed metrics and linkages
ALTER TABLE IF EXISTS dcms_visit_feedback
  ADD COLUMN IF NOT EXISTS subscription_id integer,
  ADD COLUMN IF NOT EXISTS staff_id integer,
  ADD COLUMN IF NOT EXISTS city_id integer,
  ADD COLUMN IF NOT EXISTS branch_id integer,
  ADD COLUMN IF NOT EXISTS rating_score integer,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS issue_reported boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS complaint_id integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_dcms_visit_feedback_sub ON dcms_visit_feedback(subscription_id);
CREATE INDEX IF NOT EXISTS idx_dcms_visit_feedback_staff ON dcms_visit_feedback(staff_id);
CREATE INDEX IF NOT EXISTS idx_dcms_visit_feedback_score ON dcms_visit_feedback(rating_score);
CREATE INDEX IF NOT EXISTS idx_dcms_visit_feedback_city ON dcms_visit_feedback(city_id);

-- 2. Create sla_policies table
CREATE TABLE IF NOT EXISTS sla_policies (
  id serial PRIMARY KEY,
  name text NOT NULL,
  city_id integer,
  service_type text,
  category text NOT NULL DEFAULT 'all',
  priority text NOT NULL DEFAULT 'all',
  response_target_minutes integer NOT NULL DEFAULT 720,
  resolution_target_minutes integer NOT NULL DEFAULT 1440,
  pause_on_customer_response boolean NOT NULL DEFAULT true,
  escalation_level_1_minutes integer,
  escalation_level_2_minutes integer,
  is_active boolean NOT NULL DEFAULT true,
  company_id integer,
  branch_id integer,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sla_policies_city ON sla_policies(city_id);
CREATE INDEX IF NOT EXISTS idx_sla_policies_priority ON sla_policies(priority);
CREATE INDEX IF NOT EXISTS idx_sla_policies_active ON sla_policies(is_active);

-- Seed baseline default SLA policies if empty
INSERT INTO sla_policies (name, category, priority, response_target_minutes, resolution_target_minutes, escalation_level_1_minutes, escalation_level_2_minutes)
SELECT 'Urgent Safety & Damage SLA', 'damage', 'urgent', 60, 240, 120, 240
WHERE NOT EXISTS (SELECT 1 FROM sla_policies WHERE name = 'Urgent Safety & Damage SLA');

INSERT INTO sla_policies (name, category, priority, response_target_minutes, resolution_target_minutes, escalation_level_1_minutes, escalation_level_2_minutes)
SELECT 'High Priority Reclean & Missed SLA', 'reclean', 'high', 180, 720, 360, 720
WHERE NOT EXISTS (SELECT 1 FROM sla_policies WHERE name = 'High Priority Reclean & Missed SLA');

INSERT INTO sla_policies (name, category, priority, response_target_minutes, resolution_target_minutes, escalation_level_1_minutes, escalation_level_2_minutes)
SELECT 'Standard Service Quality SLA', 'quality', 'medium', 720, 1440, 1080, 1440
WHERE NOT EXISTS (SELECT 1 FROM sla_policies WHERE name = 'Standard Service Quality SLA');

INSERT INTO sla_policies (name, category, priority, response_target_minutes, resolution_target_minutes, escalation_level_1_minutes, escalation_level_2_minutes)
SELECT 'General Inquiries & Feedback SLA', 'all', 'low', 1440, 2880, 2160, 2880
WHERE NOT EXISTS (SELECT 1 FROM sla_policies WHERE name = 'General Inquiries & Feedback SLA');

-- 3. Create sla_escalation_logs table
CREATE TABLE IF NOT EXISTS sla_escalation_logs (
  id serial PRIMARY KEY,
  complaint_id integer,
  operational_exception_id integer,
  sla_policy_id integer,
  escalation_level integer NOT NULL,
  reason text NOT NULL,
  escalated_to_role text NOT NULL,
  escalated_to_user_id integer,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sla_escalation_complaint ON sla_escalation_logs(complaint_id);
CREATE INDEX IF NOT EXISTS idx_sla_escalation_level ON sla_escalation_logs(escalation_level);

-- 4. Extend complaints table with SLA clock and escalation tracking
ALTER TABLE IF EXISTS complaints
  ADD COLUMN IF NOT EXISTS sla_policy_id integer,
  ADD COLUMN IF NOT EXISTS response_due_at timestamp,
  ADD COLUMN IF NOT EXISTS resolution_due_at timestamp,
  ADD COLUMN IF NOT EXISTS first_responded_at timestamp,
  ADD COLUMN IF NOT EXISTS sla_paused_at timestamp,
  ADD COLUMN IF NOT EXISTS sla_total_paused_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sla_status text DEFAULT 'on_track',
  ADD COLUMN IF NOT EXISTS escalation_level integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalated_at timestamp;

CREATE INDEX IF NOT EXISTS idx_complaints_sla_status ON complaints(sla_status);
CREATE INDEX IF NOT EXISTS idx_complaints_res_due ON complaints(resolution_due_at);

-- 5. Extend dcms_subscriptions with retention and cancellation telemetry
ALTER TABLE IF EXISTS dcms_subscriptions
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_feedback text,
  ADD COLUMN IF NOT EXISTS churn_risk_level text DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS cancellation_requested_at timestamp;

CREATE INDEX IF NOT EXISTS idx_dcms_subscriptions_churn ON dcms_subscriptions(churn_risk_level);

-- 6. Extend notifications with marketing distinction and privacy mask flag
ALTER TABLE IF EXISTS notifications
  ADD COLUMN IF NOT EXISTS is_marketing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sensitive_masked boolean DEFAULT false;
