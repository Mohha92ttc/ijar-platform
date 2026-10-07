import { Response } from 'express';
import { query } from '../../database/connection';
import { AuthenticatedRequest } from '../auth/auth.middleware';
import { NotificationService } from '../../services/notification.service';

const notifications = new NotificationService();

function uid(req: AuthenticatedRequest): string | undefined {
  return req.user?.userId || req.user?.id;
}

function mapClaim(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    booking_id: String(row.booking_id),
    bookingId: String(row.booking_id),
    customer_id: String(row.customer_id),
    customerId: String(row.customer_id),
    description: String(row.description || ''),
    amount: Number(row.amount || 0),
    status: String(row.status),
    created_at: row.created_at,
    createdAt: row.created_at,
    equipment_title: row.equipment_title != null ? String(row.equipment_title) : undefined,
    customer_name: row.customer_name != null ? String(row.customer_name) : undefined,
  };
}

function mapPolicy(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    booking_id: String(row.booking_id),
    bookingId: String(row.booking_id),
    customer_id: String(row.customer_id),
    customerId: String(row.customer_id),
    coverage_amount: Number(row.coverage_amount || 0),
    coverageAmount: Number(row.coverage_amount || 0),
    premium: Number(row.premium || 0),
    status: String(row.status),
    created_at: row.created_at,
    createdAt: row.created_at,
    equipment_title: row.equipment_title != null ? String(row.equipment_title) : undefined,
  };
}

