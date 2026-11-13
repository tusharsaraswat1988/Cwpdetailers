-- Migration 080: City/Branch-Wise Marketing, Homepage CMS & Campaign Management (Phase 20)

-- 1. Extend promotions table with branch and campaign metadata
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS campaign_id INTEGER;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS alt_text TEXT;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS desktop_image_url TEXT;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS target_audience VARCHAR(50) DEFAULT 'all';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'published';

CREATE INDEX IF NOT EXISTS idx_promotions_branch ON promotions(branch_id);
CREATE INDEX IF NOT EXISTS idx_promotions_status ON promotions(status);

-- 2. Create homepage_sections table
CREATE TABLE IF NOT EXISTS homepage_sections (
  id SERIAL PRIMARY KEY,
  section_key VARCHAR(60) NOT NULL,
  title VARCHAR(255),
  subtitle TEXT,
  city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  content JSONB DEFAULT '{}'::jsonb,
  scheduled_publish_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homepage_sections_city ON homepage_sections(city_id);
CREATE INDEX IF NOT EXISTS idx_homepage_sections_branch ON homepage_sections(branch_id);
CREATE INDEX IF NOT EXISTS idx_homepage_sections_key ON homepage_sections(section_key);
CREATE INDEX IF NOT EXISTS idx_homepage_sections_sort ON homepage_sections(sort_order);
CREATE INDEX IF NOT EXISTS idx_homepage_sections_enabled ON homepage_sections(is_enabled);

-- 3. Create marketing_campaigns table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  offer_type VARCHAR(50) NOT NULL DEFAULT 'percentage_discount',
  discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
  min_order_amount NUMERIC(10, 2) DEFAULT 0,
  max_discount_amount NUMERIC(10, 2),
  applicable_service_ids JSONB DEFAULT '[]'::jsonb,
  applicable_package_ids JSONB DEFAULT '[]'::jsonb,
  applicable_vehicle_categories JSONB DEFAULT '[]'::jsonb,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  per_customer_limit INTEGER DEFAULT 1,
  eligibility_rule VARCHAR(50) DEFAULT 'all',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  terms_and_conditions TEXT,
  banner_id INTEGER REFERENCES promotions(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_campaigns_code ON marketing_campaigns(code);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_city ON marketing_campaigns(city_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_branch ON marketing_campaigns(branch_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_active ON marketing_campaigns(is_active);

-- 4. Create city_landing_pages table
CREATE TABLE IF NOT EXISTS city_landing_pages (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  slug VARCHAR(100) NOT NULL,
  page_title TEXT NOT NULL,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  canonical_url TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  hero_headline TEXT,
  hero_subheadline TEXT,
  custom_faqs JSONB DEFAULT '[]'::jsonb,
  custom_testimonials JSONB DEFAULT '[]'::jsonb,
  localized_content JSONB DEFAULT '{}'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_city_landing_city_branch_slug ON city_landing_pages(city_id, branch_id, slug);
CREATE INDEX IF NOT EXISTS idx_city_landing_slug ON city_landing_pages(slug);
CREATE INDEX IF NOT EXISTS idx_city_landing_published ON city_landing_pages(is_published);

-- 5. Create marketing_media_assets table
CREATE TABLE IF NOT EXISTS marketing_media_assets (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  alt_text TEXT,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_type VARCHAR(50),
  file_size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  tags JSONB DEFAULT '[]'::jsonb,
  city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_city ON marketing_media_assets(city_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_branch ON marketing_media_assets(branch_id);

-- 6. Create marketing_events table
CREATE TABLE IF NOT EXISTS marketing_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  banner_id INTEGER,
  campaign_id INTEGER,
  city_id INTEGER,
  branch_id INTEGER,
  customer_id INTEGER,
  session_id TEXT,
  order_id TEXT,
  conversion_value NUMERIC(10, 2),
  metadata JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_events_type_time ON marketing_events(event_type, recorded_at);
CREATE INDEX IF NOT EXISTS idx_mkt_events_city_type ON marketing_events(city_id, event_type);
CREATE INDEX IF NOT EXISTS idx_mkt_events_campaign ON marketing_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_events_banner ON marketing_events(banner_id);

-- 7. Seed default global homepage sections if empty
INSERT INTO homepage_sections (section_key, title, subtitle, city_id, branch_id, is_enabled, sort_order, content)
SELECT 'hero_banner', 'Showroom Shine at Your Doorstep', 'Doorstep vehicle care and auto detailing by verified professionals', NULL, NULL, TRUE, 1, '{"badge": "Top Rated Doorstep Auto Care", "ctaLabel": "Book Service", "ctaLink": "/customer/schedule"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM homepage_sections WHERE section_key = 'hero_banner' AND city_id IS NULL AND branch_id IS NULL);

INSERT INTO homepage_sections (section_key, title, subtitle, city_id, branch_id, is_enabled, sort_order, content)
SELECT 'promotional_offers', 'Special Offers & Packages', 'Limited-time seasonal discounts and member rewards', NULL, NULL, TRUE, 2, '{"viewAllLink": "/customer/plans"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM homepage_sections WHERE section_key = 'promotional_offers' AND city_id IS NULL AND branch_id IS NULL);

INSERT INTO homepage_sections (section_key, title, subtitle, city_id, branch_id, is_enabled, sort_order, content)
SELECT 'service_highlights', 'Signature Services', 'Select from our certified car cleaning and detailing plans', NULL, NULL, TRUE, 3, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM homepage_sections WHERE section_key = 'service_highlights' AND city_id IS NULL AND branch_id IS NULL);

INSERT INTO homepage_sections (section_key, title, subtitle, city_id, branch_id, is_enabled, sort_order, content)
SELECT 'why_choose_us', 'Why CWP Detailers?', 'Setting the standard in professional mobile vehicle care', NULL, NULL, TRUE, 4, '{"features": ["100% RO Water", "Zero-Scratch Microfiber", "Verified Technicians", "Eco-Friendly Chemistry"]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM homepage_sections WHERE section_key = 'why_choose_us' AND city_id IS NULL AND branch_id IS NULL);

INSERT INTO homepage_sections (section_key, title, subtitle, city_id, branch_id, is_enabled, sort_order, content)
SELECT 'customer_testimonials', 'Loved by 10,000+ Car Owners', 'Real feedback from satisfied vehicle owners in your society', NULL, NULL, TRUE, 5, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM homepage_sections WHERE section_key = 'customer_testimonials' AND city_id IS NULL AND branch_id IS NULL);

INSERT INTO homepage_sections (section_key, title, subtitle, city_id, branch_id, is_enabled, sort_order, content)
SELECT 'faqs', 'Frequently Asked Questions', 'Everything you need to know about our doorstep services', NULL, NULL, TRUE, 6, '{"faqs": [{"q": "How does doorstep water supply work?", "a": "Our technician arrives equipped with dedicated tanks and pure RO water."}, {"q": "Can I pause my monthly cleaning plan?", "a": "Yes, you can pause anytime from the customer dashboard."}]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM homepage_sections WHERE section_key = 'faqs' AND city_id IS NULL AND branch_id IS NULL);
