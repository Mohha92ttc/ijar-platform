export type PaymentStatus = 'pending' | 'proof_uploaded' | 'under_review' | 'approved' | 'rejected' | 'refunded';
export type PaymentMethod = 'stripe' | 'manual' | 'wallet';

export interface Payment {
  id: string;
  booking_id: string;
  customer_id: string;
  owner_id: string;
  transaction_id?: string;
  amount: number;
  commission: number;
  owner_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  proof_image?: string;
  transfer_phone?: string;
  transfer_card?: string;
  notes?: string;
  created_at: Date;
}

export interface CreatePaymentDTO {
  booking_id: string;
  payment_method: PaymentMethod;
  amount: number;
  // For manual payments
  proof_image?: string;
  transfer_phone?: string;
  transfer_card?: string;
  notes?: string;
}

export interface OwnerPaymentSettings {
  owner_id: string;
  phone_number?: string;
  bank_account?: string;
  card_number?: string;
  wallet_number?: string;
}

export interface PaymentResponse {
  success: boolean;
  payment_id: string;
  status: PaymentStatus;
  message?: string;
  transaction_url?: string; // For Stripe/external
}
