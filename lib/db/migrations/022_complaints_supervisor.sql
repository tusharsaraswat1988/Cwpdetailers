-- Migration 022: Link complaints to field staff and supervisors

ALTER TABLE complaints ADD COLUMN IF NOT EXISTS related_staff_id INTEGER REFERENCES staff(id);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS assigned_supervisor_id INTEGER REFERENCES staff(id);

CREATE INDEX IF NOT EXISTS idx_complaints_assigned_supervisor ON complaints(assigned_supervisor_id);
CREATE INDEX IF NOT EXISTS idx_complaints_related_staff ON complaints(related_staff_id);
