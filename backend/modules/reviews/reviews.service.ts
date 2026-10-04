import { Review, CreateReviewDTO } from './reviews.types';
import { BookingService } from '../bookings/bookings.service';
import { EquipmentService } from '../equipment/equipment.service';
import { NotificationService } from '../notifications/notification.service';
import { query } from '../../database/connection';

function rowToReview(row: Record<string, unknown>): Review {
  return {
    id: String(row.id),
    booking_id: row.booking_id ? String(row.booking_id) : '',
    equipment_id: String(row.equipment_id),
    owner_id: row.owner_id ? String(row.owner_id) : '',
    customer_id: String(row.reviewer_id || row.customer_id || ''),
    rating: Number(row.rating),
    comment: row.comment != null ? String(row.comment) : undefined,
    created_at: new Date(String(row.created_at)),
  };
}

export class ReviewService {
  private bookingService: BookingService;
  private equipmentService: EquipmentService;
  private notificationService: NotificationService;

  constructor() {
    this.bookingService = new BookingService();
    this.equipmentService = new EquipmentService();
    this.notificationService = new NotificationService();
  }

  async create(customerId: string, data: CreateReviewDTO): Promise<Review> {
    const booking = await this.bookingService.getById(data.booking_id);
    if (booking.customer_id !== customerId) {
      throw new Error('غير مصرح بتقييم هذا الحجز');
    }
    if (booking.status !== 'completed') {
      throw new Error('يمكن التقييم فقط بعد اكتمال الحجز');
    }
    const rating = Math.min(5, Math.max(1, Number(data.rating) || 0));
    if (!rating) throw new Error('التقييم مطلوب (1-5)');

    const dup = await query(
      `SELECT id FROM reviews WHERE booking_id = $1 OR (equipment_id = $2 AND reviewer_id = $3) LIMIT 1`,
      [data.booking_id, booking.equipment_id, customerId]
    );
    if (dup.rows[0]) throw new Error('تم إرسال تقييم لهذا الحجز مسبقاً');

    const equipment = await this.equipmentService.getById(booking.equipment_id);

    const ins = await query(
      `
      INSERT INTO reviews (equipment_id, reviewer_id, booking_id, rating, comment)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [booking.equipment_id, customerId, data.booking_id, rating, data.comment || null]
    );

    await this.updateEquipmentRating(booking.equipment_id);

    await this.notificationService.create({
      user_id: equipment.owner_id,
      type: 'new_review',
      title: 'تقييم جديد',
      message: `حصلت على تقييم ${rating} نجوم لـ ${equipment.title}.`,
      related_id: String(ins.rows[0].id),
    });

    return rowToReview({ ...ins.rows[0], owner_id: equipment.owner_id });
  }

  private async updateEquipmentRating(equipmentId: string): Promise<void> {
    const res = await query(
      `
      SELECT COALESCE(AVG(rating), 0) AS avg, COUNT(*)::int AS cnt
      FROM reviews WHERE equipment_id = $1
      `,
      [equipmentId]
    );
    const average = Number(res.rows[0]?.avg || 0);
    const count = Number(res.rows[0]?.cnt || 0);
    await query(
      `
      UPDATE equipment
      SET average_rating = $1, review_count = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      `,
      [average, count, equipmentId]
    );
  }

  async getByEquipment(equipmentId: string): Promise<Review[]> {
    const res = await query(
      `
      SELECT r.*, e.owner_id, u.name AS reviewer_name
      FROM reviews r
      JOIN equipment e ON e.id = r.equipment_id
      LEFT JOIN users u ON u.id = r.reviewer_id
      WHERE r.equipment_id = $1
      ORDER BY r.created_at DESC
      LIMIT 20
      `,
      [equipmentId]
    );
    return res.rows.map((row) => ({
      ...rowToReview(row),
      reviewer_name: row.reviewer_name ? String(row.reviewer_name) : undefined,
    })) as Review[];
  }

  async getByOwner(ownerId: string): Promise<Review[]> {
    const res = await query(
      `
      SELECT r.*, e.owner_id
      FROM reviews r
      JOIN equipment e ON e.id = r.equipment_id
      WHERE e.owner_id = $1
      ORDER BY r.created_at DESC
      `,
      [ownerId]
    );
    return res.rows.map(rowToReview);
  }

  async getById(id: string): Promise<Review> {
    const res = await query(
      `
      SELECT r.*, e.owner_id
      FROM reviews r
      JOIN equipment e ON e.id = r.equipment_id
      WHERE r.id = $1
      `,
      [id]
    );
    if (!res.rows[0]) throw new Error('التقييم غير موجود');
    return rowToReview(res.rows[0]);
  }
}
