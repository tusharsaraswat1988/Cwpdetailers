-- Migration 073: Branch Governance, Assignments & Scoping (PRD v3.0)

-- 1. Extend user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'central_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'branch_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'supervisor';

-- 2. Create branch_user_assignments table
CREATE TABLE IF NOT EXISTS branch_user_assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  assignment_role TEXT NOT NULL DEFAULT 'branch_manager',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branch_user_assignments_user_active ON branch_user_assignments(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_branch_user_assignments_branch_active ON branch_user_assignments(branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_branch_user_assignments_user_branch ON branch_user_assignments(user_id, branch_id);

-- 3. Create service_branch_overrides table (for Branch-specific catalog pricing & overrides)
CREATE TABLE IF NOT EXISTS service_branch_overrides (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  base_price_override NUMERIC(10, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  custom_settings JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_branch_overrides_service_branch_unique UNIQUE (service_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_service_branch_overrides_branch ON service_branch_overrides(branch_id);
CREATE INDEX IF NOT EXISTS idx_service_branch_overrides_service ON service_branch_overrides(service_id);

-- 4. Backfill existing managers into branch_user_assignments
INSERT INTO branch_user_assignments (user_id, branch_id, assignment_role, is_active, assigned_at, created_at, updated_at)
SELECT u.id, u.branch_id, 'branch_manager', TRUE, NOW(), NOW(), NOW()
FROM users u
WHERE u.role::text IN ('manager', 'branch_manager')
  AND u.branch_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM branch_user_assignments bua
    WHERE bua.user_id = u.id AND bua.branch_id = u.branch_id
  );
