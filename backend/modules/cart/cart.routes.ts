import { Router, Response } from 'express';
import { query } from '../../database/connection';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/auth.middleware';
import { publicError } from '../../utils/publicError';

const router = Router();

function uid(req: AuthenticatedRequest): string | undefined {
  return req.user?.userId || req.user?.id;
}

function normalizeItems(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 100);
}

router.get(
  '/',
  authenticateToken,
  requireRole(['customer']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });

      const result = await query(`SELECT items, updated_at FROM carts WHERE user_id = $1 LIMIT 1`, [
        userId,
      ]);
      if (result.rows.length === 0) {
        return res.json({ items: [], updated_at: null });
      }
      const row = result.rows[0];
      const items = Array.isArray(row.items) ? row.items : [];
      return res.json({ items, updated_at: row.updated_at });
    } catch (e) {
      return res.status(500).json({ error: publicError(e, 'تعذر جلب السلة') });
    }
  }
);

router.put(
  '/',
  authenticateToken,
  requireRole(['customer']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });

      const items = normalizeItems(req.body?.items ?? req.body);
      const result = await query(
        `
        INSERT INTO carts (user_id, items, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          items = EXCLUDED.items,
          updated_at = NOW()
        RETURNING items, updated_at
        `,
        [userId, JSON.stringify(items)]
      );
      return res.json({
        items: result.rows[0].items,
        updated_at: result.rows[0].updated_at,
      });
    } catch (e) {
      return res.status(500).json({ error: publicError(e, 'تعذر حفظ السلة') });
    }
  }
);

router.delete(
  '/',
  authenticateToken,
  requireRole(['customer']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });

      await query(
        `
        INSERT INTO carts (user_id, items, updated_at)
        VALUES ($1, '[]'::jsonb, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          items = '[]'::jsonb,
          updated_at = NOW()
        `,
        [userId]
      );
      return res.json({ items: [], ok: true });
    } catch (e) {
      return res.status(500).json({ error: publicError(e, 'تعذر تفريغ السلة') });
    }
  }
);

export default router;
