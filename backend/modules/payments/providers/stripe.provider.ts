import crypto from 'crypto';
import Stripe from 'stripe';
import { IPaymentProvider } from '../payment.provider';
import { CreatePaymentDTO, PaymentResponse } from '../payment.types';

/**
 * Real Stripe when STRIPE_SECRET_KEY is set; otherwise refuses in production
 * and returns a clearly labeled unavailable response in development.
 */
export class StripeProvider implements IPaymentProvider {
  name = 'stripe';
  private stripe: Stripe | null = null;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key && key.startsWith('sk_')) {
      this.stripe = new Stripe(key);
    }
  }

  async processPayment(data: CreatePaymentDTO): Promise<PaymentResponse> {
    if (!this.stripe) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Stripe غير مُعدّ. اضبط STRIPE_SECRET_KEY أو استخدم التحويل اليدوي.');
      }
      return {
        success: false,
        payment_id: `stripe_unavailable_${crypto.randomBytes(6).toString('hex')}`,
        status: 'pending',
        transaction_url: undefined,
      };
    }

    const currency = (process.env.STRIPE_CURRENCY || 'usd').toLowerCase();
    const amountMinor = Math.round(Number(data.amount) * 100);
    if (!Number.isFinite(amountMinor) || amountMinor < 50) {
      throw new Error('مبلغ Stripe غير صالح');
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      success_url:
        process.env.STRIPE_SUCCESS_URL ||
        `${process.env.APP_URL || 'http://localhost:5173'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        process.env.STRIPE_CANCEL_URL ||
        `${process.env.APP_URL || 'http://localhost:5173'}/payment/cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amountMinor,
            product_data: {
              name: `حجز ${data.booking_id}`,
            },
          },
        },
      ],
      metadata: {
        booking_id: data.booking_id,
      },
    });

    return {
      success: true,
      payment_id: session.id,
      status: 'pending',
      transaction_url: session.url || undefined,
    };
  }

  async refundPayment(paymentId: string): Promise<boolean> {
    if (!this.stripe) {
      throw new Error('Stripe غير مُعدّ');
    }
    const session = await this.stripe.checkout.sessions.retrieve(paymentId);
    const pi =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!pi) return false;
    await this.stripe.refunds.create({ payment_intent: pi });
    return true;
  }
}
