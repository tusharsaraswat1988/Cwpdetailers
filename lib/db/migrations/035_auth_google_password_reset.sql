-- Google OAuth + self-service password reset

ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'local';

CREATE TABLE IF NOT EXISTS password_reset_codes (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  channel text NOT NULL DEFAULT 'sms',
  portal text NOT NULL DEFAULT 'customer',
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_codes_user_id_idx ON password_reset_codes(user_id);
CREATE INDEX IF NOT EXISTS password_reset_codes_expires_at_idx ON password_reset_codes(expires_at);

CREATE TABLE IF NOT EXISTS auth_pending_google (
  id serial PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  google_id text NOT NULL,
  email text NOT NULL,
  name text NOT NULL,
  avatar_url text,
  portal text NOT NULL DEFAULT 'customer',
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_pending_google_expires_at_idx ON auth_pending_google(expires_at);
