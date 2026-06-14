-- Enforce mobile + email as the single contact identity for customers, staff, and users.
-- 1) Normalize existing phone/email values
-- 2) Remove duplicate rows (keep lowest id per normalized phone/email)
-- 3) Add unique indexes on normalized contact fields

CREATE OR REPLACE FUNCTION normalize_indian_mobile(raw TEXT)
RETURNS TEXT AS $$
DECLARE
  digits TEXT;
  mobile TEXT;
BEGIN
  IF raw IS NULL OR trim(raw) = '' THEN
    RETURN NULL;
  END IF;

  digits := regexp_replace(raw, '[^0-9]', '', 'g');

  IF length(digits) = 10 THEN
    mobile := digits;
  ELSIF length(digits) = 12 AND left(digits, 2) = '91' THEN
    mobile := right(digits, 10);
  ELSIF length(digits) = 11 AND left(digits, 1) = '0' THEN
    mobile := right(digits, 10);
  ELSE
    RETURN NULL;
  END IF;

  IF mobile ~ '^[6-9][0-9]{9}$' THEN
    RETURN mobile;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION normalize_contact_email(raw TEXT)
RETURNS TEXT AS $$
  SELECT CASE
    WHEN raw IS NULL OR trim(raw) = '' THEN NULL
    ELSE lower(trim(raw))
  END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION clear_user_references(target_user_id INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE staff_documents SET uploaded_by_user_id = NULL WHERE uploaded_by_user_id = target_user_id;
  UPDATE staff_notes SET author_user_id = NULL WHERE author_user_id = target_user_id;
  IF to_regclass('public.migration_batches') IS NOT NULL THEN
    EXECUTE 'UPDATE migration_batches SET created_by_user_id = NULL WHERE created_by_user_id = $1'
      USING target_user_id;
  END IF;
  DELETE FROM sessions WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reassign_user_references(from_user_id INTEGER, to_user_id INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE staff_documents SET uploaded_by_user_id = to_user_id WHERE uploaded_by_user_id = from_user_id;
  UPDATE staff_notes SET author_user_id = to_user_id WHERE author_user_id = from_user_id;
  IF to_regclass('public.migration_batches') IS NOT NULL THEN
    EXECUTE 'UPDATE migration_batches SET created_by_user_id = $1 WHERE created_by_user_id = $2'
      USING to_user_id, from_user_id;
  END IF;
  DELETE FROM sessions WHERE user_id = from_user_id;
END;
$$ LANGUAGE plpgsql;

-- Normalize stored values in place
UPDATE customers
SET
  phone = COALESCE(normalize_indian_mobile(phone), phone),
  email = normalize_contact_email(email),
  updated_at = NOW()
WHERE phone IS NOT NULL;

UPDATE staff
SET
  phone = COALESCE(normalize_indian_mobile(phone), phone),
  email = normalize_contact_email(email),
  updated_at = NOW()
WHERE phone IS NOT NULL;

UPDATE users
SET
  phone = COALESCE(normalize_indian_mobile(phone), phone),
  email = normalize_contact_email(email),
  updated_at = NOW()
WHERE phone IS NOT NULL;

-- Reassign foreign keys from duplicate customer to keeper (lowest id per phone)
DO $$
DECLARE
  grp RECORD;
  keeper_id INTEGER;
  loser_id INTEGER;
BEGIN
  FOR grp IN
    SELECT normalize_indian_mobile(phone) AS norm_phone, array_agg(id ORDER BY id) AS ids
    FROM customers
    WHERE normalize_indian_mobile(phone) IS NOT NULL
    GROUP BY normalize_indian_mobile(phone)
    HAVING count(*) > 1
  LOOP
    keeper_id := grp.ids[1];
    FOR i IN 2..array_length(grp.ids, 1) LOOP
      loser_id := grp.ids[i];

      UPDATE vehicles SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE solar_sites SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE saved_locations SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE subscriptions SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE bookings SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE payments SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE quotations SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE complaints SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE wallet_transactions SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE leads SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE customers SET referred_by_customer_id = keeper_id WHERE referred_by_customer_id = loser_id;

      IF to_regclass('public.customer_contracts') IS NOT NULL THEN
        EXECUTE 'UPDATE customer_contracts SET customer_id = $1 WHERE customer_id = $2' USING keeper_id, loser_id;
      END IF;
      IF to_regclass('public.dcms_subscriptions') IS NOT NULL THEN
        EXECUTE 'UPDATE dcms_subscriptions SET customer_id = $1 WHERE customer_id = $2' USING keeper_id, loser_id;
      END IF;
      IF to_regclass('public.dcms_visit_feedback') IS NOT NULL THEN
        EXECUTE 'UPDATE dcms_visit_feedback SET customer_id = $1 WHERE customer_id = $2' USING keeper_id, loser_id;
      END IF;
      IF to_regclass('public.comm_conversations') IS NOT NULL THEN
        EXECUTE 'UPDATE comm_conversations SET customer_id = $1 WHERE customer_id = $2' USING keeper_id, loser_id;
      END IF;
      IF to_regclass('public.comm_timeline') IS NOT NULL THEN
        EXECUTE 'UPDATE comm_timeline SET customer_id = $1 WHERE customer_id = $2' USING keeper_id, loser_id;
      END IF;

      UPDATE users SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE customers SET user_id = NULL WHERE id = loser_id AND user_id IS NOT NULL;
      PERFORM clear_user_references(loser_id);
      DELETE FROM users WHERE customer_id = loser_id;
      DELETE FROM users WHERE id = loser_id;
      DELETE FROM customers WHERE id = loser_id;
    END LOOP;
  END LOOP;
END $$;

-- Remove duplicate customers by email (when email is present)
DO $$
DECLARE
  grp RECORD;
  keeper_id INTEGER;
  loser_id INTEGER;
BEGIN
  FOR grp IN
    SELECT normalize_contact_email(email) AS norm_email, array_agg(id ORDER BY id) AS ids
    FROM customers
    WHERE normalize_contact_email(email) IS NOT NULL
    GROUP BY normalize_contact_email(email)
    HAVING count(*) > 1
  LOOP
    keeper_id := grp.ids[1];
    FOR i IN 2..array_length(grp.ids, 1) LOOP
      loser_id := grp.ids[i];

      UPDATE vehicles SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE solar_sites SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE saved_locations SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE subscriptions SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE bookings SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE payments SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE quotations SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE complaints SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE wallet_transactions SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE leads SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE customers SET referred_by_customer_id = keeper_id WHERE referred_by_customer_id = loser_id;
      UPDATE users SET customer_id = keeper_id WHERE customer_id = loser_id;
      UPDATE customers SET user_id = NULL WHERE id = loser_id AND user_id IS NOT NULL;
      PERFORM clear_user_references(loser_id);
      DELETE FROM users WHERE customer_id = loser_id;
      DELETE FROM users WHERE id = loser_id;
      DELETE FROM customers WHERE id = loser_id;
    END LOOP;
  END LOOP;
END $$;

-- Reassign foreign keys from duplicate staff to keeper (lowest id per phone)
DO $$
DECLARE
  grp RECORD;
  keeper_id INTEGER;
  loser_id INTEGER;
BEGIN
  FOR grp IN
    SELECT normalize_indian_mobile(phone) AS norm_phone, array_agg(id ORDER BY id) AS ids
    FROM staff
    WHERE normalize_indian_mobile(phone) IS NOT NULL
    GROUP BY normalize_indian_mobile(phone)
    HAVING count(*) > 1
  LOOP
    keeper_id := grp.ids[1];
    FOR i IN 2..array_length(grp.ids, 1) LOOP
      loser_id := grp.ids[i];

      UPDATE bookings SET staff_id = keeper_id WHERE staff_id = loser_id;
      UPDATE attendance SET staff_id = keeper_id WHERE staff_id = loser_id;
      UPDATE complaints SET related_staff_id = keeper_id WHERE related_staff_id = loser_id;
      UPDATE complaints SET assigned_supervisor_id = keeper_id WHERE assigned_supervisor_id = loser_id;
      UPDATE leads SET assigned_to_staff_id = keeper_id WHERE assigned_to_staff_id = loser_id;
      UPDATE staff SET reporting_manager_id = keeper_id WHERE reporting_manager_id = loser_id;

      IF to_regclass('public.staff_location_logs') IS NOT NULL THEN
        EXECUTE 'UPDATE staff_location_logs SET staff_id = $1 WHERE staff_id = $2' USING keeper_id, loser_id;
      END IF;
      IF to_regclass('public.dcms_staff_assignments') IS NOT NULL THEN
        EXECUTE 'UPDATE dcms_staff_assignments SET staff_id = $1 WHERE staff_id = $2' USING keeper_id, loser_id;
      END IF;
      IF to_regclass('public.dcms_visits') IS NOT NULL THEN
        EXECUTE 'UPDATE dcms_visits SET staff_id = $1 WHERE staff_id = $2' USING keeper_id, loser_id;
      END IF;

      UPDATE users SET staff_id = keeper_id WHERE staff_id = loser_id;
      UPDATE staff SET user_id = NULL WHERE id = loser_id AND user_id IS NOT NULL;
      PERFORM clear_user_references(loser_id);
      DELETE FROM users WHERE staff_id = loser_id;
      DELETE FROM users WHERE id = loser_id;
      DELETE FROM staff WHERE id = loser_id;
    END LOOP;
  END LOOP;
END $$;

-- Remove duplicate staff by email (when email is present)
DO $$
DECLARE
  grp RECORD;
  keeper_id INTEGER;
  loser_id INTEGER;
BEGIN
  FOR grp IN
    SELECT normalize_contact_email(email) AS norm_email, array_agg(id ORDER BY id) AS ids
    FROM staff
    WHERE normalize_contact_email(email) IS NOT NULL
    GROUP BY normalize_contact_email(email)
    HAVING count(*) > 1
  LOOP
    keeper_id := grp.ids[1];
    FOR i IN 2..array_length(grp.ids, 1) LOOP
      loser_id := grp.ids[i];

      UPDATE bookings SET staff_id = keeper_id WHERE staff_id = loser_id;
      UPDATE attendance SET staff_id = keeper_id WHERE staff_id = loser_id;
      UPDATE complaints SET related_staff_id = keeper_id WHERE related_staff_id = loser_id;
      UPDATE complaints SET assigned_supervisor_id = keeper_id WHERE assigned_supervisor_id = loser_id;
      UPDATE leads SET assigned_to_staff_id = keeper_id WHERE assigned_to_staff_id = loser_id;
      UPDATE staff SET reporting_manager_id = keeper_id WHERE reporting_manager_id = loser_id;
      UPDATE users SET staff_id = keeper_id WHERE staff_id = loser_id;
      UPDATE staff SET user_id = NULL WHERE id = loser_id AND user_id IS NOT NULL;
      PERFORM clear_user_references(loser_id);
      DELETE FROM users WHERE staff_id = loser_id;
      DELETE FROM users WHERE id = loser_id;
      DELETE FROM staff WHERE id = loser_id;
    END LOOP;
  END LOOP;
END $$;

-- Remove duplicate users by phone/email
DO $$
DECLARE
  grp RECORD;
  keeper_id INTEGER;
  loser_id INTEGER;
BEGIN
  FOR grp IN
    SELECT normalize_indian_mobile(phone) AS norm_phone, array_agg(id ORDER BY id) AS ids
    FROM users
    WHERE normalize_indian_mobile(phone) IS NOT NULL
    GROUP BY normalize_indian_mobile(phone)
    HAVING count(*) > 1
  LOOP
    keeper_id := grp.ids[1];
    FOR i IN 2..array_length(grp.ids, 1) LOOP
      loser_id := grp.ids[i];
      PERFORM reassign_user_references(loser_id, keeper_id);
      DELETE FROM users WHERE id = loser_id;
    END LOOP;
  END LOOP;

  FOR grp IN
    SELECT normalize_contact_email(email) AS norm_email, array_agg(id ORDER BY id) AS ids
    FROM users
    WHERE normalize_contact_email(email) IS NOT NULL
    GROUP BY normalize_contact_email(email)
    HAVING count(*) > 1
  LOOP
    keeper_id := grp.ids[1];
    FOR i IN 2..array_length(grp.ids, 1) LOOP
      loser_id := grp.ids[i];
      PERFORM reassign_user_references(loser_id, keeper_id);
      DELETE FROM users WHERE id = loser_id;
    END LOOP;
  END LOOP;
END $$;

-- Remove orphan user accounts that duplicate an existing customer or staff phone
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT u.id AS user_id
    FROM users u
    WHERE EXISTS (
      SELECT 1 FROM customers c
      WHERE normalize_indian_mobile(c.phone) = normalize_indian_mobile(u.phone)
    )
    OR EXISTS (
      SELECT 1 FROM staff st
      WHERE normalize_indian_mobile(st.phone) = normalize_indian_mobile(u.phone)
    )
  LOOP
    PERFORM clear_user_references(rec.user_id);
    DELETE FROM users WHERE id = rec.user_id;
  END LOOP;
END $$;

-- Remove orphan user accounts that duplicate an existing customer or staff email
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT u.id AS user_id
    FROM users u
    WHERE u.email IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM customers c
          WHERE normalize_contact_email(c.email) = normalize_contact_email(u.email)
        )
        OR EXISTS (
          SELECT 1 FROM staff st
          WHERE normalize_contact_email(st.email) = normalize_contact_email(u.email)
        )
      )
  LOOP
    PERFORM clear_user_references(rec.user_id);
    DELETE FROM users WHERE id = rec.user_id;
  END LOOP;
