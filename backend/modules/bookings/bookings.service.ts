import { query } from '../../database/connection';
import { Booking, CreateBookingDTO, BookingStatus } from './bookings.types';
import { EquipmentService } from '../equipment/equipment.service';
import { NotificationService } from '../notifications/notification.service';
import { PaymentService } from '../payments/payment.service';

function rowToBooking(row: Record<string, unknown>): Booking {
  return {
    id: String(row.id),
    equipment_id: String(row.equipment_id),
    customer_id: String(row.customer_id),
    start_date: new Date(row.start_date as string),
    end_date: new Date(row.end_date as string),
    total_price: Number(row.total_amount),
    status: row.status as BookingStatus,
    created_at: new Date(row.created_at as string),
    updated_at: new Date(row.updated_at as string),
    payment_preference: row.payment_preference != null ? String(row.payment_preference) : undefined,
    customer_phone: row.customer_phone != null ? String(row.customer_phone) : undefined,
    delivery_requested: Boolean(row.delivery_requested),
    cancel_reason: row.cancel_reason != null ? String(row.cancel_reason) : null,
  };
}

export class BookingService {
  private equipmentService: EquipmentService;
  private notificationService: NotificationService;
  private paymentService: PaymentService;

  constructor() {
    this.equipmentService = new EquipmentService();
    this.notificationService = new NotificationService();
    this.paymentService = new PaymentService();
  }

  async create(customerId: string, data: CreateBookingDTO): Promise<Booking> {
    const equipment = await this.equipmentService.getById(data.equipment_id, { requirePublicOwner: true });
    if (String(equipment.status) === 'rented') {
      // still allow if dates don't overlap — checkAvailability handles conflicts
    }

    const start = new Date(data.start_date);
    const end = new Date(data.end_date);

    // Compare by calendar day (Iraq-local noon), not UTC midnight — fixes "اليوم" bookings
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDay < today) {
      throw new Error('تاريخ البداية لا يمكن أن يكون في الماضي');
    }

    if (end <= start) {
      throw new Error('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
    }

    // Normalize to midday to avoid DST/UTC edge cases on day counts
    const startNorm = new Date(start);
    startNorm.setHours(12, 0, 0, 0);
    const endNorm = new Date(end);
    endNorm.setHours(12, 0, 0, 0);
    if (endNorm <= startNorm) {
      throw new Error('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
    }

    const available = await this.checkAvailability(data.equipment_id, startNorm, endNorm);
    if (!available) {
      throw new Error('المعدة محجوزة مسبقاً في هذه التواريخ. اختر تواريخ أخرى.');
    }

    const diffTime = Math.abs(endNorm.getTime() - startNorm.getTime());
    const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
    const rentalPrice = diffDays * equipment.price_per_day;
    const deliveryRequested = Boolean(data.delivery_requested);

    let deliveryFee = 0;
    if (deliveryRequested && !data.waive_delivery_fee) {
      const feeRes = await query(
        `SELECT COALESCE(delivery_fee, 0) AS delivery_fee FROM owner_payment_settings WHERE owner_id = $1 LIMIT 1`,
        [equipment.owner_id]
      );
      deliveryFee = Math.max(0, Number(feeRes.rows[0]?.delivery_fee ?? 0) || 0);
    }
    const totalPrice = rentalPrice + deliveryFee;

    let deliveryLat: number | null = null;
    let deliveryLng: number | null = null;
    if (deliveryRequested) {
      const lat = data.delivery_lat != null ? Number(data.delivery_lat) : NaN;
      const lng = data.delivery_lng != null ? Number(data.delivery_lng) : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('حدد موقع التوصيل على الخريطة');
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new Error('إحداثيات التوصيل غير صالحة');
      }
      deliveryLat = lat;
      deliveryLng = lng;
    }

    const deliveryAddress =
      deliveryRequested && data.delivery_address
        ? String(data.delivery_address).trim() || null
        : null;
    const deliveryStatus = deliveryRequested ? 'pending_assign' : null;

    const ins = await query(
      `
      INSERT INTO bookings (
        equipment_id, customer_id, start_date, end_date, total_amount, status,
        location, notes, customer_phone, delivery_requested, delivery_fee, payment_preference,
        delivery_lat, delivery_lng, delivery_address, delivery_status
      )
      VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `,
      [
        data.equipment_id,
        customerId,
        startNorm.toISOString(),
        endNorm.toISOString(),
        totalPrice,
        data.location ?? null,
        data.notes ?? null,
        data.customer_phone ?? null,
        deliveryRequested,
        deliveryFee,
        data.payment_preference ?? null,
        deliveryLat,
        deliveryLng,
        deliveryAddress,
        deliveryStatus,
      ]
    );

    const newBooking = rowToBooking(ins.rows[0]);

    await this.notificationService.create({
      user_id: equipment.owner_id,
      type: 'system',
      title: 'طلب حجز جديد',
      message: `لديك طلب حجز جديد على «${equipment.title}».`,
      related_id: newBooking.id,
    });

    return newBooking;
  }

