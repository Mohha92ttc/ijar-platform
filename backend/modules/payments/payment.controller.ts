import { Request, Response } from 'express';
import Stripe from 'stripe';
import { PaymentService } from './payment.service';
import { publicError } from '../../utils/publicError';

export class PaymentController {
  private service: PaymentService;

  constructor() {
    this.service = new PaymentService();
  }

  initiate = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string } }).user;
      if (!actor?.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const payment = await this.service.initiatePayment(actor.userId, '', req.body);
      res.status(201).json(payment);
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل إنشاء الدفع') });
    }
  };

  /** Public — UI shows Stripe option only when available */
  stripeStatus = async (_req: Request, res: Response) => {
    res.status(200).json({ available: this.service.isStripeAvailable() });
  };

  partnerPlatformSubmit = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string } }).user;
      if (!actor?.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const result = await this.service.submitPartnerPlatformPayment(actor.userId, req.body);
      res.status(201).json(result);
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل إرسال طلب الدفع') });
    }
  };

  myPlatformPayments = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string } }).user;
      if (!actor?.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const rows = await this.service.listMyPlatformPayments(actor.userId);
      res.status(200).json(rows);
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل جلب المدفوعات') });
    }
  };

  myBookingEarnings = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string } }).user;
      if (!actor?.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const summary = await this.service.listOwnerBookingEarnings(actor.userId);
      res.status(200).json(summary);
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل جلب الأرباح') });
    }
  };

  ownerSettleRefund = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'owner') {
        return res.status(403).json({ error: 'للشركاء فقط' });
      }
      const notes = req.body?.notes != null ? String(req.body.notes) : undefined;
      await this.service.settleRefund(req.params.id, notes, {
        userId: actor.userId,
        role: 'owner',
      });
      res.status(200).json({ message: 'تم تأكيد الاسترداد' });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل تأكيد الاسترداد') });
    }
  };

  ownerRejectProof = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId || actor.role !== 'owner') {
        return res.status(403).json({ error: 'للشركاء فقط' });
      }
      const bookingId = String(req.params.bookingId || '');
      const notes = req.body?.notes != null ? String(req.body.notes) : undefined;
      await this.service.rejectProofOnly(bookingId, actor.userId, notes);
      res.status(200).json({ message: 'تم رفض الإثبات — الزبون يمكنه إعادة الرفع' });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل رفض الإثبات') });
    }
  };

  review = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { approve, notes } = req.body;
      await this.service.adminReview(id, approve, notes);
      res.status(200).json({ message: `Payment ${approve ? 'approved' : 'rejected'}` });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل مراجعة الدفع') });
    }
  };

  updateOwnerSettings = async (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { user?: { userId?: string } }).user;
      if (!actor?.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      await this.service.setOwnerPaymentSettings({ owner_id: actor.userId, ...req.body });
      res.status(200).json({ message: 'Payment settings updated' });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل تحديث الإعدادات') });
    }
  };

  getOwnerSettings = async (req: Request, res: Response) => {
    try {
      const { ownerId } = req.params;
      const actor = (req as Request & { user?: { userId?: string; role?: string } }).user;
      if (!actor?.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (actor.role === 'owner' && ownerId !== actor.userId) {
        return res.status(403).json({ error: 'Not allowed' });
      }
      const settings = await this.service.getOwnerPaymentSettings(ownerId);
      if (!settings) {
        return res.status(200).json({
          owner_id: ownerId,
          delivery_fee: 0,
          phone_number: '',
          wallet_number: '',
          bank_account: '',
          card_number: '',
          account_holder_name: '',
        });
      }
      res.status(200).json(settings);
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل جلب الإعدادات') });
    }
  };

  /** بيانات عامة للزبون عند الدفع/التوصيل — بدون حساب بنكي كامل */
  getPublicOwnerInfo = async (req: Request, res: Response) => {
    try {
      const { ownerId } = req.params;
      const settings = await this.service.getOwnerPaymentSettings(ownerId);
      res.status(200).json({
        owner_id: ownerId,
        delivery_fee: Number(settings?.delivery_fee ?? 0) || 0,
        phone_number: settings?.phone_number || '',
        wallet_number: settings?.wallet_number || '',
        card_number: settings?.card_number || '',
        bank_account: settings?.bank_account || '',
        account_holder_name: settings?.account_holder_name || '',
        /** aliases */
        mastercard: settings?.card_number || '',
        zain_cash: settings?.wallet_number || '',
      });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل جلب بيانات الشريك') });
    }
  };

  getPendingReviews = async (_req: Request, res: Response) => {
    try {
      const payments = await this.service.getPaymentsForReview();
      res.status(200).json(payments);
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل جلب المدفوعات') });
    }
  };

  /**
   * Stripe webhook — must receive raw body (mounted in server.ts before json parser).
   */
  stripeWebhook = async (req: Request, res: Response) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!secret || !key?.startsWith('sk_')) {
      return res.status(503).json({ error: 'Stripe webhook not configured' });
    }
    try {
      const stripe = new Stripe(key);
      const sig = req.headers['stripe-signature'];
      if (!sig || Array.isArray(sig)) {
        return res.status(400).json({ error: 'Missing stripe-signature' });
      }
      const raw = req.body as Buffer;
      const event = stripe.webhooks.constructEvent(raw, sig, secret);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.booking_id;
        await this.service.handleStripeCheckoutCompleted(session.id, bookingId);
      }
      res.status(200).json({ received: true });
    } catch (error: unknown) {
      console.error('[stripe webhook]', error);
      res.status(400).json({ error: publicError(error, 'Webhook verification failed') });
    }
  };
}
