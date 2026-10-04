import { query } from '../../database/connection';
import { Payment, OwnerPaymentSettings, PaymentStatus } from './payment.types';

/**
 * Database Schema for Payments (Reference)
 * 
 * CREATE TABLE IF NOT EXISTS payments (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     booking_id UUID NOT NULL REFERENCES bookings(id),
 *     customer_id UUID NOT NULL REFERENCES users(id),
 *     owner_id UUID NOT NULL REFERENCES users(id),
 *     amount DECIMAL(10, 2) NOT NULL,
 *     commission DECIMAL(10, 2) NOT NULL,
 *     owner_amount DECIMAL(10, 2) NOT NULL,
 *     payment_method VARCHAR(50) NOT NULL,
 *     payment_status payment_status_enum NOT NULL,
 *     proof_image TEXT,
 *     transfer_phone VARCHAR(20),
 *     transfer_card VARCHAR(20),
 *     notes TEXT,
 *     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
 * );
 * 
 * CREATE TABLE IF NOT EXISTS owner_payment_settings (
 *     owner_id UUID PRIMARY KEY REFERENCES users(id),
 *     phone_number VARCHAR(20),
 *     bank_account VARCHAR(50),
 *     card_number VARCHAR(20),
 *     wallet_number VARCHAR(50)
 * );
 */

function mapPaymentRow(row: Record<string, unknown> | undefined): (Payment & Record<string, unknown>) | undefined {
  if (!row) return undefined;
  const uid = String(row.user_id ?? row.customer_id ?? row.owner_id);
  return {
    ...row,
    id: String(row.id),
    payment_status: row.status as Payment['payment_status'],
    payment_method: row.method as Payment['payment_method'],
    proof_image: row.payment_proof as string | undefined,
    booking_id: row.booking_id ? String(row.booking_id) : undefined,
    customer_id: row.customer_id != null ? String(row.customer_id) : uid,
    owner_id: row.owner_id != null ? String(row.owner_id) : uid,
  } as Payment & Record<string, unknown>;
}

export class PaymentRepository {
  async insertPartnerServicePayment(params: {
    id: string;
    userId: string;
    type: string;
    amount: number;
    paymentProof?: string;
    notes?: string;
  }): Promise<void> {
    await query(
      `
      INSERT INTO payments (
        id, user_id, type, booking_id, customer_id, owner_id, amount, commission, owner_amount,
        method, status, payment_proof, notes
      ) VALUES (
        $1, $2, $3, NULL, $2, $2, $4, 0, $4,
        'manual'::payment_method, 'under_review'::payment_status, $5, $6
      )
    `,
      [params.id, params.userId, params.type, params.amount, params.paymentProof ?? null, params.notes ?? null]
    );
  }

  async save(payment: Payment): Promise<Payment> {
    await query(`
      INSERT INTO payments (
        id, user_id, type, booking_id, customer_id, owner_id, amount, commission, 
        owner_amount, method, status, transaction_id, payment_proof, 
        transfer_phone, transfer_card, notes
      ) VALUES ($1, $2, 'booking', $3, $4, $5, $6, $7, $8, $9::payment_method, $10::payment_status, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        transaction_id = EXCLUDED.transaction_id,
        payment_proof = EXCLUDED.payment_proof,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
    `, [
      payment.id, payment.customer_id, payment.booking_id, payment.customer_id, payment.owner_id,
      payment.amount, payment.commission, payment.owner_amount,
      payment.payment_method, payment.payment_status, payment.transaction_id ?? null, payment.proof_image,
      payment.transfer_phone, payment.transfer_card, payment.notes
    ]);
    return payment;
  }

  async findById(id: string): Promise<(Payment & Record<string, unknown>) | undefined> {
    const res = await query('SELECT * FROM payments WHERE id = $1', [id]);
    return mapPaymentRow(res.rows[0]);
  }

  async findByBookingId(bookingId: string): Promise<(Payment & Record<string, unknown>) | undefined> {
    const res = await query(
      `SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [bookingId]
    );
    return mapPaymentRow(res.rows[0]);
  }

  async findByTransactionId(transactionId: string): Promise<(Payment & Record<string, unknown>) | undefined> {
    const res = await query('SELECT * FROM payments WHERE transaction_id = $1 LIMIT 1', [transactionId]);
    return mapPaymentRow(res.rows[0]);
  }

  async updateStatus(id: string, status: PaymentStatus): Promise<void> {
    await query('UPDATE payments SET status = $1::payment_status, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, id]);
  }

  async saveOwnerSettings(settings: OwnerPaymentSettings): Promise<void> {
    await query(`
      INSERT INTO owner_payment_settings (
        owner_id, phone_number, bank_account, card_number, wallet_number,
        delivery_fee, account_holder_name, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (owner_id) DO UPDATE SET
        phone_number = EXCLUDED.phone_number,
        bank_account = EXCLUDED.bank_account,
        card_number = EXCLUDED.card_number,
        wallet_number = EXCLUDED.wallet_number,
        delivery_fee = EXCLUDED.delivery_fee,
        account_holder_name = EXCLUDED.account_holder_name,
        updated_at = CURRENT_TIMESTAMP
    `, [
      settings.owner_id,
      settings.phone_number ?? null,
      settings.bank_account ?? null,
      settings.card_number ?? null,
      settings.wallet_number ?? null,
      Number(settings.delivery_fee ?? 0) || 0,
      settings.account_holder_name ?? null,
    ]);
  }

  async getOwnerSettings(ownerId: string): Promise<OwnerPaymentSettings | undefined> {
    const res = await query('SELECT * FROM owner_payment_settings WHERE owner_id = $1', [ownerId]);
    if (!res.rows[0]) return undefined;
    const r = res.rows[0];
    return {
      owner_id: String(r.owner_id),
      phone_number: r.phone_number ?? undefined,
      bank_account: r.bank_account ?? undefined,
      card_number: r.card_number ?? undefined,
      wallet_number: r.wallet_number ?? undefined,
      account_holder_name: r.account_holder_name ?? undefined,
      delivery_fee: Number(r.delivery_fee ?? 0) || 0,
    };
  }

  async findAllUnderReview(): Promise<Payment[]> {
    const res = await query("SELECT * FROM payments WHERE status = 'under_review' ORDER BY created_at DESC");
    return res.rows;
  }
}
