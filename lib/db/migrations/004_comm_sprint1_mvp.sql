-- Sprint 1 MVP — ensure core tables + compatibility views (maps to Phase 1/2 physical tables)

-- Views for Sprint 1 naming convention (read-compatible; writes use comm_* base tables)
CREATE OR REPLACE VIEW comm_sms_templates AS
  SELECT * FROM comm_templates WHERE channel = 'sms';

CREATE OR REPLACE VIEW comm_sms_campaigns AS
  SELECT * FROM comm_campaigns WHERE channel = 'sms';

CREATE OR REPLACE VIEW comm_sms_logs AS
  SELECT * FROM comm_events WHERE channel = 'sms';

CREATE OR REPLACE VIEW comm_provider_configs AS
  SELECT
    id, name, provider_type, channel, config,
    is_active, is_primary, priority, brand_id, company_id,
    created_at, updated_at
  FROM comm_providers;

-- Seed default CWP brand if missing
INSERT INTO comm_brands (name, code, status, primary_color)
SELECT 'CWP Detailers', 'cwp', 'active', '#1e40af'
WHERE NOT EXISTS (SELECT 1 FROM comm_brands WHERE code = 'cwp' AND company_id IS NULL);
