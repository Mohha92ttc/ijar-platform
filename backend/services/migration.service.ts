import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../database/connection';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MigrationService {
  private migrationsPath: string;

  constructor() {
    this.migrationsPath = path.join(__dirname, '../database/migrations');
  }

  async runMigrations(): Promise<void> {
    try {
      console.log('Starting database migrations...');
      
      // Create migrations table if it doesn't exist
      await this.createMigrationsTable();
      
      // Get all migration files
      const migrationFiles = this.getMigrationFiles();
      
      // Run each migration in order
      for (const file of migrationFiles) {
        await this.runMigration(file);
      }
      
      console.log('All migrations completed successfully!');
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  }

  private async createMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await query(sql);
  }

  private getMigrationFiles(): string[] {
    const files = fs.readdirSync(this.migrationsPath);
    return files
      .filter(file => file.endsWith('.sql'))
      .sort((a, b) => {
        // Sort by numeric prefix
        const aNum = parseInt(a.split('_')[0]);
        const bNum = parseInt(b.split('_')[0]);
        return aNum - bNum;
      });
  }

  private async runMigration(filename: string): Promise<void> {
    // Check if migration has already been executed
    const existingMigration = await query(
      'SELECT * FROM migrations WHERE filename = $1',
      [filename]
    );

    if (existingMigration.rows.length > 0) {
      console.log(`Migration ${filename} already executed, skipping...`);
      return;
    }

    console.log(`Running migration: ${filename}`);
    
    // Read and execute migration file
    const migrationPath = path.join(this.migrationsPath, filename);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await query(migrationSQL);
    
    // Mark migration as executed
    await query(
      'INSERT INTO migrations (filename) VALUES ($1)',
      [filename]
    );
    
    console.log(`Migration ${filename} completed successfully!`);
  }

  async rollbackMigration(filename: string): Promise<void> {
    try {
      console.log(`Rolling back migration: ${filename}`);
      
      // Check if migration exists
      const migrationPath = path.join(this.migrationsPath, filename);
      if (!fs.existsSync(migrationPath)) {
        throw new Error(`Migration file ${filename} not found`);
      }
      
      // For now, we'll just mark it as not executed
      // In a real implementation, you'd have separate rollback files
      await query(
        'DELETE FROM migrations WHERE filename = $1',
        [filename]
      );
      
      console.log(`Migration ${filename} rolled back successfully!`);
    } catch (error) {
      console.error('Rollback error:', error);
      throw error;
    }
  }

  async getMigrationStatus(): Promise<any[]> {
    const sql = `
      SELECT filename, executed_at 
      FROM migrations 
      ORDER BY id
    `;
    
    const result = await query(sql);
    return result.rows;
  }

  async createNewMigration(name: string, sql: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    const filename = `${timestamp}_${name}.sql`;
    const migrationPath = path.join(this.migrationsPath, filename);
    
    // Write migration file
    fs.writeFileSync(migrationPath, sql);
    
    console.log(`Created new migration: ${filename}`);
  }

  async resetDatabase(): Promise<void> {
    console.log('Resetting database...');
    
    // This would drop all tables and recreate them
    // Only use in development!
    const resetSQL = `
      DROP TABLE IF EXISTS user_activity CASCADE;
      DROP TABLE IF EXISTS user_preferences CASCADE;
      DROP TABLE IF EXISTS push_subscriptions CASCADE;
      DROP TABLE IF EXISTS messages CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS categories CASCADE;
      DROP TABLE IF EXISTS payments CASCADE;
      DROP TABLE IF EXISTS reviews CASCADE;
      DROP TABLE IF EXISTS bookings CASCADE;
      DROP TABLE IF EXISTS equipment CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      
      DROP TYPE IF EXISTS user_role CASCADE;
      DROP TYPE IF EXISTS equipment_status CASCADE;
      DROP TYPE IF EXISTS booking_status CASCADE;
      DROP TYPE IF EXISTS payment_status CASCADE;
      DROP TYPE IF EXISTS payment_method CASCADE;
      DROP TYPE IF EXISTS notification_type CASCADE;
      
      DROP TABLE IF EXISTS migrations;
    `;
    
    await query(resetSQL);
    
    console.log('Database reset completed!');
  }

  async seedDatabase(): Promise<void> {
    console.log('Seeding database with initial data...');

    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const adminUser = await query(`
      INSERT INTO users (name, email, phone, password, role, is_email_verified, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      'مدير النظام',
      'admin@ijar.iq',
      '+964 7700 000 001',
      hashedPassword,
      'admin',
      true,
      true
    ]);
    
    // Seed sample partners
    const partner1 = await query(`
      INSERT INTO users (name, email, phone, password, role, is_email_verified, is_approved, subscription_status, subscription_end_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      'شركة الرافدين للمعدات',
      'rafidain@example.com',
      '+964 7700 123 456',
      await bcrypt.hash('password123', 12),
      'owner',
      false,
      false,
      'pending',
      null
    ]);
    
    const partner2 = await query(`
      INSERT INTO users (name, email, phone, password, role, is_email_verified, is_approved, subscription_status, subscription_end_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      'أحمد علي (معدات تصوير)',
      'ahmed@example.com',
      '+964 7500 789 012',
      await bcrypt.hash('password123', 12),
      'owner',
      false,
      true,
      'active',
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    ]);
    
    // Seed sample equipment
    const p1 = partner1.rows[0].id;
    const p2 = partner2.rows[0].id;
    await query(`
      INSERT INTO equipment (owner_id, title, description, category, price_per_day, location, images, status, average_rating, review_count)
      VALUES 
        ($1, 'مولد كهرباء 50KV', 'مولد كهرباء جديد بحالة ممتازة، مناسب للأحداث والفعاليات الكبيرة', 'مولدات', 45000, 'بغداد - الكرادة', '{"https://images.unsplash.com/photo-1581092160562-40aa08e78837"}', 'available', 4.8, 12),
        ($2, 'كاميرا Sony A7III', 'كاميرا احترافية للتصوير الفوتوغرافي والفيديو', 'تصوير', 35000, 'أربيل - عينكاوة', '{"https://images.unsplash.com/photo-1516035069371-29a1b244cc32"}', 'available', 4.9, 24),
        ($3, 'دريل هيلتي احترافي', 'دريل هيلتي احترافي لأعمال البناء والصيانة', 'أدوات بناء', 15000, 'البصرة - العشار', '{"https://images.unsplash.com/photo-1504307651254-35680f356dfd"}', 'available', 4.7, 8),
        ($4, 'رافعة شوكية 3 طن', 'رافعة شوكية احترافية للاستخدامات الصناعية والمستودعات', 'معدات ثقيلة', 120000, 'بغداد - عويريج', '{"https://images.unsplash.com/photo-1586864387967-d02ef85d93e8"}', 'available', 4.5, 15)
      RETURNING id
    `, [p1, p2, p1, p2]);
    
    console.log('Database seeded successfully!');
  }

  async getDatabaseInfo(): Promise<any> {
    const tables = await query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    const userCount = await query('SELECT COUNT(*) as count FROM users');
    const equipmentCount = await query('SELECT COUNT(*) as count FROM equipment');
    const bookingCount = await query('SELECT COUNT(*) as count FROM bookings');
    const reviewCount = await query('SELECT COUNT(*) as count FROM reviews');
    
    return {
      tables: tables.rows,
      stats: {
        users: parseInt(userCount.rows[0].count),
        equipment: parseInt(equipmentCount.rows[0].count),
        bookings: parseInt(bookingCount.rows[0].count),
        reviews: parseInt(reviewCount.rows[0].count)
      }
    };
  }

  async checkDatabaseHealth(): Promise<boolean> {
    try {
      await query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}

export default new MigrationService();
