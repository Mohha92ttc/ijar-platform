import { Request, Response } from 'express';
import { CouriersService } from './couriers.service';
import { query } from '../../database/connection';
import { publicError } from '../../utils/publicError';
import { NotificationService } from '../notifications/notification.service';

export class CouriersController {
  private service = new CouriersService();
  private notifications = new NotificationService();

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

  resetPassword = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'owner') {
        return res.status(403).json({ error: 'للشركاء فقط' });
      }
      const result = await this.service.resetPassword(
        actor.userId,
        req.params.id,
        typeof req.body.password === 'string' ? req.body.password : undefined
      );
      res.json(result);
    } catch (e: unknown) {
      res.status(400).json({ error: publicError(e, 'تعذر إعادة تعيين كلمة المرور') });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'owner') {
        return res.status(403).json({ error: 'للشركاء فقط' });
      }
      const updated = await this.service.updateCourier(actor.userId, req.params.id, {
        name: req.body.name,
        phone: req.body.phone,
      });
      res.json(updated);
    } catch (e: unknown) {
      res.status(400).json({ error: publicError(e, 'تعذر تحديث المندوب') });
    }
  };

  unassignBooking = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'owner') {
        return res.status(403).json({ error: 'للشركاء فقط' });
      }
      const leg = String(req.body?.leg || req.body?.delivery_leg || 'outbound');
      await this.service.unassignBooking(actor.userId, req.params.bookingId, leg);
      res.json({ ok: true, leg });
    } catch (e: unknown) {
      res.status(400).json({ error: publicError(e, 'تعذر إلغاء التعيين') });
    }
  };

  /** شريك يعيّن/ينقل طلب لمندوب (توصيل أو استرجاع) */
  assignBooking = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'owner') {
        return res.status(403).json({ error: 'للشركاء فقط' });
      }
      const bookingId = req.params.bookingId;
      const courierId = String(req.body.courier_id || '');
      if (!courierId) return res.status(400).json({ error: 'courier_id مطلوب' });
      const leg = String(req.body.leg || req.body.delivery_leg || 'outbound');

      const courier = await this.service.assertOwned(actor.userId, courierId);

      const own = await query(
        `
        SELECT b.id, e.title AS equipment_title, b.status::text AS status, b.delivery_requested
        FROM bookings b
        JOIN equipment e ON e.id = b.equipment_id
        WHERE b.id = $1 AND e.owner_id = $2
        `,
        [bookingId, actor.userId]
      );
      if (!own.rows[0]) return res.status(404).json({ error: 'الطلب غير موجود' });
      if (String(own.rows[0].status) !== 'confirmed') {
        return res.status(400).json({ error: 'عيّن المندوب بعد تأكيد الحجز فقط' });
      }

      if (leg === 'return') {
        await query(
          `
          UPDATE bookings
          SET return_requested = TRUE,
              return_courier_id = $1,
              return_status = CASE
                WHEN return_status = 'delivered' THEN return_status
                ELSE 'assigned'
              END,
              updated_at = NOW()
          WHERE id = $2
          `,
          [courierId, bookingId]
        );
      } else {
        if (!own.rows[0].delivery_requested) {
          return res.status(400).json({ error: 'لا يوجد توصيل مطلوب لهذا الحجز — عيّن مندوب استرجاع إن لزم' });
        }
        await query(
          `
          UPDATE bookings
          SET assigned_courier_id = $1,
              delivery_status = CASE
                WHEN delivery_status = 'delivered' THEN delivery_status
                ELSE 'assigned'
              END,
              updated_at = NOW()
          WHERE id = $2
          `,
          [courierId, bookingId]
        );
      }

      if (courier.user_id) {
        try {
          await this.notifications.create({
            user_id: courier.user_id,
            type: 'system',
            title: leg === 'return' ? 'طلب استرجاع جديد' : 'طلب توصيل جديد',
            message: `تم تعيينك لـ${leg === 'return' ? 'استرجاع' : 'توصيل'}: ${String(own.rows[0].equipment_title || 'طلب')} — افتح لوحة المندوب.`,
            related_id: bookingId,
          });
        } catch {
          // non-blocking
        }
      }

      res.json({ ok: true, assigned_courier_id: courierId, leg });
    } catch (e: unknown) {
      res.status(400).json({ error: publicError(e, 'تعذر تعيين المندوب') });
    }
  };

  requestReturn = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'owner') {
        return res.status(403).json({ error: 'للشركاء فقط' });
      }
      const bookingId = req.params.bookingId;
      const own = await query(
        `
        SELECT b.id, b.delivery_status, b.delivery_requested, b.customer_id, e.title, b.status::text AS status
        FROM bookings b
        JOIN equipment e ON e.id = b.equipment_id
        WHERE b.id = $1 AND e.owner_id = $2
        `,
        [bookingId, actor.userId]
      );
      if (!own.rows[0]) return res.status(404).json({ error: 'الطلب غير موجود' });
      if (String(own.rows[0].status) !== 'confirmed') {
        return res.status(400).json({ error: 'اطلب الاسترجاع بعد تأكيد الحجز فقط' });
      }
      const wantsDelivery = Boolean(own.rows[0].delivery_requested);
      if (wantsDelivery && String(own.rows[0].delivery_status) !== 'delivered') {
        return res.status(400).json({ error: 'فعّل الاسترجاع بعد إتمام تسليم التوصيل للزبون' });
      }
      await query(
        `
        UPDATE bookings
        SET return_requested = TRUE,
            return_status = COALESCE(NULLIF(return_status, 'delivered'), 'pending_assign'),
            updated_at = NOW()
        WHERE id = $1
        `,
        [bookingId]
      );
      try {
        await this.notifications.create({
          user_id: String(own.rows[0].customer_id),
          type: 'system',
          title: 'طلب استرجاع المعدة',
          message: wantsDelivery
            ? `الشريك طلب استرجاع «${own.rows[0].title}». سيُعيَّن مندوب للاستلام من موقعك.`
            : `الشريك طلب استرجاع «${own.rows[0].title}» (استلام ذاتي). نسّقوا التسليم أو سيُعيَّن مندوب إن لزم.`,
          related_id: bookingId,
        });
      } catch {
        // ignore
      }
      res.json({ ok: true });
    } catch (e: unknown) {
      res.status(400).json({ error: publicError(e, 'تعذر طلب الاسترجاع') });
    }
  };

  cancelReturn = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'owner') {
        return res.status(403).json({ error: 'للشركاء فقط' });
      }
      const bookingId = req.params.bookingId;
      const own = await query(
        `
        SELECT b.id, b.return_requested, b.return_status, b.customer_id, e.title, b.status::text AS status
        FROM bookings b
        JOIN equipment e ON e.id = b.equipment_id
        WHERE b.id = $1 AND e.owner_id = $2
        `,
        [bookingId, actor.userId]
      );
      if (!own.rows[0]) return res.status(404).json({ error: 'الطلب غير موجود' });
      if (String(own.rows[0].status) !== 'confirmed') {
        return res.status(400).json({ error: 'الحجز غير مؤكد' });
      }
      if (!own.rows[0].return_requested) {
        return res.status(400).json({ error: 'لا يوجد طلب استرجاع لإلغائه' });
      }
      if (String(own.rows[0].return_status) === 'delivered') {
        return res.status(400).json({ error: 'لا يمكن إلغاء استرجاع مكتمل' });
      }
      await query(
        `
        UPDATE bookings
        SET return_requested = FALSE,
            return_status = NULL,
            return_courier_id = NULL,
            updated_at = NOW()
        WHERE id = $1
        `,
        [bookingId]
      );
      try {
        await this.notifications.create({
          user_id: String(own.rows[0].customer_id),
          type: 'system',
          title: 'أُلغي طلب الاسترجاع',
          message: `الشريك ألغى طلب استرجاع «${own.rows[0].title}».`,
          related_id: bookingId,
        });
      } catch {
        // ignore
      }
      res.json({ ok: true });
    } catch (e: unknown) {
      res.status(400).json({ error: publicError(e, 'تعذر إلغاء الاسترجاع') });
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
      const leg = String(req.body.leg || req.body.delivery_leg || 'outbound');
      if (!['assigned', 'out_for_delivery', 'delivered', 'failed'].includes(status)) {
        return res.status(400).json({ error: 'حالة غير صالحة' });
      }

      const isReturn = leg === 'return';
      const resu = await query(
        isReturn
          ? `
        UPDATE bookings
        SET return_status = $1, updated_at = NOW()
        WHERE id = $2 AND return_courier_id = $3 AND status = 'confirmed'::booking_status
        RETURNING id, customer_id, return_status AS delivery_status
        `
          : `
        UPDATE bookings
        SET delivery_status = $1, updated_at = NOW()
        WHERE id = $2 AND assigned_courier_id = $3 AND status = 'confirmed'::booking_status
        RETURNING id, customer_id, delivery_status
        `,
        [status, req.params.bookingId, me.id]
      );
      if (!resu.rows[0]) return res.status(404).json({ error: 'الطلب غير معيّن لك أو غير مؤكد' });

      const customerId = String(resu.rows[0].customer_id || '');
      if (customerId && (status === 'out_for_delivery' || status === 'delivered' || status === 'failed')) {
        try {
          const title =
            status === 'delivered'
              ? isReturn
                ? 'تم استرجاع المعدة'
                : 'تم تسليم طلبك'
              : status === 'failed'
                ? isReturn
                  ? 'تعذّر استرجاع المعدة'
                  : 'تعذّر تسليم الطلب'
                : isReturn
                  ? 'المندوب في الطريق للاسترجاع'
                  : 'المندوب في الطريق';
          const message =
            status === 'delivered'
              ? isReturn
                ? 'تم استلام المعدة من موقعك وإرجاعها للشريك.'
                : 'تم تسليم معدتك بنجاح.'
              : status === 'failed'
                ? 'سجّل المندوب تعذّر المهمة. سيتواصل الشريك معك.'
                : isReturn
                  ? 'مندوب الاسترجاع في الطريق إليك.'
                  : 'مندوب التوصيل في الطريق إليك الآن.';
          await this.notifications.create({
            user_id: customerId,
            type: 'system',
            title,
            message,
            related_id: String(resu.rows[0].id),
          });
          const ownerRes = await query(
            `
            SELECT e.owner_id
            FROM bookings b
            JOIN equipment e ON e.id = b.equipment_id
            WHERE b.id = $1
            LIMIT 1
            `,
            [req.params.bookingId]
          );
          const ownerId = ownerRes.rows[0]?.owner_id;
          if (ownerId) {
            const ownerTitle =
              status === 'delivered'
                ? isReturn
                  ? 'تم استرجاع معدة'
                  : 'تم تسليم حجز'
                : status === 'failed'
                  ? isReturn
                    ? 'فشل استرجاع معدة'
                    : 'فشل توصيل حجز'
                  : isReturn
                    ? 'مندوب الاسترجاع في الطريق'
                    : 'مندوب التوصيل في الطريق';
            const ownerMessage =
              status === 'delivered'
                ? isReturn
                  ? 'المندوب أكمل استرجاع المعدة من الزبون.'
                  : 'المندوب أكمل تسليم المعدة للزبون.'
                : status === 'failed'
                  ? 'سجّل المندوب تعذّر المهمة. راجع الطلب وأعد التعيين إن لزم.'
                  : isReturn
                    ? 'المندوب خرج لاسترجاع المعدة.'
                    : 'المندوب خرج لتوصيل الطلب.';
            await this.notifications.create({
              user_id: String(ownerId),
              type: 'system',
              title: ownerTitle,
              message: ownerMessage,
              related_id: String(resu.rows[0].id),
            });
          }
        } catch {
          // non-blocking
        }
      }

      // COD: mark payment paid when outbound delivered
      if (!isReturn && status === 'delivered') {
        try {
          await query(
            `
            UPDATE payments
            SET status = 'approved'::payment_status,
                notes = COALESCE(notes, '') || ' | تم الاستلام عند التسليم',
                updated_at = NOW()
            WHERE booking_id = $1
              AND method = 'cash'::payment_method
              AND status IN ('pending'::payment_status, 'under_review'::payment_status)
            `,
            [req.params.bookingId]
          );
        } catch {
          // non-blocking
        }
      }

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

  /** شريك يسجّل التسليم/الاسترجاع بنفسه (بدون مندوب) */
  ownerMarkDelivery = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'owner') {
        return res.status(403).json({ error: 'للشركاء فقط' });
      }
      const bookingId = req.params.bookingId;
      const status = String(req.body.delivery_status || '');
      const leg = String(req.body.leg || req.body.delivery_leg || 'outbound');
      if (!['delivered', 'failed', 'out_for_delivery'].includes(status)) {
        return res.status(400).json({ error: 'حالة غير صالحة' });
      }

      const own = await query(
        `
        SELECT b.id, b.customer_id, b.delivery_requested, b.return_requested, b.status::text AS status
        FROM bookings b
        JOIN equipment e ON e.id = b.equipment_id
        WHERE b.id = $1 AND e.owner_id = $2
        `,
        [bookingId, actor.userId]
      );
      if (!own.rows[0]) return res.status(404).json({ error: 'الطلب غير موجود' });
      if (String(own.rows[0].status) !== 'confirmed') {
        return res.status(400).json({ error: 'سجّل التسليم بعد تأكيد الحجز فقط' });
      }

      const isReturn = leg === 'return';
      if (isReturn && !own.rows[0].return_requested) {
        return res.status(400).json({ error: 'لم يُطلب استرجاع لهذا الحجز' });
      }
      if (!isReturn && !own.rows[0].delivery_requested) {
        return res.status(400).json({ error: 'لا يوجد توصيل مطلوب لهذا الحجز' });
      }

      await query(
        isReturn
          ? `UPDATE bookings SET return_status = $1, updated_at = NOW() WHERE id = $2`
          : `UPDATE bookings SET delivery_status = $1, updated_at = NOW() WHERE id = $2`,
        [status, bookingId]
      );

      const customerId = String(own.rows[0].customer_id || '');
      if (customerId && (status === 'delivered' || status === 'failed')) {
        try {
          await this.notifications.create({
            user_id: customerId,
            type: 'system',
            title:
              status === 'delivered'
                ? isReturn
                  ? 'تم استرجاع المعدة'
                  : 'تم تسليم طلبك'
                : isReturn
                  ? 'تعذّر الاسترجاع'
                  : 'تعذّر التسليم',
            message:
              status === 'delivered'
                ? isReturn
                  ? 'سجّل الشريك استلام المعدة من موقعك.'
                  : 'سجّل الشريك تسليم المعدة إليك.'
                : 'سجّل الشريك تعذّر المهمة. تواصل معه عند الحاجة.',
            related_id: bookingId,
          });
        } catch {
          // ignore
        }
      }

      if (!isReturn && status === 'delivered') {
        try {
          await query(
            `
            UPDATE payments
            SET status = 'approved'::payment_status,
                notes = COALESCE(notes, '') || ' | تم الاستلام عند التسليم (شريك)',
                updated_at = NOW()
            WHERE booking_id = $1
              AND method = 'cash'::payment_method
              AND status IN ('pending'::payment_status, 'under_review'::payment_status)
            `,
            [bookingId]
          );
        } catch {
          // ignore
        }
      }

      res.json({ ok: true, leg, delivery_status: status });
    } catch (e: unknown) {
      res.status(400).json({ error: publicError(e, 'تعذر تحديث حالة التوصيل') });
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
