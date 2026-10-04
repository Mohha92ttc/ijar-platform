import bcrypt from 'bcryptjs';
import { query } from '../../database/connection';
import { CreateCourierDTO, Courier } from './couriers.types';

function rowToCourier(row: Record<string, unknown>): Courier {
  return {
    id: String(row.id),
    owner_id: String(row.owner_id),
    user_id: row.user_id ? String(row.user_id) : null,
    name: String(row.name),
    phone: String(row.phone),
    email: row.email != null ? String(row.email) : null,
    is_active: Boolean(row.is_active),
    created_at: new Date(row.created_at as string),
  };
}

export class CouriersService {
  private bcryptRounds = Math.max(10, parseInt(process.env.BCRYPT_ROUNDS || '12', 10) || 12);

  async listByOwner(ownerId: string): Promise<Courier[]> {
    const res = await query(
      `
      SELECT c.*, u.email
      FROM couriers c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.owner_id = $1
      ORDER BY c.created_at DESC
      `,
      [ownerId]
    );
    return res.rows.map(rowToCourier);
  }

  /** الشريك ينشئ مندوب: حساب دخول تلقائي بصلاحية courier فقط */
  async createForOwner(ownerId: string, data: CreateCourierDTO): Promise<Courier & { temp_password?: string }> {
    const name = String(data.name || '').trim();
    const phone = String(data.phone || '').replace(/\s/g, '');
    if (!name || name.length < 2) throw new Error('اسم المندوب مطلوب');
    if (!phone || phone.length < 8) throw new Error('رقم هاتف المندوب مطلوب');

    const tempPassword =
      (data.password && data.password.length >= 8
        ? data.password
        : `Ij${Math.random().toString(36).slice(2, 8)}A1`) || 'Ijar1234';

    let email = (data.email || '').trim().toLowerCase();
    if (!email) {
      const slug = phone.replace(/\D/g, '').slice(-8) || Date.now().toString().slice(-8);
      email = `courier.${slug}@ijar.local`;
    }

    const dup = await query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (dup.rows.length > 0) {
      throw new Error('البريد/الحساب مستخدم مسبقاً — غيّر الهاتف أو البريد');
    }

    const hash = await bcrypt.hash(tempPassword, this.bcryptRounds);
    const userIns = await query(
      `
      INSERT INTO users (name, email, phone, password, role, is_email_verified, is_approved, subscription_status)
      VALUES ($1, $2, $3, $4, 'courier'::user_role, TRUE, TRUE, 'none')
      RETURNING id, email
      `,
      [name, email, phone, hash]
    );
    const userId = String(userIns.rows[0].id);

    const cIns = await query(
      `
      INSERT INTO couriers (owner_id, user_id, name, phone, is_active)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING *
      `,
      [ownerId, userId, name, phone]
    );

    return { ...rowToCourier({ ...cIns.rows[0], email }), temp_password: tempPassword };
  }

  async setActive(ownerId: string, courierId: string, isActive: boolean): Promise<void> {
    const res = await query(
      `UPDATE couriers SET is_active = $1, updated_at = NOW() WHERE id = $2 AND owner_id = $3`,
      [isActive, courierId, ownerId]
    );
    if (res.rowCount === 0) throw new Error('المندوب غير موجود');
  }

  async getByUserId(userId: string): Promise<Courier | null> {
    const res = await query(
      `SELECT c.*, u.email FROM couriers c LEFT JOIN users u ON u.id = c.user_id WHERE c.user_id = $1 LIMIT 1`,
      [userId]
    );
    if (!res.rows[0]) return null;
    return rowToCourier(res.rows[0]);
  }

  async assertOwned(ownerId: string, courierId: string): Promise<Courier> {
    const res = await query(`SELECT * FROM couriers WHERE id = $1 AND owner_id = $2`, [courierId, ownerId]);
    if (!res.rows[0]) throw new Error('المندوب غير تابع لهذا الشريك');
    return rowToCourier(res.rows[0]);
  }

  async listAssignedBookings(courierId: string): Promise<any[]> {
    const res = await query(
      `
      SELECT b.*, e.title AS equipment_title, e.location AS equipment_location,
             u.name AS customer_name, u.phone AS customer_user_phone
      FROM bookings b
      JOIN equipment e ON e.id = b.equipment_id
      JOIN users u ON u.id = b.customer_id
      WHERE b.assigned_courier_id = $1
        AND COALESCE(b.delivery_requested, FALSE) = TRUE
      ORDER BY
        CASE b.delivery_status
          WHEN 'out_for_delivery' THEN 0
          WHEN 'assigned' THEN 1
          WHEN 'pending_assign' THEN 2
          WHEN 'delivered' THEN 3
          ELSE 4
        END,
        b.start_date ASC
      `,
      [courierId]
    );
    return res.rows;
  }

  async monthlyReport(courierId: string, yearMonth: string): Promise<{
    month: string;
    delivered_count: number;
    total_delivery_fees: number;
    by_status: Record<string, number>;
    items: any[];
  }> {
    // yearMonth: YYYY-MM
    const start = `${yearMonth}-01`;
    const res = await query(
      `
      SELECT b.*, e.title AS equipment_title, e.category AS equipment_category
      FROM bookings b
      JOIN equipment e ON e.id = b.equipment_id
      WHERE b.assigned_courier_id = $1
        AND COALESCE(b.delivery_requested, FALSE) = TRUE
        AND b.updated_at >= $2::date
        AND b.updated_at < ($2::date + INTERVAL '1 month')
      ORDER BY b.updated_at DESC
      `,
      [courierId, start]
    );
    const items = res.rows;
    const by_status: Record<string, number> = {};
    let delivered_count = 0;
    let total_delivery_fees = 0;
    for (const row of items) {
      const st = String(row.delivery_status || 'unknown');
      by_status[st] = (by_status[st] || 0) + 1;
      if (st === 'delivered') {
        delivered_count += 1;
        total_delivery_fees += Number(row.delivery_fee || 0);
      }
    }
    return { month: yearMonth, delivered_count, total_delivery_fees, by_status, items };
  }
}
