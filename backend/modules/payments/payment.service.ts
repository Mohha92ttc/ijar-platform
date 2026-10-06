import crypto from 'crypto';
import { PaymentRepository } from './payment.repository';
import { IPaymentProvider } from './payment.provider';
import { StripeProvider } from './providers/stripe.provider';
import { ManualProvider } from './providers/manual.provider';
import { CreatePaymentDTO, Payment, PaymentStatus, OwnerPaymentSettings } from './payment.types';
import { NotificationService } from '../notifications/notification.service';
import { query } from '../../database/connection';
import { saveProofImage } from '../../services/upload.service';

export class PaymentService {
  private repository: PaymentRepository;
  private providers: Map<string, IPaymentProvider>;
  private notificationService: NotificationService;

  constructor() {
    this.repository = new PaymentRepository();
    this.notificationService = new NotificationService();
    this.providers = new Map();
    this.registerProvider(new StripeProvider());
    this.registerProvider(new ManualProvider());
  }

  private registerProvider(provider: IPaymentProvider) {
    this.providers.set(provider.name, provider);
  }

  private async getCommissionRate(): Promise<number> {
    const res = await query(`SELECT commission_rate FROM platform_settings WHERE id = 1`);
    const rate = Number(res.rows[0]?.commission_rate);
    if (Number.isFinite(rate) && rate >= 0 && rate <= 1) return rate;
    return 0.1;
  }

  private async resolveBookingParticipants(
    bookingId: string
  ): Promise<{ customerId: string; ownerId: string; totalAmount: number }> {
    const result = await query(
      `
      SELECT b.customer_id, e.owner_id, b.total_amount
      FROM bookings b
      JOIN equipment e ON e.id = b.equipment_id
      WHERE b.id = $1
      LIMIT 1
      `,
      [bookingId]
    );
    if (result.rows.length === 0) {
      throw new Error('Booking not found for payment');
    }
    return {
      customerId: String(result.rows[0].customer_id),
      ownerId: String(result.rows[0].owner_id),
      totalAmount: Number(result.rows[0].total_amount || 0),
    };
  }

  async initiatePayment(customerId: string, ownerId: string, data: CreatePaymentDTO): Promise<Payment> {
    // Map UI methods → providers + DB enum values
    const methodMap: Record<string, { provider: string; dbMethod: CreatePaymentDTO['payment_method'] }> = {
      manual: { provider: 'manual', dbMethod: 'manual' },
      stripe: { provider: 'stripe', dbMethod: 'stripe' },
      wallet: { provider: 'manual', dbMethod: 'wallet' },
      zain_cash: { provider: 'manual', dbMethod: 'wallet' },
      asia_hawala: { provider: 'manual', dbMethod: 'bank' },
      cash_on_delivery: { provider: 'manual', dbMethod: 'cash' },
      cash: { provider: 'manual', dbMethod: 'cash' },
      bank: { provider: 'manual', dbMethod: 'bank' },
      online: { provider: 'manual', dbMethod: 'online' },
      visa: { provider: 'manual', dbMethod: 'visa' },
    };
    const mapped = methodMap[String(data.payment_method)] || methodMap.manual;
    const provider = this.providers.get(mapped.provider);
    if (!provider) {
      throw new Error(`Payment method ${data.payment_method} not supported`);
    }

    // Check for duplicate / blocking payment for this booking
    const existing = await this.repository.findByBookingId(data.booking_id);
    const existingStatus = String(existing?.payment_status || '');
    if (existing && ['approved', 'paid', 'completed'].includes(existingStatus)) {
      throw new Error('Payment already exists for this booking');
    }
    // Allow replace when rejected/failed OR still under_review (wrong proof)
    const reuseId =
      existing && ['rejected', 'failed', 'under_review', 'proof_uploaded', 'pending'].includes(existingStatus)
        ? String(existing.id)
        : null;
    if (existing && !reuseId) {
      throw new Error('Payment already exists for this booking');
    }

    const bookingParticipants = await this.resolveBookingParticipants(data.booking_id);
    const effectiveCustomerId = customerId || bookingParticipants.customerId;
    const effectiveOwnerId = ownerId || bookingParticipants.ownerId;
    // Trust server booking total — ignore client-sent amount for underpay/overpay
    const trustedAmount = Math.max(0, Number(bookingParticipants.totalAmount) || 0);
    if (trustedAmount <= 0) {
      throw new Error('مبلغ الحجز غير صالح');
    }

    const commissionRate = await this.getCommissionRate();
    const commission = trustedAmount * commissionRate;
    const ownerAmount = trustedAmount - commission;

    let proofPath = data.proof_image || (data as { payment_proof?: string }).payment_proof;
    if (proofPath && String(proofPath).startsWith('data:')) {
      proofPath = await saveProofImage(String(proofPath), 'booking_proof');
    }

    const methodKey = String(data.payment_method);
    const isCod = methodKey === 'cash_on_delivery' || methodKey === 'cash';
    if (!isCod && (!proofPath || String(proofPath).length < 8)) {
      throw new Error('يرجى إرفاق صورة إثبات التحويل قبل إرسال الطلب');
    }

    const providerPayload = {
      ...data,
      amount: trustedAmount,
      payment_method: mapped.dbMethod as CreatePaymentDTO['payment_method'],
    };
    const providerResponse = await provider.processPayment({ ...providerPayload, proof_image: proofPath });

    // COD stays pending until delivery; transfer+proof → under_review for partner
    let status = providerResponse.status;
    if (isCod) {
      status = 'pending';
    } else if (proofPath) {
      status = 'under_review';
    }

    const payment: Payment = {
      id: reuseId || crypto.randomUUID(),
      booking_id: data.booking_id,
      customer_id: effectiveCustomerId,
      owner_id: effectiveOwnerId,
      transaction_id: providerResponse.payment_id,
      amount: trustedAmount,
      commission: commission,
      owner_amount: ownerAmount,
      payment_method: mapped.dbMethod,
      payment_status: status,
      proof_image: proofPath,
      transfer_phone: data.transfer_phone,
      transfer_card: data.transfer_card,
      notes: data.notes,
      created_at: new Date()
    };

    const saved = await this.repository.save(payment);

    if (!isCod && proofPath && status === 'under_review' && effectiveOwnerId) {
      try {
        await this.notificationService.create({
          user_id: effectiveOwnerId,
          type: 'payment',
          title: reuseId ? 'تم استبدال إثبات الدفع' : 'إثبات دفع جديد',
          message: `الزبون رفع إثبات تحويل للحجز ${data.booking_id}. راجع الصورة من لوحة الطلبات.`,
          related_id: String(data.booking_id),
        });
      } catch {
        // non-blocking
      }
    }

    return saved;
  }

