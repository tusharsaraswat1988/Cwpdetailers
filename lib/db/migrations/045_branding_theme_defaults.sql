-- Sync branding theme defaults to current CWP production palette
UPDATE platform_branding SET
  primary_color = '#00cccc',
  secondary_color = '#212529',
  accent_color = '#e0ffff',
  background_color = '#f5f6f8',
  text_color = '#212529',
  loader_background_color = COALESCE(loader_background_color, '#f5f6f8'),
  company_name = CASE WHEN company_name IS NULL OR company_name = '' THEN 'CWP Detailers + Kleansolar' ELSE company_name END,
  brand_name = CASE WHEN brand_name IS NULL OR brand_name = '' THEN 'CWP Detailers' ELSE brand_name END,
  tagline = COALESCE(NULLIF(tagline, ''), 'Premium Car Care & Solar Cleaning'),
  meta_description_template = COALESCE(NULLIF(meta_description_template, ''), 'Premium car detailing, daily wash subscriptions, and solar panel cleaning services.')
WHERE is_active = TRUE;