END $$;

-- Staff whose phone matches a customer: remove staff row (customer identity wins)
DO $$
DECLARE
  rec RECORD;
  urec RECORD;
BEGIN
  FOR rec IN
    SELECT s.id AS staff_id
    FROM staff s
    INNER JOIN customers c
      ON normalize_indian_mobile(c.phone) = normalize_indian_mobile(s.phone)
  LOOP
    UPDATE bookings SET staff_id = NULL WHERE staff_id = rec.staff_id;
    UPDATE complaints SET related_staff_id = NULL WHERE related_staff_id = rec.staff_id;
    UPDATE complaints SET assigned_supervisor_id = NULL WHERE assigned_supervisor_id = rec.staff_id;
    UPDATE leads SET assigned_to_staff_id = NULL WHERE assigned_to_staff_id = rec.staff_id;
    UPDATE staff SET reporting_manager_id = NULL WHERE reporting_manager_id = rec.staff_id;
    FOR urec IN SELECT id FROM users WHERE staff_id = rec.staff_id LOOP
      PERFORM clear_user_references(urec.id);
    END LOOP;
    DELETE FROM users WHERE staff_id = rec.staff_id;
    DELETE FROM staff WHERE id = rec.staff_id;
  END LOOP;
END $$;

-- Staff whose email matches a customer email (when both have email)
DO $$
DECLARE
  rec RECORD;
  urec RECORD;
