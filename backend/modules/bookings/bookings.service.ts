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
    const equipment = await this.equipmentService.getById(data.equipment_id);

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
    const deliveryFee = deliveryRequested ? Math.max(0, Number(data.delivery_fee) || 0) : 0;
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
      title: 'New Booking Request',
      message: `You have a new booking request for ${equipment.title}.`,
      related_id: newBooking.id,
    });

    return newBooking;
  }

  /** true = no overlapping pending/confirmed booking */
  async checkAvailability(equipmentId: string, start: Date, end: Date): Promise<boolean> {
    const res = await query(
      `
      SELECT 1 FROM bookings
      WHERE equipment_id = $1
        AND status IN ('pending', 'confirmed')
        AND start_date < $3 AND end_date > $2
      LIMIT 1
    `,
      [equipmentId, start, end]
    );
    return res.rows.length === 0;
  }

  async updateStatus(id: string, status: BookingStatus, actor: { userId: string; role: string }): Promise<Booking> {
    const existing = await this.getById(id);
    const oldStatus = existing.status;

    if (actor.role === 'customer') {
      if (existing.customer_id !== actor.userId) {
        throw new Error('Not authorized to update this booking');
      }
      if (status !== 'cancelled') {
        throw new Error('الزبون يمكنه إلغاء الحجز فقط');
      }
      if (!['pending', 'confirmed'].includes(oldStatus)) {
        throw new Error('لا يمكن إلغاء هذا الحجز في حالته الحالية');
      }
    } else if (actor.role === 'owner') {
      const equipment = await this.equipmentService.getById(existing.equipment_id);
      if (equipment.owner_id !== actor.userId) {
        throw new Error('Not authorized to update this booking');
      }
    } else if (actor.role !== 'admin') {
      throw new Error('Not authorized to update this booking');
    }

    const res = await query(
      `
      UPDATE bookings SET status = $1::booking_status, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `,
      [status, id]
    );
    if (res.rows.length === 0) {
      throw new Error('Booking not found');
    }
    const booking = rowToBooking(res.rows[0]);

    const equipment = await this.equipmentService.getById(booking.equipment_id);

    if (status === 'confirmed' && oldStatus !== 'confirmed') {
      await this.notificationService.create({
        user_id: booking.customer_id,
        type: 'booking_confirmed',
        title: 'Booking Confirmed',
        message: `Your booking for ${equipment.title} has been confirmed.`,
        related_id: booking.id,
      });
    } else if (status === 'cancelled' && oldStatus !== 'cancelled') {
      await this.notificationService.create({
        user_id: booking.customer_id,
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: `Your booking for ${equipment.title} has been cancelled.`,
        related_id: booking.id,
      });
      await this.notificationService.create({
        user_id: equipment.owner_id,
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: `The booking for ${equipment.title} has been cancelled.`,
        related_id: booking.id,
      });
    }

    // Partner confirm/reject also settles the booking payment review when applicable
    if (actor.role === 'owner' && (status === 'confirmed' || status === 'cancelled')) {
      try {
        await this.paymentService.ownerReviewByBooking(
          booking.id,
          actor.userId,
          status === 'confirmed',
          status === 'confirmed' ? 'موافقة الشريك على الحجز والدفع' : 'رفض الشريك للحجز'
        );
      } catch (e) {
        console.warn('[booking] owner payment review failed', e instanceof Error ? e.message : e);
      }
    }

    return booking;
  }

  async getByCustomer(customerId: string): Promise<any[]> {
    const res = await query(
      `
      SELECT b.*, e.title as equipment_title, u.name as owner_name, e.location as equipment_location,
             c.name AS courier_name, c.phone AS courier_phone,
             p.status::text AS payment_status,
             p.notes AS payment_notes,
             p.payment_proof AS payment_proof,
             EXISTS (
               SELECT 1 FROM reviews r
               WHERE r.booking_id = b.id OR (r.equipment_id = b.equipment_id AND r.reviewer_id = b.customer_id)
             ) AS has_review
      FROM bookings b
      JOIN equipment e ON b.equipment_id = e.id
      JOIN users u ON e.owner_id = u.id
      LEFT JOIN couriers c ON c.id = b.assigned_courier_id
      LEFT JOIN LATERAL (
        SELECT status, notes, payment_proof
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
    const res = await query(
      `
      SELECT b.*, e.title as equipment_title, u.name as customer_name,
             p.payment_proof AS payment_proof,
             p.method::text AS payment_db_method,
             p.status::text AS payment_status,
             p.notes AS payment_notes,
             c.name AS courier_name,
             c.phone AS courier_phone
      FROM bookings b
      JOIN equipment e ON b.equipment_id = e.id
      JOIN users u ON b.customer_id = u.id
      LEFT JOIN couriers c ON c.id = b.assigned_courier_id
      LEFT JOIN LATERAL (
        SELECT payment_proof, method, status, notes
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