  /**
   * شريك يدفع للمنصة: إعلان مميز أو تجديد اشتراك (بدون حجز).
   */
  async submitPartnerPlatformPayment(
    ownerId: string,
    body: { kind: string; amount: number; payment_proof?: string; notes?: string }
  ): Promise<{ id: string }> {
    const kind = body.kind;
    if (kind !== 'featured_promotion' && kind !== 'subscription_renewal') {
      throw new Error('نوع الطلب غير صالح');
    }
    const settingsRes = await query(
      `SELECT featured_ad_price, subscription_renewal_price FROM platform_settings WHERE id = 1`
    );
    const s = settingsRes.rows[0];
    const expected =
      kind === 'featured_promotion'
        ? Number(s?.featured_ad_price ?? 50000)
        : Number(s?.subscription_renewal_price ?? 100000);
    const amt = Number(body.amount);
    if (!Number.isFinite(amt) || Math.abs(amt - expected) > 0.01) {
      throw new Error(`المبلغ يجب أن يطابق السعر المعلن (${expected} د.ع)`);
    }
    if (!body.payment_proof || String(body.payment_proof).length < 20) {
      throw new Error('يرجى إرفاق صورة إثبات التحويل');
    }
    // Store on disk — never keep base64 blobs in DB
    const proofUrl = String(body.payment_proof).startsWith('/uploads/')
      ? String(body.payment_proof)
      : await saveProofImage(String(body.payment_proof), kind);

    const id = crypto.randomUUID();
    await this.repository.insertPartnerServicePayment({
      id,
      userId: ownerId,
      type: kind,
      amount: amt,
      paymentProof: proofUrl,
      notes: body.notes,
    });

    const kindLabel = kind === 'featured_promotion' ? 'إعلان مميز' : 'تجديد اشتراك';
    const ownerRes = await query(`SELECT name, email FROM users WHERE id = $1`, [ownerId]);
    const ownerName = String(ownerRes.rows[0]?.name || 'شريك');
    const ownerEmail = String(ownerRes.rows[0]?.email || '');

    await this.notificationService.notifyAdmins({
      type: 'payment',
      title: `طلب دفع شريك معلّق — ${kindLabel}`,
      message: `${ownerName} (${ownerEmail}) أرسل إثبات دفع بمبلغ ${amt.toLocaleString()} د.ع وبانتظار المراجعة.`,
      related_id: id,
    });

    await this.notificationService.create({
      user_id: ownerId,
      type: 'payment',
      title: 'تم استلام طلب الدفع',
      message: `طلب ${kindLabel} قيد المراجعة لدى الإدارة. المبلغ: ${amt.toLocaleString()} د.ع.`,
      related_id: id,
    });

    return { id };
  }

