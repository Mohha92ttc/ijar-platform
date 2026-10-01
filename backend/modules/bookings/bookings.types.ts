export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Booking {
  id: string;
  equipment_id: string;
  customer_id: string;
  start_date: Date;
  end_date: Date;
  total_price: number;
  status: BookingStatus;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBookingDTO {
  equipment_id: string;
  start_date: string; // ISO string
  end_date: string;   // ISO string
  location?: string;
  notes?: string;
  customer_phone?: string;
}

export interface UpdateBookingStatusDTO {
  status: BookingStatus;
}