export const insuranceController = {
  /** Customer: optional insurance on a confirmed booking */
  async createPolicy(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });

      const bookingId = String(req.body?.bookingId || req.body?.booking_id || '').trim();
      if (!bookingId) return res.status(400).json({ error: 'bookingId مطلوب' });

      const bookingRes = await query(
        `
        SELECT b.id, b.customer_id, b.status, b.total_amount, e.title AS equipment_title
        FROM bookings b
        JOIN equipment e ON e.id = b.equipment_id
        WHERE b.id = $1
        LIMIT 1
        `,
        [bookingId]
      );
      const booking = bookingRes.rows[0];
      if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });
      if (String(booking.customer_id) !== String(userId) && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'يمكن للمستأجر فقط إضافة تأمين' });
      }
      if (String(booking.status) !== 'confirmed' && req.user?.role !== 'admin') {
        return res.status(400).json({ error: 'التأمين الاختياري متاح للحجوزات المؤكدة فقط' });
      }

      const existing = await query(
        `SELECT id FROM insurance_policies WHERE booking_id = $1 AND status = 'active' LIMIT 1`,
        [bookingId]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'يوجد تأمين نشط لهذا الحجز مسبقاً' });
      }

      const total = Number(booking.total_amount || 0);
      let coverageAmount = Number(req.body?.coverage_amount ?? req.body?.coverageAmount);
      if (!Number.isFinite(coverageAmount) || coverageAmount <= 0) {
        coverageAmount = Math.max(total * 2, 50000);
      }
      let premium = Number(req.body?.premium);
      if (!Number.isFinite(premium) || premium < 0) {
        premium = Math.max(Math.round(coverageAmount * 0.03), 5000);
      }

      const inserted = await query(
        `
        INSERT INTO insurance_policies (booking_id, customer_id, coverage_amount, premium, status)
        VALUES ($1, $2, $3, $4, 'active')
        RETURNING *
        `,
        [bookingId, booking.customer_id, coverageAmount, premium]
      );
      const policy = mapPolicy({ ...inserted.rows[0], equipment_title: booking.equipment_title });

      await notifications.sendNotification({
        userId: String(booking.customer_id),
        type: 'system',
        title: 'تأمين اختياري',
        message: `تم تفعيل تأمين على حجز «${booking.equipment_title}» بقسط ${premium.toLocaleString()} د.ع`,
        data: { related_id: bookingId },
      });

      return res.status(201).json(policy);
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'يوجد تأمين لهذا الحجز مسبقاً' });
      }
      console.error('createPolicy', error);
      return res.status(500).json({ error: 'فشل إنشاء بوليصة التأمين' });
    }
  },

  async getPolicies(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });

      const isAdmin = req.user?.role === 'admin';
      const result = isAdmin
        ? await query(
            `
            SELECT p.*, e.title AS equipment_title
            FROM insurance_policies p
            JOIN bookings b ON b.id = p.booking_id
            JOIN equipment e ON e.id = b.equipment_id
            ORDER BY p.created_at DESC
            LIMIT 200
            `
          )
        : await query(
            `
            SELECT p.*, e.title AS equipment_title
            FROM insurance_policies p
            JOIN bookings b ON b.id = p.booking_id
            JOIN equipment e ON e.id = b.equipment_id
            WHERE p.customer_id = $1
            ORDER BY p.created_at DESC
            LIMIT 100
            `,
            [userId]
          );

      return res.json(result.rows.map((r) => mapPolicy(r)));
    } catch (error) {
      console.error('getPolicies', error);
      return res.status(500).json({ error: 'فشل جلب البوالص' });
    }
  },

  async getPolicy(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });

      const result = await query(
        `
        SELECT p.*, e.title AS equipment_title
        FROM insurance_policies p
        JOIN bookings b ON b.id = p.booking_id
        JOIN equipment e ON e.id = b.equipment_id
        WHERE p.id = $1
        LIMIT 1
        `,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'البوليصة غير موجودة' });
      }
      const row = result.rows[0];
      if (String(row.customer_id) !== String(userId) && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
      }
      return res.json(mapPolicy(row));
    } catch (error) {
      return res.status(500).json({ error: 'فشل جلب البوليصة' });
    }
  },

  async updatePolicy(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'للإدارة فقط' });
      }
      const status = String(req.body?.status || '').trim();
      if (!['active', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'حالة غير صالحة' });
      }
      const result = await query(
        `UPDATE insurance_policies SET status = $1 WHERE id = $2 RETURNING *`,
        [status, req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'البوليصة غير موجودة' });
      }
      return res.json(mapPolicy(result.rows[0]));
    } catch (error) {
      return res.status(500).json({ error: 'فشل تحديث البوليصة' });
    }
  },

  /** Customer cancel own active policy, or admin */
  async deletePolicy(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });

      const existing = await query(`SELECT * FROM insurance_policies WHERE id = $1 LIMIT 1`, [
        req.params.id,
      ]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'البوليصة غير موجودة' });
      }
      const row = existing.rows[0];
      if (String(row.customer_id) !== String(userId) && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
      }
      if (String(row.status) === 'cancelled') {
        return res.json(mapPolicy(row));
      }

      const result = await query(
        `UPDATE insurance_policies SET status = 'cancelled' WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      return res.json(mapPolicy(result.rows[0]));
    } catch (error) {
      console.error('deletePolicy', error);
      return res.status(500).json({ error: 'فشل إلغاء البوليصة' });
    }
  },

  async cancelPolicy(req: AuthenticatedRequest, res: Response) {
    return insuranceController.deletePolicy(req, res);
  },

  // —— Claims (real) ——
  async createClaim(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });

      const bookingId = String(req.body?.bookingId || req.body?.booking_id || '').trim();
      const description = String(req.body?.description || '').trim();
      const amount = Number(req.body?.amount ?? 0);

      if (!bookingId) return res.status(400).json({ error: 'bookingId مطلوب' });
      if (!description) return res.status(400).json({ error: 'وصف المطالبة مطلوب' });
      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ error: 'المبلغ غير صالح' });
      }

      const bookingRes = await query(
        `
        SELECT b.id, b.customer_id, b.status, e.title AS equipment_title
        FROM bookings b
        JOIN equipment e ON e.id = b.equipment_id
        WHERE b.id = $1
        LIMIT 1
        `,
        [bookingId]
      );
      const booking = bookingRes.rows[0];
      if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });

      if (String(booking.customer_id) !== String(userId) && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'يمكن للمستأجر فقط فتح مطالبة' });
      }
      if (String(booking.status) !== 'completed' && req.user?.role !== 'admin') {
        return res.status(400).json({ error: 'المطالبات متاحة للحجوزات المكتملة فقط' });
      }

      const inserted = await query(
        `
        INSERT INTO insurance_claims (booking_id, customer_id, description, amount, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING *
        `,
        [bookingId, booking.customer_id, description, amount]
      );
      const claim = mapClaim(inserted.rows[0]);

      await notifications.notifyAdmins({
        type: 'system',
        title: 'مطالبة تأمين جديدة',
        message: `مطالبة على حجز «${booking.equipment_title}»: ${description.slice(0, 80)}`,
        related_id: bookingId,
      });

      return res.status(201).json(claim);
    } catch (error) {
      console.error('createClaim', error);
      return res.status(500).json({ error: 'فشل إنشاء المطالبة' });
    }
  },

  /** Customer: mine. Admin: all (optional ?status=) */
  async getClaims(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });

      const status = String(req.query.status || '').trim();
      const isAdmin = req.user?.role === 'admin';

      let sql: string;
      const params: unknown[] = [];

      if (isAdmin) {
        sql = `
          SELECT c.*, e.title AS equipment_title, u.name AS customer_name
          FROM insurance_claims c
          JOIN bookings b ON b.id = c.booking_id
          JOIN equipment e ON e.id = b.equipment_id
          JOIN users u ON u.id = c.customer_id
        `;
        if (status) {
          params.push(status);
          sql += ` WHERE c.status = $${params.length}`;
        }
        sql += ` ORDER BY c.created_at DESC LIMIT 200`;
      } else {
        params.push(userId);
        sql = `
          SELECT c.*, e.title AS equipment_title
          FROM insurance_claims c
          JOIN bookings b ON b.id = c.booking_id
          JOIN equipment e ON e.id = b.equipment_id
          WHERE c.customer_id = $1
        `;
        if (status) {
          params.push(status);
          sql += ` AND c.status = $${params.length}`;
        }
        sql += ` ORDER BY c.created_at DESC LIMIT 100`;
      }

      const result = await query(sql, params);
      return res.json(result.rows.map((r) => mapClaim(r)));
    } catch (error) {
      console.error('getClaims', error);
      return res.status(500).json({ error: 'فشل جلب المطالبات' });
    }
  },

  async getClaim(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });

      const result = await query(
        `
        SELECT c.*, e.title AS equipment_title, u.name AS customer_name
        FROM insurance_claims c
        JOIN bookings b ON b.id = c.booking_id
        JOIN equipment e ON e.id = b.equipment_id
        JOIN users u ON u.id = c.customer_id
        WHERE c.id = $1
        LIMIT 1
        `,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'المطالبة غير موجودة' });
      }
      const row = result.rows[0];
      if (String(row.customer_id) !== String(userId) && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
      }
      return res.json(mapClaim(row));
    } catch (error) {
      return res.status(500).json({ error: 'فشل جلب المطالبة' });
    }
  },

  async updateClaim(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'مراجعة المطالبات للإدارة فقط' });
      }
      const status = String(req.body?.status || '').trim();
      if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'حالة غير صالحة' });
      }
      return insuranceController.reviewClaim(req, res, status as 'approved' | 'rejected' | 'pending');
    } catch (error) {
      return res.status(500).json({ error: 'فشل تحديث المطالبة' });
    }
  },

  async approveClaim(req: AuthenticatedRequest, res: Response) {
    return insuranceController.reviewClaim(req, res, 'approved');
  },

  async rejectClaim(req: AuthenticatedRequest, res: Response) {
    return insuranceController.reviewClaim(req, res, 'rejected');
  },

  async reviewClaim(
    req: AuthenticatedRequest,
    res: Response,
    status: 'approved' | 'rejected' | 'pending'
  ) {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'مراجعة المطالبات للإدارة فقط' });
      }

      const updated = await query(
        `
        UPDATE insurance_claims SET status = $1 WHERE id = $2
        RETURNING *
        `,
        [status, req.params.id]
      );
      if (updated.rows.length === 0) {
        return res.status(404).json({ error: 'المطالبة غير موجودة' });
      }
      const claim = mapClaim(updated.rows[0]);

      const label =
        status === 'approved' ? 'مقبولة' : status === 'rejected' ? 'مرفوضة' : 'قيد المراجعة';
      await notifications.sendNotification({
        userId: claim.customer_id,
        type: 'system',
        title: `مطالبة التأمين ${label}`,
        message: `تم تحديث حالة مطالبة التأمين إلى: ${label}`,
        data: { related_id: claim.booking_id, claimId: claim.id },
      });

      return res.json(claim);
    } catch (error) {
      console.error('reviewClaim', error);
      return res.status(500).json({ error: 'فشل مراجعة المطالبة' });
    }
  },

  async getInsuranceAnalytics(_req: AuthenticatedRequest, res: Response) {
    try {
      const result = await query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
          COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0)::float AS total_payouts
        FROM insurance_claims
      `);
      const r = result.rows[0] || {};
      return res.json({
        totalClaims: Number(r.total || 0),
        pendingClaims: Number(r.pending || 0),
        approvedClaims: Number(r.approved || 0),
        rejectedClaims: Number(r.rejected || 0),
        totalPayouts: Number(r.total_payouts || 0),
      });
    } catch (error) {
      return res.status(500).json({ error: 'فشل إحصائيات التأمين' });
    }
  },
};
