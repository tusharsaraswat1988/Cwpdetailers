-- Migration 005: Legal CMS, Business Info, Refund Settings, OAuth Compliance, SEO Settings
-- Run: pnpm --filter @workspace/db run push  OR  apply manually

-- ─── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE legal_page_status AS ENUM ('draft', 'published');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── Legal Pages (CMS) ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal_pages (
  id              SERIAL PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  status          legal_page_status NOT NULL DEFAULT 'draft',
  content         TEXT NOT NULL DEFAULT '',
  seo_title       TEXT,
  seo_description TEXT,
  seo_keywords    TEXT,
  canonical_url   TEXT,
  og_title        TEXT,
  og_description  TEXT,
  og_image        TEXT,
  last_updated_by TEXT,
  published_at    TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── Legal Page Version History ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal_page_versions (
  id              SERIAL PRIMARY KEY,
  page_id         INTEGER NOT NULL REFERENCES legal_pages(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL DEFAULT '',
  seo_title       TEXT,
  seo_description TEXT,
  seo_keywords    TEXT,
  canonical_url   TEXT,
  og_title        TEXT,
  og_description  TEXT,
  saved_by        TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_page_versions_page_id ON legal_page_versions(page_id);

-- ─── Business Information ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS business_info (
  id               SERIAL PRIMARY KEY,
  business_name    TEXT NOT NULL DEFAULT 'CWP Detailers And Motors',
  owner_name       TEXT NOT NULL DEFAULT 'Tushar Saraswat',
  business_type    TEXT NOT NULL DEFAULT 'Proprietorship',
  gst_number       TEXT,
  support_email    TEXT NOT NULL DEFAULT 'cwpdetailers@gmail.com',
  support_phone    TEXT NOT NULL DEFAULT '+91-7054007733',
  whatsapp_number  TEXT,
  alternate_phone  TEXT,
  address_line1    TEXT NOT NULL DEFAULT 'Seer Goverdhanpur, Behind BHU',
  address_line2    TEXT,
  city             TEXT NOT NULL DEFAULT 'Varanasi',
  state            TEXT NOT NULL DEFAULT 'Uttar Pradesh',
  pin_code         TEXT NOT NULL DEFAULT '221005',
  country          TEXT NOT NULL DEFAULT 'India',
  services         JSONB DEFAULT '["Car Wash","Solar Panel Cleaning & Maintenance","Vehicle Detailing","Ceramic Coating","Graphene Coating","PPF","Bike Detailing","Dent & Paint Services"]'::jsonb,
  facebook         TEXT,
  instagram        TEXT,
  youtube          TEXT,
  linkedin         TEXT,
  twitter          TEXT,
  website          TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── Refund Policy Settings ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS refund_policy_settings (
  id                         SERIAL PRIMARY KEY,
  refund_eligible_cases      JSONB DEFAULT '["Service failure on company side","Service not delivered as promised","Duplicate payment","Technical error in payment processing"]'::jsonb,
  non_refundable_cases       JSONB DEFAULT '["Customer-initiated cancellation","Service already rendered","Partial service completion at customer request"]'::jsonb,
  refund_processing_days     TEXT NOT NULL DEFAULT '7-10 business days',
  cancellation_rules         TEXT NOT NULL DEFAULT 'Cancellations initiated by the customer are non-refundable. Company-side failures are fully eligible for refund.',
  advance_payment_rules      TEXT,
  partial_payment_rules      TEXT,
  full_payment_rules         TEXT,
  settlement_info            TEXT,
  accepted_payment_methods   JSONB DEFAULT '["UPI","Credit Card","Debit Card","Net Banking","Wallets"]'::jsonb,
  updated_at                 TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── Google OAuth Compliance ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS oauth_compliance_settings (
  id                        SERIAL PRIMARY KEY,
  data_collected            TEXT NOT NULL DEFAULT 'Name, Email address, Profile photo',
  data_usage_description    TEXT NOT NULL DEFAULT 'We use your name, email and profile image solely to create and manage your account on our platform. We do not share or sell your data to any third party.',
  data_retention_description TEXT NOT NULL DEFAULT 'We retain your personal data for as long as your account is active. Upon deletion request, data is permanently removed within 30 days.',
  data_deletion_process     TEXT NOT NULL DEFAULT 'Users can request data deletion by emailing cwpdetailers@gmail.com. We will process the request within 30 days.',
  privacy_policy_url        TEXT NOT NULL DEFAULT '/privacy-policy',
  terms_url                 TEXT NOT NULL DEFAULT '/terms-and-conditions',
  updated_at                TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── SEO Settings ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seo_settings (
  id                      SERIAL PRIMARY KEY,
  site_title              TEXT NOT NULL DEFAULT 'CWP Detailers And Motors — Professional Car Detailing in Varanasi',
  site_description        TEXT NOT NULL DEFAULT 'CWP Detailers And Motors offers professional car wash, vehicle detailing, ceramic coating, PPF, graphene coating, solar panel cleaning, and bike detailing services in Varanasi, UP.',
  meta_keywords           TEXT,
  canonical_domain        TEXT NOT NULL DEFAULT 'https://cwpdetailers.in',
  og_title                TEXT,
  og_description          TEXT,
  og_image                TEXT,
  twitter_card_type       TEXT DEFAULT 'summary_large_image',
  twitter_title           TEXT,
  twitter_description     TEXT,
  robots_index            BOOLEAN NOT NULL DEFAULT TRUE,
  robots_follow           BOOLEAN NOT NULL DEFAULT TRUE,
  robots_additional_rules TEXT,
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── Seed Default Data ───────────────────────────────────────────────────────

INSERT INTO business_info (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO refund_policy_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO oauth_compliance_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO seo_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

INSERT INTO legal_pages (slug, title, status, content, seo_title, seo_description, last_updated_by)
VALUES
  ('privacy-policy', 'Privacy Policy', 'published',
   '<h2>Privacy Policy</h2><p>Last updated: June 2025</p><p>CWP Detailers And Motors ("we", "us", or "our") respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, and safeguard your information when you use our services.</p><h3>1. Information We Collect</h3><ul><li><strong>Account Data:</strong> When you register, we collect your name, phone number, and email address.</li><li><strong>Google Sign-In:</strong> If you log in via Google, we collect your name, email address, and profile photo only. We do not access any other Google account data.</li><li><strong>Service Data:</strong> Details about your vehicles, service history, and bookings.</li><li><strong>Communication Data:</strong> WhatsApp, SMS, and email communication records for service updates and notifications.</li><li><strong>Payment Data:</strong> Payment transactions are processed by Razorpay. We do not store card details.</li></ul><h3>2. How We Use Your Information</h3><ul><li>To provide and manage our detailing services</li><li>To process bookings and payments</li><li>To send service reminders, invoices, and updates via WhatsApp, SMS, and email</li><li>To improve our services and customer experience</li></ul><h3>3. Data Sharing</h3><p>We do not sell, trade, or rent your personal data to third parties. We share data only with:</p><ul><li>Razorpay for payment processing</li><li>Fast2SMS/MSG91 for SMS notifications</li><li>WhatsApp Business API for messaging</li><li>Cloudinary for image storage</li></ul><h3>4. Data Security</h3><p>We implement appropriate security measures including encrypted storage, secure HTTPS connections, and access controls to protect your personal data.</p><h3>5. Your Rights</h3><p>You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at cwpdetailers@gmail.com.</p><h3>6. Data Retention</h3><p>We retain your data for as long as your account is active. Upon account deletion, data is permanently removed within 30 days.</p><h3>7. Cookies</h3><p>Our web application uses local storage for session management. We do not use tracking cookies.</p><h3>8. Contact</h3><p>For privacy concerns: <a href="mailto:cwpdetailers@gmail.com">cwpdetailers@gmail.com</a><br>Phone: +91-7054007733</p>',
   'Privacy Policy — CWP Detailers And Motors',
   'Read the Privacy Policy of CWP Detailers And Motors. Learn how we collect, use, and protect your personal data.',
   'System'),

  ('terms-and-conditions', 'Terms & Conditions', 'published',
   '<h2>Terms and Conditions</h2><p>Last updated: June 2025</p><p>Welcome to CWP Detailers And Motors. By accessing or using our services, you agree to be bound by these Terms and Conditions.</p><h3>1. Services</h3><p>CWP Detailers And Motors provides the following services in Varanasi, Uttar Pradesh, India:</p><ul><li>Car Wash</li><li>Solar Panel Cleaning & Maintenance</li><li>Vehicle Detailing</li><li>Ceramic Coating</li><li>Graphene Coating</li><li>Paint Protection Film (PPF)</li><li>Bike Detailing</li><li>Dent & Paint Services</li></ul><h3>2. Bookings & Appointments</h3><ul><li>All bookings are subject to availability and confirmation.</li><li>Customers must provide accurate vehicle and contact information.</li><li>We reserve the right to reschedule appointments due to weather, staff availability, or other operational reasons.</li></ul><h3>3. Payments</h3><ul><li>Payments are processed securely via Razorpay.</li><li>Accepted methods: UPI, Credit Card, Debit Card, Net Banking, and Wallets.</li><li>All prices are inclusive of applicable taxes unless stated otherwise.</li></ul><h3>4. Cancellation & Refund Policy</h3><p>Refer to our <a href="/refund-policy">Refund & Cancellation Policy</a> for details.</p><h3>5. Liability</h3><p>CWP Detailers And Motors takes due care of all vehicles under service. However, we are not liable for pre-existing damage, mechanical failures unrelated to our services, or damage caused by force majeure events.</p><h3>6. User Conduct</h3><p>You agree not to misuse our platform or services. Any fraudulent activity, false claims, or abuse of our systems may result in account suspension.</p><h3>7. Governing Law</h3><p>These Terms are governed by the laws of India. Disputes shall be subject to the jurisdiction of courts in Varanasi, Uttar Pradesh.</p><h3>8. Changes</h3><p>We may update these Terms periodically. Continued use of our services constitutes acceptance of updated Terms.</p><h3>9. Contact</h3><p>Email: <a href="mailto:cwpdetailers@gmail.com">cwpdetailers@gmail.com</a><br>Phone: +91-7054007733</p>',
   'Terms & Conditions — CWP Detailers And Motors',
   'Read the Terms and Conditions for using CWP Detailers And Motors services. Understand your rights and obligations.',
   'System'),

  ('refund-policy', 'Refund & Cancellation Policy', 'published',
   '<h2>Refund & Cancellation Policy</h2><p>Last updated: June 2025</p><h3>Overview</h3><p>At CWP Detailers And Motors, customer satisfaction is our priority. This policy outlines our refund and cancellation guidelines.</p><h3>Refund Eligible Cases</h3><ul><li>Service failure on the company''s side</li><li>Service not delivered as promised or booked</li><li>Duplicate payment</li><li>Technical error in payment processing</li></ul><h3>Non-Refundable Cases</h3><ul><li>Customer-initiated cancellation after service is confirmed</li><li>Service already rendered in full or in part</li><li>Partial service completion at the customer''s own request</li></ul><h3>Refund Timeline</h3><p>Approved refunds are processed within <strong>7–10 business days</strong> and credited to the original payment method.</p><h3>How to Request a Refund</h3><ol><li>Contact us at <a href="mailto:cwpdetailers@gmail.com">cwpdetailers@gmail.com</a> or call +91-7054007733</li><li>Provide your booking reference and description of the issue</li><li>Our team will review and respond within 48 hours</li></ol><h3>Payment Methods</h3><p>We accept UPI, Credit Card, Debit Card, Net Banking, and Wallets via Razorpay.</p><h3>Disputes</h3><p>For unresolved disputes, please write to us at cwpdetailers@gmail.com. We are committed to resolving all disputes amicably.</p>',
   'Refund & Cancellation Policy — CWP Detailers And Motors',
   'Learn about the refund and cancellation policy of CWP Detailers And Motors. Understand eligible cases and timelines.',
   'System'),

  ('data-deletion', 'Data Deletion Policy', 'published',
   '<h2>Data Deletion Policy</h2><p>Last updated: June 2025</p><h3>Your Right to Data Deletion</h3><p>CWP Detailers And Motors respects your right to have your personal data deleted. Under applicable data protection regulations, you may request the deletion of your personal information from our systems.</p><h3>What We Delete</h3><p>Upon a valid deletion request, we will delete:</p><ul><li>Your account credentials (name, email, phone number, password)</li><li>Your profile photo and personal information</li><li>Your vehicle and asset records</li><li>Your booking and service history</li><li>Your payment references (not transaction records required by law)</li><li>Your communication preferences and consent records</li></ul><h3>What We Retain (Legal Obligation)</h3><p>Certain records may be retained for legal or regulatory compliance:</p><ul><li>Financial transaction records (required under Indian financial regulations)</li><li>GST-related invoices (retained for 7 years per GST rules)</li></ul><h3>How to Request Deletion</h3><ol><li>Send an email to <a href="mailto:cwpdetailers@gmail.com">cwpdetailers@gmail.com</a> with subject line: <strong>"Data Deletion Request"</strong></li><li>Include your registered phone number or email in the body</li><li>We will confirm receipt within 48 hours</li><li>Deletion will be completed within <strong>30 days</strong></li></ol><h3>Google Account Data</h3><p>If you used Google Sign-In, we only store your name, email, and profile photo. These are fully deleted upon your request. We do not retain any other Google account data.</p><h3>Contact</h3><p>Email: <a href="mailto:cwpdetailers@gmail.com">cwpdetailers@gmail.com</a><br>Phone: +91-7054007733</p>',
   'Data Deletion Policy — CWP Detailers And Motors',
   'Request deletion of your personal data from CWP Detailers And Motors. Learn about our data deletion process and timelines.',
   'System'),

  ('about-us', 'About Us', 'published',
   '<h2>About CWP Detailers And Motors</h2><h3>Who We Are</h3><p>CWP Detailers And Motors is Varanasi''s premier professional vehicle detailing and solar panel cleaning service. Founded by <strong>Tushar Saraswat</strong>, we are committed to delivering world-class care for your vehicles and solar installations at your doorstep.</p><h3>Our Story</h3><p>Born from a passion for pristine vehicles and sustainable solar energy, CWP Detailers And Motors combines cutting-edge detailing technology with the highest standards of service. Operating in Varanasi, Uttar Pradesh, we have built a trusted name among vehicle owners and solar energy users across the region.</p><h3>Our Services</h3><ul><li><strong>Car Wash:</strong> Thorough exterior and interior cleaning</li><li><strong>Solar Panel Cleaning & Maintenance:</strong> Restore efficiency of your solar installations</li><li><strong>Vehicle Detailing:</strong> Full interior and exterior detailing</li><li><strong>Ceramic Coating:</strong> Long-lasting protection and shine</li><li><strong>Graphene Coating:</strong> Next-generation hydrophobic protection</li><li><strong>Paint Protection Film (PPF):</strong> Invisible shield for your paintwork</li><li><strong>Bike Detailing:</strong> Professional detailing for motorcycles and scooters</li><li><strong>Dent & Paint Services:</strong> Restore your vehicle''s appearance</li></ul><h3>Why Choose Us?</h3><ul><li>Professional, trained technicians</li><li>Premium detailing products</li><li>Transparent pricing with Razorpay payment integration</li><li>Real-time booking tracking and service updates</li><li>WhatsApp, SMS, and email notifications</li><li>Fully digital — paperless invoices and receipts</li></ul><h3>Our Commitment</h3><p>We believe every vehicle deserves the best care. Our promise is quality, transparency, and customer satisfaction — every single time.</p><h3>Visit Us</h3><p>Seer Goverdhanpur, Behind BHU<br>Varanasi, Uttar Pradesh 221005<br>India</p><h3>Contact</h3><p>Email: <a href="mailto:cwpdetailers@gmail.com">cwpdetailers@gmail.com</a><br>Phone: +91-7054007733</p>',
   'About Us — CWP Detailers And Motors',
   'Learn about CWP Detailers And Motors, Varanasi''s professional vehicle detailing and solar panel cleaning service founded by Tushar Saraswat.',
   'System'),

  ('contact-us', 'Contact Us', 'published',
   '<h2>Contact CWP Detailers And Motors</h2><p>We are here to help! Reach out to us through any of the channels below.</p><h3>Business Details</h3><p><strong>CWP Detailers And Motors</strong><br>Proprietorship | Owner: Tushar Saraswat</p><h3>Address</h3><p>Seer Goverdhanpur, Behind BHU<br>Varanasi, Uttar Pradesh 221005<br>India</p><h3>Contact Information</h3><ul><li><strong>Email:</strong> <a href="mailto:cwpdetailers@gmail.com">cwpdetailers@gmail.com</a></li><li><strong>Phone:</strong> <a href="tel:+917054007733">+91-7054007733</a></li><li><strong>WhatsApp:</strong> <a href="https://wa.me/917054007733">+91-7054007733</a></li></ul><h3>Business Hours</h3><p>Monday – Saturday: 8:00 AM – 8:00 PM<br>Sunday: 9:00 AM – 6:00 PM</p><h3>Book a Service</h3><p>You can also <a href="/register">create a free account</a> and book services directly through our platform.</p>',
   'Contact Us — CWP Detailers And Motors',
   'Contact CWP Detailers And Motors for car wash, vehicle detailing, ceramic coating, and solar panel cleaning services in Varanasi.',
   'System')
ON CONFLICT (slug) DO NOTHING;
