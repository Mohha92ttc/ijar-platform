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
    const { assertOwnerSubscriptionActive } = await import('../subscriptions/subscription.policy');
    await assertOwnerSubscriptionActive(ownerId);
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
      throw new Error('بريد المندوب مطلوب');
    }
    if (!email.includes('@') || email.endsWith('@') || email.startsWith('@')) {
      throw new Error('بريد المندوب غير صالح');
    }
    if (email.endsWith('.local') || email.includes('@ijar.local')) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('لا يُسمح ببريد @ijar.local في الإنتاج — أدخل بريداً حقيقياً');
      }
      throw new Error('أدخل بريداً حقيقياً (ليس .local)');
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
    if (!isActive) {
      await query(
        `
        UPDATE bookings
        SET assigned_courier_id = NULL,
            delivery_status = CASE
              WHEN COALESCE(delivery_requested, FALSE) AND delivery_status IS DISTINCT FROM 'delivered'
              THEN 'pending_assign'
              ELSE delivery_status
            END,
            updated_at = NOW()
        WHERE assigned_courier_id = $1
          AND COALESCE(delivery_status, '') <> 'delivered'
        `,
        [courierId]
      );
      await query(
        `
        UPDATE bookings
        SET return_courier_id = NULL,
            return_status = CASE
              WHEN COALESCE(return_requested, FALSE) AND return_status IS DISTINCT FROM 'delivered'
              THEN 'pending_assign'
              ELSE return_status
            END,
            updated_at = NOW()
        WHERE return_courier_id = $1
          AND COALESCE(return_status, '') <> 'delivered'
        `,
        [courierId]
      );
    }
  }

  async updateCourier(
    ownerId: string,
    courierId: string,
    data: { name?: string; phone?: string }
  ): Promise<Courier> {
    const existing = await this.assertOwned(ownerId, courierId);
    const name = data.name != null ? String(data.name).trim() : existing.name;
    const phone = data.phone != null ? String(data.phone).replace(/\s/g, '') : existing.phone;
    if (!name || name.length < 2) throw new Error('اسم المندوب مطلوب');
    if (!phone || phone.length < 8) throw new Error('رقم هاتف المندوب مطلوب');

    const upd = await query(
      `
      UPDATE couriers
      SET name = $1, phone = $2, updated_at = NOW()
      WHERE id = $3 AND owner_id = $4
      RETURNING *
      `,
      [name, phone, courierId, ownerId]
    );
    if (existing.user_id) {
      await query(`UPDATE users SET name = $1, phone = $2 WHERE id = $3`, [
        name,
        phone,
        existing.user_id,
      ]);
    }
    const emailRes = await query(
      `SELECT email FROM users WHERE id = $1`,
      [existing.user_id]
    );
    return rowToCourier({
      ...upd.rows[0],
      email: emailRes.rows[0]?.email ?? null,
    });
  }

  async unassignBooking(ownerId: string, bookingId: string, leg: string = 'outbound'): Promise<void> {
    const own = await query(
      `
      SELECT b.id FROM bookings b
      JOIN equipment e ON e.id = b.equipment_id
      WHERE b.id = $1 AND e.owner_id = $2
      `,
      [bookingId, ownerId]
    );
    if (!own.rows[0]) throw new Error('الطلب غير موجود');
    if (leg === 'return') {
      await query(
        `
        UPDATE bookings
        SET return_courier_id = NULL,
            return_status = CASE
              WHEN COALESCE(return_requested, FALSE) THEN 'pending_assign'
              ELSE return_status
            END,
            updated_at = NOW()
        WHERE id = $1
        `,
        [bookingId]
      );
      return;
    }
    await query(
      `
      UPDATE bookings
      SET assigned_courier_id = NULL,
          delivery_status = CASE
            WHEN COALESCE(delivery_requested, FALSE) THEN 'pending_assign'
            ELSE NULL
          END,
          updated_at = NOW()
      WHERE id = $1
      `,
      [bookingId]
    );
  }

  async resetPassword(ownerId: string, courierId: string, password?: string): Promise<{ email: string; temp_password: string }> {
    const courier = await this.assertOwned(ownerId, courierId);
    if (!courier.user_id) throw new Error('لا يوجد حساب دخول لهذا المندوب');

    const tempPassword =
      password && password.length >= 8
        ? password
        : `Ij${Math.random().toString(36).slice(2, 8)}A1`;

    const hash = await bcrypt.hash(tempPassword, this.bcryptRounds);
    const u = await query(`UPDATE users SET password = $1 WHERE id = $2 RETURNING email`, [
      hash,
      courier.user_id,
    ]);
    return { email: String(u.rows[0]?.email || ''), temp_password: tempPassword };
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
      SELECT * FROM (
        SELECT b.id, b.start_date, b.end_date, b.delivery_lat, b.delivery_lng, b.delivery_address,
               b.delivery_fee, b.customer_phone, b.status,
               e.title AS equipment_title, e.location AS equipment_location,
               e.pickup_lat, e.pickup_lng,
               u.name AS customer_name, u.phone AS customer_user_phone,
               ow.name AS owner_name, ow.phone AS owner_phone,
               b.delivery_status AS job_status,
               'outbound'::text AS delivery_leg
        FROM bookings b
        JOIN equipment e ON e.id = b.equipment_id
        JOIN users u ON u.id = b.customer_id
        JOIN users ow ON ow.id = e.owner_id
        WHERE b.assigned_courier_id = $1
          AND COALESCE(b.delivery_requested, FALSE) = TRUE
          AND b.status = 'confirmed'

        UNION ALL

        SELECT b.id, b.start_date, b.end_date, b.delivery_lat, b.delivery_lng, b.delivery_address,
               b.delivery_fee, b.customer_phone, b.status,
               e.title AS equipment_title, e.location AS equipment_location,
               e.pickup_lat, e.pickup_lng,
               u.name AS customer_name, u.phone AS customer_user_phone,
               ow.name AS owner_name, ow.phone AS owner_phone,
               b.return_status AS job_status,
               'return'::text AS delivery_leg
        FROM bookings b
        JOIN equipment e ON e.id = b.equipment_id
        JOIN users u ON u.id = b.customer_id
        JOIN users ow ON ow.id = e.owner_id
        WHERE b.return_courier_id = $1
          AND COALESCE(b.return_requested, FALSE) = TRUE
          AND b.status = 'confirmed'
      ) jobs
      ORDER BY
        CASE jobs.job_status
          WHEN 'out_for_delivery' THEN 0
          WHEN 'assigned' THEN 1
          WHEN 'pending_assign' THEN 2
          WHEN 'delivered' THEN 3
          ELSE 4
        END,
        jobs.start_date ASC
      `,
      [courierId]
    );
    return res.rows.map((row: Record<string, unknown>) => ({
      ...row,
      delivery_status: row.job_status,
    }));
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
      SELECT * FROM (
        SELECT b.id, b.updated_at, b.delivery_fee, e.title AS equipment_title, e.category AS equipment_category,
               b.delivery_status AS job_status, 'outbound'::text AS delivery_leg
        FROM bookings b
        JOIN equipment e ON e.id = b.equipment_id
        WHERE b.assigned_courier_id = $1
          AND COALESCE(b.delivery_requested, FALSE) = TRUE
          AND b.updated_at >= $2::date
          AND b.updated_at < ($2::date + INTERVAL '1 month')

        UNION ALL

        SELECT b.id, b.updated_at, 0::numeric AS delivery_fee, e.title AS equipment_title, e.category AS equipment_category,
               b.return_status AS job_status, 'return'::text AS delivery_leg
        FROM bookings b
        JOIN equipment e ON e.id = b.equipment_id
        WHERE b.return_courier_id = $1
          AND COALESCE(b.return_requested, FALSE) = TRUE
          AND b.updated_at >= $2::date
          AND b.updated_at < ($2::date + INTERVAL '1 month')
      ) jobs
      ORDER BY jobs.updated_at DESC
      `,
      [courierId, start]
    );
    const items = res.rows.map((row: Record<string, unknown>) => ({
      ...row,
      delivery_status: row.job_status,
      delivery_leg: String(row.delivery_leg || 'outbound'),
      delivery_fee: Number(row.delivery_fee || 0),
    }));
    const by_status: Record<string, number> = {};
    let delivered_count = 0;
    let total_delivery_fees = 0;
    for (const row of items) {
      const st = String(row.delivery_status || 'unknown');
      by_status[st] = (by_status[st] || 0) + 1;
      if (st === 'delivered') {
        delivered_count += 1;
        if (row.delivery_leg === 'outbound') {
          total_delivery_fees += row.delivery_fee;
        }
      }
    }
    return { month: yearMonth, delivered_count, total_delivery_fees, by_status, items };
  }
}
