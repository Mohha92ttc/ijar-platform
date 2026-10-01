-- Platform bank / transfer display (admin-editable)
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS bank_account_iban TEXT;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS card_number_display TEXT;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS transfer_instructions TEXT;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS featured_ad_price DECIMAL(12, 2) DEFAULT 50000;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS featured_duration_days INTEGER DEFAULT 30;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS subscription_renewal_price DECIMAL(12, 2) DEFAULT 100000;

-- Partner featured listing (paid)
ALTER TABLE users ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS featured_priority INTEGER DEFAULT 0;

-- Service payments (featured / subscription proof) may omit booking
ALTER TABLE payments ALTER COLUMN booking_id DROP NOT NULL;
