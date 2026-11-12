-- Migration 066: City-Targeted Promotions and Banner Engine (ADS-001)

CREATE TABLE IF NOT EXISTS "promotions" (
  "id" serial PRIMARY KEY,
  "title" varchar(255) NOT NULL,
  "subtitle" text,
  "banner_type" varchar(50) NOT NULL DEFAULT 'first_party',
  "placement" varchar(50) NOT NULL DEFAULT 'home_hero',
  "city_id" integer REFERENCES "cities"("id") ON DELETE SET NULL,
  "service_id" integer REFERENCES "services"("id") ON DELETE SET NULL,
  "badge_text" varchar(100),
  "image_url" text,
  "mobile_image_url" text,
  "cta_text" varchar(100),
  "cta_link" varchar(500),
  "highlights" json,
  "advertiser_name" varchar(255),
  "advertiser_contact" varchar(255),
  "start_date" timestamp,
  "end_date" timestamp,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "click_count" integer NOT NULL DEFAULT 0,
  "impression_count" integer NOT NULL DEFAULT 0,
  "metadata" json,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_promotions_city" ON "promotions" ("city_id");
CREATE INDEX IF NOT EXISTS "idx_promotions_placement" ON "promotions" ("placement");
CREATE INDEX IF NOT EXISTS "idx_promotions_active" ON "promotions" ("is_active");

-- Seed initial city-specific hero banners if not present
DO $$
DECLARE
  v_varanasi_id integer;
  v_noida_id integer;
BEGIN
  SELECT id INTO v_varanasi_id FROM cities WHERE slug = 'varanasi' LIMIT 1;
  SELECT id INTO v_noida_id FROM cities WHERE slug = 'noida' LIMIT 1;

  -- Default Global/Fallback Hero Banner
  IF NOT EXISTS (SELECT 1 FROM promotions WHERE placement = 'home_hero' AND city_id IS NULL) THEN
    INSERT INTO promotions (
      title,
      subtitle,
      banner_type,
      placement,
      city_id,
      badge_text,
      cta_text,
      cta_link,
      highlights,
      is_active,
      sort_order
    ) VALUES (
      'Showroom Shine at Your Doorstep, Every Single Morning.',
      'Professional doorstep vehicle care and solar cleaning. 100% RO water, zero scratches, and trained detailers.',
      'first_party',
      'home_hero',
      NULL,
      '#1 Doorstep Detailing Platform',
      'Book Service',
      '/customer/schedule',
      '["Zero Scratches", "100% RO Water", "Doorstep Convenience", "Verified Staff"]'::json,
      true,
      100
    );
  END IF;

  -- Varanasi Targeted Hero Banner
  IF v_varanasi_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM promotions WHERE placement = 'home_hero' AND city_id = v_varanasi_id) THEN
    INSERT INTO promotions (
      title,
      subtitle,
      banner_type,
      placement,
      city_id,
      badge_text,
      cta_text,
      cta_link,
      highlights,
      is_active,
      sort_order
    ) VALUES (
      'Showroom Shine at Your Doorstep, Every Single Morning.',
      'Say goodbye to swirl marks from dirty cloths. We bring professional detailers, 100% RO water, and Korean 450 GSM microfibers right to your home or office parking.',
      'first_party',
      'home_hero',
      v_varanasi_id,
      'Varanasi''s #1 Doorstep Detailing & Solar Care',
      'Book Service',
      '/customer/schedule',
      '["Zero Scratches", "100% RO Water", "+25% Solar Power", "Doorstep Detailers"]'::json,
      true,
      10
    );
  END IF;

  -- Noida Targeted Hero Banner
  IF v_noida_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM promotions WHERE placement = 'home_hero' AND city_id = v_noida_id) THEN
    INSERT INTO promotions (
      title,
      subtitle,
      banner_type,
      placement,
      city_id,
      badge_text,
      cta_text,
      cta_link,
      highlights,
      is_active,
      sort_order
    ) VALUES (
      'Showroom Shine at Your Doorstep, Every Single Morning.',
      'Dedicated high-rise society car care. Daily morning microfiber wipe-downs, monthly full washes, and spot-free RO cleaning right in your basement parking bay.',
      'first_party',
      'home_hero',
      v_noida_id,
      'Noida''s #1 Doorstep Daily Cleaning & Society Care',
      'Explore Daily Cleaning Plans',
      '/customer/plans',
      '["Basement Bay Service", "Daily Morning Routine", "100% RO Water", "Dedicated Society Route"]'::json,
      true,
      10
    );
  END IF;
END $$;
