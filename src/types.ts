export type UserRole = 'customer' | 'owner' | 'admin' | 'courier';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  created_at?: string;
  subscription_status?: 'pending' | 'active' | 'expired';
  subscription_end_date?: string | null;
}

export interface Equipment {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  price_per_day: number;
  location: string;
  images: string[];
  status: 'available' | 'rented' | 'maintenance' | 'hidden';
  average_rating: number;
  review_count: number;
  created_at: string;
}

export interface Booking {
  id: string;
  equipment_id: string;
  customer_id: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled' | 'completed';
  location?: string;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  status: 'pending' | 'completed' | 'failed' | 'under_review' | 'approved' | 'rejected' | 'paid' | 'proof_uploaded';
  method: string;
  transaction_id?: string;
  payment_proof?: string;
  description?: string;
  due_date?: string;
  created_at: string;
  // Joins
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  booking_id?: string;
  processed_by?: string;
  processed_at?: string;
  rejection_reason?: string;
}
