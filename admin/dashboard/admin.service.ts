import { query } from '../../backend/database/connection';
import { AdminDashboardData, AdminStats, MostRentedEquipment } from './admin.types';
import { NotificationService } from '../../backend/modules/notifications/notification.service';
import { PaymentService } from '../../backend/modules/payments/payment.service';
import { mailService } from '../../backend/services/mail.service';
import crypto from 'crypto';

export class AdminService {
  private notificationService = new NotificationService();
  private paymentService = new PaymentService();
  async getDashboardData(): Promise<AdminDashboardData> {
    const partnerCount = await query(`SELECT COUNT(*) FROM users WHERE role = 'owner'`);
    const eqCount = await query('SELECT COUNT(*) FROM equipment');
    const bookingCount = await query('SELECT COUNT(*) FROM bookings');
    // إيرادات المنصة الفعلية: اشتراكات + إعلانات مميزة معتمدة
    const platformRevenue = await query(`
      SELECT COALESCE(SUM(amount), 0) AS sum
      FROM payments
      WHERE status = 'approved'
        AND type IN ('featured_promotion', 'subscription_renewal', 'subscription')
    `);
    // عمولة محاسبية من دفعات الحجوزات (الزبون يدفع للشريك — الرقم للمقارنة فقط)
    const bookingCommission = await query(`
      SELECT COALESCE(SUM(commission), 0) AS sum
      FROM payments
      WHERE status IN ('approved', 'paid', 'completed')
        AND (type = 'booking' OR type IS NULL OR booking_id IS NOT NULL)
        AND type NOT IN ('featured_promotion', 'subscription_renewal', 'subscription')
    `);
    const approvedPlatform = parseFloat(String(platformRevenue.rows[0].sum || 0));
    const commissionStored = parseFloat(String(bookingCommission.rows[0].sum || 0));

    const stats: AdminStats = {
      totalUsers: parseInt(String(partnerCount.rows[0].count), 10),
      totalEquipment: parseInt(String(eqCount.rows[0].count), 10),
      totalBookings: parseInt(String(bookingCount.rows[0].count), 10),
      monthlyRevenue: approvedPlatform,
      totalCommission: Math.round(commissionStored * 100) / 100,
    };

    const mostRentedRes = await query(`
      SELECT e.id as "equipmentId", e.title, COUNT(b.id) as "bookingCount", SUM(b.total_amount) as "totalRevenue"
      FROM equipment e
      LEFT JOIN bookings b ON e.id = b.equipment_id
      GROUP BY e.id, e.title
      ORDER BY "bookingCount" DESC
      LIMIT 5
    `);

    const pendingPayments = await query("SELECT * FROM payments WHERE status = 'pending' ORDER BY created_at DESC");

    const recentBookingsRes = await query(`
      SELECT b.id, b.status, b.total_amount, b.created_at,
             u.name as customer_name, e.title as equipment_title
      FROM bookings b
      JOIN users u ON b.customer_id = u.id
      JOIN equipment e ON b.equipment_id = e.id
      ORDER BY b.created_at DESC
      LIMIT 5
    `);

    return {
      stats,
      mostRented: mostRentedRes.rows.map(r => ({
        equipmentId: String(r.equipmentId),
        title: String(r.title),
        bookingCount: parseInt(String(r.bookingCount)),
        totalRevenue: parseFloat(String(r.totalRevenue || 0))
      })),
      recentBookings: recentBookingsRes.rows.map(r => ({
        id: String(r.id),
        status: String(r.status),
        total_amount: parseFloat(String(r.total_amount)),
        customer_name: String(r.customer_name),
        equipment_title: String(r.equipment_title),
        created_at: String(r.created_at)
      })),
      pendingPayments: pendingPayments.rows.map(r => ({
        id: String(r.id),
        amount: parseFloat(String(r.amount)),
        user_id: String(r.user_id),
        status: String(r.status),
        created_at: String(r.created_at)
      })) as any
    };
  }

  async getAllUsers(): Promise<any[]> {
    const res = await query(`
      SELECT id, name, email, role, phone, is_approved, subscription_status, subscription_end_date, created_at as joined 
      FROM users 
      ORDER BY created_at DESC
    `);
    return res.rows;
  }

