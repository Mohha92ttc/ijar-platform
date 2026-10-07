import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

function assertSafeDbName(dbName: string): string {
  // Allow only conservative identifier characters to prevent SQL injection.
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
    throw new Error('Invalid DB_NAME. Use only letters, numbers, and underscores.');
  }
  return dbName;
}

const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || '';

const useSsl =
  Boolean(databaseUrl) ||
  process.env.DB_SSL === 'true' ||
  process.env.DB_SSL === '1' ||
  /\.neon\.tech$/i.test(process.env.DB_HOST || '') ||
  /\.supabase\.co$/i.test(process.env.DB_HOST || '');

// Prefer Neon DATABASE_URL when present; otherwise classic DB_* vars
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'ijar_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

pool.on('remove', () => {
  console.log('Client removed from pool');
});

// Helper function to execute queries
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Database initialization
export async function initializeDatabase() {
  try {
    const dbName = assertSafeDbName(process.env.DB_NAME || 'ijar_db');
    const skipCreate =
      Boolean(databaseUrl) ||
      process.env.DB_SKIP_CREATE === 'true' ||
      process.env.DB_SKIP_CREATE === '1' ||
      /\.neon\.tech$/i.test(process.env.DB_HOST || '') ||
      /\.supabase\.co$/i.test(process.env.DB_HOST || '');

    // Managed clouds (Neon/Supabase) already provide a database — don't CREATE DATABASE
    if (!skipCreate) {
      const tempPool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: 'postgres',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 10000,
      });

      try {
        await tempPool.query(`CREATE DATABASE "${dbName}"`);
        console.log('Database created successfully');
      } catch (error: any) {
        if (error.code === '42P04') {
          console.log('Database already exists');
        } else {
          throw error;
        }
      } finally {
        await tempPool.end();
      }
    } else {
      console.log('Skipping CREATE DATABASE (managed Postgres)');
    }

    // Test connection to our database
    await query('SELECT NOW()');
    console.log('Database connection initialized successfully');
    
    // Run migrations if needed
    await runMigrations();
    
    return true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    return false;
  }
}

