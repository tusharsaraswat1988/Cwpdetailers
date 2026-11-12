-- Migration 071: Service Reliability, Notifications, and Customer Support Tickets

-- 1. Notification enum enhancements
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_initiated';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_success';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_failed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'subscription_activated';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'subscription_paused';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'subscription_resumed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'subscription_cancelled';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'subscription_renewal_due';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'cleaning_completed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'cleaning_cna';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'cleaning_missed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'exception_resolved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ticket_created';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ticket_updated';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ticket_resolved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'staff_assigned';

-- 2. Notifications table expansion
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_customer_read ON notifications(customer_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_city ON notifications(city_id);
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe ON notifications(dedupe_key);

-- 3. Support & Complaints Enums
ALTER TYPE complaint_status ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE complaint_status ADD VALUE IF NOT EXISTS 'awaiting_customer';
ALTER TYPE complaint_priority ADD VALUE IF NOT EXISTS 'urgent';
ALTER TYPE complaint_type ADD VALUE IF NOT EXISTS 'subscription';

-- 4. Complaints / Support Tickets Schema Extension
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS ticket_number TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES dcms_subscriptions(id) ON DELETE SET NULL;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS visit_id INTEGER REFERENCES dcms_visits(id) ON DELETE SET NULL;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS operational_exception_id INTEGER REFERENCES dcms_operational_exceptions(id) ON DELETE SET NULL;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS internal_notes TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_complaints_ticket_number ON complaints(ticket_number) WHERE ticket_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_complaints_customer_status ON complaints(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_complaints_city ON complaints(city_id);
CREATE INDEX IF NOT EXISTS idx_complaints_branch ON complaints(branch_id);
CREATE INDEX IF NOT EXISTS idx_complaints_sub ON complaints(subscription_id);

-- 5. Support Ticket Messages / Updates Thread
CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id SERIAL PRIMARY KEY,
  complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL, -- 'customer' | 'staff' | 'admin' | 'system'
  sender_id INTEGER,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  attachment_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_complaint ON support_ticket_messages(complaint_id, created_at);

-- 6. Link DCMS Operational Exceptions to Support Complaints
ALTER TABLE dcms_operational_exceptions ADD COLUMN IF NOT EXISTS complaint_id INTEGER REFERENCES complaints(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_dcms_exceptions_complaint ON dcms_operational_exceptions(complaint_id);
