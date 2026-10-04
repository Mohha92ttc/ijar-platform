import { Request, Response } from 'express';
import { CouriersService } from './couriers.service';
import { query } from '../../database/connection';
import { publicError } from '../../utils/publicError';

export class CouriersController {
  private service = new CouriersService();

  listMine = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'owner') {
        return res.status(403).json({ error: 'للشركاء فقط' });
      }
      const list = await this.service.listByOwner(actor.userId);
      res.json(list);
    } catch (e: unknown) {
      res.status(400).json({ error: publicError(e, 'تعذر جلب المندوبين') });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'owner') {
        return res.status(403).json({ error: 'للشركاء فقط' });
      }
      const created = await this.service.createForOwner(actor.userId, req.body);
      res.status(201).json(created);
    } catch (e: unknown) {
      res.status(400).json({ error: publicError(e, 'تعذر إنشاء المندوب') });
    }
  };

  setActive = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'owner') {
        return res.status(403).json({ error: 'للشركاء فقط' });
      }
      await this.service.setActive(actor.userId, req.params.id, Boolean(req.body.is_active));
      res.json({ ok: true });
    } catch (e: unknown) {
      res.status(400).json({ error: publicError(e, 'تعذر التحديث') });
    }
  };

  /** شريك يعيّن/ينقل طلب لمندوب */
  assignBooking = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'owner') {
        return res.status(403).json({ error: 'للشركاء فقط' });
      }
      const bookingId = req.params.bookingId;
      const courierId = String(req.body.courier_id || '');
      if (!courierId) return res.status(400).json({ error: 'courier_id مطلوب' });

      await this.service.assertOwned(actor.userId, courierId);

      const own = await query(
        `
        SELECT b.id FROM bookings b
        JOIN equipment e ON e.id = b.equipment_id
        WHERE b.id = $1 AND e.owner_id = $2
        `,
        [bookingId, actor.userId]
      );
      if (!own.rows[0]) return res.status(404).json({ error: 'الطلب غير موجود' });

      await query(
        `
        UPDATE bookings
        SET assigned_courier_id = $1,
            delivery_status = COALESCE(NULLIF(delivery_status, 'delivered'), 'assigned'),
            updated_at = NOW()
        WHERE id = $2
        `,
        [courierId, bookingId]
      );
      res.json({ ok: true, assigned_courier_id: courierId });
    } catch (e: unknown) {
      res.status(400).json({ error: publicError(e, 'تعذر تعيين المندوب') });
    }
  };

  myBookings = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'courier') {
        return res.status(403).json({ error: 'للمندوبين فقط' });
      }
      const me = await this.service.getByUserId(actor.userId);
      if (!me || !me.is_active) return res.status(403).json({ error: 'حساب المندوب غير نشط' });
      const rows = await this.service.listAssignedBookings(me.id);
      res.json(rows);
    } catch (e: unknown) {
      res.status(400).json({ error: publicError(e, 'تعذر جلب الطلبات') });
    }
  };

  updateDeliveryStatus = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'courier') {
        return res.status(403).json({ error: 'للمندوبين فقط' });
      }
      const me = await this.service.getByUserId(actor.userId);
      if (!me) return res.status(403).json({ error: 'مندوب غير معروف' });
      const status = String(req.body.delivery_status || '');
      if (!['assigned', 'out_for_delivery', 'delivered', 'failed'].includes(status)) {
        return res.status(400).json({ error: 'حالة غير صالحة' });
      }
      const resu = await query(
        `
        UPDATE bookings
        SET delivery_status = $1, updated_at = NOW()
        WHERE id = $2 AND assigned_courier_id = $3
        RETURNING id
        `,
        [status, req.params.bookingId, me.id]
      );
      if (!resu.rows[0]) return res.status(404).json({ error: 'الطلب غير معيّن لك' });
      res.json({ ok: true });
    } catch (e: unknown) {
      res.status(400).json({ error: publicError(e, 'تعذر تحديث الحالة') });
    }
  };

  myReport = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'courier') {
        return res.status(403).json({ error: 'للمندوبين فقط' });
      }
      const me = await this.service.getByUserId(actor.userId);
      if (!me) return res.status(403).json({ error: 'مندوب غير معروف' });
      const month =
        typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
          ? req.query.month
          : new Date().toISOString().slice(0, 7);
      const report = await this.service.monthlyReport(me.id, month);
      res.json(report);
    } catch (e: unknown) {
      res.status(400).json({ error: publicError(e, 'تعذر جلب التقرير') });
    }
  };

  partnerCourierReport = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'owner') {
        return res.status(403).json({ error: 'للشركاء فقط' });
      }
      await this.service.assertOwned(actor.userId, req.params.id);
      const month =
        typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
          ? req.query.month
          : new Date().toISOString().slice(0, 7);
      const report = await this.service.monthlyReport(req.params.id, month);
      res.json(report);
    } catch (e: unknown) {
      res.status(400).json({ error: publicError(e, 'تعذر جلب التقرير') });
    }
  };

  me = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'courier') {
        return res.status(403).json({ error: 'للمندوبين فقط' });
      }
      const me = await this.service.getByUserId(actor.userId);
      if (!me) return res.status(404).json({ error: 'غير موجود' });
      res.json(me);
    } catch (e: unknown) {
      res.status(400).json({ error: publicError(e, 'خطأ') });
    }
  };
}