  async adminReview(
    paymentId: string,
    approve: boolean,
    adminNotes?: string,
    actorUserId?: string
  ): Promise<void> {
    const payment = await this.repository.findById(paymentId);
    if (!payment) throw new Error('Payment not found');

    const raw = payment as Payment & Record<string, unknown>;
    const status = String(raw.status ?? payment.payment_status);
    if (!['under_review', 'pending', 'proof_uploaded'].includes(status)) {
      throw new Error('Payment is not under review');
    }

    const paymentType = String(raw.type ?? 'booking');
    const bookingId = payment.booking_id ? String(payment.booking_id) : '';

    if (approve) {
      await this.repository.updateStatus(paymentId, 'approved');

      if (paymentType === 'featured_promotion') {
        const settingsRes = await query(`SELECT featured_duration_days FROM platform_settings WHERE id = 1`);
        const days = Math.max(1, parseInt(String(settingsRes.rows[0]?.featured_duration_days ?? 30), 10));
        const uid = String(raw.user_id ?? payment.customer_id);
        await query(
          `UPDATE users SET featured_until = NOW() + ($1::int * INTERVAL '1 day'),
            featured_priority = GREATEST(COALESCE(featured_priority, 0), 10)
           WHERE id = $2`,
          [days, uid]
        );
        await this.notificationService.create({
          user_id: uid,
          type: 'system',
          title: 'تم تفعيل الإعلان المميز',
          message: `تمت الموافقة على طلب الإعلان المميز. ستظهر معداتك في مقدمة القائمة لمدة ${days} يوماً.`,
          related_id: paymentId,
        });
        return;
      }

      if (paymentType === 'subscription_renewal' || paymentType === 'subscription') {
        const uid = String(raw.user_id ?? payment.customer_id);
        const monthsRes = await query(
          `SELECT COALESCE(subscription_duration_months, 1) AS months FROM platform_settings WHERE id = 1`
        );
        const months = Math.max(1, Math.min(36, parseInt(String(monthsRes.rows[0]?.months ?? 1), 10) || 1));
        await query(
          `
          UPDATE users
          SET subscription_end_date = GREATEST(COALESCE(subscription_end_date, NOW()), NOW()) + ($2::int * INTERVAL '1 month'),
              subscription_status = 'active',
              is_approved = TRUE
          WHERE id = $1
          `,
          [uid, months]
        );
        await this.notificationService.create({
          user_id: uid,
          type: 'system',
          title: 'تم تفعيل الاشتراك',
          message: `تمت الموافقة على دفع الاشتراك لمدة ${months} شهر. معداتك ظهرت في السوق من جديد ولوحة التحكم كاملة.`,
          related_id: paymentId,
        });
        return;
      }

      // دفع حجز: الموافقة على الإثبات فقط — تأكيد الحجز يبقى للشريك
      if (bookingId) {
        await this.notificationService.create({
          user_id: payment.owner_id,
          type: 'system',
          title: 'تم التحقق من إثبات الدفع',
          message: `تم قبول إثبات دفع الحجز ${bookingId}. أكّد أو ارفض الحجز من لوحة الشريك.`,
          related_id: payment.id,
        });
        await this.notificationService.create({
          user_id: payment.customer_id,
          type: 'system',
          title: 'تم التحقق من الدفع',
          message: `تم قبول إثبات الدفع للحجز ${bookingId}. بانتظار تأكيد الشريك للحجز.`,
          related_id: payment.id,
        });
        return;
      }

      await this.notificationService.create({
        user_id: payment.customer_id,
        type: 'system',
        title: 'تمت الموافقة على الدفع',
        message: 'تمت الموافقة على دفعتك.',
        related_id: payment.id,
      });
      return;
    }

    // —— رفض ——
    if (paymentType === 'featured_promotion' || paymentType === 'subscription_renewal' || paymentType === 'subscription') {
      await this.repository.updateStatus(paymentId, 'rejected');
      const uid = String(raw.user_id ?? payment.customer_id);
      await this.notificationService.create({
        user_id: uid,
        type: 'system',
        title: 'تم رفض طلب الدفع',
        message: `تم رفض الطلب. ${adminNotes || ''}`,
        related_id: paymentId,
      });
      return;
    }

    // رفض دفعة حجز: إلغاء عبر BookingService (سبب + تسوية استرداد) لا SQL أعمى
    if (bookingId && actorUserId) {
      try {
        const { BookingService } = await import('../bookings/bookings.service');
        const bookingService = new BookingService();
        const existing = await bookingService.getById(bookingId);
        if (existing.status === 'pending' || existing.status === 'confirmed') {
          await bookingService.updateStatus(
            bookingId,
            'cancelled',
            { userId: actorUserId, role: 'admin' },
            { reason: String(adminNotes || '').trim() || 'رفض إداري لإثبات الدفع' }
          );
          return;
        }
      } catch (e) {
        console.warn('[payment] booking cancel via BookingService failed', e instanceof Error ? e.message : e);
      }
      try {
        await this.settleOnBookingCancel(bookingId, adminNotes || 'رفض الدفعة');
        return;
      } catch (e) {
        console.warn('[payment] settleOnBookingCancel failed', e instanceof Error ? e.message : e);
      }
    }

    await this.repository.updateStatus(paymentId, 'rejected');
    if (bookingId) {
      await this.notificationService.create({
        user_id: payment.customer_id,
        type: 'system',
        title: 'تم رفض الدفع',
        message: `تم رفض دفعتك للحجز ${bookingId}. السبب: ${adminNotes || 'غير محدد'}`,
        related_id: payment.id,
      });
      if (payment.owner_id) {
        await this.notificationService.create({
          user_id: payment.owner_id,
          type: 'system',
          title: 'رُفضت دفعة حجز',
          message: `رُفضت دفعة الزبون للحجز ${bookingId}.`,
          related_id: payment.id,
        });
      }
    }
  }

