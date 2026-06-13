-- Platform Brand Identity Management
CREATE TABLE IF NOT EXISTS platform_branding (
  id SERIAL PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  company_name TEXT NOT NULL DEFAULT 'CWP Detailers + Kleansolar',
  brand_name TEXT NOT NULL DEFAULT 'CWP Detailers',
  tagline TEXT,

  full_logo_url TEXT,
  navbar_logo_url TEXT,
  mobile_logo_url TEXT,
  light_logo_url TEXT,
  dark_logo_url TEXT,
  login_logo_url TEXT,

  favicon_url TEXT,
  pwa_icon_url TEXT,
  apple_touch_icon_url TEXT,

  email_logo_url TEXT,
  invoice_logo_url TEXT,
  pdf_logo_url TEXT,

  og_image_url TEXT,

  primary_color TEXT NOT NULL DEFAULT '#00cccc',
  secondary_color TEXT NOT NULL DEFAULT '#212529',
  accent_color TEXT NOT NULL DEFAULT '#e0ffff',
  background_color TEXT NOT NULL DEFAULT '#ffffff',

  website TEXT,
  support_email TEXT,
  support_phone TEXT,

  gst_number TEXT,
  address TEXT,

  meta_title_template TEXT DEFAULT '{brand} | {tagline}',
  meta_description_template TEXT,
  og_title TEXT,
  og_description TEXT,
  twitter_card_type TEXT DEFAULT 'summary_large_image',
  twitter_title TEXT,
  twitter_description TEXT,

  social_links JSONB,
  schema_org JSONB,
  generated_assets JSONB,

  version INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO platform_branding (company_name, brand_name, tagline, meta_description_template, og_description)
SELECT
  'CWP Detailers + Kleansolar',
  'CWP Detailers',
  'Premium Car Care & Solar Cleaning',
  'Premium car detailing, daily wash subscriptions, and solar panel cleaning services.',
  'Premium car detailing, daily wash subscriptions, and solar panel cleaning services.'
WHERE NOT EXISTS (SELECT 1 FROM platform_branding LIMIT 1);
