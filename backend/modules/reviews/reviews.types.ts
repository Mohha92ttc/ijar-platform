export interface Review {
  id: string;
  booking_id: string;
  equipment_id: string;
  owner_id: string;
  customer_id: string;
  rating: number;
  comment?: string;
  created_at: Date;
}

export interface CreateReviewDTO {
  booking_id: string;
  rating: number;
  comment?: string;
}

export interface EquipmentRatingStats {
  average_rating: number;
  review_count: number;
}
