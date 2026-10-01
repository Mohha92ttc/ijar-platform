-- Hardening: one-time token after admin approves password reset
ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS completion_token VARCHAR(128);
ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS completion_token_expires TIMESTAMPTZ;

-- Configurable platform commission
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 4) DEFAULT 0.10;

-- Align notification enum values used by app + DB
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_confirmed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_cancelled';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_received';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_review';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'partner_approval';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'review';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'message';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'system';
