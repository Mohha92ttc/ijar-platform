import { Request, Response } from 'express';
import { query } from '../../database/connection';
import { AuthenticatedRequest } from '../auth/auth.middleware';

function normalizeCode(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toUpperCase();
}

function generateReferralCode(userId: string): string {
  const suffix = userId.replace(/-/g, '').slice(0, 6).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `REF${suffix}${rand}`.slice(0, 16);
}

/**
 * Apply referral on register (optional).
 * Call from auth.register when body.referral_code is present —
 * wiring may live in auth.service separately; this helper is the DB apply path.
 */
export async function applyReferralOnRegister(
  referralCodeRaw: string,
  newUserId: string
): Promise<{ ok: boolean; message?: string }> {
  const code = normalizeCode(referralCodeRaw);
  if (!code) return { ok: false, message: 'كود الإحالة فارغ' };

  const result = await query(
    `SELECT * FROM referral_codes WHERE UPPER(code) = $1 AND is_active = true LIMIT 1`,
    [code]
  );
  if (result.rows.length === 0) {
    return { ok: false, message: 'كود الإحالة غير صالح' };
  }
  const row = result.rows[0] as { id: string; user_id: string };
  if (String(row.user_id) === String(newUserId)) {
    return { ok: false, message: 'لا يمكن استخدام كود الإحالة الخاص بك' };
  }

  await query(
    `UPDATE referral_codes SET uses_count = COALESCE(uses_count, 0) + 1 WHERE id = $1`,
    [row.id]
  );
  return { ok: true };
}

export const referralController = {
  /** Get or create the authenticated user's referral code */
  async getReferralCodes(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'يلزم تسجيل الدخول' });
      }

      let result = await query(
        `SELECT * FROM referral_codes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (result.rows.length === 0) {
        const code = generateReferralCode(userId);
        result = await query(
          `
          INSERT INTO referral_codes (user_id, code, uses_count, reward_amount, is_active)
          VALUES ($1, $2, 0, 0, true)
          RETURNING *
          `,
          [userId, code]
        );
      }

      res.json(result.rows);
    } catch (error) {
      console.error('getReferralCodes', error);
      res.status(500).json({ error: 'فشل جلب كود الإحالة' });
    }
  },

  async createReferralCode(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'يلزم تسجيل الدخول' });
      }

      const existing = await query(
        `SELECT * FROM referral_codes WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      if (existing.rows.length > 0) {
        return res.status(200).json(existing.rows[0]);
      }

      const custom = normalizeCode(req.body?.code);
      const code = custom || generateReferralCode(userId);
      const rewardAmount = Number(req.body?.reward_amount ?? 0) || 0;

      const result = await query(
        `
        INSERT INTO referral_codes (user_id, code, uses_count, reward_amount, is_active)
        VALUES ($1, $2, 0, $3, true)
        RETURNING *
        `,
        [userId, code, rewardAmount]
      );
      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'كود الإحالة موجود مسبقاً' });
      }
      console.error('createReferralCode', error);
      res.status(500).json({ error: 'فشل إنشاء كود الإحالة' });
    }
  },

  async validateReferralCode(req: Request, res: Response) {
    try {
      const code = normalizeCode(req.body?.code);
      if (!code) {
        return res.status(200).json({
          valid: false,
          isValid: false,
          message: 'يرجى إدخال كود الإحالة',
        });
      }

      const result = await query(
        `SELECT id, code, uses_count, reward_amount, is_active, user_id
         FROM referral_codes WHERE UPPER(code) = $1 LIMIT 1`,
        [code]
      );

      if (result.rows.length === 0 || !result.rows[0].is_active) {
        return res.status(200).json({
          valid: false,
          isValid: false,
          message: 'كود الإحالة غير صالح أو غير نشط',
        });
      }

      const row = result.rows[0];
      res.json({
        valid: true,
        isValid: true,
        code: row.code,
        reward_amount: Number(row.reward_amount || 0),
        uses_count: Number(row.uses_count || 0),
      });
    } catch (error) {
      console.error('validateReferralCode', error);
      res.status(500).json({ error: 'فشل التحقق من كود الإحالة' });
    }
  },

  async useReferralCode(req: AuthenticatedRequest, res: Response) {
    try {
      const code = normalizeCode(req.body?.code || req.params.code);
      const userId = req.user?.userId || req.user?.id || req.body?.userId;

      const result = await query(
        `SELECT * FROM referral_codes WHERE UPPER(code) = $1 AND is_active = true LIMIT 1`,
        [code]
      );
      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'كود الإحالة غير صالح' });
      }
      const row = result.rows[0];
      if (userId && String(row.user_id) === String(userId)) {
        return res.status(400).json({ error: 'لا يمكن استخدام كود الإحالة الخاص بك' });
      }

      await query(
        `UPDATE referral_codes SET uses_count = COALESCE(uses_count, 0) + 1 WHERE id = $1`,
        [row.id]
      );

      res.json({
        success: true,
        referralCode: row.code,
        reward_amount: Number(row.reward_amount || 0),
        userId: userId || null,
      });
    } catch (error) {
      console.error('useReferralCode', error);
      res.status(500).json({ error: 'فشل استخدام كود الإحالة' });
    }
  },

  // Program / analytics stubs for existing routes
  async createReferralProgram(_req: Request, res: Response) {
    res.status(501).json({ error: 'برامج الإحالة المتقدمة غير مفعّلة؛ استخدم أكواد الإحالة' });
  },
  async getReferralPrograms(_req: Request, res: Response) {
    res.json([]);
  },
  async getReferralProgram(_req: Request, res: Response) {
    res.status(404).json({ error: 'البرنامج غير موجود' });
  },
  async updateReferralProgram(_req: Request, res: Response) {
    res.status(501).json({ error: 'برامج الإحالة المتقدمة غير مفعّلة' });
  },
  async deleteReferralProgram(_req: Request, res: Response) {
    res.status(501).json({ error: 'برامج الإحالة المتقدمة غير مفعّلة' });
  },
  async getReferralTransactions(_req: Request, res: Response) {
    res.json([]);
  },
  async getUserReferralTransactions(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const result = await query(
        `SELECT * FROM referral_codes WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('getUserReferralTransactions', error);
      res.status(500).json({ error: 'فشل جلب بيانات الإحالة' });
    }
  },
  async getPersonalizedRecommendations(_req: Request, res: Response) {
    res.json({ referrals: [], userProfile: {} });
  },
};