BEGIN
  FOR rec IN
    SELECT s.id AS staff_id
    FROM staff s
    INNER JOIN customers c
      ON normalize_contact_email(c.email) = normalize_contact_email(s.email)
    WHERE normalize_contact_email(s.email) IS NOT NULL
  LOOP
    UPDATE bookings SET staff_id = NULL WHERE staff_id = rec.staff_id;
    UPDATE complaints SET related_staff_id = NULL WHERE related_staff_id = rec.staff_id;
    UPDATE complaints SET assigned_supervisor_id = NULL WHERE assigned_supervisor_id = rec.staff_id;
    UPDATE leads SET assigned_to_staff_id = NULL WHERE assigned_to_staff_id = rec.staff_id;
    UPDATE staff SET reporting_manager_id = NULL WHERE reporting_manager_id = rec.staff_id;
    FOR urec IN SELECT id FROM users WHERE staff_id = rec.staff_id LOOP
      PERFORM clear_user_references(urec.id);
    END LOOP;
    DELETE FROM users WHERE staff_id = rec.staff_id;
    DELETE FROM staff WHERE id = rec.staff_id;
  END LOOP;
END $$;

-- Unique indexes on normalized contact fields
CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_normalized_unique
  ON customers (normalize_indian_mobile(phone))
  WHERE normalize_indian_mobile(phone) IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_email_normalized_unique
  ON customers (normalize_contact_email(email))
  WHERE normalize_contact_email(email) IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS staff_phone_normalized_unique
  ON staff (normalize_indian_mobile(phone))
  WHERE normalize_indian_mobile(phone) IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS staff_email_normalized_unique
  ON staff (normalize_contact_email(email))
  WHERE normalize_contact_email(email) IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_normalized_unique
  ON users (normalize_indian_mobile(phone))
  WHERE normalize_indian_mobile(phone) IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_unique
  ON users (normalize_contact_email(email))
  WHERE normalize_contact_email(email) IS NOT NULL;

COMMENT ON FUNCTION normalize_indian_mobile(TEXT) IS 'Normalize Indian mobile numbers to 10-digit format for identity checks';
COMMENT ON FUNCTION normalize_contact_email(TEXT) IS 'Normalize email addresses to lowercase trimmed form for identity checks';
