export type PaymentStatus = 'pending' | 'proof_uploaded' | 'under_review' | 'approved' | 'rejected' | 'refunded' | 'paid' | 'failed' | 'completed';
/** Stored in DB enum + client aliases mapped in service */
export type PaymentMethod =
  | 'stripe'
  | 'manual'
  | 'wallet'
  | 'cash'
  | 'bank'
  | 'visa'
  | 'online'
  | 'zain_cash'
  | 'asia_hawala'
  | 'cash_on_delivery';

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
  proof_image?: string;
  transfer_phone?: string;
  transfer_card?: string;
  notes?: string;
}

export interface OwnerPaymentSettings {
  owner_id: string;
  phone_number?: string;
  bank_account?: string;
  /** رقم ماستركارد / فيزا للتحويل */
  card_number?: string;
  /** رقم زين كاش */
  wallet_number?: string;
  /** اسم صاحب الحساب */
  account_holder_name?: string;
  /** رسوم التوصيل بالدينار — 0 مسموح */
  delivery_fee?: number;
}

export interface PaymentResponse {
  success: boolean;
  payment_id: string;
  status: PaymentStatus;
  message?: string;
  transaction_url?: string;
}
