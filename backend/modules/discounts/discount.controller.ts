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
    res.status(501).json({ error: 'يُطبَّق الخصم تلقائياً عند إنشاء الحجز' });
  },
  async createLoyaltyProgram(_req: Request, res: Response) {
    res.status(501).json({ error: 'برنامج الولاء غير مفعّل حالياً' });
  },
  async getLoyaltyPrograms(_req: Request, res: Response) {
    res.json([]);
  },
  async getLoyaltyProgram(_req: Request, res: Response) {
    res.status(404).json({ error: 'البرنامج غير موجود' });
  },
  async updateLoyaltyProgram(_req: Request, res: Response) {
    res.status(501).json({ error: 'برنامج الولاء غير مفعّل حالياً' });
  },
  async getUserLoyaltyPoints(req: Request, res: Response) {
    res.json({
      userId: req.params.userId,
      totalPoints: 0,
      tier: 'bronze',
      pointsHistory: [],
    });
  },
  async addLoyaltyPoints(_req: Request, res: Response) {
    res.status(501).json({ error: 'برنامج الولاء غير مفعّل حالياً' });
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
