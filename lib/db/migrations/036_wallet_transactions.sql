-- Wallet ledger table (required for customer wallet balance & transactions)

DO $$ BEGIN
  CREATE TYPE wallet_transaction_type AS ENUM ('credit', 'debit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE wallet_payment_mode AS ENUM ('cash', 'upi', 'bank_transfer', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id serial PRIMARY KEY,
  customer_id integer NOT NULL,
  company_id integer,
  type wallet_transaction_type NOT NULL,
  amount numeric(10, 2) NOT NULL,
  balance_after numeric(10, 2) NOT NULL,
  reference text,
  reference_id integer,
  payment_mode wallet_payment_mode,
  notes text,
  created_by integer,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_transactions_customer_id_idx ON wallet_transactions (customer_id);
CREATE INDEX IF NOT EXISTS wallet_transactions_created_at_idx ON wallet_transactions (created_at DESC);
