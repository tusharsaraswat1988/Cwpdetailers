-- GST-compliant invoicing: credit notes, customer snapshot, tax breakdown, audit fields

DO $$ BEGIN
  CREATE TYPE invoice_document_type AS ENUM ('tax_invoice', 'credit_note', 'debit_note');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_type invoice_document_type NOT NULL DEFAULT 'tax_invoice';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reference_invoice_id integer REFERENCES invoices(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reference_invoice_number text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reference_invoice_date date;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_snapshot jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cgst_amount numeric(10, 2) NOT NULL DEFAULT '0';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sgst_amount numeric(10, 2) NOT NULL DEFAULT '0';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS igst_amount numeric(10, 2) NOT NULL DEFAULT '0';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS place_of_supply text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS supply_state_code text DEFAULT '09';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_inter_state boolean NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS round_off numeric(10, 2) NOT NULL DEFAULT '0';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hsn_summary jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credit_reason text;

CREATE INDEX IF NOT EXISTS idx_invoices_document_type ON invoices(document_type);
CREATE INDEX IF NOT EXISTS idx_invoices_reference_invoice ON invoices(reference_invoice_id);
