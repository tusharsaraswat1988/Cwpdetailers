-- Sprint 4C — contract-linked billing + pending assignment placeholder

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS contract_registry_id integer REFERENCES customer_contracts(id);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS service_location_id integer;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS asset_id integer;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS service_id integer;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS cgst_amount numeric(10, 2) NOT NULL DEFAULT '0';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS sgst_amount numeric(10, 2) NOT NULL DEFAULT '0';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS igst_amount numeric(10, 2) NOT NULL DEFAULT '0';

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contract_registry_id integer REFERENCES customer_contracts(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_location_id integer;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS asset_id integer;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_id integer;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_terms text;

CREATE TABLE IF NOT EXISTS pending_service_assignments (
  id serial PRIMARY KEY,
  contract_registry_id integer NOT NULL REFERENCES customer_contracts(id),
  customer_id integer NOT NULL,
  service_location_id integer,
  asset_id integer,
  service_id integer,
  source_system contract_source_system NOT NULL,
  source_id integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  company_id integer,
  franchisee_id integer,
  branch_id integer,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotations_contract_registry ON quotations(contract_registry_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contract_registry ON invoices(contract_registry_id);
CREATE INDEX IF NOT EXISTS idx_pending_assignments_customer ON pending_service_assignments(customer_id);
CREATE INDEX IF NOT EXISTS idx_pending_assignments_status ON pending_service_assignments(status);

CREATE UNIQUE INDEX IF NOT EXISTS pending_service_assignments_contract_pending_unique
  ON pending_service_assignments(contract_registry_id)
  WHERE status = 'pending';
