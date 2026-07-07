-- Enterprise Branding Management System (BMS) — extend platform_branding
ALTER TABLE platform_branding ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE platform_branding ADD COLUMN IF NOT EXISTS text_color TEXT DEFAULT '#212529';
ALTER TABLE platform_branding ADD COLUMN IF NOT EXISTS logo_white_url TEXT;
ALTER TABLE platform_branding ADD COLUMN IF NOT EXISTS logo_transparent_url TEXT;
ALTER TABLE platform_branding ADD COLUMN IF NOT EXISTS logo_square_url TEXT;
ALTER TABLE platform_branding ADD COLUMN IF NOT EXISTS logo_icon_url TEXT;
ALTER TABLE platform_branding ADD COLUMN IF NOT EXISTS favicon_ico_url TEXT;
ALTER TABLE platform_branding ADD COLUMN IF NOT EXISTS splash_logo_url TEXT;
ALTER TABLE platform_branding ADD COLUMN IF NOT EXISTS loader_animation_url TEXT;
ALTER TABLE platform_branding ADD COLUMN IF NOT EXISTS loader_background_color TEXT;
ALTER TABLE platform_branding ADD COLUMN IF NOT EXISTS loader_text TEXT DEFAULT 'Loading…';
ALTER TABLE platform_branding ADD COLUMN IF NOT EXISTS twitter_image_url TEXT;
ALTER TABLE platform_branding ADD COLUMN IF NOT EXISTS seo_keywords TEXT;
ALTER TABLE platform_branding ADD COLUMN IF NOT EXISTS seo_author TEXT;

-- Backfill new columns from existing branding data
UPDATE platform_branding SET
  short_description = COALESCE(short_description, meta_description_template),
  splash_logo_url = COALESCE(splash_logo_url, login_logo_url, full_logo_url),
  logo_icon_url = COALESCE(logo_icon_url, pwa_icon_url, full_logo_url),
  logo_square_url = COALESCE(logo_square_url, pwa_icon_url, full_logo_url),
  twitter_image_url = COALESCE(twitter_image_url, og_image_url),
  loader_background_color = COALESCE(loader_background_color, background_color),
  text_color = COALESCE(text_color, '#212529')
WHERE is_active = TRUE;