  /** Create partner/customer without issuing a login session (admin-only) */
  async createUser(data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role?: string;
    subscriptionMonths?: number;
  }): Promise<any> {
    const bcrypt = await import('bcryptjs');
    const name = String(data.name || '').trim();
    const email = String(data.email || '').trim().toLowerCase();
    const password = String(data.password || '');
    const role = data.role === 'customer' ? 'customer' : 'owner';
    if (!name || !email || password.length < 8) {
      throw new Error('الاسم والبريد وكلمة مرور (8 أحرف+) مطلوبة');
    }
    const dup = await query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (dup.rows.length > 0) throw new Error('البريد الإلكتروني مستخدم مسبقاً');

    const hashed = await bcrypt.hash(password, 12);
    const phone = (data.phone && String(data.phone).replace(/\s/g, '')) || `+964000${Date.now().toString().slice(-7)}`;
    const months = Math.max(1, Number(data.subscriptionMonths) || 1);
    const endDate =
      role === 'owner'
        ? new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000)
        : null;

    const ins = await query(
      `
      INSERT INTO users (
        name, email, phone, password, role,
        is_email_verified, is_approved, subscription_status, subscription_end_date
      )
      VALUES ($1, $2, $3, $4, $5::user_role, true, true, $6, $7)
      RETURNING id, name, email, phone, role, is_approved, subscription_status, subscription_end_date, created_at as joined
    `,
      [name, email, phone, hashed, role, role === 'owner' ? 'active' : 'none', endDate]
    );
    return ins.rows[0];
  }

  async updateEquipmentStatus(equipmentId: string, status: any): Promise<void> {
    await query('UPDATE equipment SET status = $1 WHERE id = $2', [status, equipmentId]);
  }

  async banUser(userId: string): Promise<void> {
    await query("UPDATE users SET subscription_status = 'banned' WHERE id = $1", [userId]);
  }

  async unbanUser(userId: string): Promise<void> {
    const res = await query(`SELECT role FROM users WHERE id = $1`, [userId]);
    if (res.rows.length === 0) throw new Error('User not found');
    const role = String(res.rows[0].role);
    const next = role === 'owner' ? 'active' : 'none';
    await query(`UPDATE users SET subscription_status = $1 WHERE id = $2 AND subscription_status = 'banned'`, [
      next,
      userId,
    ]);
  }

  async approveUser(userId: string): Promise<void> {
    // الموافقة تفتح الدخول فقط — الظهور بالسوق بعد دفع الاشتراك وقبوله
    await query(
      `
      UPDATE users
      SET is_approved = TRUE,
          subscription_status = CASE
            WHEN subscription_status = 'active' AND subscription_end_date IS NOT NULL AND subscription_end_date > NOW()
              THEN subscription_status
            ELSE 'pending'
          END
      WHERE id = $1
      `,
      [userId]
    );
    await this.notificationService.create({
      user_id: userId,
      type: 'partner_approval',
      title: 'تمت الموافقة على حسابك',
      message:
        'حسابك مفعّل للدخول. لتظهر معداتك في السوق وتُفتح لوحة التحكم بالكامل، ادفع الاشتراك من تبويب «إعلان مميز / اشتراك» وارفع إثبات التحويل.',
      related_id: userId,
    });
  }

  async renewSubscription(userId: string, months: number): Promise<void> {
    const m = Math.max(1, Math.min(24, Number(months) || 1));
    await query(
      `
      UPDATE users
      SET subscription_end_date = GREATEST(COALESCE(subscription_end_date, NOW()), NOW()) + ($2::int * INTERVAL '1 month'),
          subscription_status = 'active',
          is_approved = TRUE
      WHERE id = $1
      `,
      [userId, m]
    );
    await this.notificationService.create({
      user_id: userId,
      type: 'system',
      title: 'تم تفعيل الاشتراك',
      message: `تم تجديد اشتراكك لمدة ${m} شهر. معداتك ولوحة التحكم عادت للعمل.`,
      related_id: userId,
    });
  }

  async getAllBookings(): Promise<any[]> {
    const res = await query(`
      SELECT b.*, u.name as customer_name, e.title as equipment_title 
      FROM bookings b
      JOIN users u ON b.customer_id = u.id
      JOIN equipment e ON b.equipment_id = e.id
      ORDER BY b.created_at DESC
      LIMIT 200
    `);
    return res.rows;
  }

  async updateBookingStatus(bookingId: string, status: string): Promise<void> {
    const allowed = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!allowed.includes(status)) throw new Error('حالة غير صالحة');
    const res = await query(
      `
      UPDATE bookings
      SET status = $1::booking_status, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id
      `,
      [status, bookingId]
    );
    if (res.rows.length === 0) throw new Error('الحجز غير موجود');
  }

  async listAllEquipment(): Promise<any[]> {
    const res = await query(
      `
      SELECT e.id, e.title, e.category, e.status, e.price_per_day, e.location, u.name AS owner_name
      FROM equipment e
      JOIN users u ON u.id = e.owner_id
      ORDER BY e.created_at DESC
      LIMIT 300
      `
    );
    return res.rows;
  }

  async getAllPayments(): Promise<any[]> {
    const res = await query(`
      SELECT p.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);
    return res.rows;
  }

  async getPlatformSettings(): Promise<any> {
    const res = await query("SELECT * FROM platform_settings LIMIT 1");
    if (res.rows[0]) {
      const r = res.rows[0];
      return {
        ...r,
        phones: r.phones || ['+964 7700 123 456'],
        emails: r.emails || ['info@ijar.iq'],
        addresses: r.addresses || ['بغداد، العراق'],
        bank_name: r.bank_name ?? '',
        bank_account_iban: r.bank_account_iban ?? '',
        card_number_display: r.card_number_display ?? '',
        zain_cash_phone: r.zain_cash_phone ?? '',
        account_holder_name: r.account_holder_name ?? '',
        transfer_instructions: r.transfer_instructions ?? '',
        featured_ad_price: r.featured_ad_price != null ? Number(r.featured_ad_price) : 50000,
        featured_duration_days: r.featured_duration_days != null ? Number(r.featured_duration_days) : 30,
        subscription_renewal_price: r.subscription_renewal_price != null ? Number(r.subscription_renewal_price) : 100000,
        commission_rate: r.commission_rate != null ? Number(r.commission_rate) : 0.1,
      };
    }
    return {
      name: 'إيجار',
      description: 'المنصة الأولى لتأجير المعدات في العراق',
      phones: ['+964 7700 123 456', '+964 7500 789 012'],
      emails: ['info@ijar.iq', 'support@ijar.iq'],
      addresses: ['بغداد - الكرادة، شارع فلسطين', 'أربيل - عينكاوة، بالقرب من الجامعة'],
      mission: 'مهمتنا هي تسهيل عملية تأجير المعدات في العراق وتوفير مصدر دخل إضافي لأصحاب المعدات.',
      vision: 'أن نكون المنصة الأولى والأكثر ثقة في تأجير المعدات في الشرق الأوسط.',
      bank_name: '',
      bank_account_iban: '',
      card_number_display: '',
      zain_cash_phone: '',
      account_holder_name: '',
      transfer_instructions: '',
      featured_ad_price: 50000,
      featured_duration_days: 30,
      subscription_renewal_price: 100000,
      commission_rate: 0.1,
    };
  }

  async updatePlatformSettings(data: any): Promise<void> {
    const asTextArray = (v: unknown): string[] => {
      if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean);
      if (typeof v === 'string' && v.trim()) return [v.trim()];
      return [];
    };
    await query(
      `
      INSERT INTO platform_settings (
        id, name, description, phones, emails, addresses, mission, vision,
        bank_name, bank_account_iban, card_number_display, zain_cash_phone, account_holder_name,
        transfer_instructions,
        featured_ad_price, featured_duration_days, subscription_renewal_price, commission_rate
      )
      VALUES (
        1, $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        phones = EXCLUDED.phones,
        emails = EXCLUDED.emails,
        addresses = EXCLUDED.addresses,
        mission = EXCLUDED.mission,
        vision = EXCLUDED.vision,
        bank_name = EXCLUDED.bank_name,
        bank_account_iban = EXCLUDED.bank_account_iban,
        card_number_display = EXCLUDED.card_number_display,
        zain_cash_phone = EXCLUDED.zain_cash_phone,
        account_holder_name = EXCLUDED.account_holder_name,
        transfer_instructions = EXCLUDED.transfer_instructions,
        featured_ad_price = EXCLUDED.featured_ad_price,
        featured_duration_days = EXCLUDED.featured_duration_days,
        subscription_renewal_price = EXCLUDED.subscription_renewal_price,
        commission_rate = EXCLUDED.commission_rate
    `,
      [
        data.name || 'إيجار',
        data.description ?? '',
        asTextArray(data.phones),
        asTextArray(data.emails),
        asTextArray(data.addresses),
        data.mission ?? '',
        data.vision ?? '',
        data.bank_name ?? null,
        data.bank_account_iban ?? null,
        data.card_number_display ?? null,
        data.zain_cash_phone ?? null,
        data.account_holder_name ?? null,
        data.transfer_instructions ?? null,
        Number(data.featured_ad_price ?? 50000),
        Number(data.featured_duration_days ?? 30),
        Number(data.subscription_renewal_price ?? 100000),
        Number(data.commission_rate ?? 0.1),
      ]
    );
  }

  async deleteUser(id: string): Promise<void> {
    await query('DELETE FROM users WHERE id = $1', [id]);
  }

  async reviewPayment(paymentId: string, approve: boolean, notes?: string): Promise<void> {
    await this.paymentService.adminReview(paymentId, approve, notes);
  }

  async getPasswordResetRequests(): Promise<any[]> {
    const res = await query(
      `
      SELECT r.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
      FROM password_reset_requests r
      JOIN users u ON u.id = r.user_id
      ORDER BY r.created_at DESC
      `
    );
    return res.rows;
  }

  async reviewPasswordResetRequest(adminId: string, requestId: string, approve: boolean, notes?: string): Promise<{ completionToken?: string }> {
    if (!approve) {
      const res = await query(
        `
        UPDATE password_reset_requests
        SET status = 'rejected', admin_notes = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND status = 'pending'
        RETURNING user_id, requested_email
        `,
        [notes || null, adminId, requestId]
      );
      if (res.rows.length === 0) throw new Error('Request not found or already reviewed');
      const userId = String(res.rows[0].user_id);
      await this.notificationService.create({
        user_id: userId,
        type: 'system',
        title: 'تم رفض طلب تغيير كلمة المرور',
        message: `تم الرفض${notes ? `: ${notes}` : ''}`,
        related_id: requestId,
      });
      return {};
    }

    const completionToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 30);
    const res = await query(
      `
      UPDATE password_reset_requests
      SET status = 'approved',
          admin_notes = $1,
          reviewed_by = $2,
          reviewed_at = CURRENT_TIMESTAMP,
          completion_token = $3,
          completion_token_expires = $4
      WHERE id = $5 AND status = 'pending'
      RETURNING user_id, requested_email
      `,
      [notes || null, adminId, completionToken, expires, requestId]
    );
    if (res.rows.length === 0) throw new Error('Request not found or already reviewed');
    const userId = String(res.rows[0].user_id);
    const email = String(res.rows[0].requested_email);
    await this.notificationService.create({
      user_id: userId,
      type: 'system',
      title: 'تمت الموافقة على تغيير كلمة المرور',
      message: 'تمت الموافقة. استخدم رمز التأكيد المرسل لإدخال كلمة المرور الجديدة خلال 30 دقيقة.',
      related_id: requestId,
    });
    await mailService.send({
      to: email,
      subject: 'رمز تأكيد تغيير كلمة المرور — إيجار',
      text: `رمز التأكيد لمرة واحدة: ${completionToken}\nصالح لمدة 30 دقيقة.`,
    });
    // Return token so admin UI / tests can complete flow when SMTP is not configured
    return { completionToken };
  }

  /** تقرير مدفوعات الشركاء للمنصة (اشتراك / إعلان مميز) */
  async getPartnerPaymentsReport(): Promise<any> {
    const partnersRes = await query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        u.is_approved,
        u.subscription_status,
        u.subscription_end_date,
        COALESCE(SUM(CASE WHEN p.status = 'approved' THEN p.amount ELSE 0 END), 0) AS total_paid,
        COALESCE(SUM(CASE WHEN p.status IN ('under_review','pending','proof_uploaded') THEN p.amount ELSE 0 END), 0) AS pending_amount,
        COUNT(p.id) FILTER (WHERE p.type IN ('featured_promotion','subscription_renewal','subscription')) AS payment_count
      FROM users u
      LEFT JOIN payments p
        ON p.user_id = u.id
       AND p.type IN ('featured_promotion', 'subscription_renewal', 'subscription')
      WHERE u.role = 'owner'
      GROUP BY u.id
      ORDER BY pending_amount DESC, total_paid DESC
    `);

    const txRes = await query(`
      SELECT p.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
      FROM payments p
      JOIN users u ON u.id = p.user_id
      WHERE u.role = 'owner'
        AND p.type IN ('featured_promotion', 'subscription_renewal', 'subscription')
      ORDER BY p.created_at DESC
      LIMIT 200
    `);

    const summary = {
      partnersCount: partnersRes.rows.length,
      totalPaid: partnersRes.rows.reduce((s, r) => s + Number(r.total_paid || 0), 0),
      pendingAmount: partnersRes.rows.reduce((s, r) => s + Number(r.pending_amount || 0), 0),
      pendingRequests: txRes.rows.filter((r) =>
        ['under_review', 'pending', 'proof_uploaded'].includes(String(r.status))
      ).length,
    };

    return {
      summary,
      partners: partnersRes.rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        email: String(r.email),
        phone: String(r.phone || '—'),
        is_approved: Boolean(r.is_approved),
        subscription_status: String(r.subscription_status || 'none'),
        subscription_end_date: r.subscription_end_date,
        total_paid: Number(r.total_paid || 0),
        pending_amount: Number(r.pending_amount || 0),
        payment_count: Number(r.payment_count || 0),
      })),
      transactions: txRes.rows.map((r) => ({
        id: String(r.id),
        user_id: String(r.user_id),
        user_name: String(r.user_name),
        user_email: String(r.user_email),
        amount: Number(r.amount),
        type: String(r.type),
        status: String(r.status),
        created_at: r.created_at,
        payment_proof: r.payment_proof,
        notes: r.notes,
      })),
    };
  }
}
