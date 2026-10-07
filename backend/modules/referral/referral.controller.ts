import { Request, Response } from 'express';
import { query } from '../../database/connection';
import { AuthenticatedRequest } from '../auth/auth.middleware';
import { NotificationService } from '../../services/notification.service';

const notifications = new NotificationService();

const DEFAULT_REFERRER_REWARD = 5000;
const DEFAULT_REFEREE_PERCENT = 5;

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

function defaultProgram() {
  return {
    id: 'default',
    name: 'برنامج الإحالة الافتراضي',
    description:
      'ادعُ صديقاً: يحصل على خصم ترحيبي 5%، وتحصل أنت على كود خصم بقيمة المكافأة عند تسجيله.',
    reward_amount: DEFAULT_REFERRER_REWARD,
    referee_percent: DEFAULT_REFEREE_PERCENT,
    is_active: true,
    status: 'active',
    type: 'customer',
  };
}

async function insertUniqueDiscountCode(params: {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses?: number;
}): Promise<string> {
  let code = params.code;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const result = await query(
        `
        INSERT INTO discount_codes (
          code, discount_type, discount_value, max_uses, min_order,
          starts_at, ends_at, is_active
        ) VALUES ($1, $2, $3, $4, 0, NOW(), NOW() + INTERVAL '90 days', true)
        RETURNING code
        `,
        [
          code,
          params.discountType,
          params.discountValue,
          params.maxUses != null ? params.maxUses : 1,
        ]
      );
      return String(result.rows[0].code);
    } catch (error: any) {
      if (error?.code === '23505') {
        code = `${params.code}${Math.random().toString(36).slice(2, 4).toUpperCase()}`.slice(
          0,
          24
        );
        continue;
      }
      throw error;
    }
  }
  throw new Error('تعذر إنشاء كود خصم فريد');
}