  /**
   * Partner reviews transfer proof for a booking payment when confirming/rejecting the booking.
   * No-op if there is no payment row, or COD still pending without proof.
   */
  async ownerReviewByBooking(bookingId: string, ownerId: string, approve: boolean, notes?: string): Promise<void> {
    const payment = await this.repository.findByBookingId(bookingId);
    if (!payment) return;
    const raw = payment as Payment & Record<string, unknown>;
    if (String(raw.owner_id || payment.owner_id) !== ownerId) {
      throw new Error('غير مصرح بمراجعة هذه الدفعة');
    }
    const status = String(raw.status ?? payment.payment_status);
    if (!['under_review', 'pending', 'proof_uploaded'].includes(status)) {
      return;
    }
    if (status === 'pending' && approve) {
      const method = String(raw.method ?? payment.payment_method ?? '').toLowerCase();
      const isCod = method === 'cash' || method === 'cash_on_delivery';
      if (!isCod) return;
      // COD with delivery: cash collected at handoff — leave pending until delivered
      const bid = String(raw.booking_id || payment.booking_id || '');
      if (bid) {
        const b = await query(`SELECT delivery_requested FROM bookings WHERE id = $1 LIMIT 1`, [bid]);
        if (b.rows[0]?.delivery_requested) return;
      }
    }

    const paymentId = String(raw.id || payment.id);
    if (approve) {
      // الحجز مؤكد مسبقاً من BookingService — لا تعِد رسائل «بانتظار تأكيد الشريك»
      await this.repository.updateStatus(paymentId, 'approved');
      if (notes) {
        await query(`UPDATE payments SET notes = COALESCE(notes,'') || $1 WHERE id = $2`, [` | ${notes}`, paymentId]);
      }
      return;
    }

    await this.adminReview(paymentId, false, notes || 'رفض الشريك', ownerId);
  }

  /** On cancel: reject open reviews; mark approved as refunded (manual settlement). */
  async settleOnBookingCancel(bookingId: string, note?: string): Promise<void> {
    const payment = await this.repository.findByBookingId(bookingId);
    if (!payment) return;
    const raw = payment as Payment & Record<string, unknown>;
    const st = String(raw.status ?? payment.payment_status);
    const id = String(raw.id || payment.id);
    if (['under_review', 'pending', 'proof_uploaded'].includes(st)) {
      await this.repository.updateStatus(id, 'rejected');
      await query(`UPDATE payments SET notes = COALESCE(notes,'') || $1 WHERE id = $2`, [
        ` | ${note || 'إلغاء الحجز'}`,
        id,
      ]);
      return;
    }
    if (['approved', 'paid', 'completed'].includes(st)) {
      try {
        await query(
          `UPDATE payments SET status = 'refunded'::payment_status, notes = COALESCE(notes,'') || $1, updated_at = NOW() WHERE id = $2`,
          [` | ${note || 'بانتظار استرداد بعد إلغاء الحجز'}`, id]
        );
        const ownerId = String(raw.owner_id || payment.owner_id || '');
        const customerId = String(raw.customer_id || payment.customer_id || '');
        if (customerId) {
          await this.notificationService.create({
            user_id: customerId,
            type: 'payment',
            title: 'طلب استرداد مبلغ',
            message: 'أُلغي الحجز بعد دفع معتمد. الاسترداد يدوي — سنتواصل معك أو مع الشريك لإتمام الإرجاع.',
            related_id: bookingId,
          });
        }
        if (ownerId) {
          await this.notificationService.create({
            user_id: ownerId,
            type: 'payment',
            title: 'استرداد مطلوب بعد إلغاء',
            message: 'حُجز أُلغي بعد دفع معتمد. راجع الزبون وأتمّ الاسترداد يدوياً إن لزم.',
            related_id: bookingId,
          });
        }
        await this.notificationService.notifyAdmins({
          type: 'payment',
          title: 'استرداد معلّق',
          message: `دفعة حجز ${bookingId} بانتظار استرداد يدوي بعد الإلغاء.`,
          related_id: id,
        });
      } catch {
        await this.repository.updateStatus(id, 'rejected');
      }
    }
  }