  /** Cancel pending bookings older than 48h via full cancel path (settle + notifs). */
  private async expireStalePending(equipmentId?: string): Promise<void> {
    try {
      const params: unknown[] = [];
      let sql = `
        SELECT id FROM bookings
        WHERE status = 'pending'
          AND created_at < NOW() - INTERVAL '48 hours'
      `;
      if (equipmentId) {
        params.push(equipmentId);
        sql += ` AND equipment_id = $${params.length}`;
      }
      sql += ` ORDER BY created_at ASC LIMIT 40`;
      const res = await query(sql, params);
      for (const row of res.rows) {
        try {
          await this.updateStatus(
            String(row.id),
            'cancelled',
            { userId: 'system-expire', role: 'admin' },
            { reason: 'انتهت مهلة الانتظار دون تأكيد (48 ساعة)' }
          );
        } catch (e) {
          console.warn(
            '[booking] expire one stale pending failed',
            row.id,
            e instanceof Error ? e.message : e
          );
        }
      }
    } catch (e) {
      console.warn('[booking] expireStalePending failed', e instanceof Error ? e.message : e);
    }
  }

  /** true = still have stock for this date range (overlapping bookings < quantity) */
  async checkAvailability(equipmentId: string, start: Date, end: Date): Promise<boolean> {
    const detail = await this.getAvailabilityDetail(equipmentId, start, end);
    return detail.available;
  }

  async getAvailabilityDetail(
    equipmentId: string,
    start: Date,
    end: Date
  ): Promise<{ available: boolean; quantity: number; booked: number; remaining: number }> {
    await this.expireStalePending(equipmentId);
    const qtyRes = await query(
      `SELECT COALESCE(quantity, 1)::int AS quantity FROM equipment WHERE id = $1 LIMIT 1`,
      [equipmentId]
    );
    if (!qtyRes.rows[0]) {
      return { available: false, quantity: 0, booked: 0, remaining: 0 };
    }
    const quantity = Math.max(1, Number(qtyRes.rows[0].quantity) || 1);
    const res = await query(
      `
      SELECT COUNT(*)::int AS cnt FROM bookings
      WHERE equipment_id = $1
        AND status IN ('pending', 'confirmed')
        AND start_date < $3 AND end_date > $2
    `,
      [equipmentId, start, end]
    );
    const booked = Number(res.rows[0]?.cnt || 0);
    const remaining = Math.max(0, quantity - booked);
    return { available: remaining > 0, quantity, booked, remaining };
  }

