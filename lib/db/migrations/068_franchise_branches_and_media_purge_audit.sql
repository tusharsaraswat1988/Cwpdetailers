-- Migration 068: Franchise Branches and Media Purge Audit
-- Enhances branches, franchisees, and media retention for multi-city company vs franchise operations

-- 1. Extend franchisee_status enum if needed
DO $$ BEGIN
  ALTER TYPE franchisee_status ADD VALUE IF NOT EXISTS 'onboarding';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE franchisee_status ADD VALUE IF NOT EXISTS 'suspended';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add branch operational columns
ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_company_operated BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS service_availability JSONB;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS operational_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_branches_city_id ON branches(city_id);
CREATE INDEX IF NOT EXISTS idx_branches_franchisee_id ON branches(franchisee_id);
CREATE INDEX IF NOT EXISTS idx_branches_legal_entity_id ON branches(legal_entity_id);

-- 3. Add franchisee governance columns
ALTER TABLE franchisees ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE franchisees ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
ALTER TABLE franchisees ADD COLUMN IF NOT EXISTS suspended_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE franchisees ADD COLUMN IF NOT EXISTS agreement_number TEXT;
ALTER TABLE franchisees ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5, 2) DEFAULT 15.00;

CREATE INDEX IF NOT EXISTS idx_franchisees_city_id ON franchisees(city_id);
CREATE INDEX IF NOT EXISTS idx_franchisees_status ON franchisees(status);

-- 4. Add media deletion status columns to dcms_visits
ALTER TABLE dcms_visits ADD COLUMN IF NOT EXISTS cloudinary_deletion_status TEXT;
ALTER TABLE dcms_visits ADD COLUMN IF NOT EXISTS media_purged_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
