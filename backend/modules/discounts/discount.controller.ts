import { Request, Response } from 'express';
import { query } from '../../database/connection';
import { AuthenticatedRequest } from '../auth/auth.middleware';

function normalizeCode(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toUpperCase();
}

function calcDiscount(
  amount: number,
  discountType: string,
  discountValue: number
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  let discount = 0;
  if (discountType === 'percentage') {
    discount = amount * (Number(discountValue) / 100);
  } else {
    discount = Number(discountValue);
  }
  if (!Number.isFinite(discount) || discount < 0) return 0;
  return Math.min(discount, amount);
}

/** Shared server-side validation used by API and bookings. */
export async function validateDiscountAgainstAmount(
  codeRaw: string,
  amountRaw: number
): Promise<{
  valid: boolean;
  message?: string;
  code?: string;
  discount_amount?: number;
  final_amount?: number;
  row?: Record<string, unknown>;
}> {
  const code = normalizeCode(codeRaw);
  const amount = Number(amountRaw);
  if (!code) {
    return { valid: false, message: 'يرجى إدخال كود الخصم' };
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return { valid: false, message: 'مبلغ الطلب غير صالح' };
  }

  const result = await query(
    `SELECT * FROM discount_codes WHERE UPPER(code) = $1 LIMIT 1`,
    [code]
  );
  if (result.rows.length === 0) {
    return { valid: false, message: 'كود الخصم غير موجود' };
  }

  const row = result.rows[0] as Record<string, unknown>;
  if (!row.is_active) {
    return { valid: false, message: 'كود الخصم غير نشط' };
  }

  const now = new Date();
  if (row.starts_at && new Date(String(row.starts_at)) > now) {
    return { valid: false, message: 'كود الخصم لم يبدأ بعد' };
  }
  if (row.ends_at && new Date(String(row.ends_at)) < now) {
    return { valid: false, message: 'انتهت صلاحية كود الخصم' };
  }

  const maxUses = row.max_uses != null ? Number(row.max_uses) : null;
  const usedCount = Number(row.used_count || 0);
  if (maxUses != null && Number.isFinite(maxUses) && usedCount >= maxUses) {
    return { valid: false, message: 'تم استنفاد عدد استخدامات كود الخصم' };
  }

  const minOrder = Number(row.min_order || 0);
  if (Number.isFinite(minOrder) && minOrder > 0 && amount < minOrder) {
    return {
      valid: false,
      message: `الحد الأدنى للطلب لاستخدام هذا الكود هو ${minOrder.toLocaleString()} د.ع`,
    };
  }

  const discountAmount = calcDiscount(
    amount,
    String(row.discount_type),
    Number(row.discount_value)
  );
  const finalAmount = Math.max(0, amount - discountAmount);

  return {
    valid: true,
    code: String(row.code),
    discount_amount: Math.round(discountAmount * 100) / 100,
    final_amount: Math.round(finalAmount * 100) / 100,
    row,
  };
}

export async function consumeDiscountCode(codeId: string): Promise<void> {
  await query(
    `UPDATE discount_codes SET used_count = COALESCE(used_count, 0) + 1 WHERE id = $1`,
    [codeId]
  );
}

const DEFAULT_POINTS_PER_1000 = 1;
const DEFAULT_REDEEM_IQD_PER_POINT = 1000;
const DEFAULT_MIN_REDEEM = 10;

async function ensureDefaultLoyaltyProgram(): Promise<{
  id: string;
  points_per_1000_iqd: number;
  redeem_iqd_per_point: number;
  min_redeem_points: number;
}> {
  const existing = await query(
    `SELECT * FROM loyalty_programs WHERE is_active = true ORDER BY created_at ASC LIMIT 1`
  );
  if (existing.rows[0]) {
    const r = existing.rows[0];
    return {
      id: String(r.id),
      points_per_1000_iqd: Number(r.points_per_1000_iqd) || DEFAULT_POINTS_PER_1000,
      redeem_iqd_per_point: Number(r.redeem_iqd_per_point) || DEFAULT_REDEEM_IQD_PER_POINT,
      min_redeem_points: Number(r.min_redeem_points) || DEFAULT_MIN_REDEEM,
    };
  }
  const inserted = await query(
    `
    INSERT INTO loyalty_programs (
      name, description, points_per_1000_iqd, redeem_iqd_per_point, min_redeem_points, is_active
    ) VALUES (
      'برنامج الولاء الافتراضي',
      'نقطة واحدة لكل 1000 د.ع عند اكتمال الحجز. استبدال النقاط بكود خصم.',
      $1, $2, $3, true
    )
    RETURNING *
    `,
    [DEFAULT_POINTS_PER_1000, DEFAULT_REDEEM_IQD_PER_POINT, DEFAULT_MIN_REDEEM]
  );
  const r = inserted.rows[0];
  return {
    id: String(r.id),
    points_per_1000_iqd: Number(r.points_per_1000_iqd) || DEFAULT_POINTS_PER_1000,
    redeem_iqd_per_point: Number(r.redeem_iqd_per_point) || DEFAULT_REDEEM_IQD_PER_POINT,
    min_redeem_points: Number(r.min_redeem_points) || DEFAULT_MIN_REDEEM,
  };
}

