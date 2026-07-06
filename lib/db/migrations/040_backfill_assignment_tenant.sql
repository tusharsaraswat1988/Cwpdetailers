-- Backfill tenant columns on assignment rows created before scope stamping.

UPDATE pending_service_assignments
SET company_id = 1,
    branch_id = COALESCE(branch_id, 1),
    updated_at = NOW()
WHERE company_id IS NULL;

UPDATE service_assignments
SET company_id = 1,
    branch_id = COALESCE(branch_id, 1),
    updated_at = NOW()
WHERE company_id IS NULL;

UPDATE service_executions
SET company_id = 1,
    branch_id = COALESCE(branch_id, 1),
    updated_at = NOW()
WHERE company_id IS NULL;