  /** Days/ranges fully sold out (booked count >= quantity). Partial stock days stay open. */
  async getBusyRanges(
    equipmentId: string,
    from?: Date,
    to?: Date
  ): Promise<{ start: string; end: string; status: string; booked?: number; quantity?: number }[]> {
    await this.expireStalePending(equipmentId);
    const qtyRes = await query(
      `SELECT COALESCE(quantity, 1)::int AS quantity FROM equipment WHERE id = $1 LIMIT 1`,
      [equipmentId]
    );
    const quantity = Math.max(1, Number(qtyRes.rows[0]?.quantity) || 1);

    const params: unknown[] = [equipmentId];
    let sql = `
      SELECT start_date::date AS start, end_date::date AS end, status::text AS status
      FROM bookings
      WHERE equipment_id = $1
        AND status IN ('pending', 'confirmed')
    `;
    if (from) {
      params.push(from);
      sql += ` AND end_date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      sql += ` AND start_date <= $${params.length}`;
    }
    sql += ` ORDER BY start_date ASC LIMIT 500`;
    const res = await query(sql, params);
    const bookings = res.rows.map((r: any) => ({
      start: String(r.start).slice(0, 10),
      end: String(r.end).slice(0, 10),
      status: String(r.status),
    }));

    if (quantity <= 1) {
      return bookings.map((b) => ({ ...b, booked: 1, quantity: 1 }));
    }

    // Sweep calendar days: only mark fully sold-out days
    const dayCounts = new Map<string, number>();
    const bump = (ymd: string) => dayCounts.set(ymd, (dayCounts.get(ymd) || 0) + 1);
    for (const b of bookings) {
      const s = new Date(`${b.start}T12:00:00`);
      const e = new Date(`${b.end}T12:00:00`);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s) continue;
      for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        bump(`${y}-${m}-${day}`);
      }
    }

    const fullDays = [...dayCounts.entries()]
      .filter(([, cnt]) => cnt >= quantity)
      .map(([day, cnt]) => ({ day, cnt }))
      .sort((a, b) => a.day.localeCompare(b.day));

    const ranges: { start: string; end: string; status: string; booked?: number; quantity?: number }[] = [];
    for (const { day, cnt } of fullDays) {
      const nextDay = (() => {
        const d = new Date(`${day}T12:00:00`);
        d.setDate(d.getDate() + 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      })();
      const last = ranges[ranges.length - 1];
      if (last && last.end === day) {
        last.end = nextDay;
        last.booked = Math.max(Number(last.booked || 0), cnt);
      } else {
        ranges.push({ start: day, end: nextDay, status: 'confirmed', booked: cnt, quantity });
      }
    }
    return ranges;
  }

  async updateStatus(
    id: string,
    status: BookingStatus,
    actor: { userId: string; role: string },
    opts?: { reason?: string }
  ): Promise<Booking> {
    const existing = await this.getById(id);
    const oldStatus = existing.status;

    if (actor.role === 'customer') {
      if (existing.customer_id !== actor.userId) {
        throw new Error('Not authorized to update this booking');
      }
      if (status !== 'cancelled') {
        throw new Error('الزبون يمكنه إلغاء الحجز فقط');
      }
      if (oldStatus !== 'pending') {
        throw new Error('بعد تأكيد الحجز لا يمكن الإلغاء من لوحتك — تواصل مع الشريك أو الدعم');
      }
    } else if (actor.role === 'owner') {
      const equipment = await this.equipmentService.getById(existing.equipment_id);
      if (equipment.owner_id !== actor.userId) {
        throw new Error('Not authorized to update this booking');
      }
      // Lifecycle on existing bookings stays allowed when sub expires;
      // market visibility / new listings are gated elsewhere.
    } else if (actor.role !== 'admin') {
      throw new Error('Not authorized to update this booking');
    }

    // Status transition matrix (admin emergency cancel already restricted upstream)
    if (oldStatus === status) {
      return existing;
    }
    if (oldStatus === 'cancelled' || oldStatus === 'completed') {
      throw new Error('لا يمكن تغيير حالة حجز ملغي أو مكتمل');
    }
    if (status === 'confirmed' && oldStatus !== 'pending') {
      throw new Error('لا يمكن تأكيد حجز إلا وهو بانتظار الموافقة');
    }
    if (status === 'completed' && oldStatus !== 'confirmed') {
      throw new Error('لا يمكن إكمال حجز إلا بعد تأكيده');
    }
    if (status === 'pending') {
      throw new Error('لا يمكن إعادة الحجز إلى حالة الانتظار');
    }
    if (status === 'cancelled' && !['pending', 'confirmed'].includes(oldStatus)) {
      throw new Error('لا يمكن إلغاء هذا الحجز');
    }

    if (status === 'confirmed' && actor.role === 'owner') {
      const pref = String(existing.payment_preference || '').toLowerCase();
      const isCod = pref === 'cash_on_delivery' || pref === 'cash';
      if (!isCod) {
        const pay = await query(
          `
          SELECT status::text AS status, payment_proof
          FROM payments
          WHERE booking_id = $1
          ORDER BY created_at DESC
          LIMIT 1
          `,
          [id]
        );
        const row = pay.rows[0];
        const st = String(row?.status || '');
        const hasProof = Boolean(row?.payment_proof);
        if (!hasProof || !['under_review', 'proof_uploaded', 'approved', 'paid', 'completed'].includes(st)) {
          throw new Error('لا يمكن تأكيد الحجز بدون إثبات تحويل قيد المراجعة أو مقبول');
        }
      }
    }

    if (status === 'completed' && actor.role === 'owner') {
      const full = await query(
        `SELECT delivery_requested, delivery_status, return_requested, return_status
         FROM bookings WHERE id = $1 LIMIT 1`,
        [id]
      );
      const row = full.rows[0];
      if (row?.delivery_requested) {
        const ds = String(row.delivery_status || '');
        if (ds !== 'delivered') {
          throw new Error('لا يمكن إكمال الحجز قبل إتمام تسليم التوصيل للزبون');
        }
      }
      // Always require return handoff so equipment is not freed while still with customer
      if (!row?.return_requested || String(row.return_status || '') !== 'delivered') {
        throw new Error(
          'أكمل استرجاع المعدة قبل إكمال الإيجار: اطلب الاسترجاع ثم سجّل «استرجعت بنفسي» أو أكمل مندوب الاسترجاع'
        );
      }
    }

    const cancelReason =
      status === 'cancelled' && opts?.reason
        ? String(opts.reason).trim().slice(0, 500)
        : null;
    const adminNote =
      actor.role === 'admin' && opts?.reason
        ? String(opts.reason).trim().slice(0, 500)
        : null;

    const res = await query(
      `
      UPDATE bookings SET
        status = $1::booking_status,
        cancel_reason = CASE
          WHEN $1::booking_status = 'cancelled' AND $3::text IS NOT NULL AND $3::text <> '' THEN $3::text
          WHEN $1::booking_status = 'cancelled' THEN cancel_reason
          ELSE cancel_reason
        END,
        admin_notes = CASE
          WHEN $4::text IS NOT NULL AND $4::text <> '' THEN
            TRIM(BOTH FROM COALESCE(admin_notes, '') ||
              CASE WHEN COALESCE(admin_notes, '') = '' THEN '' ELSE E'\n' END ||
              $4::text)
          ELSE admin_notes
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `,
      [status, id, cancelReason, adminNote]
    );
    if (res.rows.length === 0) {
      throw new Error('Booking not found');
    }
    const booking = rowToBooking(res.rows[0]);

    const equipment = await this.equipmentService.getById(booking.equipment_id);

    if (status === 'confirmed') {
      await this.notificationService.create({
        user_id: booking.customer_id,
        type: 'booking_confirmed',
        title: 'تم تأكيد الحجز',
        message: `تم تأكيد حجزك لـ «${equipment.title}».`,
        related_id: booking.id,
      });
      try {
        // Single-unit listings only: multi-stock stays "available" while any unit remains
        const qty = Math.max(1, Number((equipment as { quantity?: number }).quantity ?? 1) || 1);
        if (qty <= 1) {
          await query(
            `UPDATE equipment SET status = 'rented'::equipment_status WHERE id = $1 AND status = 'available'::equipment_status`,
            [booking.equipment_id]
          );
        }
      } catch {
        // enum may not have rented in all envs — ignore
      }
    } else if (status === 'cancelled') {
      const reasonSuffix = booking.cancel_reason
        ? ` السبب: ${booking.cancel_reason}`
        : cancelReason
          ? ` السبب: ${cancelReason}`
          : '';
      await this.notificationService.create({
        user_id: booking.customer_id,
        type: 'booking_cancelled',
        title: 'تم إلغاء الحجز',
        message: `أُلغي حجزك لـ «${equipment.title}».${reasonSuffix}`,
        related_id: booking.id,
      });
      await this.notificationService.create({
        user_id: equipment.owner_id,
        type: 'booking_cancelled',
        title: 'تم إلغاء حجز',
        message: `أُلغي الحجز على «${equipment.title}».${reasonSuffix}`,
        related_id: booking.id,
      });
      try {
        await this.paymentService.settleOnBookingCancel(
          booking.id,
          cancelReason || booking.cancel_reason || 'إلغاء الحجز'
        );
      } catch (e) {
        console.warn('[booking] cancel payment settle failed', e instanceof Error ? e.message : e);
      }
      await this.releaseEquipmentIfIdle(booking.equipment_id);
    } else if (status === 'completed') {
      await this.notificationService.create({
        user_id: booking.customer_id,
        type: 'system',
        title: 'اكتمل الإيجار',
        message: `اكتمل إيجار «${equipment.title}». يمكنك تقييم تجربتك من لوحة الحجوزات.`,
        related_id: booking.id,
      });
      try {
        await query(
          `
          UPDATE payments
          SET status = 'approved'::payment_status,
              notes = COALESCE(notes, '') || $1,
              updated_at = NOW()
          WHERE booking_id = $2
            AND method = 'cash'::payment_method
            AND status IN ('pending'::payment_status, 'under_review'::payment_status)
          `,
          [
            actor.role === 'admin'
              ? ' | اعتماد COD عند إكمال إداري'
              : ' | اعتماد COD عند إكمال الإيجار / استلام النقد',
            booking.id,
          ]
        );
      } catch {
        // non-blocking
      }
      if (actor.role === 'admin') {
        try {
          await this.notificationService.create({
            user_id: equipment.owner_id,
            type: 'system',
            title: 'إكمال إداري لحجز',
            message: `أُكمل حجز «${equipment.title}» من الإدارة${adminNote ? `: ${adminNote}` : ''}.`,
            related_id: booking.id,
          });
        } catch {
          // non-blocking
        }
      }
      await this.releaseEquipmentIfIdle(booking.equipment_id);
    }

    // Partner confirm/reject also settles the booking payment review when applicable
    if (actor.role === 'owner' && (status === 'confirmed' || status === 'cancelled')) {
      try {
        await this.paymentService.ownerReviewByBooking(
          booking.id,
          actor.userId,
          status === 'confirmed',
          status === 'confirmed'
            ? 'موافقة الشريك على الحجز والدفع'
            : cancelReason || booking.cancel_reason || 'رفض الشريك للحجز'
        );
      } catch (e) {
        console.warn('[booking] owner payment review failed', e instanceof Error ? e.message : e);
      }
    }

    return booking;
  }

  /** Mark equipment available only when no other confirmed booking still holds it. */
  private async releaseEquipmentIfIdle(equipmentId: string): Promise<void> {
    try {
      const active = await query(
        `SELECT 1 FROM bookings WHERE equipment_id = $1 AND status = 'confirmed' LIMIT 1`,
        [equipmentId]
      );
      if (active.rows.length > 0) return;
      await query(`UPDATE equipment SET status = 'available'::equipment_status WHERE id = $1`, [equipmentId]);
    } catch {
      // ignore enum / race
    }
  }

  async getByCustomer(customerId: string): Promise<any[]> {
    await this.expireStalePending();
    const res = await query(
      `
      SELECT b.*, e.title as equipment_title, u.name as owner_name, u.phone as owner_phone, e.location as equipment_location,
             e.pickup_lat AS equipment_pickup_lat, e.pickup_lng AS equipment_pickup_lng,
             c.name AS courier_name, c.phone AS courier_phone,
             rc.name AS return_courier_name, rc.phone AS return_courier_phone,
             p.status::text AS payment_status,
             p.notes AS payment_notes,
             p.payment_proof AS payment_proof,
             p.method::text AS payment_method,
             EXISTS (
               SELECT 1 FROM reviews r
               WHERE r.booking_id = b.id OR (r.equipment_id = b.equipment_id AND r.reviewer_id = b.customer_id)
             ) AS has_review
      FROM bookings b
      JOIN equipment e ON b.equipment_id = e.id
      JOIN users u ON e.owner_id = u.id
      LEFT JOIN couriers c ON c.id = b.assigned_courier_id
      LEFT JOIN couriers rc ON rc.id = b.return_courier_id
      LEFT JOIN LATERAL (
        SELECT status, notes, payment_proof, method
        FROM payments
        WHERE booking_id = b.id
        ORDER BY created_at DESC
        LIMIT 1
      ) p ON TRUE
      WHERE b.customer_id = $1 
      ORDER BY b.start_date DESC
      `,
      [customerId]
    );
    return res.rows;
  }

  async getByEquipment(equipmentId: string): Promise<any[]> {
    const res = await query(`
      SELECT b.*, u.name as customer_name
      FROM bookings b
      JOIN users u ON b.customer_id = u.id
      WHERE b.equipment_id = $1 
      ORDER BY b.start_date DESC
    `, [equipmentId]);
    return res.rows;
  }
  async getById(id: string): Promise<Booking> {
    const res = await query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (res.rows.length === 0) throw new Error('Booking not found');
    return rowToBooking(res.rows[0]);
  }

  async getByOwner(ownerId: string): Promise<any[]> {
    await this.expireStalePending();
    const res = await query(
      `
      SELECT b.*, e.title as equipment_title, u.name as customer_name,
             p.id AS payment_id,
             p.payment_proof AS payment_proof,
             p.method::text AS payment_db_method,
             p.status::text AS payment_status,
             p.notes AS payment_notes,
             p.commission AS payment_commission,
             p.owner_amount AS payment_owner_amount,
             c.name AS courier_name,
             c.phone AS courier_phone,
             rc.name AS return_courier_name
      FROM bookings b
      JOIN equipment e ON b.equipment_id = e.id
      JOIN users u ON b.customer_id = u.id
      LEFT JOIN couriers c ON c.id = b.assigned_courier_id
      LEFT JOIN couriers rc ON rc.id = b.return_courier_id
      LEFT JOIN LATERAL (
        SELECT id, payment_proof, method, status, notes, commission, owner_amount
        FROM payments
        WHERE booking_id = b.id
        ORDER BY created_at DESC
        LIMIT 1
      ) p ON TRUE
      WHERE e.owner_id = $1
      ORDER BY b.created_at DESC
      `,
      [ownerId]
    );
    return res.rows;
  }
}