function tierFromPoints(total: number): string {
  if (total >= 500) return 'gold';
  if (total >= 100) return 'silver';
  return 'bronze';
}

/** Award loyalty points when a booking completes (1 pt / 1000 IQD). Idempotent per booking. */
export async function awardLoyaltyForCompletedBooking(
  customerId: string,
  bookingId: string,
  totalAmountIqd: number
): Promise<{ points: number } | null> {
  const amount = Number(totalAmountIqd) || 0;
  if (!customerId || !bookingId || amount <= 0) return null;

  const program = await ensureDefaultLoyaltyProgram();
  const points = Math.floor(
    (amount / 1000) * (Number(program.points_per_1000_iqd) || DEFAULT_POINTS_PER_1000)
  );
  if (points <= 0) return null;

  try {
    await query(
      `
      INSERT INTO loyalty_ledger (user_id, booking_id, points, reason)
      VALUES ($1, $2, $3, $4)
      `,
      [customerId, bookingId, points, `اكتساب من حجز مكتمل (${Math.round(amount)} د.ع)`]
    );
  } catch (e: any) {
    // unique index on earn-per-booking → already awarded
    if (e?.code === '23505') return null;
    throw e;
  }

  await query(
    `
    INSERT INTO loyalty_balances (user_id, total_points, available_points, updated_at)
    VALUES ($1, $2, $2, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      total_points = loyalty_balances.total_points + EXCLUDED.total_points,
      available_points = loyalty_balances.available_points + EXCLUDED.available_points,
      updated_at = NOW()
    `,
    [customerId, points]
  );

  return { points };
}