/**
 * Apply referral on register (optional).
 * Creates WELCOME discount for new user + fixed IQD discount for referrer; notifies both.
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
  const row = result.rows[0] as {
    id: string;
    user_id: string;
    code: string;
    reward_amount?: number | string;
  };
  if (String(row.user_id) === String(newUserId)) {
    return { ok: false, message: 'لا يمكن استخدام كود الإحالة الخاص بك' };
  }

  await query(
    `UPDATE referral_codes SET uses_count = COALESCE(uses_count, 0) + 1 WHERE id = $1`,
    [row.id]
  );

  try {
    await query(
      `
      INSERT INTO referral_uses (referral_code_id, referrer_id, referee_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (referee_id) DO NOTHING
      `,
      [row.id, row.user_id, newUserId]
    );
  } catch (e) {
    console.warn('referral_uses insert failed:', e instanceof Error ? e.message : e);
  }

  // Program defaults (optional row)
  let rewardAmount = Number(row.reward_amount) || 0;
  let refereePercent = DEFAULT_REFEREE_PERCENT;
  try {
    const prog = await query(
      `SELECT reward_amount, referee_percent FROM referral_programs WHERE is_active = true ORDER BY created_at DESC LIMIT 1`
    );
    if (prog.rows[0]) {
      if (!rewardAmount) rewardAmount = Number(prog.rows[0].reward_amount) || DEFAULT_REFERRER_REWARD;
      refereePercent = Number(prog.rows[0].referee_percent) || DEFAULT_REFEREE_PERCENT;
    }
  } catch {
    // table may be empty / missing on older DBs mid-migrate
  }
  if (!rewardAmount || !Number.isFinite(rewardAmount) || rewardAmount <= 0) {
    rewardAmount = DEFAULT_REFERRER_REWARD;
  }

  const welcomeBase = `WELCOME-${normalizeCode(row.code)}`.slice(0, 20);
  const referrerRewardCode = `REFREW-${String(row.user_id).replace(/-/g, '').slice(0, 6)}${Date.now().toString(36).slice(-4)}`
    .toUpperCase()
    .slice(0, 20);

  let welcomeCode = welcomeBase;
  let referrerCode = referrerRewardCode;

  try {
    welcomeCode = await insertUniqueDiscountCode({
      code: welcomeBase,
      discountType: 'percentage',
      discountValue: refereePercent,
      maxUses: 1,
    });
  } catch (e) {
    console.warn('referral welcome code failed:', e instanceof Error ? e.message : e);
  }

  try {
    referrerCode = await insertUniqueDiscountCode({
      code: referrerRewardCode,
      discountType: 'fixed',
      discountValue: rewardAmount,
      maxUses: 1,
    });
  } catch (e) {
    console.warn('referral referrer code failed:', e instanceof Error ? e.message : e);
  }

  try {
    await notifications.sendNotification({
      userId: newUserId,
      type: 'system',
      title: 'مرحباً بك — خصم ترحيبي',
      message: `شكراً لانضمامك عبر إحالة! كودك: ${welcomeCode} (${refereePercent}% لمرة واحدة)`,
      data: { related_id: row.id },
    });
  } catch (e) {
    console.warn('referral notify new user:', e instanceof Error ? e.message : e);
  }

  try {
    await notifications.sendNotification({
      userId: String(row.user_id),
      type: 'system',
      title: 'مكافأة إحالة',
      message: `انضم مستخدم بكودك! كود مكافأتك: ${referrerCode} (${Number(rewardAmount).toLocaleString()} د.ع لمرة واحدة)`,
      data: { related_id: row.id },
    });
  } catch (e) {
    console.warn('referral notify referrer:', e instanceof Error ? e.message : e);
  }

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
          VALUES ($1, $2, 0, $3, true)
          RETURNING *
          `,
          [userId, code, DEFAULT_REFERRER_REWARD]
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
      const rewardAmount =
        Number(req.body?.reward_amount ?? DEFAULT_REFERRER_REWARD) || DEFAULT_REFERRER_REWARD;

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

      if (userId) {
        const applied = await applyReferralOnRegister(code, String(userId));
        if (!applied.ok) {
          return res.status(400).json({ error: applied.message || 'فشل تطبيق الإحالة' });
        }
        return res.json({
          success: true,
          referralCode: row.code,
          reward_amount: Number(row.reward_amount || DEFAULT_REFERRER_REWARD),
          userId,
        });
      }

      await query(
        `UPDATE referral_codes SET uses_count = COALESCE(uses_count, 0) + 1 WHERE id = $1`,
        [row.id]
      );

      if (userId) {
        try {
          await query(
            `
            INSERT INTO referral_uses (referral_code_id, referrer_id, referee_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (referee_id) DO NOTHING
            `,
            [row.id, row.user_id, userId]
          );
        } catch (e) {
          console.warn('referral_uses insert failed:', e instanceof Error ? e.message : e);
        }
      }

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

  async createReferralProgram(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'للإدارة فقط' });
      }
      const name = String(req.body?.name || 'برنامج إحالة').trim();
      const description = String(req.body?.description || '').trim();
      const rewardAmount =
        Number(req.body?.reward_amount ?? DEFAULT_REFERRER_REWARD) || DEFAULT_REFERRER_REWARD;
      const refereePercent =
        Number(req.body?.referee_percent ?? DEFAULT_REFEREE_PERCENT) || DEFAULT_REFEREE_PERCENT;

      const result = await query(
        `
        INSERT INTO referral_programs (name, description, reward_amount, referee_percent, is_active)
        VALUES ($1, $2, $3, $4, true)
        RETURNING *
        `,
        [name, description, rewardAmount, refereePercent]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('createReferralProgram', error);
      res.status(500).json({ error: 'فشل إنشاء برنامج الإحالة' });
    }
  },

  async getReferralPrograms(_req: Request, res: Response) {
    try {
      const result = await query(
        `SELECT * FROM referral_programs WHERE is_active = true ORDER BY created_at DESC`
      );
      if (result.rows.length === 0) {
        return res.json([defaultProgram()]);
      }
      res.json(
        result.rows.map((r) => ({
          ...r,
          status: r.is_active ? 'active' : 'inactive',
          type: 'customer',
        }))
      );
    } catch (error) {
      console.error('getReferralPrograms', error);
      res.json([defaultProgram()]);
    }
  },

  async getReferralProgram(req: Request, res: Response) {
    try {
      if (req.params.id === 'default') {
        return res.json(defaultProgram());
      }
      const result = await query(`SELECT * FROM referral_programs WHERE id = $1 LIMIT 1`, [
        req.params.id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'البرنامج غير موجود' });
      }
      const r = result.rows[0];
      res.json({
        ...r,
        status: r.is_active ? 'active' : 'inactive',
        type: 'customer',
      });
    } catch (error) {
      console.error('getReferralProgram', error);
      res.status(500).json({ error: 'فشل جلب البرنامج' });
    }
  },

  async updateReferralProgram(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'للإدارة فقط' });
      }
      const name = req.body?.name != null ? String(req.body.name).trim() : null;
      const description =
        req.body?.description != null ? String(req.body.description).trim() : null;
      const rewardAmount =
        req.body?.reward_amount != null ? Number(req.body.reward_amount) : null;
      const refereePercent =
        req.body?.referee_percent != null ? Number(req.body.referee_percent) : null;
      const isActive =
        req.body?.is_active != null ? Boolean(req.body.is_active) : null;

      const result = await query(
        `
        UPDATE referral_programs SET
          name = COALESCE($2, name),
          description = COALESCE($3, description),
          reward_amount = COALESCE($4, reward_amount),
          referee_percent = COALESCE($5, referee_percent),
          is_active = COALESCE($6, is_active)
        WHERE id = $1
        RETURNING *
        `,
        [req.params.id, name, description, rewardAmount, refereePercent, isActive]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'البرنامج غير موجود' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('updateReferralProgram', error);
      res.status(500).json({ error: 'فشل تحديث البرنامج' });
    }
  },

  async deleteReferralProgram(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'للإدارة فقط' });
      }
      const result = await query(
        `UPDATE referral_programs SET is_active = false WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'البرنامج غير موجود' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('deleteReferralProgram', error);
      res.status(500).json({ error: 'فشل حذف البرنامج' });
    }
  },

  async getReferralTransactions(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'للإدارة فقط' });
      }
      const result = await query(
        `
        SELECT ru.*,
          ref.name AS referrer_name,
          ree.name AS referee_name,
          rc.code AS referral_code
        FROM referral_uses ru
        JOIN users ref ON ref.id = ru.referrer_id
        JOIN users ree ON ree.id = ru.referee_id
        JOIN referral_codes rc ON rc.id = ru.referral_code_id
        ORDER BY ru.created_at DESC
        LIMIT 200
        `
      );
      res.json(result.rows);
    } catch (error) {
      console.error('getReferralTransactions', error);
      res.status(500).json({ error: 'فشل جلب معاملات الإحالة' });
    }
  },

  async getUserReferralTransactions(req: AuthenticatedRequest, res: Response) {
    try {
      const authId = req.user?.userId || req.user?.id;
      const { userId } = req.params;
      if (!authId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });
      if (String(userId) !== String(authId) && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
      }
      const codes = await query(
        `SELECT * FROM referral_codes WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      const uses = await query(
        `
        SELECT ru.*, u.name AS referee_name, u.email AS referee_email, rc.code
        FROM referral_uses ru
        JOIN users u ON u.id = ru.referee_id
        JOIN referral_codes rc ON rc.id = ru.referral_code_id
        WHERE ru.referrer_id = $1
        ORDER BY ru.created_at DESC
        LIMIT 100
        `,
        [userId]
      );
      res.json({ codes: codes.rows, referrals: uses.rows });
    } catch (error) {
      console.error('getUserReferralTransactions', error);
      res.status(500).json({ error: 'فشل جلب بيانات الإحالة' });
    }
  },

  async getPersonalizedRecommendations(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId || req.user?.id;
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });

      const codeRes = await query(
        `SELECT * FROM referral_codes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      const codeRow = codeRes.rows[0] || null;

      const countRes = await query(
        `SELECT COUNT(*)::int AS cnt FROM referral_uses WHERE referrer_id = $1`,
        [userId]
      );
      const referredCount = Number(countRes.rows[0]?.cnt || codeRow?.uses_count || 0);

      const recent = await query(
        `
        SELECT
          ru.id,
          ru.referee_id,
          ru.created_at,
          u.name AS referee_name,
          LEFT(COALESCE(u.email, ''), 3) || '***' AS referee_email_masked,
          rc.code AS referral_code
        FROM referral_uses ru
        JOIN users u ON u.id = ru.referee_id
        JOIN referral_codes rc ON rc.id = ru.referral_code_id
        WHERE ru.referrer_id = $1
        ORDER BY ru.created_at DESC
        LIMIT 20
        `,
        [userId]
      );

      res.json({
        referredCount,
        recentReferrals: recent.rows,
        referrals: recent.rows,
        userProfile: {
          userId,
          referralCode: codeRow ? String(codeRow.code) : null,
          usesCount: Number(codeRow?.uses_count || referredCount),
          rewardAmount: Number(codeRow?.reward_amount || 0),
          isActive: codeRow ? Boolean(codeRow.is_active) : false,
        },
      });
    } catch (error) {
      console.error('getPersonalizedRecommendations', error);
      res.status(500).json({ error: 'فشل جلب إحصائيات الإحالة' });
    }
  },
};
