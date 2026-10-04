import { Router } from 'express';
import { query } from '../../database/connection';
import { authenticateToken, requireRole } from '../auth/auth.middleware';
import { publicError } from '../../utils/publicError';

const router = Router();

router.get('/', authenticateToken, requireRole(['customer']), async (req, res) => {
  try {
    const userId = (req as any).user.userId as string;
    const r = await query(
      `
      SELECT e.*, f.created_at AS favorited_at, u.name AS owner_name
      FROM favorites f
      JOIN equipment e ON e.id = f.equipment_id
      JOIN users u ON u.id = e.owner_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
      `,
      [userId]
    );
    res.json(r.rows);
  } catch (e) {
    res.status(400).json({ error: publicError(e, 'تعذر جلب المفضلة') });
  }
});

router.get('/ids', authenticateToken, requireRole(['customer']), async (req, res) => {
  try {
    const userId = (req as any).user.userId as string;
    const r = await query(`SELECT equipment_id FROM favorites WHERE user_id = $1`, [userId]);
    res.json(r.rows.map((x) => String(x.equipment_id)));
  } catch (e) {
    res.status(400).json({ error: publicError(e, 'تعذر جلب المفضلة') });
  }
});

router.post('/:equipmentId', authenticateToken, requireRole(['customer']), async (req, res) => {
  try {
    const userId = (req as any).user.userId as string;
    const equipmentId = req.params.equipmentId;
    await query(
      `
      INSERT INTO favorites (user_id, equipment_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, equipment_id) DO NOTHING
      `,
      [userId, equipmentId]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: publicError(e, 'تعذر الإضافة للمفضلة') });
  }
});

router.delete('/:equipmentId', authenticateToken, requireRole(['customer']), async (req, res) => {
  try {
    const userId = (req as any).user.userId as string;
    await query(`DELETE FROM favorites WHERE user_id = $1 AND equipment_id = $2`, [
      userId,
      req.params.equipmentId,
    ]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: publicError(e, 'تعذر الحذف من المفضلة') });
  }
});

export default router;