export const discountController = {
  async getDiscountCodes(req: Request, res: Response) {
    try {
      const result = await query(
        `SELECT * FROM discount_codes ORDER BY created_at DESC`
      );
      res.json(result.rows);
    } catch (error) {
      console.error('getDiscountCodes', error);
      res.status(500).json({ error: 'فشل جلب أكواد الخصم' });
    }
  },

  async createDiscountCode(req: AuthenticatedRequest, res: Response) {
    try {
      const body = req.body || {};
      const code = normalizeCode(body.code);
      const discountType = String(body.discount_type || body.discountType || '')
        .trim()
        .toLowerCase();
      const discountValue = Number(body.discount_value ?? body.discountValue);
      const maxUses =
        body.max_uses != null || body.usageLimit != null
          ? Number(body.max_uses ?? body.usageLimit)
          : null;
      const minOrder = Number(body.min_order ?? body.minOrder ?? 0) || 0;
      const startsAt = body.starts_at || body.startDate || null;
      const endsAt = body.ends_at || body.expiryDate || body.endDate || null;
      const createdBy = req.user?.userId || req.user?.id || null;

      if (!code) {
        return res.status(400).json({ error: 'كود الخصم مطلوب' });
      }
      if (discountType !== 'percentage' && discountType !== 'fixed') {
        return res
          .status(400)
          .json({ error: 'نوع الخصم يجب أن يكون percentage أو fixed' });
      }
      if (!Number.isFinite(discountValue) || discountValue <= 0) {
        return res.status(400).json({ error: 'قيمة الخصم غير صالحة' });
      }
      if (discountType === 'percentage' && discountValue > 100) {
        return res.status(400).json({ error: 'نسبة الخصم لا يمكن أن تتجاوز 100%' });
      }

      const result = await query(
        `
        INSERT INTO discount_codes (
          code, discount_type, discount_value, max_uses, min_order,
          starts_at, ends_at, is_active, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
        RETURNING *
        `,
        [
          code,
          discountType,
          discountValue,
          maxUses != null && Number.isFinite(maxUses) ? maxUses : null,
          minOrder,
          startsAt,
          endsAt,
          createdBy,
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'كود الخصم موجود مسبقاً' });
      }
      console.error('createDiscountCode', error);
      res.status(500).json({ error: 'فشل إنشاء كود الخصم' });
    }
  },

  async validateDiscountCode(req: Request, res: Response) {
    try {
      const { code, amount } = req.body || {};
      const result = await validateDiscountAgainstAmount(code, Number(amount ?? 0));
      if (!result.valid) {
        return res.status(200).json({
          valid: false,
          discount_amount: 0,
          final_amount: Number(amount ?? 0) || 0,
          code: normalizeCode(code) || null,
          message: result.message || 'كود الخصم غير صالح',
        });
      }
      res.json({
        valid: true,
        discount_amount: result.discount_amount,
        final_amount: result.final_amount,
        code: result.code,
      });
    } catch (error) {
      console.error('validateDiscountCode', error);
      res.status(500).json({ error: 'فشل التحقق من كود الخصم' });
    }
  },

  async deactivateDiscountCode(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const isActive =
        req.body?.is_active != null ? Boolean(req.body.is_active) : false;

      const result = await query(
        `
        UPDATE discount_codes
        SET is_active = $2
        WHERE id = $1
        RETURNING *
        `,
        [id, isActive]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'كود الخصم غير موجود' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('deactivateDiscountCode', error);
      res.status(500).json({ error: 'فشل تحديث كود الخصم' });
    }
  },

  async createDiscountCampaign(req: AuthenticatedRequest, res: Response) {
    try {
      const body = req.body || {};
      const name = String(body.name || '').trim();
      const description = String(body.description || '').trim();
      const discountType = String(body.discount_type || body.discountType || '')
        .trim()
        .toLowerCase();
      const discountValue = Number(body.discount_value ?? body.discountValue);
      const startsAt = body.starts_at || body.startDate || null;
      const endsAt = body.ends_at || body.endDate || null;
      const autoCode =
        body.auto_code != null
          ? Boolean(body.auto_code)
          : body.create_code !== false;

      if (!name) {
        return res.status(400).json({ error: 'اسم الحملة مطلوب' });
      }
      if (discountType !== 'percentage' && discountType !== 'fixed') {
        return res
          .status(400)
          .json({ error: 'نوع الخصم يجب أن يكون percentage أو fixed' });
      }
      if (!Number.isFinite(discountValue) || discountValue <= 0) {
        return res.status(400).json({ error: 'قيمة الخصم غير صالحة' });
      }
      if (discountType === 'percentage' && discountValue > 100) {
        return res.status(400).json({ error: 'نسبة الخصم لا يمكن أن تتجاوز 100%' });
      }

      let discountCodeId: string | null = null;
      let createdCode: Record<string, unknown> | null = null;

      if (autoCode) {
        const codeRaw = normalizeCode(
          body.code || `CAMP-${name.replace(/\s+/g, '').slice(0, 8)}${Date.now().toString(36).slice(-4)}`
        );
        const codeResult = await query(
          `
          INSERT INTO discount_codes (
            code, discount_type, discount_value, max_uses, min_order,
            starts_at, ends_at, is_active, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
          RETURNING *
          `,
          [
            codeRaw.slice(0, 24),
            discountType,
            discountValue,
            body.max_uses != null ? Number(body.max_uses) : null,
            Number(body.min_order ?? 0) || 0,
            startsAt,
            endsAt,
            req.user?.userId || req.user?.id || null,
          ]
        );
        createdCode = codeResult.rows[0];
        discountCodeId = String(createdCode.id);
      }

      const result = await query(
        `
        INSERT INTO discount_campaigns (
          name, description, discount_type, discount_value,
          starts_at, ends_at, is_active, discount_code_id
        ) VALUES ($1, $2, $3, $4, $5, $6, true, $7)
        RETURNING *
        `,
        [name, description || null, discountType, discountValue, startsAt, endsAt, discountCodeId]
      );

      res.status(201).json({
        ...result.rows[0],
        discount_code: createdCode,
      });
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'كود الخصم المرتبط بالحملة موجود مسبقاً' });
      }
      console.error('createDiscountCampaign', error);
      res.status(500).json({ error: 'فشل إنشاء حملة الخصم' });
    }
  },

  async getDiscountCampaigns(req: Request, res: Response) {
    try {
      const authReq = req as AuthenticatedRequest;
      const isAdmin = authReq.user?.role === 'admin';
      const nowFilter = !isAdmin || String(req.query.active) === '1';

      let sql = `SELECT c.*, dc.code AS promo_code
        FROM discount_campaigns c
        LEFT JOIN discount_codes dc ON dc.id = c.discount_code_id
        WHERE 1=1`;
      if (nowFilter) {
        sql += ` AND c.is_active = true
          AND (c.starts_at IS NULL OR c.starts_at <= NOW())
          AND (c.ends_at IS NULL OR c.ends_at >= NOW())`;
      }
      sql += ` ORDER BY c.created_at DESC LIMIT 100`;

      const result = await query(sql);
      res.json(result.rows);
    } catch (error) {
      console.error('getDiscountCampaigns', error);
      res.status(500).json({ error: 'فشل جلب الحملات' });
    }
  },

  async getDiscountCampaign(req: Request, res: Response) {
    try {
      const result = await query(
        `
        SELECT c.*, dc.code AS promo_code
        FROM discount_campaigns c
        LEFT JOIN discount_codes dc ON dc.id = c.discount_code_id
        WHERE c.id = $1
        LIMIT 1
        `,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'الحملة غير موجودة' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('getDiscountCampaign', error);
      res.status(500).json({ error: 'فشل جلب الحملة' });
    }
  },

  async updateDiscountCampaign(req: AuthenticatedRequest, res: Response) {
    try {
      const body = req.body || {};
      const name = body.name != null ? String(body.name).trim() : null;
      const description =
        body.description != null ? String(body.description).trim() : null;
      const discountType =
        body.discount_type != null || body.discountType != null
          ? String(body.discount_type || body.discountType)
              .trim()
              .toLowerCase()
          : null;
      const discountValue =
        body.discount_value != null || body.discountValue != null
          ? Number(body.discount_value ?? body.discountValue)
          : null;
      const startsAt =
        body.starts_at !== undefined || body.startDate !== undefined
          ? body.starts_at ?? body.startDate
          : undefined;
      const endsAt =
        body.ends_at !== undefined || body.endDate !== undefined
          ? body.ends_at ?? body.endDate
          : undefined;
      const isActive = body.is_active != null ? Boolean(body.is_active) : null;

      if (discountType && discountType !== 'percentage' && discountType !== 'fixed') {
        return res.status(400).json({ error: 'نوع الخصم غير صالح' });
      }

      const result = await query(
        `
        UPDATE discount_campaigns SET
          name = COALESCE($2, name),
          description = COALESCE($3, description),
          discount_type = COALESCE($4, discount_type),
          discount_value = COALESCE($5, discount_value),
          starts_at = CASE WHEN $6::boolean THEN $7::timestamptz ELSE starts_at END,
          ends_at = CASE WHEN $8::boolean THEN $9::timestamptz ELSE ends_at END,
          is_active = COALESCE($10, is_active)
        WHERE id = $1
        RETURNING *
        `,
        [
          req.params.id,
          name,
          description,
          discountType,
          discountValue,
          startsAt !== undefined,
          startsAt ?? null,
          endsAt !== undefined,
          endsAt ?? null,
          isActive,
        ]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'الحملة غير موجودة' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('updateDiscountCampaign', error);
      res.status(500).json({ error: 'فشل تحديث الحملة' });
    }
  },

  async deleteDiscountCampaign(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await query(
        `UPDATE discount_campaigns SET is_active = false WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'الحملة غير موجودة' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('deleteDiscountCampaign', error);
      res.status(500).json({ error: 'فشل حذف الحملة' });
    }
  },
  async useDiscountCode(_req: Request, res: Response) {
    // Discount codes are consumed during booking creation — keep explicit 400 (not 501 stub).
    res.status(400).json({
      error: 'يُطبَّق الخصم تلقائياً عند إنشاء الحجز عبر حقل discount_code',
    });
  },

  async createLoyaltyProgram(req: AuthenticatedRequest, res: Response) {
    try {
      const body = req.body || {};
      const name = String(body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'اسم البرنامج مطلوب' });
      const result = await query(
        `
        INSERT INTO loyalty_programs (
          name, description, points_per_1000_iqd, redeem_iqd_per_point, min_redeem_points, is_active
        ) VALUES ($1, $2, $3, $4, $5, true)
        RETURNING *
        `,
        [
          name,
          body.description != null ? String(body.description).trim() : null,
          Number(body.points_per_1000_iqd ?? body.pointsPer1000Iqd ?? DEFAULT_POINTS_PER_1000) ||
            DEFAULT_POINTS_PER_1000,
          Number(body.redeem_iqd_per_point ?? body.redeemIqdPerPoint ?? DEFAULT_REDEEM_IQD_PER_POINT) ||
            DEFAULT_REDEEM_IQD_PER_POINT,
          Number(body.min_redeem_points ?? body.minRedeemPoints ?? DEFAULT_MIN_REDEEM) ||
            DEFAULT_MIN_REDEEM,
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('createLoyaltyProgram', error);
      res.status(500).json({ error: 'فشل إنشاء برنامج الولاء' });
    }
  },

  async getLoyaltyPrograms(_req: Request, res: Response) {
    try {
      await ensureDefaultLoyaltyProgram();
      const result = await query(
        `SELECT * FROM loyalty_programs WHERE is_active = true ORDER BY created_at DESC`
      );
      res.json(result.rows);
    } catch (error) {
      console.error('getLoyaltyPrograms', error);
      res.status(500).json({ error: 'فشل جلب برامج الولاء' });
    }
  },

  async getLoyaltyProgram(req: Request, res: Response) {
    try {
      const result = await query(`SELECT * FROM loyalty_programs WHERE id = $1 LIMIT 1`, [
        req.params.id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'البرنامج غير موجود' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('getLoyaltyProgram', error);
      res.status(500).json({ error: 'فشل جلب البرنامج' });
    }
  },

  async updateLoyaltyProgram(req: AuthenticatedRequest, res: Response) {
    try {
      const body = req.body || {};
      const result = await query(
        `
        UPDATE loyalty_programs SET
          name = COALESCE($2, name),
          description = COALESCE($3, description),
          points_per_1000_iqd = COALESCE($4, points_per_1000_iqd),
          redeem_iqd_per_point = COALESCE($5, redeem_iqd_per_point),
          min_redeem_points = COALESCE($6, min_redeem_points),
          is_active = COALESCE($7, is_active)
        WHERE id = $1
        RETURNING *
        `,
        [
          req.params.id,
          body.name != null ? String(body.name).trim() : null,
          body.description != null ? String(body.description).trim() : null,
          body.points_per_1000_iqd != null || body.pointsPer1000Iqd != null
            ? Number(body.points_per_1000_iqd ?? body.pointsPer1000Iqd)
            : null,
          body.redeem_iqd_per_point != null || body.redeemIqdPerPoint != null
            ? Number(body.redeem_iqd_per_point ?? body.redeemIqdPerPoint)
            : null,
          body.min_redeem_points != null || body.minRedeemPoints != null
            ? Number(body.min_redeem_points ?? body.minRedeemPoints)
            : null,
          body.is_active != null ? Boolean(body.is_active) : null,
        ]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'البرنامج غير موجود' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('updateLoyaltyProgram', error);
      res.status(500).json({ error: 'فشل تحديث البرنامج' });
    }
  },

  async getUserLoyaltyPoints(req: AuthenticatedRequest, res: Response) {
    try {
      const authId = req.user?.userId || req.user?.id;
      const targetId = String(req.params.userId || '');
      if (!authId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });
      if (
        targetId !== String(authId) &&
        req.user?.role !== 'admin' &&
        targetId !== 'me'
      ) {
        return res.status(403).json({ error: 'غير مصرح بعرض نقاط مستخدم آخر' });
      }
      const userId = targetId === 'me' ? String(authId) : targetId;

      const bal = await query(`SELECT * FROM loyalty_balances WHERE user_id = $1 LIMIT 1`, [
        userId,
      ]);
      const totalPoints = Number(bal.rows[0]?.total_points || 0);
      const availablePoints = Number(bal.rows[0]?.available_points || 0);
      const history = await query(
        `
        SELECT id, booking_id, points, reason, discount_code, created_at
        FROM loyalty_ledger
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
        `,
        [userId]
      );
      const program = await ensureDefaultLoyaltyProgram();
      res.json({
        userId,
        totalPoints,
        availablePoints,
        tier: tierFromPoints(totalPoints),
        pointsHistory: history.rows,
        program: {
          pointsPer1000Iqd: program.points_per_1000_iqd,
          redeemIqdPerPoint: program.redeem_iqd_per_point,
          minRedeemPoints: program.min_redeem_points,
        },
      });
    } catch (error) {
      console.error('getUserLoyaltyPoints', error);
      res.status(500).json({ error: 'فشل جلب نقاط الولاء' });
    }
  },

  async addLoyaltyPoints(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'إضافة النقاط يدوياً للإدارة فقط' });
      }
      const userId = String(req.params.userId || '');
      const points = Math.floor(Number(req.body?.points));
      const reason = String(req.body?.reason || 'تعديل إداري').slice(0, 200);
      if (!userId || !Number.isFinite(points) || points === 0) {
        return res.status(400).json({ error: 'userId ونقاط غير صفرية مطلوبة' });
      }

      await query(
        `INSERT INTO loyalty_ledger (user_id, points, reason) VALUES ($1, $2, $3)`,
        [userId, points, reason]
      );
      await query(
        `
        INSERT INTO loyalty_balances (user_id, total_points, available_points, updated_at)
        VALUES ($1, GREATEST($2, 0), $2, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          total_points = GREATEST(loyalty_balances.total_points + EXCLUDED.available_points, 0),
          available_points = loyalty_balances.available_points + EXCLUDED.available_points,
          updated_at = NOW()
        `,
        [userId, points]
      );
      // Clamp available if negative adjustment went below zero
      await query(
        `UPDATE loyalty_balances SET available_points = GREATEST(available_points, 0) WHERE user_id = $1`,
        [userId]
      );

      const bal = await query(`SELECT * FROM loyalty_balances WHERE user_id = $1`, [userId]);
      res.json({
        userId,
        totalPoints: Number(bal.rows[0]?.total_points || 0),
        availablePoints: Number(bal.rows[0]?.available_points || 0),
      });
    } catch (error) {
      console.error('addLoyaltyPoints', error);
      res.status(500).json({ error: 'فشل إضافة نقاط الولاء' });
    }
  },

  /** Redeem available points → single-use fixed discount_code */
  async redeemLoyaltyPoints(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId || req.user?.id;
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });

      const program = await ensureDefaultLoyaltyProgram();
      const points = Math.floor(Number(req.body?.points));
      if (!Number.isFinite(points) || points < program.min_redeem_points) {
        return res.status(400).json({
          error: `الحد الأدنى للاستبدال ${program.min_redeem_points} نقطة`,
        });
      }

      const bal = await query(
        `SELECT available_points FROM loyalty_balances WHERE user_id = $1`,
        [userId]
      );
      const available = Number(bal.rows[0]?.available_points || 0);
      if (available < points) {
        return res.status(400).json({ error: 'رصيد النقاط غير كافٍ' });
      }

      const discountValue = points * program.redeem_iqd_per_point;
      const code = `LOY-${String(userId).replace(/-/g, '').slice(0, 6)}${Date.now().toString(36).slice(-5)}`
        .toUpperCase()
        .slice(0, 20);

      const deducted = await query(
        `
        UPDATE loyalty_balances SET
          available_points = available_points - $2,
          updated_at = NOW()
        WHERE user_id = $1 AND available_points >= $2
        RETURNING available_points
        `,
        [userId, points]
      );
      if (deducted.rows.length === 0) {
        return res.status(400).json({ error: 'رصيد النقاط غير كافٍ' });
      }

      const codeResult = await query(
        `
        INSERT INTO discount_codes (
          code, discount_type, discount_value, max_uses, min_order,
          starts_at, ends_at, is_active, created_by
        ) VALUES ($1, 'fixed', $2, 1, 0, NOW(), NOW() + INTERVAL '90 days', true, $3)
        RETURNING *
        `,
        [code, discountValue, userId]
      );

      await query(
        `
        INSERT INTO loyalty_ledger (user_id, points, reason, discount_code)
        VALUES ($1, $2, $3, $4)
        `,
        [userId, -points, `استبدال نقاط بكود خصم ${discountValue} د.ع`, code]
      );

      res.status(201).json({
        pointsRedeemed: points,
        discountValue,
        discount_code: codeResult.rows[0],
        code,
      });
    } catch (error) {
      console.error('redeemLoyaltyPoints', error);
      res.status(500).json({ error: 'فشل استبدال نقاط الولاء' });
    }
  },
  async getDiscountAnalytics(_req: Request, res: Response) {
    try {
      const result = await query(`
        SELECT
          COUNT(*)::int AS total_codes,
          COUNT(*) FILTER (WHERE is_active)::int AS active_codes,
          COALESCE(SUM(used_count), 0)::int AS total_redemption
        FROM discount_codes
      `);
      const row = result.rows[0] || {};
      res.json({
        totalCodes: row.total_codes || 0,
        activeCodes: row.active_codes || 0,
        totalRedemption: row.total_redemption || 0,
      });
    } catch (error) {
      console.error('getDiscountAnalytics', error);
      res.status(500).json({ error: 'فشل جلب إحصائيات الخصم' });
    }
  },
};
