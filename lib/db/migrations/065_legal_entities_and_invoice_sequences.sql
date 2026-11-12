-- Migration 065: Legal Entities, Invoice Number Sequences, and Billing Architecture (LEG-001, LEG-004, LEG-005)

CREATE TABLE IF NOT EXISTS "legal_entities" (
  "id" serial PRIMARY KEY,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "trade_name" text,
  "entity_type" text NOT NULL DEFAULT 'company',
  "gstin" text,
  "pan_number" text,
  "state_code" text NOT NULL DEFAULT '09',
  "state_name" text NOT NULL DEFAULT 'Uttar Pradesh',
  "address_line1" text NOT NULL,
  "address_line2" text,
  "city" text NOT NULL,
  "pincode" text NOT NULL,
  "phone" text,
  "email" text,
  "website" text,
  "bank_account_name" text,
  "bank_name" text,
  "bank_account_number" text,
  "bank_ifsc" text,
  "bank_branch" text,
  "upi_id" text,
  "default_sac" text DEFAULT '998533',
  "invoice_prefix" text NOT NULL DEFAULT 'CWP',
  "is_active" boolean NOT NULL DEFAULT true,
  "is_default" boolean NOT NULL DEFAULT false,
  "terms_and_conditions" json,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_legal_entities_code" ON "legal_entities" ("code");
CREATE INDEX IF NOT EXISTS "idx_legal_entities_state" ON "legal_entities" ("state_code");

CREATE TABLE IF NOT EXISTS "invoice_number_sequences" (
  "id" serial PRIMARY KEY,
  "legal_entity_id" integer NOT NULL REFERENCES "legal_entities"("id") ON DELETE CASCADE,
  "document_type" text NOT NULL DEFAULT 'tax_invoice',
  "financial_year" text NOT NULL,
  "current_value" integer NOT NULL DEFAULT 0,
  "prefix" text NOT NULL,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_invoice_seq_entity_type_fy" 
  ON "invoice_number_sequences" ("legal_entity_id", "document_type", "financial_year");

-- Add legal_entity_id to branches and franchisees
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "legal_entity_id" integer REFERENCES "legal_entities"("id");
ALTER TABLE "franchisees" ADD COLUMN IF NOT EXISTS "legal_entity_id" integer REFERENCES "legal_entities"("id");

-- Add legal_entity_id and legal_entity_snapshot to invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "legal_entity_id" integer REFERENCES "legal_entities"("id");
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "legal_entity_snapshot" json;

-- Seed default corporate legal entity from legacy business info if legal_entities is empty
INSERT INTO "legal_entities" (
  "code", "name", "trade_name", "entity_type", "gstin", "pan_number", "state_code", "state_name",
  "address_line1", "address_line2", "city", "pincode", "phone", "email", "website",
  "bank_account_name", "bank_name", "bank_account_number", "bank_ifsc", "upi_id", "default_sac",
  "invoice_prefix", "is_active", "is_default"
)
SELECT 
  'CWP_VNS_CORP',
  COALESCE(b.business_name, 'CWP Detailers and Motors'),
  'CWP Detailers',
  'company',
  COALESCE(b.gst_number, '09BYWPS9468R3ZG'),
  'BYWPS9468R',
  '09',
  COALESCE(b.state, 'Uttar Pradesh'),
  COALESCE(b.address_line1, '0, Near Ishita School Seer Goverdhanpur'),
  b.address_line2,
  COALESCE(b.city, 'Varanasi'),
  COALESCE(b.pin_code, '221011'),
  COALESCE(b.support_phone, '7054007733'),
  COALESCE(b.support_email, 'cwpdetailers@gmail.com'),
  COALESCE(b.website, 'www.cwpdetailers.in'),
  'CWP DETAILERS AND MOTORS',
  'State Bank of India, BHELUPURA',
  '42105505194',
  'SBIN0001773',
  'pinelabs.stq4501838@pineaxis',
  '998533',
  'CWP',
  true,
  true
FROM business_info b
WHERE b.id = 1
ON CONFLICT (code) DO NOTHING;

-- If no business_info existed, insert default fallback
INSERT INTO "legal_entities" (
  "code", "name", "trade_name", "entity_type", "gstin", "pan_number", "state_code", "state_name",
  "address_line1", "city", "pincode", "phone", "email", "website",
  "bank_account_name", "bank_name", "bank_account_number", "bank_ifsc", "upi_id", "default_sac",
  "invoice_prefix", "is_active", "is_default"
)
SELECT 
  'CWP_VNS_CORP', 'CWP Detailers and Motors', 'CWP Detailers', 'company',
  '09BYWPS9468R3ZG', 'BYWPS9468R', '09', 'Uttar Pradesh',
  '0, Near Ishita School Seer Goverdhanpur', 'Varanasi', '221011',
  '7054007733', 'cwpdetailers@gmail.com', 'www.cwpdetailers.in',
  'CWP DETAILERS AND MOTORS', 'State Bank of India, BHELUPURA', '42105505194', 'SBIN0001773',
  'pinelabs.stq4501838@pineaxis', '998533', 'CWP', true, true
WHERE NOT EXISTS (SELECT 1 FROM legal_entities WHERE code = 'CWP_VNS_CORP');

-- Backfill legacy branches to the default corporate legal entity
UPDATE "branches" 
SET "legal_entity_id" = (SELECT id FROM "legal_entities" WHERE "is_default" = true LIMIT 1)
WHERE "legal_entity_id" IS NULL;
