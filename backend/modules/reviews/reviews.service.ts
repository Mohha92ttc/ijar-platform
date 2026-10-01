import { Review, CreateReviewDTO } from './reviews.types';
import { BookingService } from '../bookings/bookings.service';
import { EquipmentService } from '../equipment/equipment.service';
import { NotificationService } from '../notifications/notification.service';
import { query } from '../../database/connection';

// Mocking database interaction
let mockReviews: Review[] = [];

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
    // 1. Validate booking exists and belongs to customer
    const booking = await this.bookingService.getById(data.booking_id);
    if (booking.customer_id !== customerId) {
      throw new Error('Unauthorized to review this booking');
    }

    // 2. Validate booking is completed
    if (booking.status !== 'completed') {
      throw new Error('Can only review completed bookings');
    }

    // 3. Check if review already exists
    const existing = mockReviews.find(r => r.booking_id === data.booking_id);
    if (existing) {
      throw new Error('Review already submitted for this booking');
    }

    // 4. Get equipment details to find owner
    const equipment = await this.equipmentService.getById(booking.equipment_id);

    const newReview: Review = {
      id: Math.random().toString(36).substr(2, 9),
      booking_id: data.booking_id,
      equipment_id: booking.equipment_id,
      owner_id: equipment.owner_id,
      customer_id: customerId,
      rating: data.rating,
      comment: data.comment,
      created_at: new Date()
    };

    mockReviews.push(newReview);

    // 5. Update equipment rating automatically
    await this.updateEquipmentRating(booking.equipment_id);

    // 6. Notify owner about new review
    await this.notificationService.create({
      user_id: equipment.owner_id,
      type: 'new_review',
      title: 'New Review Received',
      message: `You received a ${data.rating}-star review for ${equipment.title}.`,
      related_id: newReview.id
    });

    return newReview;
  }

  private async updateEquipmentRating(equipmentId: string): Promise<void> {
    const equipmentReviews = mockReviews.filter(r => r.equipment_id === equipmentId);
    const count = equipmentReviews.length;
    const sum = equipmentReviews.reduce((acc, r) => acc + r.rating, 0);
    const average = count > 0 ? sum / count : 0;

    // Update derived stats directly; avoids owner-based authorization in equipmentService.
    await query(
      `UPDATE equipment
       SET average_rating = $1,
           review_count = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [average, count, equipmentId]
    );
  }

  async getByEquipment(equipmentId: string): Promise<Review[]> {
    return mockReviews.filter(r => r.equipment_id === equipmentId);
  }

  async getByOwner(ownerId: string): Promise<Review[]> {
    return mockReviews.filter(r => r.owner_id === ownerId);
  }

  async getById(id: string): Promise<Review> {
    const review = mockReviews.find(r => r.id === id);
    if (!review) {
      throw new Error('Review not found');
    }
    return review;
  }
}