  async setOwnerPaymentSettings(settings: OwnerPaymentSettings): Promise<void> {
    await this.repository.saveOwnerSettings(settings);
  }

  async getOwnerPaymentSettings(ownerId: string): Promise<OwnerPaymentSettings | undefined> {
    return await this.repository.getOwnerSettings(ownerId);
  }

  async getPaymentsForReview(): Promise<Payment[]> {
    return await this.repository.findAllUnderReview();
  }

  /** Admin marks a refunded payment as manually settled with the customer. */
  async settleRefund(paymentId: string, notes?: string): Promise<void> {
    const payment = await this.repository.findById(paymentId);
    if (!payment) throw new Error('Payment not found');
    const raw = payment as Payment & Record<string, unknown>;
    const st = String(raw.status ?? payment.payment_status);
    if (st !== 'refunded') {
      throw new Error('الدفعة ليست بانتظار استرداد');
    }
    await query(
      `
      UPDATE payments
      SET status = 'completed'::payment_status,
          notes = COALESCE(notes, '') || $1,
          updated_at = NOW()
      WHERE id = $2
      `,
      [` | تم تأكيد الاسترداد${notes ? `: ${notes}` : ''}`, paymentId]
    );
    const customerId = String(raw.customer_id || payment.customer_id || '');
    if (customerId) {
      await this.notificationService.create({
        user_id: customerId,
        type: 'payment',
        title: 'تم استرداد المبلغ',
        message: 'تم تأكيد إتمام استرداد دفعتك بعد إلغاء الحجز.',
        related_id: paymentId,
      });
    }
  }

  async listOwnerBookingEarnings(ownerId: string): Promise<{
    gross: number;
    commission: number;
    net: number;
    count: number;
  }> {
    const res = await query(
      `
      SELECT
        COALESCE(SUM(amount), 0) AS gross,
        COALESCE(SUM(commission), 0) AS commission,
        COALESCE(SUM(owner_amount), 0) AS net,
        COUNT(*)::int AS cnt
      FROM payments
      WHERE owner_id = $1
        AND booking_id IS NOT NULL
        AND status IN ('approved', 'paid', 'completed', 'under_review', 'pending', 'proof_uploaded')
      `,
      [ownerId]
    );
    const row = res.rows[0] || {};
    return {
      gross: Number(row.gross || 0),
      commission: Number(row.commission || 0),
      net: Number(row.net || 0),
      count: Number(row.cnt || 0),
    };
  }

  async listMyPlatformPayments(ownerId: string): Promise<any[]> {
    const res = await query(
      `
      SELECT id, amount, type, status, notes, created_at, payment_proof
      FROM payments
      WHERE user_id = $1
        AND type IN ('featured_promotion', 'subscription_renewal', 'subscription')
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [ownerId]
    );
    return res.rows;
  }

  /**
   * Stripe Checkout webhook: mark booking payment approved when session completes.
   */
  async handleStripeCheckoutCompleted(sessionId: string, bookingIdFromMeta?: string): Promise<void> {
    let payment = await this.repository.findByTransactionId(sessionId);
    if (!payment && bookingIdFromMeta) {
      payment = await this.repository.findByBookingId(bookingIdFromMeta);
    }
    if (!payment) {
      console.warn('[stripe webhook] payment not found for session', sessionId);
      return;
    }
    const status = String(payment.payment_status || (payment as Record<string, unknown>).status);
    if (status === 'approved') return;
    await this.adminReview(payment.id, true, 'Stripe Checkout completed');
  }
}