// Run database migrations
async function runMigrations() {
  try {
    // Create tables if they don't exist
    await createTables();
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}

// Create database tables
async function createTables() {
  const createTablesSQL = `
    -- User Roles Enum
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('customer', 'owner', 'admin');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Equipment Status Enum
    DO $$ BEGIN
      CREATE TYPE equipment_status AS ENUM ('available', 'rented', 'maintenance', 'hidden');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Booking Status Enum
    DO $$ BEGIN
      CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Payment Status Enum
    DO $$ BEGIN
      CREATE TYPE payment_status AS ENUM (
        'pending', 
        'proof_uploaded', 
        'under_review', 
        'approved', 
        'rejected', 
        'refunded',
        'paid',
        'failed'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Payment Method Enum
    DO $$ BEGIN
      CREATE TYPE payment_method AS ENUM ('bank', 'visa', 'cash', 'online', 'stripe', 'manual', 'wallet');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Notification Type Enum
    DO $$ BEGIN
      CREATE TYPE notification_type AS ENUM ('booking', 'payment', 'partner_approval', 'system', 'review', 'message');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role user_role NOT NULL DEFAULT 'customer',
      is_email_verified BOOLEAN DEFAULT FALSE,
      -- Partner Specific Fields
      is_approved BOOLEAN DEFAULT FALSE,
      subscription_status VARCHAR(50) DEFAULT 'none', -- 'none', 'active', 'expired'
      subscription_end_date TIMESTAMP WITH TIME ZONE,
      verification_token VARCHAR(255),
      reset_password_token VARCHAR(255),
      reset_password_expires TIMESTAMP,
      profile_image TEXT,
      bio TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Equipment Table
    CREATE TABLE IF NOT EXISTS equipment (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(100) NOT NULL,
      price_per_day DECIMAL(10, 2) NOT NULL,
      location VARCHAR(255) NOT NULL,
      images TEXT[] DEFAULT '{}',
      status equipment_status NOT NULL DEFAULT 'available',
      average_rating DECIMAL(3, 2) DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      specifications JSONB DEFAULT '{}',
      rental_terms TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Bookings Table
    CREATE TABLE IF NOT EXISTS bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
      customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_date TIMESTAMP WITH TIME ZONE NOT NULL,
      end_date TIMESTAMP WITH TIME ZONE NOT NULL,
      total_amount DECIMAL(10, 2) NOT NULL,
      status booking_status NOT NULL DEFAULT 'pending',
      location VARCHAR(255),
      notes TEXT,
      customer_phone VARCHAR(20),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Reviews Table
    CREATE TABLE IF NOT EXISTS reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
      reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      images TEXT[] DEFAULT '{}',
      helpful_count INTEGER DEFAULT 0,
      not_helpful_count INTEGER DEFAULT 0,
      response_text TEXT,
      response_date TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(equipment_id, reviewer_id)
    );

    -- Payments Table
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount DECIMAL(10, 2) NOT NULL,
      type VARCHAR(50) NOT NULL, -- 'subscription', 'commission', 'penalty', 'booking'
      status payment_status NOT NULL DEFAULT 'pending',
      method payment_method NOT NULL,
      transaction_id VARCHAR(255),
      payment_proof TEXT, -- Base64 encoded image or URL
      description TEXT,
      due_date TIMESTAMP WITH TIME ZONE,
      processed_at TIMESTAMP WITH TIME ZONE,
      processed_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Reconcile enum values for older databases that were created with a narrower enum.
    ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'proof_uploaded';
    ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'under_review';
    ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'approved';
    ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'rejected';
    ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'paid';
    ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'failed';
    ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refunded';
    ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'completed';

    ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'stripe';
    ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'manual';
    ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'wallet';

    -- Backward-compatible columns required by the payment module.
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS commission DECIMAL(10, 2) DEFAULT 0;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS owner_amount DECIMAL(10, 2) DEFAULT 0;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS transfer_phone VARCHAR(20);
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS transfer_card VARCHAR(20);
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;

    -- Normalize provider storage keys used by the payment module.
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255);

    -- Categories Table
    CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      description TEXT,
      image TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Notifications Table
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type notification_type NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      data JSONB DEFAULT '{}',
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Platform Settings Table
    CREATE TABLE IF NOT EXISTS platform_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name VARCHAR(255) NOT NULL DEFAULT 'إيجار',
      description TEXT,
      phones TEXT[] DEFAULT '{}',
      emails TEXT[] DEFAULT '{}',
      addresses TEXT[] DEFAULT '{}',
      mission TEXT,
      vision TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT single_row CHECK (id = 1)
    );

    -- Owner Payment Settings Table
    CREATE TABLE IF NOT EXISTS owner_payment_settings (
      owner_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      phone_number VARCHAR(20),
      bank_account VARCHAR(50),
      card_number VARCHAR(20),
      wallet_number VARCHAR(50),
      delivery_fee DECIMAL(12, 2) DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE owner_payment_settings ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(12, 2) DEFAULT 0;
    ALTER TABLE owner_payment_settings ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(120);
    ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS zain_cash_phone TEXT;
    ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS account_holder_name TEXT;
    ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS subscription_duration_months INTEGER DEFAULT 1;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_requested BOOLEAN DEFAULT FALSE;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(12, 2) DEFAULT 0;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_preference VARCHAR(50);
    ALTER TABLE equipment ADD COLUMN IF NOT EXISTS governorate VARCHAR(100);
    ALTER TABLE equipment ADD COLUMN IF NOT EXISTS area VARCHAR(100);
    ALTER TABLE equipment ADD COLUMN IF NOT EXISTS pickup_lat DOUBLE PRECISION;
    ALTER TABLE equipment ADD COLUMN IF NOT EXISTS pickup_lng DOUBLE PRECISION;
    ALTER TABLE equipment ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
    UPDATE equipment SET quantity = 1 WHERE quantity IS NULL OR quantity < 1;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS admin_notes TEXT;
    UPDATE equipment
      SET governorate = TRIM(SPLIT_PART(location, '-', 1))
      WHERE (governorate IS NULL OR governorate = '')
        AND location IS NOT NULL AND location <> '';
    CREATE INDEX IF NOT EXISTS idx_equipment_governorate ON equipment (governorate);
    CREATE INDEX IF NOT EXISTS idx_equipment_area ON equipment (area);

    -- Couriers (مناديب الشريك)
    CREATE TABLE IF NOT EXISTS couriers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(120) NOT NULL,
      phone VARCHAR(30) NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_couriers_owner ON couriers (owner_id);
    CREATE INDEX IF NOT EXISTS idx_couriers_user ON couriers (user_id);

    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_lat DOUBLE PRECISION;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_lng DOUBLE PRECISION;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_address TEXT;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(30) DEFAULT NULL;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS return_requested BOOLEAN DEFAULT FALSE;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS return_status VARCHAR(30) DEFAULT NULL;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS return_courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_bookings_courier ON bookings (assigned_courier_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_return_courier ON bookings (return_courier_id);

    CREATE TABLE IF NOT EXISTS support_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(120) NOT NULL,
      email VARCHAR(200) NOT NULL,
      category VARCHAR(80) DEFAULT 'general',
      message TEXT NOT NULL,
      status VARCHAR(30) DEFAULT 'open',
      admin_notes TEXT,
      booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;
    ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS customer_reply TEXT;
    ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS admin_reply TEXT;
    CREATE INDEX IF NOT EXISTS idx_support_messages_status ON support_messages (status);
    CREATE INDEX IF NOT EXISTS idx_support_messages_booking ON support_messages (booking_id);

    CREATE TABLE IF NOT EXISTS favorites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, equipment_id)
    );
    CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites (user_id);

    -- Discount codes (promo)
    CREATE TABLE IF NOT EXISTS discount_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT UNIQUE NOT NULL,
      discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
      discount_value NUMERIC NOT NULL,
      max_uses INT,
      used_count INT DEFAULT 0,
      min_order NUMERIC DEFAULT 0,
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      is_active BOOLEAN DEFAULT true,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes (code);

    -- Referral codes (per user)
    CREATE TABLE IF NOT EXISTS referral_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      code TEXT UNIQUE NOT NULL,
      uses_count INT DEFAULT 0,
      reward_amount NUMERIC DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes (user_id);
    CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes (code);

    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_code TEXT;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

    -- Messages Table
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'file'
      file_url TEXT,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- User Preferences Table (for personalization)
    CREATE TABLE IF NOT EXISTS user_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      language VARCHAR(10) DEFAULT 'ar',
      theme VARCHAR(20) DEFAULT 'light',
      email_notifications BOOLEAN DEFAULT TRUE,
      sms_notifications BOOLEAN DEFAULT TRUE,
      push_notifications BOOLEAN DEFAULT TRUE,
      preferred_categories TEXT[] DEFAULT '{}',
      preferred_locations TEXT[] DEFAULT '{}',
      price_range JSONB DEFAULT '{"min": 0, "max": null}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    );

    -- User Activity Log (for personalization)
    CREATE TABLE IF NOT EXISTS user_activity (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activity_type VARCHAR(50) NOT NULL, -- 'view', 'search', 'booking', 'review', 'favorite'
      activity_data JSONB DEFAULT '{}',
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Password reset requests requiring admin approval
    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, completed
      requested_email VARCHAR(255) NOT NULL,
      admin_notes TEXT,
      reviewed_by UUID REFERENCES users(id),
      reviewed_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Digital rental contracts (minimal)
    CREATE TABLE IF NOT EXISTS digital_contracts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
      customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'signed', 'cancelled')),
      terms_text TEXT NOT NULL,
      signed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_digital_contracts_customer ON digital_contracts (customer_id);
    CREATE INDEX IF NOT EXISTS idx_digital_contracts_owner ON digital_contracts (owner_id);

    -- Custom contract templates (owner_id NULL = platform template)
    CREATE TABLE IF NOT EXISTS contract_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body_text TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_contract_templates_owner ON contract_templates (owner_id);
    CREATE INDEX IF NOT EXISTS idx_contract_templates_active ON contract_templates (is_active);

    -- Insurance claims (minimal)
    CREATE TABLE IF NOT EXISTS insurance_claims (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_insurance_claims_customer ON insurance_claims (customer_id);
    CREATE INDEX IF NOT EXISTS idx_insurance_claims_booking ON insurance_claims (booking_id);
    CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims (status);

    -- Insurance policies (optional coverage on confirmed bookings)
    CREATE TABLE IF NOT EXISTS insurance_policies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      coverage_amount NUMERIC NOT NULL DEFAULT 0,
      premium NUMERIC NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'cancelled')),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (booking_id)
    );
    CREATE INDEX IF NOT EXISTS idx_insurance_policies_customer ON insurance_policies (customer_id);
    CREATE INDEX IF NOT EXISTS idx_insurance_policies_booking ON insurance_policies (booking_id);
    CREATE INDEX IF NOT EXISTS idx_insurance_policies_status ON insurance_policies (status);

    -- Server-side carts (customer)
    CREATE TABLE IF NOT EXISTS carts (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- Discount campaigns
    CREATE TABLE IF NOT EXISTS discount_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
      discount_value NUMERIC NOT NULL,
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      is_active BOOLEAN DEFAULT true,
      discount_code_id UUID REFERENCES discount_codes(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_discount_campaigns_active ON discount_campaigns (is_active);

    -- Optional referral programs (minimal default supported even without rows)
    CREATE TABLE IF NOT EXISTS referral_programs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      reward_amount NUMERIC NOT NULL DEFAULT 5000,
      referee_percent NUMERIC NOT NULL DEFAULT 5,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- Who used whose referral code (for owner stats / recommendations)
    CREATE TABLE IF NOT EXISTS referral_uses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
      referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (referee_id)
    );
    CREATE INDEX IF NOT EXISTS idx_referral_uses_referrer ON referral_uses (referrer_id);
    CREATE INDEX IF NOT EXISTS idx_referral_uses_code ON referral_uses (referral_code_id);

    -- Loyalty: 1 point per 1000 IQD on completed bookings
    CREATE TABLE IF NOT EXISTS loyalty_programs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      points_per_1000_iqd NUMERIC NOT NULL DEFAULT 1,
      redeem_iqd_per_point NUMERIC NOT NULL DEFAULT 1000,
      min_redeem_points INT NOT NULL DEFAULT 10,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loyalty_balances (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      total_points INT NOT NULL DEFAULT 0,
      available_points INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loyalty_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
      points INT NOT NULL,
      reason TEXT,
      discount_code TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_user ON loyalty_ledger (user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_ledger_booking_earn
      ON loyalty_ledger (booking_id) WHERE booking_id IS NOT NULL AND points > 0;

    ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS settlement_note TEXT;
    ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS admin_notes TEXT;
    ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
    ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);

    -- Payout ledger when claims are approved
    CREATE TABLE IF NOT EXISTS insurance_settlements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      claim_id UUID NOT NULL REFERENCES insurance_claims(id) ON DELETE CASCADE,
      amount NUMERIC NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'settled'
        CHECK (status IN ('settled', 'pending', 'cancelled')),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_insurance_settlements_claim ON insurance_settlements (claim_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_insurance_settlements_claim_unique
      ON insurance_settlements (claim_id) WHERE status = 'settled';

    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_equipment_owner_id ON equipment(owner_id);
    CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
    CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
    CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_equipment_id ON bookings(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
    CREATE INDEX IF NOT EXISTS idx_reviews_equipment_id ON reviews(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
    CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at);
    CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user_id ON password_reset_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON password_reset_requests(status);
  `;

  await query(createTablesSQL);

  // Add courier role to enum (safe if already present)
  try {
    await query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'courier'`);
  } catch (e) {
    console.warn('courier role enum note:', e instanceof Error ? e.message : e);
  }
}

// Export the pool for direct use if needed
export default pool;

/** Run work inside a single DB transaction (BEGIN/COMMIT/ROLLBACK). */
export async function withTransaction<T>(
  fn: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    client.release();
  }
}
