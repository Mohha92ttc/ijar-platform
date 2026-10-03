export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Booking {
  id: string;
  equipment_id: string;
  customer_id: string;
  start_date: Date;
  end_date: Date;
  total_price: number;
  status: BookingStatus;
  delivery_requested?: boolean;
  delivery_fee?: number;
  payment_preference?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBookingDTO {
  equipment_id: string;
  start_date: string;
  end_date: string;
  location?: string;
  notes?: string;
  customer_phone?: string;
  delivery_requested?: boolean;
  delivery_fee?: number;
  payment_preference?: string;
}

export interface UpdateBookingStatusDTO {
  status: BookingStatus;
}
