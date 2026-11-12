-- Migration 074: Universal Multi-City Lifecycle, Configuration & City Admin Governance
-- PRD v4.0 (CITY-001, CITY-002, CITY-007)

DO $$ BEGIN
  CREATE TYPE city_status AS ENUM (
    'draft',
    'setup_in_progress',
    'ready_for_launch',
    'active',
    'suspended',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enhance cities table with full lifecycle, commercial, locale, and operational settings
ALTER TABLE cities ADD COLUMN IF NOT EXISTS status city_status NOT NULL DEFAULT 'active';
ALTER TABLE cities ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE cities ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR';
ALTER TABLE cities ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en-IN';
ALTER TABLE cities ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS operational_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS content_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS launched_at timestamp;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS suspended_at timestamp;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS suspension_reason text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS archived_at timestamp;

-- Backfill codes and active status for existing cities
UPDATE cities SET code = 'VNS', status = 'active' WHERE slug = 'varanasi' AND (code IS NULL OR code = '');
UPDATE cities SET code = 'NOI', status = 'active' WHERE slug = 'noida' AND (code IS NULL OR code = '');
UPDATE cities SET code = UPPER(SUBSTRING(slug, 1, 3)) || id::text WHERE code IS NULL OR code = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_cities_code ON cities(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cities_status ON cities(status);

-- Add city_admin to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'city_admin';

-- Add city_id to users for city-level scoping
ALTER TABLE users ADD COLUMN IF NOT EXISTS city_id integer REFERENCES cities(id);
CREATE INDEX IF NOT EXISTS idx_users_city_id ON users(city_id);
