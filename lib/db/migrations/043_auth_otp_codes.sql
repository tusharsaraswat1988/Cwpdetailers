-- Phone OTP for customer login and signup

CREATE TABLE IF NOT EXISTS auth_otp_codes (
  id serial PRIMARY KEY,
  phone text NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL,
  portal text NOT NULL DEFAULT 'customer',
  pending_name text,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_otp_codes_phone_purpose_idx ON auth_otp_codes(phone, purpose);
CREATE INDEX IF NOT EXISTS auth_otp_codes_expires_at_idx ON auth_otp_codes(expires_at);
